import type { Server } from 'node:net';

import { errorResponseSchema, issueSchema, projectSchema } from '@lokibench/shared/contracts';
import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import type { DataSource } from 'typeorm';

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

// 프로젝트를 추가하고 계약 모양인지 확인한 프로젝트를 돌려줌
async function addProject(name: string) {
  const response = await request(server).post('/api/projects').send({ name });
  expect(response.status).toBe(201);
  return projectSchema.parse(response.body);
}

// 이슈를 추가하고 계약 모양인지 확인한 이슈를 돌려줌
async function addIssue(projectId: number, title: string) {
  const response = await request(server).post('/api/issues').send({ projectId, title });
  expect(response.status).toBe(201);
  return issueSchema.parse(response.body);
}

// 번호 카운터의 지금 값을 읽음
async function readCounter(): Promise<unknown> {
  const rows: { value: number }[] = await dataSource.query(`SELECT value FROM issue_counter`);
  return rows[0]?.value;
}

describe('이슈 만들기', () => {
  test('입력 실수를 허용하기 위해 앞뒤 공백을 지운 제목으로 저장하고 번호 1의 TODO 이슈로 시작한다', async () => {
    // Given
    const project = await addProject('가계부');

    // When
    const response = await request(server)
      .post('/api/issues')
      .send({ projectId: project.id, title: '  영수증 정리  ' });

    // Then
    expect(response.status).toBe(201);
    const issue = issueSchema.parse(response.body);
    expect(issue).toMatchObject({
      projectId: project.id,
      number: 1,
      title: '영수증 정리',
      due: null,
      status: 'TODO',
      version: 1,
      closedAt: null,
    });
  });

  test('마감을 잃지 않도록 만들 때 넘긴 마감을 그대로 저장한다', async () => {
    // Given
    const project = await addProject('가계부');

    // When
    const response = await request(server)
      .post('/api/issues')
      .send({ projectId: project.id, title: '영수증 정리', due: '2026-11-30' });

    // Then: 응답과 다시 읽은 이슈 모두 마감이 남아 있음
    expect(response.status).toBe(201);
    const created = issueSchema.parse(response.body);
    expect(created.due).toBe('2026-11-30');
    const stored = await request(server).get(`/api/issues/${created.id}`);
    expect(issueSchema.parse(stored.body).due).toBe('2026-11-30');
  });

  test('번호로 이슈를 가리킬 수 있도록 번호는 프로젝트와 상관없이 이어진다', async () => {
    // Given: 한 프로젝트에 이슈 2건
    const books = await addProject('독서 기록');
    const budget = await addProject('가계부');
    await addIssue(books.id, '읽은 책 별점 입력');
    await addIssue(books.id, '독서 목표 설정');

    // When: 다른 프로젝트에 하나 더
    const issue = await addIssue(budget.id, '이번 달 영수증 정리');

    // Then
    expect(issue.number).toBe(3);
  });

  test('번호가 겹치지 않도록 동시에 들어온 두 만들기는 모두 성공하고 서로 다른 번호를 받는다', async () => {
    // Given
    const project = await addProject('독서 기록');

    // When
    const responses = await Promise.all([
      request(server)
        .post('/api/issues')
        .send({ projectId: project.id, title: '읽은 책 별점 입력' }),
      request(server).post('/api/issues').send({ projectId: project.id, title: '독서 목표 설정' }),
    ]);

    // Then
    expect(responses.map((response) => response.status)).toEqual([201, 201]);
    const numbers = responses.map((response) => issueSchema.parse(response.body).number);
    expect(new Set(numbers).size).toBe(2);
  });

  test('주인 없는 이슈가 생기지 않도록 없는 프로젝트면 PROJECT_NOT_FOUND를 주고 번호도 쓰지 않는다', async () => {
    // When
    const response = await request(server)
      .post('/api/issues')
      .send({ projectId: 999, title: '읽은 책 별점 입력' });

    // Then
    expect(response.status).toBe(404);
    expect(errorResponseSchema.parse(response.body).code).toBe('PROJECT_NOT_FOUND');
    expect(await readCounter()).toBe(0);
  });

  test.each([
    ['빈 제목은', { title: '   ' }],
    ['201자 제목은', { title: '가'.repeat(201) }],
    ['없는 날짜의 마감은', { title: '영수증 정리', due: '2026-02-30' }],
  ])('잘못된 입력이 저장되지 않도록 %s VALIDATION을 준다', async (_, body) => {
    // Given
    const project = await addProject('가계부');

    // When
    const response = await request(server)
      .post('/api/issues')
      .send({ projectId: project.id, ...body });

    // Then
    expect(response.status).toBe(400);
    expect(errorResponseSchema.parse(response.body).code).toBe('VALIDATION');
  });

  test('상태는 서버가 정하므로 요청에 담긴 상태는 무시하고 TODO로 시작한다', async () => {
    // Given
    const project = await addProject('가계부');

    // When
    const response = await request(server)
      .post('/api/issues')
      .send({ projectId: project.id, title: '영수증 정리', status: 'DONE' });

    // Then
    expect(response.status).toBe(201);
    expect(issueSchema.parse(response.body).status).toBe('TODO');
  });

  test('이슈와 이력이 어긋나지 않도록 만든 직후의 이력은 만든 시각과 같은 CREATED 한 줄이다', async () => {
    // Given
    const project = await addProject('가계부');

    // When
    const issue = await addIssue(project.id, '영수증 정리');

    // Then
    const events: unknown = await dataSource.query(
      `SELECT kind, at FROM issue_events WHERE issue_id = ?`,
      [issue.id],
    );
    expect(events).toEqual([{ kind: 'CREATED', at: issue.createdAt }]);
  });
});

describe('이슈 조회', () => {
  test('프로젝트 화면이 자기 이슈만 보도록 그 프로젝트의 이슈만 번호순으로 준다', async () => {
    // Given: 두 프로젝트에 이슈가 번갈아 생김
    const books = await addProject('독서 기록');
    const budget = await addProject('가계부');
    const first = await addIssue(books.id, '읽은 책 별점 입력');
    await addIssue(budget.id, '이번 달 영수증 정리');
    const third = await addIssue(books.id, '독서 목표 설정');

    // When
    const response = await request(server).get(`/api/issues?projectId=${books.id}`);

    // Then
    expect(response.status).toBe(200);
    const issues = issueSchema.array().parse(response.body);
    expect(issues.map((issue) => issue.id)).toEqual([first.id, third.id]);
  });

  test('없는 프로젝트를 오류 없이 다루도록 없는 프로젝트의 목록은 빈 배열을 준다', async () => {
    // When
    const response = await request(server).get('/api/issues?projectId=999');

    // Then
    expect(response.status).toBe(200);
    expect(response.body).toEqual([]);
  });

  test.each([
    ['숫자가 아닌 projectId는', '?projectId=abc'],
    ['소수인 projectId는', '?projectId=1.5'],
    ['projectId가 없는 요청은', ''],
  ])('어느 프로젝트인지 모르는 요청을 막도록 %s VALIDATION을 준다', async (_, query) => {
    // When
    const response = await request(server).get(`/api/issues${query}`);

    // Then
    expect(response.status).toBe(400);
    expect(errorResponseSchema.parse(response.body).code).toBe('VALIDATION');
  });

  test('이슈 하나를 열 수 있도록 id로 조회하면 그 이슈를 준다', async () => {
    // Given
    const project = await addProject('가계부');
    const issue = await addIssue(project.id, '영수증 정리');

    // When
    const response = await request(server).get(`/api/issues/${issue.id}`);

    // Then
    expect(response.status).toBe(200);
    expect(issueSchema.parse(response.body)).toEqual(issue);
  });

  test('없는 이슈를 화면이 구분하도록 없는 id는 ISSUE_NOT_FOUND를 준다', async () => {
    // When
    const response = await request(server).get('/api/issues/999');

    // Then
    expect(response.status).toBe(404);
    expect(errorResponseSchema.parse(response.body).code).toBe('ISSUE_NOT_FOUND');
  });

  test('id가 아닌 경로를 막도록 숫자가 아닌 id는 VALIDATION을 준다', async () => {
    // When
    const response = await request(server).get('/api/issues/abc');

    // Then
    expect(response.status).toBe(400);
    expect(errorResponseSchema.parse(response.body).code).toBe('VALIDATION');
  });
});
