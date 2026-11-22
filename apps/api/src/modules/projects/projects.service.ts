import { Injectable } from '@nestjs/common';

import { DomainError } from '@/errors/domain-error';

import type { CreateProjectCommand, Project, UpdateProjectCommand } from './project.model';
import { ProjectRepository } from './project.repository';
import { pickProjectColor } from './project.rules';

/**
 * 프로젝트의 이름 유일, 색 자동 배정 규칙을 지켜 목록, 추가, 수정을 처리한다.
 */
@Injectable()
export class ProjectsService {
  constructor(private readonly repository: ProjectRepository) {}

  /**
   * 프로젝트를 만든 순서대로 준다.
   *
   * @returns 프로젝트 전체 목록
   */
  list(): Promise<Project[]> {
    return this.repository.findAll();
  }

  /**
   * 새 프로젝트를 만들고 색을 자동으로 정한다.
   *
   * @param command 공백이 지워진 이름
   * @returns 저장된 프로젝트
   */
  async create(command: CreateProjectCommand): Promise<Project> {
    if (await this.repository.findByName(command.name)) {
      throw new DomainError('PROJECT_NAME_TAKEN');
    }

    const projects = await this.repository.findAll();
    const color = pickProjectColor(projects);
    return this.repository.create({ ...command, color });
  }

  /**
   * 프로젝트의 이름이나 색을 바꾼다.
   *
   * - 자기 이름 그대로 저장은 중복이 아니므로 통과시킨다
   * - 대상이 없다는 안내가 이름 중복보다 먼저이므로 존재부터 확인한다
   *
   * @param id 바꿀 프로젝트 id
   * @param command 바꿀 이름, 색 (둘 중 하나 이상)
   * @returns 바뀐 프로젝트
   */
  async update(id: number, command: UpdateProjectCommand): Promise<Project> {
    const project = await this.repository.findById(id);
    if (!project) {
      throw new DomainError('PROJECT_NOT_FOUND');
    }

    if (command.name !== undefined) {
      const sameName = await this.repository.findByName(command.name);
      if (sameName && sameName.id !== id) {
        throw new DomainError('PROJECT_NAME_TAKEN');
      }
    }

    const updated = await this.repository.update(id, command);
    if (!updated) {
      throw new DomainError('PROJECT_NOT_FOUND');
    }

    return updated;
  }
}
