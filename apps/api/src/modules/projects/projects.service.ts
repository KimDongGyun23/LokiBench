import type { CreateProjectRequest, Project, UpdateProjectRequest } from '@lokibench/contracts';
import { Injectable } from '@nestjs/common';

import { AppError } from '../../common/app-error';
import { pickProjectColor } from './pick-project-color';
import { ProjectRepository } from './project.repository';

/**
 * 프로젝트의 이름 유일, 색 자동 배정 규칙을 지켜 목록, 추가, 수정을 처리한다.
 *
 * - 이름 중복은 먼저 조회해서 409로 막고, 그 사이 끼어든 중복은 저장소가 DB 제약에서 막는다
 */
@Injectable()
export class ProjectsService {
  constructor(private readonly repository: ProjectRepository) {}

  /**
   * 화면에 보일 프로젝트를 만든 순서대로 준다.
   *
   * @returns 아카이브되지 않은 프로젝트 목록
   */
  list(): Promise<Project[]> {
    return this.repository.findAll({ includeArchived: false });
  }

  /**
   * 새 프로젝트를 만들고 색을 자동으로 정한다.
   *
   * @param request 공백이 지워진 이름
   * @returns 저장된 프로젝트
   */
  async create(request: CreateProjectRequest): Promise<Project> {
    if (await this.repository.findByName(request.name)) {
      throw new AppError('PROJECT_NAME_TAKEN');
    }

    const projects = await this.repository.findAll({ includeArchived: true });
    return this.repository.create({ name: request.name, color: pickProjectColor(projects) });
  }

  /**
   * 프로젝트의 이름이나 색을 바꾼다.
   *
   * - 자기 이름 그대로 저장은 중복이 아니므로 통과시킨다
   * - 대상이 없다는 안내가 이름 중복보다 먼저이므로 존재부터 확인한다
   *
   * @param id 바꿀 프로젝트 id
   * @param request 바꿀 이름, 색 (둘 중 하나 이상)
   * @returns 바뀐 프로젝트
   */
  async update(id: number, request: UpdateProjectRequest): Promise<Project> {
    if (!(await this.repository.findById(id))) {
      throw new AppError('PROJECT_NOT_FOUND');
    }

    if (request.name !== undefined) {
      const sameName = await this.repository.findByName(request.name);
      if (sameName && sameName.id !== id) {
        throw new AppError('PROJECT_NAME_TAKEN');
      }
    }

    const updated = await this.repository.update(id, request);
    if (!updated) {
      throw new AppError('PROJECT_NOT_FOUND');
    }

    return updated;
  }
}
