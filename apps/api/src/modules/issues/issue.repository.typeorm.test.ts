import { DataSource } from 'typeorm';

import { createDataSourceOptions } from '@/database/data-source-options';

import type { Issue, IssueChanges, SaveIssueChangeInput, SaveIssueUndoInput } from './issue.model';
import { TypeOrmIssueRepository } from './issue.repository.typeorm';
import { applyIssueUpdate, undoIssueStatus } from './issue.rules';

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

// 만든 이슈를 고치는 시각
const LATER = new Date('2026-11-22T09:01:00.000Z');

// 프로젝트 1에 이슈 하나를 만듦
function createIssue(): Promise<Issue> {
  return repository.create({ projectId: 1, title: '읽은 책 별점 입력', due: null, now: NOW });
}

/**
 * 규칙 함수로 수정 요청을 적용해 saveChange에 넘길 값을 만든다.
 *
 * @param params.issue 지금 저장돼 있는 이슈
 * @param params.changes 바꾸려는 칸
 * @returns saveChange에 넘길 값
 */
function buildChange({
  issue,
  changes,
}: {
  issue: Issue;
  changes: IssueChanges;
}): SaveIssueChangeInput {
  const result = applyIssueUpdate(issue, changes, LATER);
  if (result.kind === 'unchanged') throw new Error('바뀐 것이 없는 수정 요청임');

  return { issue: result.issue, expectedVersion: issue.version, event: result.event };
}

/**
 * 이슈를 진행 중으로 옮겨 저장한 뒤, 규칙 함수로 그 변경을 되돌려 saveUndo에 넘길 값을 만든다.
 *
 * @returns 진행 중으로 옮긴 이슈와 saveUndo에 넘길 값
 */
async function prepareUndo(): Promise<{ moved: Issue; undo: SaveIssueUndoInput }> {
  const created = await createIssue();
  const moved = await repository.saveChange(
    buildChange({ issue: created, changes: { status: 'IN_PROGRESS' } }),
  );
  if (moved === null) throw new Error('진행 중으로 옮기지 못함');

  const events = await repository.findLastEvents(moved.id, 2);
  const result = undoIssueStatus(moved, events, LATER);
  return { moved, undo: { ...result, expectedVersion: moved.version } };
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

describe('이슈 수정 저장', () => {
  test('상태와 이력이 어긋나지 않도록 상태를 바꾼 이슈와 상태 변경 이력을 함께 저장한다', async () => {
    // Given: TODO 이슈를 진행 중으로 옮긴 결과
    const created = await createIssue();
    const change = buildChange({ issue: created, changes: { status: 'IN_PROGRESS' } });

    // When
    const saved = await repository.saveChange(change);

    // Then
    expect(saved).toEqual(change.issue);
    expect(await repository.findById(created.id)).toEqual(change.issue);
    expect(await repository.findLastEvents(created.id, 1)).toEqual([
      { id: 2, issueId: created.id, at: LATER, kind: 'STATUS', from: 'TODO', to: 'IN_PROGRESS' },
    ]);
  });

  test('다른 탭의 수정을 덮어쓰지 않도록 기대한 version이 아니면 아무것도 적지 않고 null을 준다', async () => {
    // Given: 이미 다른 수정이 version을 올린 것처럼 기대한 version을 다르게 넘김
    const created = await createIssue();
    const change = buildChange({ issue: created, changes: { title: '독서 목표 설정' } });

    // When
    const saved = await repository.saveChange({ ...change, expectedVersion: 3 });

    // Then
    expect(saved).toBeNull();
    expect(await repository.findById(created.id)).toEqual(created);
  });

  test('두 탭의 수정이 함께 들어와도 하나만 반영되도록 같은 version의 저장 둘 중 하나는 null을 받고 이력도 한 줄만 늘어난다', async () => {
    // Given
    const created = await createIssue();

    // When: 같은 version을 기대하는 저장 둘을 함께 시작함
    const results = await Promise.all([
      repository.saveChange(buildChange({ issue: created, changes: { status: 'IN_PROGRESS' } })),
      repository.saveChange(buildChange({ issue: created, changes: { status: 'IN_REVIEW' } })),
    ]);

    // Then
    expect(results.filter((result) => result === null)).toHaveLength(1);
    expect(await repository.findLastEvents(created.id, 3)).toHaveLength(2);
  });

  test('이력 없는 상태 변경이 남지 않도록 이력 저장이 실패하면 이슈의 상태와 version도 그대로 둔다', async () => {
    // Given: 이력 저장이 실패하도록 테이블 이름을 바꿔 둠
    const created = await createIssue();
    await dataSource.query(`ALTER TABLE issue_events RENAME TO issue_events_broken`);

    // When
    const attempt = repository.saveChange(
      buildChange({ issue: created, changes: { status: 'IN_PROGRESS' } }),
    );

    // Then
    await expect(attempt).rejects.toThrow();
    expect(await repository.findById(created.id)).toEqual(created);
  });
});

describe('상태 되돌리기 저장', () => {
  test('같은 변경을 두 번 되돌리지 않도록 되돌린 이슈를 저장하면서 그 상태 변경 이력을 지운다', async () => {
    // Given: 진행 중으로 옮긴 이슈를 되돌린 결과
    const { moved, undo } = await prepareUndo();

    // When
    const saved = await repository.saveUndo(undo);

    // Then: 이슈는 넘긴 값대로이고 남은 이력은 만든 이력 한 줄뿐임
    expect(saved).toEqual(undo.issue);
    expect(await repository.findById(moved.id)).toEqual(undo.issue);
    expect(await repository.findLastEvents(moved.id, 2)).toEqual([
      { id: 1, issueId: moved.id, at: NOW, kind: 'CREATED' },
    ]);
  });

  test('다른 탭의 수정을 덮어쓰지 않도록 기대한 version이 아니면 이력도 지우지 않고 null을 준다', async () => {
    // Given
    const { moved, undo } = await prepareUndo();

    // When
    const saved = await repository.saveUndo({ ...undo, expectedVersion: moved.version + 1 });

    // Then
    expect(saved).toBeNull();
    expect(await repository.findById(moved.id)).toEqual(moved);
    expect(await repository.findLastEvents(moved.id, 3)).toHaveLength(2);
  });

  test('이력과 이슈가 어긋나지 않도록 지울 이력이 없으면 던지고 이슈도 그대로 둔다', async () => {
    // Given: 지울 이력 id가 없는 값
    const { moved, undo } = await prepareUndo();

    // When
    const attempt = repository.saveUndo({ ...undo, removedEventId: 999 });

    // Then
    await expect(attempt).rejects.toThrow('지울 이슈 이력이 없음: issueId=1, eventId=999');
    expect(await repository.findById(moved.id)).toEqual(moved);
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
