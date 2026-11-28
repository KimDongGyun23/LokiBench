import { Injectable } from '@nestjs/common';

import { DomainError } from '@/errors/domain-error';
import { ProjectRepository } from '@/modules/projects/project.repository';

import type { CreateMilestoneCommand, Milestone, UpdateMilestoneCommand } from './milestone.model';
import { MilestoneRepository } from './milestone.repository';

/**
 * 마일스톤 만들기, 조회, 수정, 닫기, 재오픈, 삭제, 되살리기를 처리한다.
 *
 * - 닫기와 삭제의 이슈 검사는 저장소가 쓰기 트랜잭션 안에서 한다 (여기서 미리 읽으면 그 사이 이슈가 바뀔 수 있음)
 */
@Injectable()
export class MilestonesService {
  constructor(
    private readonly repository: MilestoneRepository,
    private readonly projects: ProjectRepository,
  ) {}

  /**
   * 프로젝트에 새 마일스톤을 만든다.
   *
   * @param command 마일스톤을 만들 프로젝트와 칸 전부 (제목은 공백이 지워져 있음)
   * @returns 저장된 마일스톤
   * @throws {DomainError} PROJECT_NOT_FOUND, MILESTONE_TITLE_TAKEN
   */
  async create(command: CreateMilestoneCommand): Promise<Milestone> {
    // 주인 없는 마일스톤이 생기지 않도록 프로젝트부터 확인함
    const project = await this.projects.findById(command.projectId);
    if (!project) throw new DomainError('PROJECT_NOT_FOUND');

    return this.repository.create({ ...command, now: new Date() });
  }

  /**
   * 프로젝트의 마일스톤을 화면 순서로 준다.
   *
   * @param projectId 프로젝트 id (없는 프로젝트면 빈 배열)
   * @returns 열린 것은 마감 순, 닫힌 것은 그 아래 최근에 닫은 순
   */
  list(projectId: number): Promise<Milestone[]> {
    return this.repository.findByProject(projectId);
  }

  /**
   * id로 마일스톤 하나를 준다.
   *
   * @param id 마일스톤 id
   * @returns 찾은 마일스톤
   * @throws {DomainError} MILESTONE_NOT_FOUND (지운 마일스톤 포함)
   */
  async get(id: number): Promise<Milestone> {
    return this.requireFound(await this.repository.findById(id));
  }

  /**
   * 마일스톤의 칸 전부를 바꾼다.
   *
   * @param params.id 바꿀 마일스톤 id
   * @param params.command 바꿀 칸 전부
   * @returns 바뀐 마일스톤
   * @throws {DomainError} MILESTONE_NOT_FOUND, MILESTONE_TITLE_TAKEN
   */
  async update({
    id,
    command,
  }: {
    id: number;
    command: UpdateMilestoneCommand;
  }): Promise<Milestone> {
    return this.requireFound(await this.repository.update({ id, fields: command }));
  }

  /**
   * 마일스톤을 닫는다. 이미 닫혔으면 그대로 준다.
   *
   * @param id 닫을 마일스톤 id
   * @returns 닫힌 마일스톤
   * @throws {DomainError} MILESTONE_NOT_FOUND, MILESTONE_HAS_OPEN_ISSUES
   */
  async close(id: number): Promise<Milestone> {
    return this.requireFound(await this.repository.close({ id, now: new Date() }));
  }

  /**
   * 마일스톤을 다시 연다. 이미 열렸으면 그대로 준다.
   *
   * @param id 열 마일스톤 id
   * @returns 열린 마일스톤
   * @throws {DomainError} MILESTONE_NOT_FOUND
   */
  async reopen(id: number): Promise<Milestone> {
    return this.requireFound(await this.repository.reopen(id));
  }

  /**
   * 마일스톤에 지운 표시를 남긴다.
   *
   * @param id 지울 마일스톤 id
   * @throws {DomainError} MILESTONE_NOT_FOUND, MILESTONE_HAS_ISSUES
   */
  async remove(id: number): Promise<void> {
    const isDeleted = await this.repository.softDelete({ id, now: new Date() });
    if (!isDeleted) throw new DomainError('MILESTONE_NOT_FOUND');
  }

  /**
   * 지운 마일스톤을 지우기 전 그대로 되살린다. 지우지 않은 것이면 그대로 준다.
   *
   * @param id 되살릴 마일스톤 id
   * @returns 되살린 마일스톤
   * @throws {DomainError} MILESTONE_NOT_FOUND, MILESTONE_TITLE_TAKEN
   */
  async restore(id: number): Promise<Milestone> {
    return this.requireFound(await this.repository.restore(id));
  }

  // 마일스톤이 있으면 그대로 주고, 저장소가 null을 주면 없는 마일스톤으로 알림
  private requireFound(milestone: Milestone | null): Milestone {
    if (!milestone) throw new DomainError('MILESTONE_NOT_FOUND');
    return milestone;
  }
}
