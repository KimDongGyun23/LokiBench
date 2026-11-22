import { CLOSED_ISSUE_STATUS, type IssueStatus, REOPEN_ISSUE_STATUS } from '@lokibench/domain';

import { DomainError } from '../../common/domain-error';
import type { Issue, IssueChanges, NewStatusEvent } from './issue.model';

// 수정 요청을 이슈에 적용한 결과
export type IssueUpdateResult =
  { kind: 'unchanged' } | { kind: 'changed'; issue: Issue; event: NewStatusEvent | null };

/**
 * 수정 요청을 이슈에 적용해 저장할 이슈와 남길 이력을 정한다.
 *
 * - 닫힌 이슈는 상태만 바꿀 수 있고, 지금과 다른 제목이나 마감이 섞여 있으면 요청을 통째로 거부한다
 * - 닫힌 이슈는 TODO로만 다시 열 수 있고, 열린 이슈는 어느 상태로든 옮길 수 있다
 * - 지금과 같은 값만 들어 있으면 바뀐 것이 없다고 답해 version이 오르지 않게 한다
 *
 * @param issue 지금 저장돼 있는 이슈
 * @param changes 바꾸려는 칸
 * @param now 수정 시각
 * @returns 바뀐 것이 없다는 답, 또는 version이 1 오른 이슈와 상태가 바뀌었을 때의 이력
 * @throws {DomainError} ISSUE_CLOSED, ISSUE_TRANSITION_NOT_ALLOWED
 */
export function applyIssueUpdate(
  issue: Issue,
  changes: IssueChanges,
  now: Date,
): IssueUpdateResult {
  const title = changes.title ?? issue.title;
  const due = changes.due === undefined ? issue.due : changes.due;
  const status = changes.status ?? issue.status;

  const isContentChanged = title !== issue.title || due !== issue.due;
  const isStatusChanged = status !== issue.status;
  const isClosed = issue.status === CLOSED_ISSUE_STATUS;

  // 닫힌 이슈는 제목과 마감을 바꿀 수 없음
  if (isClosed && isContentChanged) throw new DomainError('ISSUE_CLOSED');

  // 닫힌 이슈는 TODO로만 다시 열 수 있음
  const isForbiddenReopen = isClosed && isStatusChanged && status !== REOPEN_ISSUE_STATUS;
  if (isForbiddenReopen) throw new DomainError('ISSUE_TRANSITION_NOT_ALLOWED');

  // 지금과 같은 값만 왔으면 아무것도 저장하지 않음
  if (!isContentChanged && !isStatusChanged) return { kind: 'unchanged' };

  const version = issue.version + 1;

  // 제목이나 마감만 바뀌면 이력을 남기지 않음
  if (!isStatusChanged) {
    return { kind: 'changed', issue: { ...issue, title, due, version }, event: null };
  }

  return {
    kind: 'changed',
    issue: withStatus({ ...issue, title, due, version }, status, now),
    event: { at: now, from: issue.status, to: status },
  };
}

/**
 * 이슈의 상태를 바꾸고 상태에 딸린 시각을 맞춘다.
 *
 * - 닫힌 상태로 가면 닫은 시각을 그 시각으로 적고, 열린 상태로 가면 비운다
 *
 * @param issue 상태를 바꿀 이슈
 * @param status 새 상태
 * @param at 상태를 바꾼 시각
 * @returns 새 상태의 이슈
 */
function withStatus(issue: Issue, status: IssueStatus, at: Date): Issue {
  const { id, projectId, number, title, due, version, createdAt } = issue;
  const base = { id, projectId, number, title, due, version, createdAt, statusChangedAt: at };

  if (status === CLOSED_ISSUE_STATUS) return { ...base, status, closedAt: at };
  return { ...base, status, closedAt: null };
}
