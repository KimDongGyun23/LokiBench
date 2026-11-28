import { parseStoredInstant } from '@/database/utils/parse-stored-instant';

import type { MilestoneEntity } from './milestone.entity';
import type { Milestone } from './milestone.model';

/**
 * 엔티티를 도메인 마일스톤으로 바꾼다.
 *
 * - DB에 ISO 문자열로 저장한 시각을 Date로 바꾼다
 * - 지운 표시는 저장소 안에서만 쓰므로 도메인에 올리지 않는다
 *
 * @param entity DB에서 읽은 엔티티
 * @returns service가 다루는 도메인 마일스톤
 */
export function toMilestoneModel(entity: MilestoneEntity): Milestone {
  const { id, closedAt } = entity;

  return {
    id,
    projectId: entity.projectId,
    title: entity.title,
    startDate: entity.startDate,
    due: entity.due,
    background: entity.background,
    solution: entity.solution,
    expectedEffect: entity.expectedEffect,
    memo: entity.memo,
    createdAt: parseStoredInstant({ value: entity.createdAt, column: 'milestones.created_at', id }),
    closedAt:
      closedAt === null
        ? null
        : parseStoredInstant({ value: closedAt, column: 'milestones.closed_at', id }),
  };
}
