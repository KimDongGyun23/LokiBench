import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, QueryFailedError, type Repository } from 'typeorm';

import { DomainError } from '../../common/domain-error';
import { ProjectEntity } from './project.entity';
import type { CreateProjectInput, Project, UpdateProjectInput } from './project.model';
import { ProjectRepository } from './project.repository';

/**
 * sqlite에 프로젝트를 읽고 쓰는 저장소 구현체다.
 *
 * - 엔티티는 밖으로 내보내지 않고 계약의 Project로 바꿔서 돌려준다
 */
@Injectable()
export class TypeOrmProjectRepository extends ProjectRepository {
  constructor(
    @InjectRepository(ProjectEntity) private readonly repository: Repository<ProjectEntity>,
  ) {
    super();
  }

  async findAll({ includeArchived }: { includeArchived: boolean }): Promise<Project[]> {
    const entities = await this.repository.find({
      where: includeArchived ? {} : { archivedAt: IsNull() },
      order: { createdAt: 'ASC', id: 'ASC' },
    });
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
    // 타입에 없는 필드가 실행 중에 섞여 와도 엔티티에 들어가지 않게 저장할 필드를 직접 고름
    const entity = this.repository.create({
      name: input.name,
      color: input.color,
      createdAt: new Date().toISOString(),
      archivedAt: null,
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

  // service 조회를 지나친 동시 요청도 500이 아니라 409가 되도록 UNIQUE 위반을 계약 오류로 바꿈
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

/**
 * 엔티티를 도메인 프로젝트로 바꾼다.
 *
 * - DB에 ISO 문자열로 저장한 시각을 Date로 바꾼다
 *
 * @param entity DB에서 읽은 엔티티
 * @returns service가 다루는 도메인 프로젝트
 */
function toProjectModel(entity: ProjectEntity): Project {
  return {
    id: entity.id,
    name: entity.name,
    color: entity.color,
    createdAt: new Date(entity.createdAt),
    archivedAt: entity.archivedAt === null ? null : new Date(entity.archivedAt),
  };
}

/**
 * sqlite의 UNIQUE 제약 위반인지 확인한다.
 *
 * - projects에서 UNIQUE가 걸린 열은 name뿐이라 이름 중복으로 본다
 *
 * @param error 저장 중 난 예외
 * @returns UNIQUE 위반이면 true
 */
function isUniqueViolation(error: unknown): boolean {
  if (!(error instanceof QueryFailedError)) {
    return false;
  }

  const driverError: unknown = error.driverError;
  return (
    typeof driverError === 'object' &&
    driverError !== null &&
    'code' in driverError &&
    driverError.code === 'SQLITE_CONSTRAINT_UNIQUE'
  );
}
