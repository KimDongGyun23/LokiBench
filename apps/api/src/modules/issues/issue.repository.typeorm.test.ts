import { ISSUE_STATUSES, type IssueStatus } from '@lokibench/shared/values';
import { DataSource } from 'typeorm';

import { createDataSourceOptions } from '@/database/data-source-options';
import { runExclusive } from '@/database/utils/run-exclusive';

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
 * 새 이슈를 정한 상태로 옮겨 저장한 뒤, 규칙 함수로 그 변경을 되돌려 saveUndo에 넘길 값을 만든다.
 *
 * @param status 옮길 상태
 * @returns 옮긴 이슈와 saveUndo에 넘길 값
 */
async function prepareUndo(
  status: IssueStatus = 'IN_PROGRESS',
): Promise<{ moved: Issue; undo: SaveIssueUndoInput }> {
  const created = await createIssue();
  const moved = await repository.saveChange(buildChange({ issue: created, changes: { status } }));
  if (moved === null) throw new Error(`${status}로 옮기지 못함`);

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

  test('상태 변경만 이력에 남도록 제목만 바꾸면 이슈와 version만 바뀌고 이력은 늘지 않는다', async () => {
    // Given
    const created = await createIssue();
    const change = buildChange({ issue: created, changes: { title: '독서 목표 설정' } });

    // When
    const saved = await repository.saveChange(change);

    // Then
    expect(saved).toMatchObject({ title: '독서 목표 설정', version: 2 });
    expect(await repository.findLastEvents(created.id, 2)).toEqual([
      { id: 1, issueId: created.id, at: NOW, kind: 'CREATED' },
    ]);
  });

  test('다시 연 이슈가 닫힌 것으로 남지 않도록 닫힌 이슈를 다시 열면 닫은 시각을 비운다', async () => {
    // Given: 닫은 이슈
    const created = await createIssue();
    const closed = await repository.saveChange(
      buildChange({ issue: created, changes: { status: 'DONE' } }),
    );
    if (closed === null) throw new Error('닫지 못함');

    // When
    const reopened = await repository.saveChange(
      buildChange({ issue: closed, changes: { status: 'TODO' } }),
    );

    // Then
    expect(reopened).toMatchObject({ status: 'TODO', closedAt: null });
    expect(await repository.findById(created.id)).toMatchObject({ status: 'TODO', closedAt: null });
  });

  test('다른 탭의 수정을 덮어쓰지 않도록 기대한 version이 아니면 아무것도 적지 않고 null을 준다', async () => {
    // Given: 이미 다른 수정이 version을 올린 것처럼 기대한 version을 다르게 넘김
    const created = await createIssue();
    const change = buildChange({ issue: created, changes: { title: '독서 목표 설정' } });

    // When
    const saved = await repository.saveChange({
      ...change,
      issue: { ...change.issue, version: 4 },
      expectedVersion: 3,
    });

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

describe('이슈 상태 저장', () => {
  test('공유 값에 상태를 더하고 마이그레이션을 빠뜨리지 않도록 모든 이슈 상태를 저장하고 다시 읽을 수 있다', async () => {
    // When: 상태마다 이슈를 만들어 그 상태로 옮긴 뒤 다시 읽음
    const statuses: unknown[] = [];
    for (const status of ISSUE_STATUSES) {
      const created = await createIssue();
      if (status !== created.status) {
        await repository.saveChange(buildChange({ issue: created, changes: { status } }));
      }
      const issue = await repository.findById(created.id);
      statuses.push(issue?.status);
    }

    // Then
    expect(statuses).toEqual([...ISSUE_STATUSES]);
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
    const saved = await repository.saveUndo({
      ...undo,
      issue: { ...undo.issue, version: moved.version + 2 },
      expectedVersion: moved.version + 1,
    });

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

describe('상태 되돌리기 저장의 경계', () => {
  test('되돌린 이슈가 닫힌 것으로 남지 않도록 닫은 변경을 되돌리면 닫은 시각을 비운다', async () => {
    // Given: 닫은 이슈를 되돌린 결과
    const { moved, undo } = await prepareUndo('DONE');

    // When
    const saved = await repository.saveUndo(undo);

    // Then
    expect(saved).toMatchObject({ status: 'TODO', closedAt: null });
    expect(await repository.findById(moved.id)).toMatchObject({ status: 'TODO', closedAt: null });
  });

  test('다른 이슈의 이력이 조용히 지워지지 않도록 다른 이슈의 이력 id를 넘기면 던지고 두 이슈 모두 그대로 둔다', async () => {
    // Given: 상태를 바꾼 이슈 둘
    const first = await prepareUndo();
    const second = await prepareUndo();
    const secondEvents = await repository.findLastEvents(second.moved.id, 2);

    // When: 첫 이슈를 되돌리면서 둘째 이슈의 상태 변경 이력 id를 넘김
    const attempt = repository.saveUndo({
      ...first.undo,
      removedEventId: second.undo.removedEventId,
    });

    // Then
    await expect(attempt).rejects.toThrow('지울 이슈 이력이 없음');
    expect(await repository.findById(first.moved.id)).toEqual(first.moved);
    expect(await repository.findLastEvents(second.moved.id, 2)).toEqual(secondEvents);
  });
});

describe('저장 입력의 짝', () => {
  test('겹친 수정을 잡는 version이 멈추지 않도록 저장할 이슈의 version이 기대한 version보다 1 크지 않으면 던진다', async () => {
    // Given: version을 올리지 않은 이슈
    const created = await createIssue();
    const change = buildChange({ issue: created, changes: { title: '독서 목표 설정' } });

    // When
    const attempt = repository.saveChange({ ...change, issue: { ...change.issue, version: 1 } });

    // Then
    await expect(attempt).rejects.toThrow(
      '저장할 version이 기대한 version의 다음이 아님: issueId=1',
    );
    expect(await repository.findById(created.id)).toEqual(created);
  });

  test('되돌리기의 기준이 사라지지 않도록 만든 이력의 id를 넘기면 지우지 않고 던진다', async () => {
    // Given: 지울 이력으로 만든 이력의 id를 넘김
    const { moved, undo } = await prepareUndo();

    // When
    const attempt = repository.saveUndo({ ...undo, removedEventId: 1 });

    // Then
    await expect(attempt).rejects.toThrow('지울 이슈 이력이 없음: issueId=1, eventId=1');
    expect(await repository.findLastEvents(moved.id, 3)).toHaveLength(2);
  });
});

describe('이슈 읽기', () => {
  test('트랜잭션 도중의 값을 읽지 않도록 같은 연결의 앞 작업이 끝난 뒤에 읽는다', async () => {
    // Given: 같은 연결에 늦게 끝나는 작업을 먼저 걸어 둠
    const created = await createIssue();
    const steps: string[] = [];
    const slowWork = runExclusive({
      dataSource,
      work: async () => {
        await new Promise((resolve) => setTimeout(resolve, 5));
        steps.push('앞 작업 끝');
      },
    });

    // When: 앞 작업을 기다리지 않고 세 읽기를 시작함
    await Promise.all([
      slowWork,
      repository.findById(created.id).then(() => steps.push('이슈 읽기 끝')),
      repository.findLastEvents(created.id, 2).then(() => steps.push('이력 읽기 끝')),
      repository.countOpenByProject().then(() => steps.push('열린 이슈 수 읽기 끝')),
    ]);

    // Then
    expect(steps).toEqual(['앞 작업 끝', '이슈 읽기 끝', '이력 읽기 끝', '열린 이슈 수 읽기 끝']);
  });

  test('service가 ISSUE_NOT_FOUND로 바꿀 수 있도록 없는 id는 예외 대신 null을 준다', async () => {
    // When
    const issue = await repository.findById(999);

    // Then
    expect(issue).toBeNull();
  });
});

describe('프로젝트의 이슈 목록 읽기', () => {
  test('목록이 번호 순서를 지키도록 그 프로젝트의 이슈만 번호 오름차순으로 준다', async () => {
    // Given: 행을 넣은 순서와 번호 순서가 다르고, 다른 프로젝트의 이슈가 섞임
    await dataSource.query(
      `INSERT INTO projects (name, color, created_at)
       VALUES ('가계부', 'teal', '2026-11-01T00:00:00.000Z')`,
    );
    await dataSource.query(
      `INSERT INTO issues (project_id, number, title, status, status_changed_at, version, created_at)
       VALUES (1, 5, '독서 목표 설정', 'TODO', '${NOW.toISOString()}', 1, '${NOW.toISOString()}'),
              (2, 3, '이번 달 영수증 정리', 'TODO', '${NOW.toISOString()}', 1, '${NOW.toISOString()}'),
              (1, 2, '읽은 책 별점 입력', 'TODO', '${NOW.toISOString()}', 1, '${NOW.toISOString()}')`,
    );

    // When
    const issues = await repository.findByProject(1);

    // Then
    expect(issues.map((issue) => issue.number)).toEqual([2, 5]);
  });

  test('없는 프로젝트를 오류 없이 다루도록 이슈가 없으면 빈 배열을 준다', async () => {
    // When
    const issues = await repository.findByProject(999);

    // Then
    expect(issues).toEqual([]);
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

  test('되돌리기가 다른 이슈의 이력을 보지 않도록 이력이 섞여 있어도 그 이슈의 이력만 준다', async () => {
    // Given: 두 이슈의 이력이 번갈아 쌓임
    const first = await createIssue();
    const second = await createIssue();
    await repository.saveChange(buildChange({ issue: first, changes: { status: 'IN_PROGRESS' } }));

    // When
    const events = await repository.findLastEvents(second.id, 3);

    // Then
    expect(events).toEqual([{ id: 2, issueId: second.id, at: NOW, kind: 'CREATED' }]);
  });
});

describe('프로젝트별 열린 이슈 수 읽기', () => {
  test('약속한 순서를 지키도록 행을 넣은 순서와 상관없이 프로젝트 id 오름차순으로 준다', async () => {
    // Given: 프로젝트 2의 이슈를 먼저 넣고 프로젝트 1의 이슈를 나중에 넣음
    await dataSource.query(
      `INSERT INTO projects (name, color, created_at)
       VALUES ('가계부', 'teal', '2026-11-01T00:00:00.000Z')`,
    );
    await dataSource.query(
      `INSERT INTO issues (project_id, number, title, status, status_changed_at, version, created_at)
       VALUES (2, 1, '이번 달 영수증 정리', 'TODO', '${NOW.toISOString()}', 1, '${NOW.toISOString()}'),
              (2, 2, '카드값 확인', 'IN_REVIEW', '${NOW.toISOString()}', 1, '${NOW.toISOString()}'),
              (1, 3, '읽은 책 별점 입력', 'TODO', '${NOW.toISOString()}', 1, '${NOW.toISOString()}')`,
    );

    // When
    const counts = await repository.countOpenByProject();

    // Then
    expect(counts).toEqual([
      { projectId: 1, count: 1 },
      { projectId: 2, count: 2 },
    ]);
  });
});
