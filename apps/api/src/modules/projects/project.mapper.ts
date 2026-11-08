import type { Project as ProjectResponse } from '@lokibench/contracts';

import type { Project } from './project.model';

// 도메인과 계약(HTTP 모양) 사이 변환만 둠
// 엔티티와 도메인 사이 변환은 저장소 구현이 맡음

/**
 * 도메인 프로젝트를 계약의 응답 모양으로 바꾼다.
 *
 * - JSON에는 날짜 타입이 없어서 시각을 UTC ISO 문자열로 바꾼다
 *
 * @param project 도메인 프로젝트
 * @returns 응답에 그대로 실을 프로젝트
 */
export function toProjectResponse(project: Project): ProjectResponse {
  return {
    id: project.id,
    name: project.name,
    color: project.color,
    createdAt: project.createdAt.toISOString(),
    archivedAt: project.archivedAt?.toISOString() ?? null,
  };
}
