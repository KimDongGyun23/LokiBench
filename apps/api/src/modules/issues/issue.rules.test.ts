import {
  type IssueStatus,
  type OpenIssueStatus,
  STATUS_UNDO_WINDOW_MS,
} from '@lokibench/shared/values';

import type { ClosedIssue, IssueEvent, OpenIssue } from './issue.model';
import { applyIssueUpdate, undoIssueStatus } from './issue.rules';

const CREATED_AT = new Date('2026-11-20T09:00:00.000Z');
const CLOSED_AT = new Date('2026-11-21T09:00:00.000Z');
const NOW = new Date('2026-11-22T09:00:00.000Z');

// 되돌리기 테스트에서 마지막으로 상태를 바꾼 시각 (NOW의 1분 전)
const CHANGED_AT = new Date('2026-11-22T08:59:00.000Z');

// 주어진 상태의 열린 이슈를 만듦
function openIssue(status: OpenIssueStatus = 'TODO'): OpenIssue {
  return {
    id: 1,
    projectId: 1,
    number: 1,
    title: '읽은 책 별점 입력',
    due: '2026-11-30',
    status,
    statusChangedAt: CREATED_AT,
    version: 3,
    createdAt: CREATED_AT,
    closedAt: null,
  };
}

// CLOSED_AT에 닫힌 이슈를 만듦
function closedIssue(): ClosedIssue {
  return { ...openIssue(), status: 'DONE', statusChangedAt: CLOSED_AT, closedAt: CLOSED_AT };
}

// CREATED_AT에 남은 만든 이력을 만듦
function createdEvent(): IssueEvent {
  return { id: 1, issueId: 1, at: CREATED_AT, kind: 'CREATED' };
}

// 주어진 시각의 상태 변경 이력을 만듦
function statusEvent(id: number, at: Date, from: IssueStatus, to: IssueStatus): IssueEvent {
  return { id, issueId: 1, at, kind: 'STATUS', from, to };
}

describe('상태 이동', () => {
  test('보드에서 열을 건너뛰어 옮길 수 있도록 열린 이슈는 인접하지 않은 상태로도 옮긴다', () => {
    // When
    const result = applyIssueUpdate(openIssue('TODO'), { status: 'IN_REVIEW' }, NOW);

    // Then
    expect(result).toMatchObject({ kind: 'changed', issue: { status: 'IN_REVIEW' } });
  });

  test('언제 닫았는지 남기기 위해 DONE으로 옮기면 닫은 시각을 그 시각으로 적는다', () => {
    // When
    const result = applyIssueUpdate(openIssue('IN_PROGRESS'), { status: 'DONE' }, NOW);

    // Then
    expect(result).toMatchObject({ kind: 'changed', issue: { status: 'DONE', closedAt: NOW } });
  });

  test('다시 연 이슈가 닫힌 것으로 세어지지 않도록 DONE에서 TODO로 옮기면 닫은 시각을 비운다', () => {
    // When
    const result = applyIssueUpdate(closedIssue(), { status: 'TODO' }, NOW);

    // Then
    expect(result).toMatchObject({ kind: 'changed', issue: { status: 'TODO', closedAt: null } });
  });

  test('다시 여는 길을 하나로 두기 위해 DONE에서 TODO가 아닌 상태로는 옮기지 못한다', () => {
    // When
    const attempt = () => applyIssueUpdate(closedIssue(), { status: 'IN_PROGRESS' }, NOW);

    // Then
    expect(attempt).toThrow(expect.objectContaining({ code: 'ISSUE_TRANSITION_NOT_ALLOWED' }));
  });
});

describe('수정 적용', () => {
  test('되돌리기가 이전 상태를 찾을 수 있도록 상태를 바꾸면 이력과 바꾼 시각을 함께 남긴다', () => {
    // When
    const result = applyIssueUpdate(openIssue('TODO'), { status: 'IN_PROGRESS' }, NOW);

    // Then
    expect(result).toEqual({
      kind: 'changed',
      issue: { ...openIssue('IN_PROGRESS'), statusChangedAt: NOW, version: 4 },
      event: { at: NOW, from: 'TODO', to: 'IN_PROGRESS' },
    });
  });

  test('제목만 바꾸면 이력을 남기지 않고 상태를 바꾼 시각도 그대로 둔다', () => {
    // When
    const result = applyIssueUpdate(openIssue(), { title: '별점 입력 화면' }, NOW);

    // Then
    expect(result).toEqual({
      kind: 'changed',
      issue: { ...openIssue(), title: '별점 입력 화면', version: 4 },
      event: null,
    });
  });

  test('마감을 지우는 요청을 받기 위해 마감 null은 마감 없음으로 바꾼다', () => {
    // When
    const result = applyIssueUpdate(openIssue(), { due: null }, NOW);

    // Then
    expect(result).toMatchObject({ kind: 'changed', issue: { due: null, version: 4 } });
  });

  test('요청 한 번이 수정 한 번으로 세어지도록 제목과 상태를 함께 바꿔도 version은 1만 올린다', () => {
    // When
    const result = applyIssueUpdate(
      openIssue('TODO'),
      { title: '별점 입력 화면', status: 'IN_PROGRESS' },
      NOW,
    );

    // Then
    expect(result).toMatchObject({
      kind: 'changed',
      issue: { title: '별점 입력 화면', status: 'IN_PROGRESS', version: 4 },
    });
  });

  test('빈 수정으로 version이 오르지 않도록 지금과 같은 값만 보내면 바뀐 것이 없다고 답한다', () => {
    // Given
    const issue = openIssue('TODO');

    // When
    const result = applyIssueUpdate(
      issue,
      { title: issue.title, due: issue.due, status: 'TODO' },
      NOW,
    );

    // Then
    expect(result).toEqual({ kind: 'unchanged' });
  });

  test('마감이 없는 이슈에 마감 null을 보내면 바뀐 것이 없다고 답한다', () => {
    // Given
    const issue = { ...openIssue(), due: null };

    // When
    const result = applyIssueUpdate(issue, { due: null }, NOW);

    // Then
    expect(result).toEqual({ kind: 'unchanged' });
  });
});

describe('닫힌 이슈 수정', () => {
  test('끝난 일의 기록을 지키기 위해 닫힌 이슈에 다른 제목을 보내면 거부한다', () => {
    // When
    const attempt = () => applyIssueUpdate(closedIssue(), { title: '별점 입력 화면' }, NOW);

    // Then
    expect(attempt).toThrow(expect.objectContaining({ code: 'ISSUE_CLOSED' }));
  });

  test('끝난 일의 기록을 지키기 위해 닫힌 이슈에 다른 마감을 보내면 거부한다', () => {
    // When
    const attempt = () => applyIssueUpdate(closedIssue(), { due: null }, NOW);

    // Then
    expect(attempt).toThrow(expect.objectContaining({ code: 'ISSUE_CLOSED' }));
  });

  test('화면이 모든 칸을 함께 보내도 되도록 닫힌 이슈에 지금과 같은 제목을 보내면 거부하지 않는다', () => {
    // Given
    const issue = closedIssue();

    // When
    const result = applyIssueUpdate(issue, { title: issue.title, status: 'DONE' }, NOW);

    // Then
    expect(result).toEqual({ kind: 'unchanged' });
  });

  test('다시 열기와 내용 수정을 한 번에 하지 못하도록 TODO와 다른 제목을 함께 보내면 거부한다', () => {
    // When
    const attempt = () =>
      applyIssueUpdate(closedIssue(), { title: '별점 입력 화면', status: 'TODO' }, NOW);

    // Then
    expect(attempt).toThrow(expect.objectContaining({ code: 'ISSUE_CLOSED' }));
  });

  test('닫힌 이슈라는 안내가 먼저 나오도록 못 가는 상태와 다른 제목을 함께 보내면 닫힘으로 거부한다', () => {
    // When
    const attempt = () =>
      applyIssueUpdate(closedIssue(), { title: '별점 입력 화면', status: 'IN_PROGRESS' }, NOW);

    // Then
    expect(attempt).toThrow(expect.objectContaining({ code: 'ISSUE_CLOSED' }));
  });
});

describe('상태 되돌리기', () => {
  test('되돌릴 상태 변경이 없으므로 마지막 이력이 만든 이력이면 거부한다', () => {
    // When
    const attempt = () => undoIssueStatus(openIssue(), [createdEvent()], NOW);

    // Then
    expect(attempt).toThrow(expect.objectContaining({ code: 'ISSUE_UNDO_NOTHING' }));
  });

  test('닫은 것을 되돌리면 이전 상태로 돌리고 닫은 시각을 비우며 바꾼 시각은 앞 이력의 시각으로 돌린다', () => {
    // Given: CHANGED_AT에 TODO에서 DONE으로 닫힌 이슈
    const issue = { ...closedIssue(), statusChangedAt: CHANGED_AT, closedAt: CHANGED_AT };
    const events = [statusEvent(2, CHANGED_AT, 'TODO', 'DONE'), createdEvent()];

    // When
    const result = undoIssueStatus(issue, events, NOW);

    // Then
    expect(result).toEqual({
      issue: { ...openIssue('TODO'), statusChangedAt: CREATED_AT, version: 4 },
      removedEventId: 2,
    });
  });

  test('다시 연 것을 되돌리면 닫은 시각과 바꾼 시각이 닫았던 시각으로 돌아온다', () => {
    // Given: CLOSED_AT에 닫았다가 CHANGED_AT에 다시 연 이슈
    const issue = { ...openIssue('TODO'), statusChangedAt: CHANGED_AT };
    const events = [
      statusEvent(3, CHANGED_AT, 'DONE', 'TODO'),
      statusEvent(2, CLOSED_AT, 'TODO', 'DONE'),
    ];

    // When
    const result = undoIssueStatus(issue, events, NOW);

    // Then
    expect(result).toEqual({ issue: { ...closedIssue(), version: 4 }, removedEventId: 3 });
  });

  test('실수를 바로잡을 시간을 주기 위해 바꾼 직후부터 정확히 5분 뒤까지는 되돌릴 수 있다', () => {
    // Given: CHANGED_AT에 TODO에서 IN_PROGRESS로 옮긴 이슈
    const issue = { ...openIssue('IN_PROGRESS'), statusChangedAt: CHANGED_AT };
    const events = [statusEvent(2, CHANGED_AT, 'TODO', 'IN_PROGRESS'), createdEvent()];
    const windowEnd = new Date(CHANGED_AT.getTime() + STATUS_UNDO_WINDOW_MS);

    // When
    const atOnce = undoIssueStatus(issue, events, CHANGED_AT);
    const atWindowEnd = undoIssueStatus(issue, events, windowEnd);

    // Then
    expect(atOnce.issue.status).toBe('TODO');
    expect(atWindowEnd.issue.status).toBe('TODO');
  });

  test('규칙을 마지막 상태 변경 하나로 두기 위해 되돌린 뒤 다시 되돌리면 그 앞 변경이 대상이 된다', () => {
    // Given: 2분 전에 IN_PROGRESS로, 1분 전에 IN_REVIEW로 옮긴 이슈를 한 번 되돌림
    const earlierAt = new Date(CHANGED_AT.getTime() - 60 * 1000);
    const earlier = statusEvent(2, earlierAt, 'TODO', 'IN_PROGRESS');
    const later = statusEvent(3, CHANGED_AT, 'IN_PROGRESS', 'IN_REVIEW');
    const issue = { ...openIssue('IN_REVIEW'), statusChangedAt: CHANGED_AT };
    const first = undoIssueStatus(issue, [later, earlier], NOW);

    // When: 남은 이력으로 한 번 더 되돌림
    const second = undoIssueStatus(first.issue, [earlier, createdEvent()], NOW);

    // Then
    expect(first.issue).toMatchObject({ status: 'IN_PROGRESS', statusChangedAt: earlierAt });
    expect(second).toEqual({
      issue: { ...openIssue('TODO'), statusChangedAt: CREATED_AT, version: 5 },
      removedEventId: 2,
    });
  });

  test('오래된 변경을 뒤늦게 뒤집지 못하도록 5분을 1ms라도 넘기면 거부한다', () => {
    // Given: CHANGED_AT에 TODO에서 IN_PROGRESS로 옮긴 이슈
    const issue = { ...openIssue('IN_PROGRESS'), statusChangedAt: CHANGED_AT };
    const events = [statusEvent(2, CHANGED_AT, 'TODO', 'IN_PROGRESS'), createdEvent()];
    const afterWindow = new Date(CHANGED_AT.getTime() + STATUS_UNDO_WINDOW_MS + 1);

    // When
    const attempt = () => undoIssueStatus(issue, events, afterWindow);

    // Then
    expect(attempt).toThrow(expect.objectContaining({ code: 'ISSUE_UNDO_EXPIRED' }));
  });

  test('어긋난 데이터를 규칙 위반으로 숨기지 않도록 이력의 새 상태가 지금 상태와 다르면 내부 오류로 던진다', () => {
    // Given: 이력은 IN_PROGRESS로 옮겼다고 하는데 이슈는 IN_REVIEW임
    const issue = { ...openIssue('IN_REVIEW'), statusChangedAt: CHANGED_AT };
    const events = [statusEvent(2, CHANGED_AT, 'TODO', 'IN_PROGRESS'), createdEvent()];

    // When
    const attempt = () => undoIssueStatus(issue, events, NOW);

    // Then
    expect(attempt).toThrow('이슈 이력이 지금 상태와 이어지지 않음: issueId=1');
  });

  test('어긋난 데이터를 규칙 위반으로 숨기지 않도록 상태 변경 이력의 앞 이력이 없으면 내부 오류로 던진다', () => {
    // Given: 만든 이력 없이 상태 변경 이력만 있음
    const issue = { ...openIssue('IN_PROGRESS'), statusChangedAt: CHANGED_AT };
    const events = [statusEvent(2, CHANGED_AT, 'TODO', 'IN_PROGRESS')];

    // When
    const attempt = () => undoIssueStatus(issue, events, NOW);

    // Then
    expect(attempt).toThrow('되돌릴 이력의 앞 이력이 없음: issueId=1');
  });

  test('틀린 닫은 시각이 저장되지 않도록 앞 이력이 되돌릴 상태로 간 이력이 아니면 내부 오류로 던진다', () => {
    // Given: 다시 연 이력 앞에 닫은 이력이 없고 만든 이력만 있음
    const issue = { ...openIssue('TODO'), statusChangedAt: CHANGED_AT };
    const afterCreated = [statusEvent(2, CHANGED_AT, 'DONE', 'TODO'), createdEvent()];

    // Given: 앞 이력은 IN_REVIEW로 갔는데 마지막 이력은 IN_PROGRESS에서 왔다고 함
    const afterStatus = [
      statusEvent(3, CHANGED_AT, 'IN_PROGRESS', 'TODO'),
      statusEvent(2, CLOSED_AT, 'TODO', 'IN_REVIEW'),
    ];

    // When
    const attemptAfterCreated = () => undoIssueStatus(issue, afterCreated, NOW);
    const attemptAfterStatus = () => undoIssueStatus(issue, afterStatus, NOW);

    // Then
    expect(attemptAfterCreated).toThrow('되돌릴 이력이 앞 이력과 이어지지 않음: issueId=1');
    expect(attemptAfterStatus).toThrow('되돌릴 이력이 앞 이력과 이어지지 않음: issueId=1');
  });
});
