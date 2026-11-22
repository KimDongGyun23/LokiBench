// 이슈 상태 목록 (순서가 보드의 열 순서)
export const ISSUE_STATUSES = ['TODO', 'IN_PROGRESS', 'IN_REVIEW', 'DONE'] as const;
export type IssueStatus = (typeof ISSUE_STATUSES)[number];

// 닫힌 이슈의 상태
export const CLOSED_ISSUE_STATUS = 'DONE' satisfies IssueStatus;
export type ClosedIssueStatus = typeof CLOSED_ISSUE_STATUS;

// 닫히지 않은 이슈가 가질 수 있는 상태
export type OpenIssueStatus = Exclude<IssueStatus, ClosedIssueStatus>;

// 새로 만든 이슈가 처음 갖는 상태
export const INITIAL_ISSUE_STATUS = 'TODO' satisfies OpenIssueStatus;

// 닫힌 이슈를 다시 열 때 갈 수 있는 유일한 상태
export const REOPEN_ISSUE_STATUS = 'TODO' satisfies OpenIssueStatus;

// 상태를 바꾼 뒤 되돌릴 수 있는 시간
export const STATUS_UNDO_WINDOW_MS = 5 * 60 * 1000;

// 이슈 규칙을 어겼을 때 알리는 오류 코드
export const ISSUE_ERROR_CODES = [
  'ISSUE_NOT_FOUND',
  'ISSUE_VERSION_CONFLICT',
  'ISSUE_TRANSITION_NOT_ALLOWED',
  'ISSUE_CLOSED',
  'ISSUE_UNDO_NOTHING',
  'ISSUE_UNDO_EXPIRED',
] as const;
export type IssueErrorCode = (typeof ISSUE_ERROR_CODES)[number];

// 이슈 제목 최대 길이
export const ISSUE_TITLE_MAX_LENGTH = 200;
