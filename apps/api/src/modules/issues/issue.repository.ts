import type { CreateIssueInput, Issue, IssueEvent } from './issue.model';

/**
 * 이슈 repository의 약속이다.
 *
 * - Nest가 추상 클래스를 주입 토큰으로 쓸 수 있어서 interface 대신 abstract class로 둔다
 * - 이슈와 이슈 이력은 늘 함께 바뀌어야 해서 이력도 이 repository가 읽고 쓴다
 */
export abstract class IssueRepository {
  // 다음 번호를 받은 처음 상태의 이슈와 만든 이력 한 줄을 함께 저장함
  abstract create(input: CreateIssueInput): Promise<Issue>;

  abstract findById(id: number): Promise<Issue | null>;

  abstract findLastEvents(issueId: number, limit: number): Promise<IssueEvent[]>;
}
