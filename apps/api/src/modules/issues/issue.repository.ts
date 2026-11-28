import type {
  CreateIssueInput,
  Issue,
  IssueEvent,
  OpenIssueCount,
  SaveIssueChangeInput,
  SaveIssueUndoInput,
} from './issue.model';

/**
 * 이슈 repository의 약속이다.
 *
 * - Nest가 추상 클래스를 주입 토큰으로 쓸 수 있어서 interface 대신 abstract class로 둔다
 * - 이슈와 이슈 이력은 늘 함께 바뀌어야 해서 이력도 이 repository가 읽고 쓴다
 */
export abstract class IssueRepository {
  // 다음 번호를 받은 처음 상태의 이슈와 만든 이력 한 줄을 함께 저장함
  abstract create(input: CreateIssueInput): Promise<Issue>;

  // 바뀐 이슈와 상태 변경 이력을 함께 저장함 (기대한 version의 행이 없으면 아무것도 적지 않고 null)
  // issue.version은 expectedVersion + 1이어야 함 (아니면 던짐)
  abstract saveChange(input: SaveIssueChangeInput): Promise<Issue | null>;

  // 되돌린 이슈를 저장하고 되돌린 상태 변경 이력을 지움 (기대한 version의 행이 없으면 아무것도 적지 않고 null)
  // issue.version은 expectedVersion + 1이어야 함 (아니면 던짐)
  abstract saveUndo(input: SaveIssueUndoInput): Promise<Issue | null>;

  abstract findById(id: number): Promise<Issue | null>;

  // 번호 오름차순으로 줌 (없는 프로젝트면 빈 배열)
  abstract findByProject(projectId: number): Promise<Issue[]>;

  abstract findLastEvents(issueId: number, limit: number): Promise<IssueEvent[]>;

  // 열린 이슈가 1건 이상인 프로젝트만 프로젝트 id 오름차순으로 줌
  abstract countOpenByProject(): Promise<OpenIssueCount[]>;
}
