import type {
  CloseMilestoneInput,
  CreateMilestoneInput,
  DeleteMilestoneInput,
  Milestone,
  UpdateMilestoneInput,
} from './milestone.model';

/**
 * 마일스톤 repository의 약속이다.
 *
 * - Nest가 추상 클래스를 주입 토큰으로 쓸 수 있어서 interface 대신 abstract class로 둔다
 * - 지운 마일스톤은 되살리기 말고는 어느 메서드에서도 없는 것으로 본다
 */
export abstract class MilestoneRepository {
  // 같은 프로젝트에 같은 제목이 있으면 DomainError(MILESTONE_TITLE_TAKEN)
  abstract create(input: CreateMilestoneInput): Promise<Milestone>;

  abstract findById(id: number): Promise<Milestone | null>;

  // 열린 것은 마감 순, 닫힌 것은 그 아래 최근에 닫은 순 (없는 프로젝트면 빈 배열)
  abstract findByProject(projectId: number): Promise<Milestone[]>;

  // 없으면 null, 같은 프로젝트에 같은 제목이 있으면 DomainError(MILESTONE_TITLE_TAKEN)
  abstract update(input: UpdateMilestoneInput): Promise<Milestone | null>;

  // 열린 이슈가 있으면 DomainError(MILESTONE_HAS_OPEN_ISSUES), 이미 닫혔으면 그대로 줌
  abstract close(input: CloseMilestoneInput): Promise<Milestone | null>;

  // 이미 열렸으면 그대로 줌
  abstract reopen(id: number): Promise<Milestone | null>;

  // 이슈가 있으면 DomainError(MILESTONE_HAS_ISSUES), 없는 마일스톤이면 false
  abstract softDelete(input: DeleteMilestoneInput): Promise<boolean>;

  // 지우지 않은 것이면 그대로, 없는 id면 null, 그 사이 같은 제목이 생겼으면 DomainError(MILESTONE_TITLE_TAKEN)
  abstract restore(id: number): Promise<Milestone | null>;
}
