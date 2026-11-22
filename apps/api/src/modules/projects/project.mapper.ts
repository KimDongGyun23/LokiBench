import type { Project as ProjectResponse } from '@lokibench/shared/contracts';

import { parseStoredInstant } from '@/database/utils/parse-stored-instant';

import type { ProjectEntity } from './project.entity';
import type { Project } from './project.model';

/**
 * 엔티티를 도메인 프로젝트로 바꾼다.
 *
 * - DB에 ISO 문자열로 저장한 시각을 Date로 바꾼다
 *
 * @param entity DB에서 읽은 엔티티
 * @returns service가 다루는 도메인 프로젝트
 */
export function toProjectModel(entity: ProjectEntity): Project {
  return {
    id: entity.id,
    name: entity.name,
    color: entity.color,
    createdAt: parseStoredInstant({
      value: entity.createdAt,
      column: 'projects.created_at',
      id: entity.id,
    }),
  };
}

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
  };
}
