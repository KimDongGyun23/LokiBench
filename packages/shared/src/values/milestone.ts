// 마일스톤 제목 최대 길이 (관리 표 한 줄에 들어가는 기준)
export const MILESTONE_TITLE_MAX_LENGTH = 50;

// 배경, 해결방안, 기대효과, 메모 한 칸의 최대 길이
export const MILESTONE_TEXT_MAX_LENGTH = 2000;

// 마일스톤 규칙을 어겼을 때 알리는 오류 코드
export const MILESTONE_ERROR_CODES = [
  'MILESTONE_NOT_FOUND',
  'MILESTONE_TITLE_TAKEN',
  'MILESTONE_HAS_OPEN_ISSUES',
  'MILESTONE_HAS_ISSUES',
  'MILESTONE_CLOSED',
  'MILESTONE_PROJECT_MISMATCH',
] as const;
export type MilestoneErrorCode = (typeof MILESTONE_ERROR_CODES)[number];
