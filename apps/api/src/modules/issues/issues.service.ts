import { Injectable } from '@nestjs/common';

import { DomainError } from '@/errors/domain-error';
import { ProjectRepository } from '@/modules/projects/project.repository';

import type { CreateIssueCommand, Issue, OpenIssueCount, UpdateIssueCommand } from './issue.model';
import { IssueRepository } from './issue.repository';
import { applyIssueUpdate, undoIssueStatus } from './issue.rules';

/**
 * 이슈 만들기, 조회, 수정, 상태 되돌리기, 열린 이슈 수 조회를 처리한다.
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
   * 이슈의 제목, 마감, 상태를 바꾼다.
   *
   * - 낡은 화면이면 규칙 위반보다 다시 불러오기를 먼저 안내하도록 version부터 비교한다
   * - 바뀐 것이 없으면 아무것도 적지 않고 지금 이슈를 그대로 준다
   *
   * @param id 바꿀 이슈 id
   * @param command 화면이 본 version과 바꿀 칸
   * @returns 바뀐 이슈 (바뀐 것이 없으면 지금 이슈)
   * @throws {DomainError} ISSUE_NOT_FOUND, ISSUE_VERSION_CONFLICT, ISSUE_CLOSED, ISSUE_TRANSITION_NOT_ALLOWED
   */
  async update(id: number, command: UpdateIssueCommand): Promise<Issue> {
    const { version, ...changes } = command;
    const issue = await this.get(id);

    // 화면이 본 뒤 다른 곳에서 먼저 고쳤음
    if (issue.version !== version) throw new DomainError('ISSUE_VERSION_CONFLICT');

    const result = applyIssueUpdate(issue, changes, new Date());

    // 바뀐 것이 없으면 version을 올리지 않음
    if (result.kind === 'unchanged') return issue;

    const saved = await this.repository.saveChange({
      issue: result.issue,
      expectedVersion: issue.version,
      event: result.event,
    });

    // 조회와 저장 사이에 다른 수정이 먼저 저장됨
    if (!saved) throw new DomainError('ISSUE_VERSION_CONFLICT');

    return saved;
  }

  /**
   * 이슈의 마지막 상태 변경을 되돌린다.
   *
   * - 낡은 화면이면 되돌릴 수 있는지 따지기 전에 다시 불러오기를 먼저 안내하도록 version부터 비교한다
   *
   * @param id 되돌릴 이슈 id
   * @param version 화면이 본 이슈의 version
   * @returns 되돌린 이슈
   * @throws {DomainError} ISSUE_NOT_FOUND, ISSUE_VERSION_CONFLICT, ISSUE_UNDO_NOTHING, ISSUE_UNDO_EXPIRED
   */
  async undoStatus(id: number, version: number): Promise<Issue> {
    const issue = await this.get(id);

    // 화면이 본 뒤 다른 곳에서 먼저 고쳤음
    if (issue.version !== version) throw new DomainError('ISSUE_VERSION_CONFLICT');

    // 되돌릴 이력과 그 앞 이력만 있으면 이전 상태와 시각을 정할 수 있음
    const events = await this.repository.findLastEvents(id, 2);
    const result = undoIssueStatus(issue, events, new Date());

    const saved = await this.repository.saveUndo({ ...result, expectedVersion: issue.version });

    // 조회와 저장 사이에 다른 수정이 먼저 저장됨
    if (!saved) throw new DomainError('ISSUE_VERSION_CONFLICT');

    return saved;
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

  /**
   * 프로젝트별 열린 이슈 수를 준다.
   *
   * @returns 열린 이슈가 1건 이상인 프로젝트의 수 (없는 프로젝트는 화면이 0으로 봄)
   */
  countOpenByProject(): Promise<OpenIssueCount[]> {
    return this.repository.countOpenByProject();
  }
}
