// 배열 순서가 보드의 열 순서임
export const ISSUE_STATUSES = ['TODO', 'IN_PROGRESS', 'IN_REVIEW', 'DONE'] as const;
export type IssueStatus = (typeof ISSUE_STATUSES)[number];

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
