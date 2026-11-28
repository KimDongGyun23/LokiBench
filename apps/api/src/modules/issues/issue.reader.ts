import { CLOSED_ISSUE_STATUS } from '@lokibench/shared/values';
import type { EntityManager } from 'typeorm';

import { IssueEntity } from './issue.entity';
import type { MilestoneIssueSummary } from './issue.model';

// 마일스톤 저장소가 자기 트랜잭션 안에서 이슈 요약을 읽을 때 넘기는 값
interface ReadMilestoneIssueSummaryParams {
  manager: EntityManager;
  milestoneId: number;
}

/**
 * 마일스톤을 닫거나 지우기 직전에 그 마일스톤에 든 이슈를 요약한다.
 *
 * - 마일스톤 저장소가 자기 쓰기 트랜잭션의 manager를 넘겨서, 읽기와 쓰기 사이에 이슈가 바뀌지 못하게 한다
 * - 넘겨받은 manager로만 읽는다 (runExclusive를 다시 부르면 바깥 쓰기를 기다리며 멈춤)
 *
 * @param params.manager 마일스톤 저장소가 연 트랜잭션의 manager
 * @param params.milestoneId 요약할 마일스톤 id
 * @returns 닫힌 이슈까지 센 이슈 수와 열린 이슈 번호 (오름차순)
 */
export async function readMilestoneIssueSummary({
  manager,
  milestoneId,
}: ReadMilestoneIssueSummaryParams): Promise<MilestoneIssueSummary> {
  const issues = await manager.find(IssueEntity, {
    select: { number: true, status: true },
    where: { milestoneId },
    order: { number: 'ASC' },
  });

  return {
    issueCount: issues.length,
    openIssueNumbers: issues
      .filter(({ status }) => status !== CLOSED_ISSUE_STATUS)
      .map(({ number }) => number),
  };
}
