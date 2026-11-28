import type { Server } from 'node:net';

import {
  errorResponseSchema,
  issueSchema,
  milestoneSchema,
  openIssueCountSchema,
  projectSchema,
} from '@lokibench/shared/contracts';
import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import type { DataSource } from 'typeorm';
import { z } from 'zod';

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

// 이슈를 고치는 요청을 보냄
function patchIssue(id: number, body: Record<string, unknown>) {
  return request(server).patch(`/api/issues/${id}`).send(body);
}

// 이슈를 고치고 계약 모양인지 확인한 이슈를 돌려줌
async function changeIssue(id: number, body: Record<string, unknown>) {
  const response = await patchIssue(id, body);
  expect(response.status).toBe(200);
  return issueSchema.parse(response.body);
}

// 이슈 이력의 종류를 오래된 순서로 읽음
async function readEventKinds(issueId: number): Promise<unknown> {
  const rows: { kind: string }[] = await dataSource.query(
    `SELECT kind FROM issue_events WHERE issue_id = ? ORDER BY id`,
    [issueId],
  );
  return rows.map((row) => row.kind);
}

// 되돌리기가 기대는 불변식: 상태를 바꾼 시각은 늘 마지막 이력의 시각과 같음
async function expectStatusClockInSync(issueId: number): Promise<void> {
  const rows: { statusChangedAt: string; lastEventAt: string }[] = await dataSource.query(
    `SELECT i.status_changed_at AS statusChangedAt,
            (SELECT at FROM issue_events WHERE issue_id = i.id ORDER BY id DESC LIMIT 1) AS lastEventAt
     FROM issues i WHERE i.id = ?`,
    [issueId],
  );
  expect(rows[0]?.statusChangedAt).toBe(rows[0]?.lastEventAt);
}

// 새 이슈를 만들어 닫은 이슈를 돌려줌
async function addClosedIssue(projectId: number) {
  const issue = await addIssue(projectId, '영수증 정리');
  return changeIssue(issue.id, { version: issue.version, status: 'DONE' });
}

// 이슈의 마지막 상태 변경을 되돌리는 요청을 보냄
function undoStatus(id: number, version: number) {
  return request(server).post(`/api/issues/${id}/undo-status`).send({ version });
}

// 마지막 상태 변경을 되돌리고 계약 모양인지 확인한 이슈를 돌려줌
async function undoIssue(id: number, version: number) {
  const response = await undoStatus(id, version);
  expect(response.status).toBe(200);
  return issueSchema.parse(response.body);
}

// 프로젝트별 열린 이슈 수를 받아 계약 모양인지 확인한 목록을 돌려줌
async function readOpenCounts() {
  const response = await request(server).get('/api/issues/open-counts');
  expect(response.status).toBe(200);
  return z.array(openIssueCountSchema).parse(response.body);
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
      milestoneId: null,
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
    // Given: 겹친 쓰기의 보장은 repository 테스트가 지키고, 여기서는 둘 다 201과 다른 번호라는 응답만 확인함
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

describe('이슈 수정', () => {
  test('상태 이동을 기록하도록 상태를 바꾸면 version을 올리고 상태 변경 이력을 한 줄 남긴다', async () => {
    // Given
    const project = await addProject('가계부');
    const issue = await addIssue(project.id, '영수증 정리');

    // When
    const changed = await changeIssue(issue.id, { version: 1, status: 'IN_PROGRESS' });

    // Then
    expect(changed).toMatchObject({ status: 'IN_PROGRESS', version: 2 });
    expect(await readEventKinds(issue.id)).toEqual(['CREATED', 'STATUS']);
    await expectStatusClockInSync(issue.id);
  });

  test('다른 곳의 수정을 덮어쓰지 않도록 낡은 version이면 ISSUE_VERSION_CONFLICT를 주고 아무것도 바꾸지 않는다', async () => {
    // Given: 이미 한 번 고친 이슈
    const project = await addProject('가계부');
    const issue = await addIssue(project.id, '영수증 정리');
    const changed = await changeIssue(issue.id, { version: 1, status: 'IN_PROGRESS' });

    // When: 고치기 전의 version으로 다시 보냄
    const response = await patchIssue(issue.id, { version: 1, status: 'IN_REVIEW' });

    // Then
    expect(response.status).toBe(409);
    expect(errorResponseSchema.parse(response.body).code).toBe('ISSUE_VERSION_CONFLICT');
    const stored = await request(server).get(`/api/issues/${issue.id}`);
    expect(issueSchema.parse(stored.body)).toEqual(changed);
    expect(await readEventKinds(issue.id)).toEqual(['CREATED', 'STATUS']);
  });

  test('두 탭의 수정이 함께 들어와도 하나만 반영되도록 같은 version의 두 요청 중 하나는 409를 준다', async () => {
    // Given
    const project = await addProject('가계부');
    const issue = await addIssue(project.id, '영수증 정리');

    // When
    const responses = await Promise.all([
      patchIssue(issue.id, { version: 1, status: 'IN_PROGRESS' }),
      patchIssue(issue.id, { version: 1, status: 'IN_REVIEW' }),
    ]);

    // Then
    expect(responses.map((response) => response.status).sort()).toEqual([200, 409]);
    expect(await readEventKinds(issue.id)).toEqual(['CREATED', 'STATUS']);
  });

  test('마감을 지울 수 있도록 마감에 null을 보내면 마감을 비운다', async () => {
    // Given: 마감 있는 이슈
    const project = await addProject('가계부');
    const response = await request(server)
      .post('/api/issues')
      .send({ projectId: project.id, title: '영수증 정리', due: '2026-11-30' });
    const issue = issueSchema.parse(response.body);

    // When
    const changed = await changeIssue(issue.id, { version: 1, due: null });

    // Then: 제목, 마감만 바뀌면 이력은 늘지 않음
    expect(changed).toMatchObject({ due: null, version: 2 });
    expect(await readEventKinds(issue.id)).toEqual(['CREATED']);
  });

  test.each([
    ['마감 없는 이슈의 마감을 비우는 요청은', { due: null }],
    ['앞뒤 공백만 다른 같은 제목은', { title: '  영수증 정리  ' }],
    ['지금과 같은 상태는', { status: 'TODO' }],
  ])(
    '바뀐 것이 없으면 다른 탭을 막지 않도록 %s 200을 주고 version을 올리지 않는다',
    async (_, body) => {
      // Given
      const project = await addProject('가계부');
      const issue = await addIssue(project.id, '영수증 정리');

      // When
      const changed = await changeIssue(issue.id, { version: 1, ...body });

      // Then
      expect(changed).toEqual(issue);
      expect(await readEventKinds(issue.id)).toEqual(['CREATED']);
    },
  );

  test('닫힌 이슈는 TODO로만 다시 열 수 있도록 다른 열린 상태로 옮기면 ISSUE_TRANSITION_NOT_ALLOWED를 준다', async () => {
    // Given
    const project = await addProject('가계부');
    const closed = await addClosedIssue(project.id);

    // When
    const response = await patchIssue(closed.id, { version: closed.version, status: 'IN_REVIEW' });

    // Then
    expect(response.status).toBe(409);
    expect(errorResponseSchema.parse(response.body).code).toBe('ISSUE_TRANSITION_NOT_ALLOWED');
  });

  test('다시 연 이슈가 닫힌 것으로 남지 않도록 닫힌 이슈를 TODO로 열면 닫은 시각을 비운다', async () => {
    // Given
    const project = await addProject('가계부');
    const closed = await addClosedIssue(project.id);
    expect(closed.closedAt).not.toBeNull();

    // When
    const reopened = await changeIssue(closed.id, { version: closed.version, status: 'TODO' });

    // Then
    expect(reopened).toMatchObject({ status: 'TODO', closedAt: null });
    await expectStatusClockInSync(closed.id);
  });

  test('닫힌 이슈의 내용이 바뀌지 않도록 다른 제목을 보내면 ISSUE_CLOSED를 준다', async () => {
    // Given
    const project = await addProject('가계부');
    const closed = await addClosedIssue(project.id);

    // When
    const response = await patchIssue(closed.id, { version: closed.version, title: '새 제목' });

    // Then
    expect(response.status).toBe(409);
    expect(errorResponseSchema.parse(response.body).code).toBe('ISSUE_CLOSED');
  });

  test('낡은 화면이면 다시 불러오기부터 안내하도록 낡은 version의 닫힌 이슈 제목 수정은 ISSUE_VERSION_CONFLICT를 먼저 준다', async () => {
    // Given
    const project = await addProject('가계부');
    const closed = await addClosedIssue(project.id);

    // When
    const response = await patchIssue(closed.id, { version: 1, title: '새 제목' });

    // Then
    expect(response.status).toBe(409);
    expect(errorResponseSchema.parse(response.body).code).toBe('ISSUE_VERSION_CONFLICT');
  });

  test('없는 이슈를 화면이 구분하도록 없는 id를 고치면 ISSUE_NOT_FOUND를 준다', async () => {
    // When
    const response = await patchIssue(999, { version: 1, title: '새 제목' });

    // Then
    expect(response.status).toBe(404);
    expect(errorResponseSchema.parse(response.body).code).toBe('ISSUE_NOT_FOUND');
  });

  test.each([
    ['version만 담은 요청은', { version: 1 }],
    ['서버가 정하는 번호만 담은 요청은', { version: 1, number: 99 }],
  ])('바꿀 칸이 없는 요청을 막도록 %s VALIDATION을 준다', async (_, body) => {
    // Given
    const project = await addProject('가계부');
    const issue = await addIssue(project.id, '영수증 정리');

    // When
    const response = await patchIssue(issue.id, body);

    // Then
    expect(response.status).toBe(400);
    expect(errorResponseSchema.parse(response.body).code).toBe('VALIDATION');
  });

  test('이슈가 다른 프로젝트로 옮겨지지 않도록 수정 요청에 담긴 projectId는 무시한다', async () => {
    // Given
    const books = await addProject('독서 기록');
    const budget = await addProject('가계부');
    const issue = await addIssue(books.id, '읽은 책 별점 입력');

    // When
    const changed = await changeIssue(issue.id, {
      version: 1,
      title: '새 제목',
      projectId: budget.id,
    });

    // Then
    expect(changed).toMatchObject({ title: '새 제목', projectId: books.id });
  });
});

describe('상태 되돌리기', () => {
  // 되돌릴 수 있는 시간을 넘기도록 시각만 가짜로 옮김 (타이머까지 바꾸면 요청이 멈춤)
  const START = new Date('2026-11-22T09:00:00.000Z');

  // 지금 시각을 시작 시각에서 정한 만큼 뒤로 옮김
  function moveClock(ms: number): void {
    vi.setSystemTime(new Date(START.getTime() + ms));
  }

  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(START);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  test('방금 한 상태 이동을 취소할 수 있도록 되돌리면 이전 상태로 돌리고 그 상태 변경 이력을 지운다', async () => {
    // Given: TODO에서 진행 중으로 옮긴 직후
    const project = await addProject('가계부');
    const issue = await addIssue(project.id, '영수증 정리');
    moveClock(1000);
    const moved = await changeIssue(issue.id, { version: 1, status: 'IN_PROGRESS' });

    // When
    const undone = await undoIssue(issue.id, moved.version);

    // Then
    expect(undone).toMatchObject({ status: 'TODO', version: 3, statusChangedAt: issue.createdAt });
    expect(await readEventKinds(issue.id)).toEqual(['CREATED']);
    await expectStatusClockInSync(issue.id);
  });

  test('오래된 변경을 실수로 되돌리지 않도록 5분 1초가 지나면 ISSUE_UNDO_EXPIRED를 준다', async () => {
    // Given
    const project = await addProject('가계부');
    const issue = await addIssue(project.id, '영수증 정리');
    const moved = await changeIssue(issue.id, { version: 1, status: 'IN_PROGRESS' });
    moveClock(5 * 60 * 1000 + 1000);

    // When
    const response = await undoStatus(issue.id, moved.version);

    // Then
    expect(response.status).toBe(409);
    expect(errorResponseSchema.parse(response.body).code).toBe('ISSUE_UNDO_EXPIRED');
    await expectStatusClockInSync(issue.id);
  });

  test('되돌릴 것이 없음을 알리도록 막 만든 이슈를 되돌리면 ISSUE_UNDO_NOTHING을 준다', async () => {
    // Given
    const project = await addProject('가계부');
    const issue = await addIssue(project.id, '영수증 정리');

    // When
    const response = await undoStatus(issue.id, issue.version);

    // Then
    expect(response.status).toBe(409);
    expect(errorResponseSchema.parse(response.body).code).toBe('ISSUE_UNDO_NOTHING');
  });

  test('이력이 없는 변경은 막지 않도록 상태 변경 뒤 제목을 고쳤어도 최신 version이면 되돌리고 제목은 고친 그대로 둔다', async () => {
    // Given
    const project = await addProject('가계부');
    const issue = await addIssue(project.id, '영수증 정리');
    const moved = await changeIssue(issue.id, { version: 1, status: 'IN_PROGRESS' });
    const renamed = await changeIssue(issue.id, { version: moved.version, title: '새 제목' });

    // When
    const undone = await undoIssue(issue.id, renamed.version);

    // Then
    expect(undone).toMatchObject({ status: 'TODO', title: '새 제목' });
    await expectStatusClockInSync(issue.id);
  });

  test('다른 곳의 수정을 덮어쓰지 않도록 낡은 version이면 ISSUE_VERSION_CONFLICT를 주고 이력도 그대로 둔다', async () => {
    // Given
    const project = await addProject('가계부');
    const issue = await addIssue(project.id, '영수증 정리');
    await changeIssue(issue.id, { version: 1, status: 'IN_PROGRESS' });

    // When
    const response = await undoStatus(issue.id, 1);

    // Then
    expect(response.status).toBe(409);
    expect(errorResponseSchema.parse(response.body).code).toBe('ISSUE_VERSION_CONFLICT');
    expect(await readEventKinds(issue.id)).toEqual(['CREATED', 'STATUS']);
  });

  test('연달아 옮긴 것도 거슬러 갈 수 있도록 두 번 되돌리면 처음 상태와 만든 시각으로 돌아간다', async () => {
    // Given: TODO에서 진행 중, 다시 완료로 옮긴 직후
    const project = await addProject('가계부');
    const issue = await addIssue(project.id, '영수증 정리');
    moveClock(1000);
    const moved = await changeIssue(issue.id, { version: 1, status: 'IN_PROGRESS' });
    moveClock(2000);
    const closed = await changeIssue(issue.id, { version: moved.version, status: 'DONE' });

    // When
    const first = await undoIssue(issue.id, closed.version);
    const second = await undoIssue(issue.id, first.version);

    // Then
    expect(second).toMatchObject({
      status: 'TODO',
      statusChangedAt: issue.createdAt,
      closedAt: null,
    });
    expect(await readEventKinds(issue.id)).toEqual(['CREATED']);
    await expectStatusClockInSync(issue.id);
  });

  test('되돌릴 때마다 시간을 따지도록 오래된 앞 변경은 두 번째 되돌리기에서 ISSUE_UNDO_EXPIRED를 준다', async () => {
    // Given: 6분 전에 진행 중으로, 방금 완료로 옮김
    const project = await addProject('가계부');
    const issue = await addIssue(project.id, '영수증 정리');
    const moved = await changeIssue(issue.id, { version: 1, status: 'IN_PROGRESS' });
    moveClock(6 * 60 * 1000);
    const closed = await changeIssue(issue.id, { version: moved.version, status: 'DONE' });

    // When
    const first = await undoIssue(issue.id, closed.version);
    const second = await undoStatus(issue.id, first.version);

    // Then
    expect(first.status).toBe('IN_PROGRESS');
    expect(second.status).toBe(409);
    expect(errorResponseSchema.parse(second.body).code).toBe('ISSUE_UNDO_EXPIRED');
    await expectStatusClockInSync(issue.id);
  });

  test('다시 열기를 취소하면 닫힌 상태가 온전하도록 닫았던 시각으로 닫은 시각을 되살린다', async () => {
    // Given: 닫은 뒤 다시 연 직후
    const project = await addProject('가계부');
    const issue = await addIssue(project.id, '영수증 정리');
    moveClock(1000);
    const closed = await changeIssue(issue.id, { version: 1, status: 'DONE' });
    moveClock(2000);
    const reopened = await changeIssue(issue.id, { version: closed.version, status: 'TODO' });

    // When
    const undone = await undoIssue(issue.id, reopened.version);

    // Then
    expect(undone).toMatchObject({ status: 'DONE', closedAt: closed.closedAt });
    await expectStatusClockInSync(issue.id);
  });

  test('이력이 없는 변경은 남기도록 다시 연 뒤 제목을 고치고 되돌리면 제목은 고친 그대로 닫힌다', async () => {
    // Given: 닫은 뒤 다시 열고 제목을 고침
    const project = await addProject('가계부');
    const issue = await addIssue(project.id, '영수증 정리');
    const closed = await changeIssue(issue.id, { version: 1, status: 'DONE' });
    const reopened = await changeIssue(issue.id, { version: closed.version, status: 'TODO' });
    const renamed = await changeIssue(issue.id, { version: reopened.version, title: '새 제목' });

    // When
    const undone = await undoIssue(issue.id, renamed.version);

    // Then
    expect(undone).toMatchObject({ status: 'DONE', title: '새 제목' });
    await expectStatusClockInSync(issue.id);
  });

  test.each([
    ['version이 없는 요청은', {}],
    ['version이 글자인 요청은', { version: '1' }],
  ])('잘못된 요청을 충돌로 오해하지 않도록 %s VALIDATION을 준다', async (_, body) => {
    // Given
    const project = await addProject('가계부');
    const issue = await addIssue(project.id, '영수증 정리');
    await changeIssue(issue.id, { version: 1, status: 'IN_PROGRESS' });

    // When
    const response = await request(server).post(`/api/issues/${issue.id}/undo-status`).send(body);

    // Then
    expect(response.status).toBe(400);
    expect(errorResponseSchema.parse(response.body).code).toBe('VALIDATION');
  });

  test('없는 이슈를 화면이 구분하도록 없는 id를 되돌리면 ISSUE_NOT_FOUND를 준다', async () => {
    // When
    const response = await undoStatus(999, 1);

    // Then
    expect(response.status).toBe(404);
    expect(errorResponseSchema.parse(response.body).code).toBe('ISSUE_NOT_FOUND');
  });
});

describe('열린 이슈 수', () => {
  test('프로젝트 표가 남은 일의 양을 보이도록 닫히지 않은 이슈만 세고 이슈가 없는 프로젝트는 빼고 준다', async () => {
    // Given: 가계부에 TODO 1, IN_PROGRESS 1, DONE 1, 독서 기록에는 이슈 없음
    const budget = await addProject('가계부');
    await addProject('독서 기록');
    await addIssue(budget.id, '영수증 정리');
    const started = await addIssue(budget.id, '카드값 확인');
    await changeIssue(started.id, { version: started.version, status: 'IN_PROGRESS' });
    await addClosedIssue(budget.id);

    // When
    const counts = await readOpenCounts();

    // Then
    expect(counts).toEqual([{ projectId: budget.id, count: 2 }]);
  });

  test('닫은 일이 수에서 빠지도록 이슈를 DONE으로 옮기면 그 프로젝트의 수가 준다', async () => {
    // Given
    const budget = await addProject('가계부');
    const issue = await addIssue(budget.id, '영수증 정리');
    await addIssue(budget.id, '카드값 확인');

    // When
    await changeIssue(issue.id, { version: issue.version, status: 'DONE' });

    // Then
    expect(await readOpenCounts()).toEqual([{ projectId: budget.id, count: 1 }]);
  });

  test('화면이 없는 프로젝트를 0으로 보므로 열린 이슈를 모두 닫으면 그 프로젝트를 목록에서 뺀다', async () => {
    // Given
    const budget = await addProject('가계부');
    const issue = await addIssue(budget.id, '영수증 정리');

    // When
    await changeIssue(issue.id, { version: issue.version, status: 'DONE' });

    // Then
    expect(await readOpenCounts()).toEqual([]);
  });
});

describe('이슈의 마일스톤', () => {
  // 프로젝트에 빈 칸의 마일스톤을 만들고 계약 모양인지 확인한 마일스톤을 돌려줌
  async function addMilestone(projectId: number, title = '12월 정리') {
    const response = await request(server).post('/api/milestones').send({
      projectId,
      title,
      startDate: null,
      due: null,
      background: '',
      solution: '',
      expectedEffect: '',
      memo: '',
    });
    expect(response.status).toBe(201);
    return milestoneSchema.parse(response.body);
  }

  // 마일스톤을 닫음 (닫을 수 있는 상태여야 함)
  async function closeMilestone(milestoneId: number) {
    const response = await request(server).post(`/api/milestones/${milestoneId}/close`);
    expect(response.status).toBe(200);
  }

  // 마일스톤에 든 이슈를 만듦
  function postIssueInMilestone(projectId: number, milestoneId: number) {
    return request(server)
      .post('/api/issues')
      .send({ projectId, title: '영수증 정리', milestoneId });
  }

  // 마일스톤에 든 이슈를 만들고 DONE으로 닫음
  async function addDoneIssueInMilestone(projectId: number, milestoneId: number) {
    const created = issueSchema.parse((await postIssueInMilestone(projectId, milestoneId)).body);
    return changeIssue(created.id, { version: created.version, status: 'DONE' });
  }

  test('만들 때 마일스톤을 고를 수 있도록 열린 마일스톤으로 만들면 그 마일스톤에 넣는다', async () => {
    // Given
    const project = await addProject('가계부');
    const milestone = await addMilestone(project.id);

    // When
    const response = await postIssueInMilestone(project.id, milestone.id);

    // Then
    expect(response.status).toBe(201);
    expect(issueSchema.parse(response.body)).toMatchObject({
      milestoneId: milestone.id,
      version: 1,
    });
  });

  test('닫힌 마일스톤에 할 일이 생기지 않도록 닫힌 마일스톤으로 만들거나 옮기면 MILESTONE_CLOSED를 준다', async () => {
    // Given
    const project = await addProject('가계부');
    const closed = await addMilestone(project.id);
    await closeMilestone(closed.id);
    const issue = await addIssue(project.id, '영수증 정리');

    // When
    const created = await postIssueInMilestone(project.id, closed.id);
    const moved = await patchIssue(issue.id, { version: issue.version, milestoneId: closed.id });

    // Then
    expect([created.status, moved.status]).toEqual([409, 409]);
    expect(errorResponseSchema.parse(created.body).code).toBe('MILESTONE_CLOSED');
    expect(errorResponseSchema.parse(moved.body).code).toBe('MILESTONE_CLOSED');
  });

  test('번호에 빈 곳이 생기지 않도록 닫힌 마일스톤으로 만들다 거부되면 번호도 쓰지 않는다', async () => {
    // Given
    const project = await addProject('가계부');
    const closed = await addMilestone(project.id);
    await closeMilestone(closed.id);

    // When
    await postIssueInMilestone(project.id, closed.id);
    const next = await addIssue(project.id, '영수증 정리');

    // Then
    expect(next.number).toBe(1);
  });

  test('프로젝트 경계가 섞이지 않도록 다른 프로젝트의 마일스톤으로 만들면 MILESTONE_PROJECT_MISMATCH를 준다', async () => {
    // Given
    const project = await addProject('가계부');
    const other = await addProject('블로그');
    const milestone = await addMilestone(other.id);

    // When
    const response = await postIssueInMilestone(project.id, milestone.id);

    // Then
    expect(response.status).toBe(409);
    expect(errorResponseSchema.parse(response.body).code).toBe('MILESTONE_PROJECT_MISMATCH');
  });

  test('없거나 지운 마일스톤에 들어가지 않도록 만들기와 옮기기 모두 MILESTONE_NOT_FOUND를 준다', async () => {
    // Given
    const project = await addProject('가계부');
    const deleted = await addMilestone(project.id);
    await request(server).delete(`/api/milestones/${deleted.id}`);
    const issue = await addIssue(project.id, '영수증 정리');

    // When
    const responses = [
      await postIssueInMilestone(project.id, 999),
      await patchIssue(issue.id, { version: issue.version, milestoneId: 999 }),
      await postIssueInMilestone(project.id, deleted.id),
      await patchIssue(issue.id, { version: issue.version, milestoneId: deleted.id }),
    ];

    // Then
    expect(responses.map(({ status }) => status)).toEqual([404, 404, 404, 404]);
    for (const response of responses) {
      expect(errorResponseSchema.parse(response.body).code).toBe('MILESTONE_NOT_FOUND');
    }
  });

  test('미지정으로 돌릴 수 있도록 milestoneId에 null을 보내면 빼고 version만 올리며 이력은 남기지 않는다', async () => {
    // Given
    const project = await addProject('가계부');
    const milestone = await addMilestone(project.id);
    const issue = issueSchema.parse((await postIssueInMilestone(project.id, milestone.id)).body);

    // When
    const changed = await changeIssue(issue.id, { version: issue.version, milestoneId: null });

    // Then
    expect(changed).toMatchObject({ milestoneId: null, version: issue.version + 1 });
    expect(await readEventKinds(issue.id)).toEqual(['CREATED']);
  });

  test('닫힌 마일스톤에 할 일이 생기지 않도록 그 마일스톤의 닫힌 이슈를 다시 열면 MILESTONE_CLOSED를 주고 그대로 둔다', async () => {
    // Given
    const project = await addProject('가계부');
    const milestone = await addMilestone(project.id);
    const done = await addDoneIssueInMilestone(project.id, milestone.id);
    await closeMilestone(milestone.id);

    // When
    const response = await patchIssue(done.id, { version: done.version, status: 'TODO' });

    // Then
    expect(response.status).toBe(409);
    expect(errorResponseSchema.parse(response.body).code).toBe('MILESTONE_CLOSED');
    const after = issueSchema.parse((await request(server).get(`/api/issues/${done.id}`)).body);
    expect(after).toEqual(done);
  });

  test('닫은 뒤 마일스톤을 닫았으면 되돌리기로 열린 이슈가 생기지 않도록 MILESTONE_CLOSED를 주고, 마일스톤을 다시 열면 되돌린다', async () => {
    // Given: 이슈를 닫고 바로 마일스톤을 닫음
    const project = await addProject('가계부');
    const milestone = await addMilestone(project.id);
    const done = await addDoneIssueInMilestone(project.id, milestone.id);
    await closeMilestone(milestone.id);

    // When
    const blocked = await request(server)
      .post(`/api/issues/${done.id}/undo-status`)
      .send({ version: done.version });
    await request(server).post(`/api/milestones/${milestone.id}/reopen`);
    const undone = await request(server)
      .post(`/api/issues/${done.id}/undo-status`)
      .send({ version: done.version });

    // Then
    expect(blocked.status).toBe(409);
    expect(errorResponseSchema.parse(blocked.body).code).toBe('MILESTONE_CLOSED');
    expect(undone.status).toBe(200);
    expect(issueSchema.parse(undone.body).status).toBe('TODO');
  });

  test('끝난 일이 다른 묶음으로 옮겨지지 않도록 닫힌 이슈의 마일스톤을 바꾸면 ISSUE_CLOSED를 준다', async () => {
    // Given
    const project = await addProject('가계부');
    const milestone = await addMilestone(project.id);
    const other = await addMilestone(project.id, '1월 정리');
    const done = await addDoneIssueInMilestone(project.id, milestone.id);

    // When
    const response = await patchIssue(done.id, { version: done.version, milestoneId: other.id });

    // Then
    expect(response.status).toBe(409);
    expect(errorResponseSchema.parse(response.body).code).toBe('ISSUE_CLOSED');
  });

  test('화면이 지금 값을 함께 보내도 막지 않도록 닫힌 마일스톤의 닫힌 이슈에 같은 마일스톤을 보내면 200에 version 그대로 준다', async () => {
    // Given
    const project = await addProject('가계부');
    const milestone = await addMilestone(project.id);
    const done = await addDoneIssueInMilestone(project.id, milestone.id);
    await closeMilestone(milestone.id);

    // When
    const response = await patchIssue(done.id, {
      version: done.version,
      milestoneId: milestone.id,
    });

    // Then
    expect(response.status).toBe(200);
    expect(issueSchema.parse(response.body).version).toBe(done.version);
  });
});
