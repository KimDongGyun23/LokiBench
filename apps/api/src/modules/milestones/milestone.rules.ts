import { DomainError } from '@/errors/domain-error';
import type { MilestoneIssueSummary } from '@/modules/issues/issue.model';

import type { Milestone } from './milestone.model';

/**
 * 마일스톤을 닫아도 되는지 판단한다.
 *
 * @param summary 쓰기 트랜잭션 안에서 읽은 그 마일스톤의 이슈 요약
 * @throws {DomainError} MILESTONE_HAS_OPEN_ISSUES (details에 남은 번호 전부)
 */
export function assertCanCloseMilestone(summary: MilestoneIssueSummary): void {
  const { openIssueNumbers } = summary;

  // 닫힌 마일스톤에 할 일이 남으면 안 됨
  if (openIssueNumbers.length > 0) {
    throw new DomainError(
      'MILESTONE_HAS_OPEN_ISSUES',
      `열린 이슈 ${openIssueNumbers.length}개가 남아 있어 닫을 수 없음`,
      { openIssueNumbers },
    );
  }
}

/**
 * 마일스톤을 지워도 되는지 판단한다.
 *
 * - 끝난 이슈의 기록도 마일스톤에 묶여 있으므로 닫힌 이슈도 하나로 센다
 *
 * @param summary 쓰기 트랜잭션 안에서 읽은 그 마일스톤의 이슈 요약
 * @throws {DomainError} MILESTONE_HAS_ISSUES (details에 이슈 수)
 */
export function assertCanDeleteMilestone(summary: MilestoneIssueSummary): void {
  const { issueCount } = summary;

  // 이슈가 하나라도 있으면 지울 수 없음
  if (issueCount > 0) {
    throw new DomainError('MILESTONE_HAS_ISSUES', `이슈 ${issueCount}개가 있어 삭제할 수 없음`, {
      issueCount,
    });
  }
}

/**
 * 마일스톤을 화면에 보일 순서로 늘어놓는다.
 *
 * - 열린 것은 보드 레인과 같이 마감 빠른 순, 마감 없는 것은 그 뒤에 만든 순이다
 * - 닫힌 것은 열린 것 아래에 최근에 닫은 순이다
 * - 나머지가 모두 같으면 id 순이라 같은 목록은 늘 같은 순서가 된다
 *
 * @param milestones 늘어놓을 마일스톤 (바꾸지 않음)
 * @returns 순서대로 늘어놓은 새 배열
 */
export function sortMilestones(milestones: readonly Milestone[]): Milestone[] {
  return [...milestones].sort(compareMilestones);
}

/**
 * 두 마일스톤 중 화면에서 앞에 올 것을 정한다.
 *
 * @param a 비교할 마일스톤
 * @param b 비교할 마일스톤
 * @returns a가 앞이면 음수, 뒤면 양수
 */
function compareMilestones(a: Milestone, b: Milestone): number {
  // 열린 것이 닫힌 것보다 앞
  if ((a.closedAt === null) !== (b.closedAt === null)) return a.closedAt === null ? -1 : 1;

  // 둘 다 닫혔으면 최근에 닫은 것이 앞
  if (a.closedAt !== null && b.closedAt !== null) {
    return b.closedAt.getTime() - a.closedAt.getTime() || a.id - b.id;
  }

  // 마감이 있는 것이 마감 없는 것보다 앞
  if ((a.due === null) !== (b.due === null)) return a.due === null ? 1 : -1;

  // 마감이 둘 다 있으면 빠른 것이 앞 (YYYY-MM-DD라 글자 비교가 날짜 비교와 같음)
  if (a.due !== null && b.due !== null && a.due !== b.due) return a.due < b.due ? -1 : 1;

  return a.createdAt.getTime() - b.createdAt.getTime() || a.id - b.id;
}
