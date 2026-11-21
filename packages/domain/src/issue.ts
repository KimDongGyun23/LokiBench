// 배열 순서가 보드의 열 순서이고, 닫힌 상태는 DONE 하나임
export const ISSUE_STATUSES = ['TODO', 'IN_PROGRESS', 'IN_REVIEW', 'DONE'] as const;
export type IssueStatus = (typeof ISSUE_STATUSES)[number];

// 이슈 제목 최대 길이
export const ISSUE_TITLE_MAX_LENGTH = 200;
