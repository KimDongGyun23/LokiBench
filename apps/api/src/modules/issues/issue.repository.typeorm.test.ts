import { DataSource } from 'typeorm';

import { createDataSourceOptions } from '@/database/data-source-options';

import { TypeOrmIssueRepository } from './issue.repository.typeorm';

const NOW = new Date('2026-11-22T09:00:00.000Z');

let dataSource: DataSource;
let repository: TypeOrmIssueRepository;

beforeEach(async () => {
  // HTTP와 service 없이 repository만 확인하려고 인메모리 DB에 프로젝트 하나만 넣고 시작함
  dataSource = await new DataSource(createDataSourceOptions(':memory:')).initialize();
  await dataSource.query(
    `INSERT INTO projects (name, color, created_at)
     VALUES ('독서 기록', 'indigo', '2026-11-01T00:00:00.000Z')`,
  );
  repository = new TypeOrmIssueRepository(dataSource);
});

afterEach(async () => {
  await dataSource.destroy();
});

// 번호 카운터의 지금 값을 읽음
async function readCounter(): Promise<unknown> {
  const rows: { value: number }[] = await dataSource.query(`SELECT value FROM issue_counter`);
  return rows[0]?.value;
}

// 이슈 행 수를 읽음
async function countIssues(): Promise<unknown> {
  const rows: { count: number }[] = await dataSource.query(`SELECT COUNT(*) AS count FROM issues`);
  return rows[0]?.count;
}

describe('이슈 만들기', () => {
  test('이슈와 이력이 어긋나지 않도록 새 이슈는 다음 번호와 처음 상태로 시작하고 만든 이력 한 줄을 같은 시각으로 남긴다', async () => {
    // When
    const issue = await repository.create({
      projectId: 1,
      title: '읽은 책 별점 입력',
      due: '2026-11-30',
      now: NOW,
    });

    // Then
    expect(issue).toEqual({
      id: 1,
      projectId: 1,
      number: 1,
      title: '읽은 책 별점 입력',
      due: '2026-11-30',
      status: 'TODO',
      statusChangedAt: NOW,
      version: 1,
      createdAt: NOW,
      closedAt: null,
    });
    expect(await repository.findLastEvents(issue.id, 2)).toEqual([
      { id: 1, issueId: issue.id, at: NOW, kind: 'CREATED' },
    ]);
    expect(await readCounter()).toBe(1);
  });

  test('번호가 겹치지 않도록 동시에 시작한 두 만들기는 서로 다른 번호를 받는다', async () => {
    // When: 앞 만들기를 기다리지 않고 둘을 함께 시작함
    const issues = await Promise.all([
      repository.create({ projectId: 1, title: '읽은 책 별점 입력', due: null, now: NOW }),
      repository.create({ projectId: 1, title: '독서 목표 설정', due: null, now: NOW }),
    ]);

    // Then
    expect(issues.map((issue) => issue.number)).toEqual([1, 2]);
    expect(await readCounter()).toBe(2);
  });

  test('번호에 빈 곳이 생기지 않도록 이력 저장이 실패하면 이슈와 카운터도 남기지 않는다', async () => {
    // Given: 이력 저장이 실패하도록 테이블 이름을 바꿔 둠
    await dataSource.query(`ALTER TABLE issue_events RENAME TO issue_events_broken`);

    // When
    const attempt = repository.create({
      projectId: 1,
      title: '읽은 책 별점 입력',
      due: null,
      now: NOW,
    });

    // Then
    await expect(attempt).rejects.toThrow();
    expect(await countIssues()).toBe(0);
    expect(await readCounter()).toBe(0);
  });

  test('한 번의 실패가 뒤 요청을 막지 않도록 실패한 만들기 다음의 만들기는 정상 동작한다', async () => {
    // Given: 한 번 실패한 뒤 테이블 이름을 되돌림
    await dataSource.query(`ALTER TABLE issue_events RENAME TO issue_events_broken`);
    await repository
      .create({ projectId: 1, title: '읽은 책 별점 입력', due: null, now: NOW })
      .catch(() => undefined);
    await dataSource.query(`ALTER TABLE issue_events_broken RENAME TO issue_events`);

    // When
    const issue = await repository.create({
      projectId: 1,
      title: '독서 목표 설정',
      due: null,
      now: NOW,
    });

    // Then
    expect(issue.number).toBe(1);
  });
});

describe('이슈 읽기', () => {
  test('service가 ISSUE_NOT_FOUND로 바꿀 수 있도록 없는 id는 예외 대신 null을 준다', async () => {
    // When
    const issue = await repository.findById(999);

    // Then
    expect(issue).toBeNull();
  });
});

describe('이슈 이력 읽기', () => {
  test('되돌리기가 마지막 이력부터 보도록 최신 순으로 정한 개수만 준다', async () => {
    // Given: 만든 이력 뒤에 상태 변경 이력 둘을 직접 넣음
    const issue = await repository.create({
      projectId: 1,
      title: '읽은 책 별점 입력',
      due: null,
      now: NOW,
    });
    await dataSource.query(
      `INSERT INTO issue_events (issue_id, at, kind, payload) VALUES
       (1, '2026-11-22T09:01:00.000Z', 'STATUS', '{"from":"TODO","to":"IN_PROGRESS"}'),
       (1, '2026-11-22T09:02:00.000Z', 'STATUS', '{"from":"IN_PROGRESS","to":"DONE"}')`,
    );

    // When
    const events = await repository.findLastEvents(issue.id, 2);

    // Then
    expect(events.map((event) => event.id)).toEqual([3, 2]);
  });
});
