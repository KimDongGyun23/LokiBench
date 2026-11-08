// 배열 순서가 새 프로젝트 색 자동 배정 순서임
export const PROJECT_COLORS = ['indigo', 'sky', 'teal', 'violet', 'rose', 'orange'] as const;
export type ProjectColor = (typeof PROJECT_COLORS)[number];

// 사이드바처럼 좁은 곳에서도 말줄임으로 버틸 수 있는 길이 기준
export const PROJECT_NAME_MAX_LENGTH = 40;
