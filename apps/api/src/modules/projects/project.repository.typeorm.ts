import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import type { Repository } from 'typeorm';

import { isUniqueViolation } from '@/database/utils/is-unique-violation';
import { DomainError } from '@/errors/domain-error';

import { ProjectEntity } from './project.entity';
import { toProjectModel } from './project.mapper';
import type { CreateProjectInput, Project, UpdateProjectInput } from './project.model';
import { ProjectRepository } from './project.repository';

/**
 * sqlite에 프로젝트를 읽고 쓰는 repository 구현체다.
 */
@Injectable()
export class TypeOrmProjectRepository extends ProjectRepository {
  constructor(
    @InjectRepository(ProjectEntity) private readonly repository: Repository<ProjectEntity>,
  ) {
    super();
  }

  async findAll(): Promise<Project[]> {
    const entities = await this.repository.find({ order: { createdAt: 'ASC', id: 'ASC' } });
    return entities.map(toProjectModel);
  }

  async findById(id: number): Promise<Project | null> {
    const entity = await this.repository.findOneBy({ id });
    return entity && toProjectModel(entity);
  }

  async findByName(name: string): Promise<Project | null> {
    const entity = await this.repository.findOneBy({ name });
    return entity && toProjectModel(entity);
  }

  async create(input: CreateProjectInput): Promise<Project> {
    const entity = this.repository.create({
      name: input.name,
      color: input.color,
      createdAt: new Date().toISOString(),
    });
    await this.saveOrThrowNameTaken(entity);
    return toProjectModel(entity);
  }

  async update(id: number, changes: UpdateProjectInput): Promise<Project | null> {
    const entity = await this.repository.findOneBy({ id });
    if (!entity) return null;

    if (changes.name !== undefined) entity.name = changes.name;
    if (changes.color !== undefined) entity.color = changes.color;

    await this.saveOrThrowNameTaken(entity);
    return toProjectModel(entity);
  }

  private async saveOrThrowNameTaken(entity: ProjectEntity): Promise<void> {
    try {
      await this.repository.save(entity);
    } catch (error) {
      if (isUniqueViolation(error)) {
        throw new DomainError('PROJECT_NAME_TAKEN');
      }
      throw error;
    }
  }
}
