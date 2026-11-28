import type { Server } from 'node:net';

import {
  errorResponseSchema,
  issueSchema,
  milestoneHasIssuesDetailsSchema,
  milestoneHasOpenIssuesDetailsSchema,
  milestoneSchema,
  projectSchema,
  type UpdateMilestoneRequest,
} from '@lokibench/shared/contracts';
import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import type { DataSource } from 'typeorm';
import { z } from 'zod';

import { createTestApp } from './create-test-app';

// 비어 있는 칸 (테스트마다 바꿀 칸만 덮어씀)
const EMPTY_FIELDS: UpdateMilestoneRequest = {
  title: '12월 정리',
  startDate: null,
  due: null,
  background: '',
  solution: '',
  expectedEffect: '',
  memo: '',
};

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

// 마일스톤을 추가하고 계약 모양인지 확인한 마일스톤을 돌려줌
async function addMilestone(projectId: number, fields: Partial<UpdateMilestoneRequest> = {}) {
  const response = await request(server)
    .post('/api/milestones')
    .send({ ...EMPTY_FIELDS, projectId, ...fields });
  expect(response.status).toBe(201);
  return milestoneSchema.parse(response.body);
}

// 마일스톤에 이슈를 하나 넣음 (이슈 API가 마일스톤을 받기 전이라 열만 직접 채움)
async function addIssueInMilestone({
  projectId,
  milestoneId,
  done = false,
}: {
  projectId: number;
  milestoneId: number;
  done?: boolean;
}) {
  const created = await request(server)
    .post('/api/issues')
    .send({ projectId, title: '영수증 정리' });
  let issue = issueSchema.parse(created.body);
  await dataSource.query(`UPDATE issues SET milestone_id = ? WHERE id = ?`, [
    milestoneId,
    issue.id,
  ]);

  if (done) {
    const patched = await request(server)
      .patch(`/api/issues/${issue.id}`)
      .send({ version: issue.version, status: 'DONE' });
    issue = issueSchema.parse(patched.body);
  }
  return issue;
}

// 오류 응답을 계약 모양으로 파싱함
function parseError(body: unknown) {
  return errorResponseSchema.parse(body);
}

describe('마일스톤 만들기', () => {
  test('입력 실수를 허용하도록 제목의 앞뒤 공백을 지우고, 빈 칸은 빈 글, 닫은 시각은 없이 만든다', async () => {
    // Given
    const project = await addProject('가계부');

    // When
    const response = await request(server)
      .post('/api/milestones')
      .send({ ...EMPTY_FIELDS, projectId: project.id, title: '  12월 정리  ' });

    // Then
    expect(response.status).toBe(201);
    expect(milestoneSchema.parse(response.body)).toMatchObject({
      projectId: project.id,
      title: '12월 정리',
      background: '',
      memo: '',
      closedAt: null,
    });
    expect(response.body).not.toHaveProperty('deletedAt');
  });

  test('프로젝트 안에서 이름으로 가릴 수 있도록 같은 프로젝트에 같은 제목이면 409를 준다', async () => {
    // Given
    const project = await addProject('가계부');
    await addMilestone(project.id);

    // When
    const response = await request(server)
      .post('/api/milestones')
      .send({ ...EMPTY_FIELDS, projectId: project.id });

    // Then
    expect(response.status).toBe(409);
    expect(parseError(response.body).code).toBe('MILESTONE_TITLE_TAKEN');
  });

  test('프로젝트마다 같은 이름의 묶음을 둘 수 있도록 다른 프로젝트에는 같은 제목을 만든다', async () => {
    // Given
    await addMilestone((await addProject('가계부')).id);
    const blog = await addProject('블로그');

    // When
    const response = await request(server)
      .post('/api/milestones')
      .send({ ...EMPTY_FIELDS, projectId: blog.id });

    // Then
    expect(response.status).toBe(201);
  });

  test('기간이 거꾸로 저장되지 않도록 시작이 마감보다 늦으면 400을 준다', async () => {
    // Given
    const project = await addProject('가계부');

    // When
    const response = await request(server)
      .post('/api/milestones')
      .send({ ...EMPTY_FIELDS, projectId: project.id, startDate: '2026-12-10', due: '2026-12-01' });

    // Then
    expect(response.status).toBe(400);
    expect(parseError(response.body).code).toBe('VALIDATION');
  });

  test('저장 전에 틀린 입력을 막도록 51자 제목, 2,001자 메모는 400을 준다', async () => {
    // Given
    const project = await addProject('가계부');
    const longTitle = { ...EMPTY_FIELDS, projectId: project.id, title: '가'.repeat(51) };
    const longMemo = { ...EMPTY_FIELDS, projectId: project.id, memo: '가'.repeat(2001) };

    // When
    const titleResponse = await request(server).post('/api/milestones').send(longTitle);
    const memoResponse = await request(server).post('/api/milestones').send(longMemo);

    // Then
    expect(titleResponse.status).toBe(400);
    expect(memoResponse.status).toBe(400);
  });

  test('주인 없는 마일스톤이 생기지 않도록 없는 프로젝트면 404를 준다', async () => {
    // When
    const response = await request(server)
      .post('/api/milestones')
      .send({ ...EMPTY_FIELDS, projectId: 999 });

    // Then
    expect(response.status).toBe(404);
    expect(parseError(response.body).code).toBe('PROJECT_NOT_FOUND');
  });
});

describe('마일스톤 조회', () => {
  test('관리 화면 순서를 서버가 정하도록 열린 것은 마감순, 닫힌 것은 그 아래 최근에 닫은 순으로 준다', async () => {
    // Given
    const project = await addProject('가계부');
    await addMilestone(project.id, { title: '12월', due: '2026-12-01' });
    await addMilestone(project.id, { title: '마감 없음' });
    await addMilestone(project.id, { title: '11월', due: '2026-11-20' });
    const first = await addMilestone(project.id, { title: '먼저 닫음' });
    const second = await addMilestone(project.id, { title: '나중에 닫음' });
    await request(server).post(`/api/milestones/${first.id}/close`);
    await request(server).post(`/api/milestones/${second.id}/close`);

    // When
    const response = await request(server).get(`/api/milestones?projectId=${project.id}`);

    // Then
    expect(response.status).toBe(200);
    const titles = z
      .array(milestoneSchema)
      .parse(response.body)
      .map(({ title }) => title);
    expect(titles).toEqual(['11월', '12월', '마감 없음', '나중에 닫음', '먼저 닫음']);
  });

  test('쿼리 실수를 바로 알리도록 projectId가 없거나 숫자 글자가 아니면 400을 준다', async () => {
    for (const query of ['', '?projectId=abc', '?projectId=1.5']) {
      const response = await request(server).get(`/api/milestones${query}`);
      expect(response.status).toBe(400);
    }
  });

  test('없는 마일스톤은 404를 준다', async () => {
    // When
    const response = await request(server).get('/api/milestones/999');

    // Then
    expect(response.status).toBe(404);
    expect(parseError(response.body).code).toBe('MILESTONE_NOT_FOUND');
  });
});

describe('마일스톤 수정', () => {
  test('상세에서 칸 전부를 한 번에 고칠 수 있도록 PUT의 값으로 바꾼다', async () => {
    // Given
    const milestone = await addMilestone((await addProject('가계부')).id);

    // When
    const response = await request(server)
      .put(`/api/milestones/${milestone.id}`)
      .send({ ...EMPTY_FIELDS, title: '12월 정리 (2차)', background: '- 영수증이 쌓임' });

    // Then
    expect(response.status).toBe(200);
    expect(milestoneSchema.parse(response.body)).toEqual({
      ...milestone,
      title: '12월 정리 (2차)',
      background: '- 영수증이 쌓임',
    });
  });

  test('자기 제목과 겹친다고 막지 않도록 제목을 그대로 두거나 공백만 더해 보내도 200을 준다', async () => {
    // Given
    const milestone = await addMilestone((await addProject('가계부')).id);

    // When
    const same = await request(server)
      .put(`/api/milestones/${milestone.id}`)
      .send({ ...EMPTY_FIELDS });
    const padded = await request(server)
      .put(`/api/milestones/${milestone.id}`)
      .send({ ...EMPTY_FIELDS, title: '  12월 정리  ' });

    // Then
    expect(same.status).toBe(200);
    expect(padded.status).toBe(200);
  });

  test('끝난 뒤 회고를 적을 수 있도록 닫힌 마일스톤도 고친다', async () => {
    // Given
    const milestone = await addMilestone((await addProject('가계부')).id);
    await request(server).post(`/api/milestones/${milestone.id}/close`);

    // When
    const response = await request(server)
      .put(`/api/milestones/${milestone.id}`)
      .send({ ...EMPTY_FIELDS, memo: '- 다음 달에는 미리 정리' });

    // Then
    expect(response.status).toBe(200);
    expect(milestoneSchema.parse(response.body).closedAt).not.toBeNull();
  });

  test('다른 마일스톤과 이름이 겹치지 않도록 같은 프로젝트의 다른 제목으로 바꾸면 409를 준다', async () => {
    // Given
    const project = await addProject('가계부');
    await addMilestone(project.id, { title: 'A' });
    const b = await addMilestone(project.id, { title: 'B' });

    // When
    const response = await request(server)
      .put(`/api/milestones/${b.id}`)
      .send({ ...EMPTY_FIELDS, title: 'A' });

    // Then
    expect(response.status).toBe(409);
    expect(parseError(response.body).code).toBe('MILESTONE_TITLE_TAKEN');
  });

  test('마일스톤은 다른 프로젝트로 옮길 수 없도록 요청의 projectId를 버린다', async () => {
    // Given
    const project = await addProject('가계부');
    const other = await addProject('블로그');
    const milestone = await addMilestone(project.id);

    // When
    const response = await request(server)
      .put(`/api/milestones/${milestone.id}`)
      .send({ ...EMPTY_FIELDS, projectId: other.id });

    // Then
    expect(milestoneSchema.parse(response.body).projectId).toBe(project.id);
  });
});

describe('마일스톤 닫기와 재오픈', () => {
  test('화면이 남은 번호를 보일 수 있도록 열린 이슈가 있으면 번호 오름차순을 details에 담아 409를 준다', async () => {
    // Given
    const project = await addProject('가계부');
    const milestone = await addMilestone(project.id);
    const first = await addIssueInMilestone({ projectId: project.id, milestoneId: milestone.id });
    const second = await addIssueInMilestone({ projectId: project.id, milestoneId: milestone.id });

    // When
    const response = await request(server).post(`/api/milestones/${milestone.id}/close`);

    // Then
    expect(response.status).toBe(409);
    const error = parseError(response.body);
    expect(error.code).toBe('MILESTONE_HAS_OPEN_ISSUES');
    expect(milestoneHasOpenIssuesDetailsSchema.parse(error.details)).toEqual({
      openIssueNumbers: [first.number, second.number],
    });
  });

  test('일이 끝난 마일스톤을 닫을 수 있도록 이슈가 모두 닫혔으면 닫은 시각을 채운다', async () => {
    // Given
    const project = await addProject('가계부');
    const milestone = await addMilestone(project.id);
    await addIssueInMilestone({ projectId: project.id, milestoneId: milestone.id, done: true });

    // When
    const response = await request(server).post(`/api/milestones/${milestone.id}/close`);

    // Then
    expect(response.status).toBe(200);
    expect(milestoneSchema.parse(response.body).closedAt).not.toBeNull();
  });

  test('닫기를 되돌릴 수 있도록 재오픈하면 닫은 시각을 비운다', async () => {
    // Given
    const milestone = await addMilestone((await addProject('가계부')).id);
    await request(server).post(`/api/milestones/${milestone.id}/close`);

    // When
    const response = await request(server).post(`/api/milestones/${milestone.id}/reopen`);

    // Then
    expect(response.status).toBe(200);
    expect(milestoneSchema.parse(response.body).closedAt).toBeNull();
  });
});

describe('마일스톤 삭제와 되살리기', () => {
  test('끝난 이슈의 기록을 잃지 않도록 닫힌 이슈만 있어도 이슈 수를 details에 담아 409를 준다', async () => {
    // Given
    const project = await addProject('가계부');
    const milestone = await addMilestone(project.id);
    await addIssueInMilestone({ projectId: project.id, milestoneId: milestone.id, done: true });

    // When
    const response = await request(server).delete(`/api/milestones/${milestone.id}`);

    // Then
    expect(response.status).toBe(409);
    const error = parseError(response.body);
    expect(error.code).toBe('MILESTONE_HAS_ISSUES');
    expect(milestoneHasIssuesDetailsSchema.parse(error.details)).toEqual({ issueCount: 1 });
  });

  test('지운 직후 되돌릴 수 있도록 되살리면 같은 id, 칸, 닫힘 상태로 돌아온다', async () => {
    // Given: 내용을 채우고 닫은 뒤 지운 마일스톤
    const milestone = await addMilestone((await addProject('가계부')).id, {
      background: '- 영수증이 쌓임',
    });
    const closed = await request(server).post(`/api/milestones/${milestone.id}/close`);
    const deleted = await request(server).delete(`/api/milestones/${milestone.id}`);

    // When
    const restored = await request(server).post(`/api/milestones/${milestone.id}/restore`);

    // Then
    expect(deleted.status).toBe(204);
    expect(restored.status).toBe(200);
    expect(milestoneSchema.parse(restored.body)).toEqual(milestoneSchema.parse(closed.body));
  });

  test('지운 마일스톤이 다시 보이지 않도록 지운 뒤에는 목록에서 빠지고 한 건 조회가 404다', async () => {
    // Given
    const project = await addProject('가계부');
    const milestone = await addMilestone(project.id);
    await request(server).delete(`/api/milestones/${milestone.id}`);

    // When
    const list = await request(server).get(`/api/milestones?projectId=${project.id}`);
    const detail = await request(server).get(`/api/milestones/${milestone.id}`);

    // Then
    expect(list.body).toEqual([]);
    expect(detail.status).toBe(404);
  });

  test('지운 마일스톤의 이름을 다시 쓸 수 있도록 지운 뒤 같은 제목을 새로 만들 수 있다', async () => {
    // Given
    const project = await addProject('가계부');
    const milestone = await addMilestone(project.id);
    await request(server).delete(`/api/milestones/${milestone.id}`);

    // When
    const response = await request(server)
      .post('/api/milestones')
      .send({ ...EMPTY_FIELDS, projectId: project.id });

    // Then
    expect(response.status).toBe(201);
  });

  test('같은 이름이 둘이 되지 않도록 그 사이 같은 제목을 새로 만들었으면 되살리기는 409를 준다', async () => {
    // Given
    const project = await addProject('가계부');
    const milestone = await addMilestone(project.id);
    await request(server).delete(`/api/milestones/${milestone.id}`);
    await addMilestone(project.id);

    // When
    const response = await request(server).post(`/api/milestones/${milestone.id}/restore`);

    // Then
    expect(response.status).toBe(409);
    expect(parseError(response.body).code).toBe('MILESTONE_TITLE_TAKEN');
  });

  test('되돌리기를 두 번 눌러도 문제없도록 지우지 않은 마일스톤을 되살리면 그대로 200을 준다', async () => {
    // Given
    const milestone = await addMilestone((await addProject('가계부')).id);

    // When
    const first = await request(server).post(`/api/milestones/${milestone.id}/restore`);
    const second = await request(server).post(`/api/milestones/${milestone.id}/restore`);

    // Then
    expect(first.status).toBe(200);
    expect(second.status).toBe(200);
    expect(milestoneSchema.parse(second.body)).toEqual(milestone);
  });

  test('없는 마일스톤은 닫고, 열고, 지우고, 되살릴 수 없도록 모두 404를 준다', async () => {
    const responses = await Promise.all([
      request(server).post('/api/milestones/999/close'),
      request(server).post('/api/milestones/999/reopen'),
      request(server).delete('/api/milestones/999'),
      request(server).post('/api/milestones/999/restore'),
    ]);

    expect(responses.map(({ status }) => status)).toEqual([404, 404, 404, 404]);
  });
});
