import type { Project } from '@lokibench/contracts';

// 프로젝트 색 이름 (indigo, sky, teal, violet, rose, orange)
export type ProjectColor = Project['color'];

// 프로젝트 색 이름마다 화면에 칠할 실제 색
export const PROJECT_COLOR_HEX: Record<ProjectColor, string> = {
  indigo: '#a5b4fc',
  sky: '#a8d5fe',
  teal: '#b7e4cc',
  violet: '#cbb6e4',
  rose: '#ff9595',
  orange: '#ffc895',
};
