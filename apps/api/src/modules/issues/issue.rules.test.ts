import type { OpenIssueStatus } from '@lokibench/domain';

import type { ClosedIssue, OpenIssue } from './issue.model';
import { applyIssueUpdate } from './issue.rules';

const CREATED_AT = new Date('2026-11-20T09:00:00.000Z');
const CLOSED_AT = new Date('2026-11-21T09:00:00.000Z');
const NOW = new Date('2026-11-22T09:00:00.000Z');

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
