import type { IssueEntity } from './issue.entity';
import { toIssueEntityUpdate, toIssueEventModel, toIssueModel } from './issue.mapper';
import type { IssueEventEntity } from './issue-event.entity';

// DB에서 읽은 닫힌 이슈 행
const CLOSED_ENTITY = {
  id: 7,
  projectId: 1,
  number: 3,
  title: '읽은 책 별점 입력',
  due: '2026-11-30',
  status: 'DONE',
  statusChangedAt: '2026-11-22T09:05:00.000Z',
  version: 4,
  createdAt: '2026-11-22T09:00:00.000Z',
  closedAt: '2026-11-22T09:05:00.000Z',
} satisfies IssueEntity;

// DB에서 읽은 상태 변경 이력 행
const STATUS_EVENT_ENTITY = {
  id: 9,
  issueId: 7,
  at: '2026-11-22T09:01:00.000Z',
  kind: 'STATUS',
  payload: '{"from":"TODO","to":"IN_PROGRESS"}',
} satisfies IssueEventEntity;

describe('도메인 이슈 모양', () => {
  test('도메인이 시각으로 바로 계산하도록 DB의 ISO 문자열을 Date로 바꾸고 마감 날짜는 그대로 둔다', () => {
    // When
    const issue = toIssueModel(CLOSED_ENTITY);

    // Then
    expect(issue).toEqual({
      id: 7,
      projectId: 1,
      number: 3,
      title: '읽은 책 별점 입력',
      due: '2026-11-30',
      status: 'DONE',
      statusChangedAt: new Date('2026-11-22T09:05:00.000Z'),
      version: 4,
      createdAt: new Date('2026-11-22T09:00:00.000Z'),
      closedAt: new Date('2026-11-22T09:05:00.000Z'),
    });
  });

  test('DB를 직접 고쳐 깨진 행을 바로 찾도록 시각으로 읽을 수 없으면 행 id와 열 이름을 담아 던진다', () => {
    // Given: 시각으로 읽을 수 없는 created_at
    const entity = { ...CLOSED_ENTITY, createdAt: '' };

    // When
    const attempt = () => toIssueModel(entity);

    // Then
    expect(attempt).toThrow('issues.created_at 시각 형식이 잘못됨: id=7');
  });

  test('닫은 시각 없는 닫힌 이슈가 규칙 계산에 들어가지 않도록 닫힌 상태인데 닫은 시각이 없으면 던진다', () => {
    // Given
    const entity = { ...CLOSED_ENTITY, closedAt: null };

    // When
    const attempt = () => toIssueModel(entity);

    // Then
    expect(attempt).toThrow('issues.status와 closed_at이 어긋남: id=7');
  });

  test('열린 이슈가 닫힌 것으로 세어지지 않도록 닫히지 않은 상태인데 닫은 시각이 있으면 던진다', () => {
    // Given
    const entity: IssueEntity = { ...CLOSED_ENTITY, status: 'IN_REVIEW' };

    // When
    const attempt = () => toIssueModel(entity);

    // Then
    expect(attempt).toThrow('issues.status와 closed_at이 어긋남: id=7');
  });
});

describe('도메인 이슈 이력 모양', () => {
  test('되돌리기가 이전 상태를 바로 쓰도록 상태 변경 이력의 JSON에서 이전 상태와 새 상태를 꺼내 준다', () => {
    // When
    const event = toIssueEventModel(STATUS_EVENT_ENTITY);

    // Then
    expect(event).toEqual({
      id: 9,
      issueId: 7,
      at: new Date('2026-11-22T09:01:00.000Z'),
      kind: 'STATUS',
      from: 'TODO',
      to: 'IN_PROGRESS',
    });
  });

  test('되돌리기가 엉뚱한 상태로 돌리지 않도록 상태 변경 이력에 새 상태가 빠져 있으면 행 id를 담아 던진다', () => {
    // Given
    const entity = { ...STATUS_EVENT_ENTITY, payload: '{"from":"TODO"}' };

    // When
    const attempt = () => toIssueEventModel(entity);

    // Then
    expect(attempt).toThrow('issue_events.payload 형식이 잘못됨: id=9');
  });

  test('JSON 오류 대신 깨진 행을 알리도록 상태 변경 이력이 JSON으로 읽히지 않아도 같은 오류로 던진다', () => {
    // Given
    const entity = { ...STATUS_EVENT_ENTITY, payload: 'TODO에서 진행 중으로' };

    // When
    const attempt = () => toIssueEventModel(entity);

    // Then
    expect(attempt).toThrow('issue_events.payload 형식이 잘못됨: id=9');
  });
});

describe('이슈 UPDATE 칸', () => {
  test('DB에서 다시 읽었을 때 같은 순간이 되도록 닫힌 이슈의 시각을 저장 형식의 ISO 글자로 바꾼다', () => {
    // Given: DB 행을 도메인으로 읽은 닫힌 이슈
    const issue = toIssueModel(CLOSED_ENTITY);

    // When
    const update = toIssueEntityUpdate(issue);

    // Then: 바뀌지 않는 칸은 빠지고 시각은 읽기 전과 같은 글자임
    expect(update).toEqual({
      title: '읽은 책 별점 입력',
      due: '2026-11-30',
      status: 'DONE',
      statusChangedAt: '2026-11-22T09:05:00.000Z',
      version: 4,
      closedAt: '2026-11-22T09:05:00.000Z',
    });
  });
});
