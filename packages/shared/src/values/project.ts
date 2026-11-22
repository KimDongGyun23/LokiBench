// 프로젝트 색 목록 (순서대로 새 프로젝트에 자동 배정)
export const PROJECT_COLORS = ['indigo', 'sky', 'teal', 'violet', 'rose', 'orange'] as const;
export type ProjectColor = (typeof PROJECT_COLORS)[number];

// 프로젝트 규칙을 어겼을 때 알리는 오류 코드
export const PROJECT_ERROR_CODES = ['PROJECT_NOT_FOUND', 'PROJECT_NAME_TAKEN'] as const;
export type ProjectErrorCode = (typeof PROJECT_ERROR_CODES)[number];

// 프로젝트 이름 최대 길이 (사이드바에서 말줄임으로 버틸 수 있는 기준)
export const PROJECT_NAME_MAX_LENGTH = 40;
