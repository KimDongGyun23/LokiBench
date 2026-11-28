import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource, type EntityManager, IsNull } from 'typeorm';

import { isUniqueViolation } from '@/database/utils/is-unique-violation';
import { runExclusive } from '@/database/utils/run-exclusive';
import { DomainError } from '@/errors/domain-error';
import { readMilestoneIssueSummary } from '@/modules/issues/issue.reader';

import { MilestoneEntity } from './milestone.entity';
import { toMilestoneModel } from './milestone.mapper';
import type {
  CloseMilestoneInput,
  CreateMilestoneInput,
  DeleteMilestoneInput,
  Milestone,
  UpdateMilestoneInput,
} from './milestone.model';
import { MilestoneRepository } from './milestone.repository';
import {
  assertCanCloseMilestone,
  assertCanDeleteMilestone,
  sortMilestones,
} from './milestone.rules';

// 지우지 않은 마일스톤 하나를 찾을 때 넘기는 값
interface FindActiveParams {
  manager: EntityManager;
  id: number;
}

// 마일스톤 행을 저장할 때 넘기는 값
interface SaveMilestoneParams {
  manager: EntityManager;
  entity: MilestoneEntity;
}

/**
 * sqlite에 마일스톤을 읽고 쓰는 repository 구현체다.
 *
 * - 읽기와 쓰기 모두 runExclusive로 같은 연결의 다른 작업이 끝난 뒤에 실행한다
 * - 지운 마일스톤을 거르는 일은 findActive 한 곳만 거친다 (되살리기만 거치지 않음)
 * - 닫기와 삭제는 같은 트랜잭션 안에서 이슈 요약을 읽고 판단해서, 그 사이 이슈가 바뀌지 못한다
 */
@Injectable()
export class TypeOrmMilestoneRepository extends MilestoneRepository {
  constructor(@InjectDataSource() private readonly dataSource: DataSource) {
    super();
  }

  async create(input: CreateMilestoneInput): Promise<Milestone> {
    const { now, ...fields } = input;

    const insertMilestone = async (manager: EntityManager): Promise<Milestone> => {
      const entity = manager.create(MilestoneEntity, {
        ...fields,
        createdAt: now.toISOString(),
        closedAt: null,
        deletedAt: null,
      });
      await this.saveOrThrowTitleTaken({ manager, entity });
      return toMilestoneModel(entity);
    };

    return this.write(insertMilestone);
  }

  async findById(id: number): Promise<Milestone | null> {
    const entity = await this.read((manager) => this.findActive({ manager, id }));
    return entity && toMilestoneModel(entity);
  }

  async findByProject(projectId: number): Promise<Milestone[]> {
    const entities = await this.read((manager) =>
      manager.find(MilestoneEntity, { where: { projectId, deletedAt: IsNull() } }),
    );
    return sortMilestones(entities.map(toMilestoneModel));
  }

  async update({ id, fields }: UpdateMilestoneInput): Promise<Milestone | null> {
    const updateMilestone = async (manager: EntityManager): Promise<Milestone | null> => {
      const entity = await this.findActive({ manager, id });
      if (!entity) return null;

      Object.assign(entity, fields);
      await this.saveOrThrowTitleTaken({ manager, entity });
      return toMilestoneModel(entity);
    };

    return this.write(updateMilestone);
  }

  async close({ id, now }: CloseMilestoneInput): Promise<Milestone | null> {
    const closeMilestone = async (manager: EntityManager): Promise<Milestone | null> => {
      const entity = await this.findActive({ manager, id });
      if (!entity) return null;

      // 이미 닫혔으면 언제 닫았는지를 바꾸지 않음
      if (entity.closedAt !== null) return toMilestoneModel(entity);

      assertCanCloseMilestone(await readMilestoneIssueSummary({ manager, milestoneId: id }));

      entity.closedAt = now.toISOString();
      await manager.save(entity);
      return toMilestoneModel(entity);
    };

    return this.write(closeMilestone);
  }

  async reopen(id: number): Promise<Milestone | null> {
    const reopenMilestone = async (manager: EntityManager): Promise<Milestone | null> => {
      const entity = await this.findActive({ manager, id });
      if (!entity) return null;

      entity.closedAt = null;
      await manager.save(entity);
      return toMilestoneModel(entity);
    };

    return this.write(reopenMilestone);
  }

  async softDelete({ id, now }: DeleteMilestoneInput): Promise<boolean> {
    const deleteMilestone = async (manager: EntityManager): Promise<boolean> => {
      const entity = await this.findActive({ manager, id });
      if (!entity) return false;

      assertCanDeleteMilestone(await readMilestoneIssueSummary({ manager, milestoneId: id }));

      entity.deletedAt = now.toISOString();
      await manager.save(entity);
      return true;
    };

    return this.write(deleteMilestone);
  }

  async restore(id: number): Promise<Milestone | null> {
    const restoreMilestone = async (manager: EntityManager): Promise<Milestone | null> => {
      // 지운 것도 찾아야 해서 findActive를 거치지 않음
      const entity = await manager.findOneBy(MilestoneEntity, { id });
      if (!entity) return null;

      entity.deletedAt = null;
      await this.saveOrThrowTitleTaken({ manager, entity });
      return toMilestoneModel(entity);
    };

    return this.write(restoreMilestone);
  }

  // 지우지 않은 마일스톤 하나를 찾음 (지운 것을 거르는 유일한 곳)
  private findActive({ manager, id }: FindActiveParams): Promise<MilestoneEntity | null> {
    return manager.findOneBy(MilestoneEntity, { id, deletedAt: IsNull() });
  }

  // 저장하다 제목 유일 제약에 걸리면 도메인 오류로 바꿈
  private async saveOrThrowTitleTaken({ manager, entity }: SaveMilestoneParams): Promise<void> {
    try {
      await manager.save(entity);
    } catch (error) {
      if (isUniqueViolation(error)) throw new DomainError('MILESTONE_TITLE_TAKEN');
      throw error;
    }
  }

  // 읽기를 같은 연결의 작업 줄 끝에 이어 붙임
  private read<T>(work: (manager: EntityManager) => Promise<T>): Promise<T> {
    return runExclusive({ dataSource: this.dataSource, work: () => work(this.dataSource.manager) });
  }

  // 트랜잭션으로 묶은 쓰기를 같은 연결의 작업 줄 끝에 이어 붙임
  private write<T>(work: (manager: EntityManager) => Promise<T>): Promise<T> {
    return runExclusive({
      dataSource: this.dataSource,
      work: () => this.dataSource.transaction(work),
    });
  }
}
