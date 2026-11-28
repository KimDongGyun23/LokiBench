import { type EntityManager, IsNull } from 'typeorm';

import { MilestoneEntity } from './milestone.entity';
import type { MilestoneGuard } from './milestone.model';

// 이슈 저장소가 자기 트랜잭션 안에서 마일스톤 상태를 읽을 때 넘기는 값
interface ReadMilestoneGuardParams {
  manager: EntityManager;
  milestoneId: number;
}

/**
 * 이슈를 쓰기 직전에 그 이슈가 가리키는 마일스톤의 상태를 읽는다.
 *
 * - 이슈 저장소가 자기 쓰기 트랜잭션의 manager를 넘겨서, 읽기와 쓰기 사이에 다른 요청이 끼어들지 못하게 한다
 * - 넘겨받은 manager로만 읽는다 (runExclusive를 다시 부르면 바깥 쓰기를 기다리며 멈춤)
 *
 * @param params.manager 이슈 저장소가 연 트랜잭션의 manager
 * @param params.milestoneId 이슈가 가리키는 마일스톤 id
 * @returns 프로젝트와 닫힘 여부 (없거나 지웠으면 null)
 */
export async function readMilestoneGuard({
  manager,
  milestoneId,
}: ReadMilestoneGuardParams): Promise<MilestoneGuard | null> {
  const entity = await manager.findOne(MilestoneEntity, {
    select: { projectId: true, closedAt: true },
    where: { id: milestoneId, deletedAt: IsNull() },
  });
  if (!entity) return null;

  return { projectId: entity.projectId, isClosed: entity.closedAt !== null };
}
