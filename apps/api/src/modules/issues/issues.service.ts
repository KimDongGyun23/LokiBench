import { Injectable } from '@nestjs/common';

import { DomainError } from '@/errors/domain-error';
import { ProjectRepository } from '@/modules/projects/project.repository';

import type { CreateIssueCommand, Issue } from './issue.model';
import { IssueRepository } from './issue.repository';

/**
 * 이슈 만들기와 조회를 처리한다.
 */
@Injectable()
export class IssuesService {
  constructor(
    private readonly repository: IssueRepository,
    private readonly projects: ProjectRepository,
  ) {}

  /**
   * 프로젝트에 새 이슈를 만든다.
   *
   * @param command 이슈를 만들 프로젝트, 공백이 지워진 제목, 마감
   * @returns 저장된 이슈
   * @throws {DomainError} PROJECT_NOT_FOUND
   */
  async create(command: CreateIssueCommand): Promise<Issue> {
    // 주인 없는 이슈가 생기지 않도록 프로젝트부터 확인함
    const project = await this.projects.findById(command.projectId);
    if (!project) throw new DomainError('PROJECT_NOT_FOUND');

    return this.repository.create({
      projectId: command.projectId,
      title: command.title,
      due: command.due ?? null,
      now: new Date(),
    });
  }

  /**
   * id로 이슈 하나를 준다.
   *
   * @param id 이슈 id (번호가 아님)
   * @returns 찾은 이슈
   * @throws {DomainError} ISSUE_NOT_FOUND
   */
  async get(id: number): Promise<Issue> {
    const issue = await this.repository.findById(id);
    if (!issue) throw new DomainError('ISSUE_NOT_FOUND');

    return issue;
  }

  /**
   * 프로젝트의 이슈를 번호순으로 준다.
   *
   * @param projectId 프로젝트 id (없는 프로젝트면 빈 배열)
   * @returns 그 프로젝트의 이슈 목록
   */
  listByProject(projectId: number): Promise<Issue[]> {
    return this.repository.findByProject(projectId);
  }
}
