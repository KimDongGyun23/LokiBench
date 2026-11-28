import { CLOSED_ISSUE_STATUS, INITIAL_ISSUE_STATUS } from '@lokibench/shared/values';
import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource, type EntityManager } from 'typeorm';

import { runExclusive } from '@/database/utils/run-exclusive';

import { IssueEntity } from './issue.entity';
import {
  toIssueEntityUpdate,
  toIssueEventModel,
  toIssueModel,
  toOpenIssueCountModel,
  toStatusEventEntity,
} from './issue.mapper';
import type {
  CreateIssueInput,
  Issue,
  IssueEvent,
  OpenIssueCount,
  SaveIssueChangeInput,
  SaveIssueUndoInput,
} from './issue.model';
import { IssueRepository } from './issue.repository';
import { IssueCounterEntity } from './issue-counter.entity';
import { IssueEventEntity } from './issue-event.entity';

// 번호 카운터 테이블의 하나뿐인 행 id
const ISSUE_COUNTER_ID = 1;

/**
 * sqlite에 이슈와 이슈 이력을 읽고 쓰는 repository 구현체다.
 *
 * - 읽기와 쓰기 모두 runExclusive로 같은 연결의 다른 작업이 끝난 뒤에 실행한다
 */
@Injectable()
export class TypeOrmIssueRepository extends IssueRepository {
  constructor(@InjectDataSource() private readonly dataSource: DataSource) {
    super();
  }

  async create(input: CreateIssueInput): Promise<Issue> {
    const saveNewIssue = async (manager: EntityManager): Promise<Issue> => {
      const number = await this.incrementIssueCounter(manager);
      const at = input.now.toISOString();

      const issue = manager.create(IssueEntity, {
        projectId: input.projectId,
        number,
        title: input.title,
        due: input.due,
        milestoneId: null,
        status: INITIAL_ISSUE_STATUS,
        statusChangedAt: at,
        version: 1,
        createdAt: at,
        closedAt: null,
      });
      await manager.save(issue);
      await manager.insert(IssueEventEntity, {
        issueId: issue.id,
        at,
        kind: 'CREATED',
        payload: null,
      });

      return toIssueModel(issue);
    };

    return this.write(saveNewIssue);
  }

  async saveChange(input: SaveIssueChangeInput): Promise<Issue | null> {
    const { issue, expectedVersion, event } = input;

    const saveIssueChange = async (manager: EntityManager): Promise<Issue | null> => {
      const isUpdated = await this.updateIfVersionMatches({ manager, issue, expectedVersion });

      // 그사이 다른 수정이 version을 올렸으면 아무것도 적지 않음
      if (!isUpdated) return null;

      // 상태가 바뀌었을 때만 이력을 남김
      if (event !== null) {
        await manager.insert(IssueEventEntity, toStatusEventEntity({ issueId: issue.id, event }));
      }

      const saved = await manager.findOneByOrFail(IssueEntity, { id: issue.id });
      return toIssueModel(saved);
    };

    return this.write(saveIssueChange);
  }

  async saveUndo(input: SaveIssueUndoInput): Promise<Issue | null> {
    const { issue, expectedVersion, removedEventId } = input;

    const saveIssueUndo = async (manager: EntityManager): Promise<Issue | null> => {
      const isUpdated = await this.updateIfVersionMatches({ manager, issue, expectedVersion });

      // 그사이 다른 수정이 version을 올렸으면 아무것도 적지 않음
      if (!isUpdated) return null;

      // 지울 상태 변경 이력이 없으면 이슈만 바뀌지 않도록 던져서 트랜잭션을 되돌림
      const result = await manager.delete(IssueEventEntity, {
        id: removedEventId,
        issueId: issue.id,
        kind: 'STATUS',
      });
      if (result.affected !== 1) {
        throw new Error(`지울 이슈 이력이 없음: issueId=${issue.id}, eventId=${removedEventId}`);
      }

      const saved = await manager.findOneByOrFail(IssueEntity, { id: issue.id });
      return toIssueModel(saved);
    };

    return this.write(saveIssueUndo);
  }

  async findById(id: number): Promise<Issue | null> {
    const entity = await this.read((manager) => manager.findOneBy(IssueEntity, { id }));
    return entity && toIssueModel(entity);
  }

  async findByProject(projectId: number): Promise<Issue[]> {
    const entities = await this.read((manager) =>
      manager.find(IssueEntity, { where: { projectId }, order: { number: 'ASC' } }),
    );
    return entities.map(toIssueModel);
  }

  async findLastEvents(issueId: number, limit: number): Promise<IssueEvent[]> {
    const entities = await this.read((manager) =>
      manager.find(IssueEventEntity, { where: { issueId }, order: { id: 'DESC' }, take: limit }),
    );
    return entities.map(toIssueEventModel);
  }

  async countOpenByProject(): Promise<OpenIssueCount[]> {
    const rows: unknown[] = await this.read((manager) =>
      manager
        .createQueryBuilder(IssueEntity, 'issue')
        .select('issue.projectId', 'projectId')
        .addSelect('COUNT(*)', 'count')
        .where('issue.status != :closed', { closed: CLOSED_ISSUE_STATUS })
        .groupBy('issue.projectId')
        .orderBy('issue.projectId', 'ASC')
        .getRawMany(),
    );
    return rows.map(toOpenIssueCountModel);
  }

  // 기대한 version의 행일 때만 이슈를 고치고 고쳤는지를 반환함 (save()는 고친 행 수를 주지 않아 UPDATE를 씀)
  private async updateIfVersionMatches({
    manager,
    issue,
    expectedVersion,
  }: {
    manager: EntityManager;
    issue: Issue;
    expectedVersion: number;
  }): Promise<boolean> {
    // version이 1씩 오르지 않으면 그 뒤 겹친 수정을 잡지 못하므로 저장하지 않음
    if (issue.version !== expectedVersion + 1) {
      throw new Error(`저장할 version이 기대한 version의 다음이 아님: issueId=${issue.id}`);
    }

    const result = await manager.update(
      IssueEntity,
      { id: issue.id, version: expectedVersion },
      toIssueEntityUpdate(issue),
    );
    return result.affected === 1;
  }

  // 번호 카운터를 1 올리고 올린 값을 반환함 (새 이슈의 번호로 씀)
  private async incrementIssueCounter(manager: EntityManager): Promise<number> {
    await manager.increment(IssueCounterEntity, { id: ISSUE_COUNTER_ID }, 'value', 1);
    const counter = await manager.findOneByOrFail(IssueCounterEntity, { id: ISSUE_COUNTER_ID });
    return counter.value;
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
