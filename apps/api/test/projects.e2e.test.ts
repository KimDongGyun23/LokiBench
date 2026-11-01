import type { Server } from 'node:net';

import { errorResponseSchema, projectSchema } from '@lokibench/contracts';
import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import type { DataSource } from 'typeorm';

import { ProjectRepository } from '../src/modules/projects/project.repository';
import { createTestApp } from './create-test-app';

let app: INestApplication;
let dataSource: DataSource;
let server: Server;

beforeEach(async () => {
  ({ app, dataSource, server } = await createTestApp());
});

afterEach(async () => {
  await app.close();
});

// 추가 요청을 보내고 계약 모양인지 확인한 프로젝트를 돌려줌
async function addProject(name: string) {
  const response = await request(server).post('/api/projects').send({ name });
  expect(response.status).toBe(201);
  return projectSchema.parse(response.body);
}

async function countProjects() {
  const rows: unknown[] = await dataSource.query('SELECT id FROM projects');
  return rows.length;
}

describe('프로젝트 추가', () => {
  test('입력 실수를 허용하기 위해 앞뒤 공백을 지운 이름으로 저장하고 첫 색 indigo를 준다', async () => {
    // Given: 빈 DB

    // When
    const response = await request(server).post('/api/projects').send({ name: '  독서 기록  ' });

    // Then
    expect(response.status).toBe(201);
    const project = projectSchema.parse(response.body);
    expect(project.name).toBe('독서 기록');
    expect(project.color).toBe('indigo');
    expect(project.archivedAt).toBeNull();
  });

  test('같은 이름이 있으면 409를 주고 행을 늘리지 않는다', async () => {
    // Given
    await addProject('독서 기록');

    // When
    const response = await request(server).post('/api/projects').send({ name: '독서 기록' });

    // Then
    expect(response.status).toBe(409);
    expect(errorResponseSchema.parse(response.body).code).toBe('PROJECT_NAME_TAKEN');
    expect(await countProjects()).toBe(1);
  });

  test('공백만 있는 이름은 VALIDATION으로 준다', async () => {
    // When
    const response = await request(server).post('/api/projects').send({ name: '   ' });

    // Then
    expect(response.status).toBe(400);
    expect(errorResponseSchema.parse(response.body).code).toBe('VALIDATION');
  });

  test('41자 이름은 VALIDATION으로 준다', async () => {
    // When
    const response = await request(server)
      .post('/api/projects')
      .send({ name: '가'.repeat(41) });

    // Then
    expect(response.status).toBe(400);
    expect(errorResponseSchema.parse(response.body).code).toBe('VALIDATION');
  });

  test('색은 서버가 정하므로 요청에 담긴 색은 무시하고 자동 배정한다', async () => {
    // When
    const response = await request(server)
      .post('/api/projects')
      .send({ name: '블로그', color: 'rose' });

    // Then
    expect(response.status).toBe(201);
    expect(projectSchema.parse(response.body).color).toBe('indigo');
  });

  test('색 구분을 넓히기 위해 이미 있는 프로젝트를 보고 팔레트 순서대로 다른 색을 준다', async () => {
    // Given
    await addProject('독서 기록');
    await addProject('가계부');

    // When
    const blog = await addProject('블로그');

    // Then
    const response = await request(server).get('/api/projects');
    const projects = projectSchema.array().parse(response.body);
    expect(projects.map((project) => project.color)).toEqual(['indigo', 'sky', 'teal']);
    expect(blog.color).toBe('teal');
  });

  test('숨겨진 프로젝트 색은 화면에서 겹치지 않으므로 아카이브된 프로젝트의 색도 다시 준다', async () => {
    // Given: 아카이브된 indigo 프로젝트만 있음
    await dataSource.query(
      `INSERT INTO projects (name, color, created_at, archived_at)
       VALUES ('이사 준비', 'indigo', '2026-10-01T00:00:00.000Z', '2026-10-02T00:00:00.000Z')`,
    );

    // When
    const project = await addProject('가계부');

    // Then
    expect(project.color).toBe('indigo');
  });

  test('대소문자가 다르면 다른 이름으로 본다', async () => {
    // Given
    await addProject('Blog');

    // When
    const response = await request(server).post('/api/projects').send({ name: 'blog' });

    // Then
    expect(response.status).toBe(201);
  });

  test('아카이브 해제 때 이름이 겹치지 않도록 아카이브된 프로젝트와 같은 이름도 409를 준다', async () => {
    // Given: 아카이브 기능이 아직 없어서 DB에 직접 넣음
    await dataSource.query(
      `INSERT INTO projects (name, color, created_at, archived_at)
       VALUES ('이사 준비', 'sky', '2026-10-01T00:00:00.000Z', '2026-10-02T00:00:00.000Z')`,
    );

    // When
    const response = await request(server).post('/api/projects').send({ name: '이사 준비' });

    // Then
    expect(response.status).toBe(409);
    expect(errorResponseSchema.parse(response.body).code).toBe('PROJECT_NAME_TAKEN');
    expect(await countProjects()).toBe(1);
  });
});

describe('프로젝트 목록', () => {
  test('추가한 순서대로 준다', async () => {
    // Given
    await addProject('독서 기록');
    await addProject('가계부');
    await addProject('블로그');

    // When
    const response = await request(server).get('/api/projects');

    // Then
    expect(response.status).toBe(200);
    const projects = projectSchema.array().parse(response.body);
    expect(projects.map((project) => project.name)).toEqual(['독서 기록', '가계부', '블로그']);
  });

  test('아카이브된 프로젝트는 목록에서 뺀다', async () => {
    // Given: 아카이브 기능이 아직 없어서 DB에 직접 넣음
    await addProject('가계부');
    await dataSource.query(
      `INSERT INTO projects (name, color, created_at, archived_at)
       VALUES ('이사 준비', 'sky', '2026-10-01T00:00:00.000Z', '2026-10-02T00:00:00.000Z')`,
    );

    // When
    const response = await request(server).get('/api/projects');

    // Then
    const projects = projectSchema.array().parse(response.body);
    expect(projects.map((project) => project.name)).toEqual(['가계부']);
  });
});

describe('프로젝트 수정', () => {
  test('색만 보내면 색만 바꾼다', async () => {
    // Given
    const blog = await addProject('블로그');

    // When
    const response = await request(server)
      .patch(`/api/projects/${String(blog.id)}`)
      .send({ color: 'violet' });

    // Then
    expect(response.status).toBe(200);
    expect(projectSchema.parse(response.body)).toEqual({ ...blog, color: 'violet' });
  });

  test('다른 프로젝트의 이름으로 바꾸면 409를 준다', async () => {
    // Given
    const blog = await addProject('블로그');
    await addProject('가계부');

    // When
    const response = await request(server)
      .patch(`/api/projects/${String(blog.id)}`)
      .send({ name: '가계부' });

    // Then
    expect(response.status).toBe(409);
    expect(errorResponseSchema.parse(response.body).code).toBe('PROJECT_NAME_TAKEN');
  });

  test('자기 이름 그대로 저장은 바뀐 것이 없으므로 성공한다', async () => {
    // Given
    const blog = await addProject('블로그');

    // When
    const response = await request(server)
      .patch(`/api/projects/${String(blog.id)}`)
      .send({ name: '블로그' });

    // Then
    expect(response.status).toBe(200);
    expect(projectSchema.parse(response.body)).toEqual(blog);
  });

  test('없는 프로젝트는 PROJECT_NOT_FOUND로 준다', async () => {
    // When
    const response = await request(server).patch('/api/projects/999').send({ color: 'sky' });

    // Then
    expect(response.status).toBe(404);
    expect(errorResponseSchema.parse(response.body).code).toBe('PROJECT_NOT_FOUND');
  });

  test('빈 수정 요청은 VALIDATION으로 준다', async () => {
    // Given
    const blog = await addProject('블로그');

    // When
    const response = await request(server)
      .patch(`/api/projects/${String(blog.id)}`)
      .send({});

    // Then
    expect(response.status).toBe(400);
    expect(errorResponseSchema.parse(response.body).code).toBe('VALIDATION');
  });

  test('팔레트 밖 색은 VALIDATION으로 준다', async () => {
    // Given
    const blog = await addProject('블로그');

    // When
    const response = await request(server)
      .patch(`/api/projects/${String(blog.id)}`)
      .send({ color: 'emerald' });

    // Then
    expect(response.status).toBe(400);
    expect(errorResponseSchema.parse(response.body).code).toBe('VALIDATION');
  });

  test('숫자가 아닌 id는 VALIDATION으로 준다', async () => {
    // When
    const response = await request(server).patch('/api/projects/abc').send({ color: 'sky' });

    // Then
    expect(response.status).toBe(400);
    expect(errorResponseSchema.parse(response.body).code).toBe('VALIDATION');
  });
});

describe('이름 유일 규칙', () => {
  test('두 탭 동시 추가에 대비하기 위해 service 조회를 지나친 중복도 DB 제약에서 409로 바꾼다', async () => {
    // Given: service 조회 없이 저장소로 직접 같은 이름을 넣음
    const repository = app.get(ProjectRepository);
    await repository.create({ name: '독서 기록', color: 'indigo' });

    // When
    const attempt = repository.create({ name: '독서 기록', color: 'sky' });

    // Then
    await expect(attempt).rejects.toMatchObject({ code: 'PROJECT_NAME_TAKEN' });
  });
});
