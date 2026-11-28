import { INITIAL_ISSUE_STATUS } from '@lokibench/shared/values';
import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource, type EntityManager } from 'typeorm';

import { IssueEntity } from './issue.entity';
import {
  toIssueEntityUpdate,
  toIssueEventModel,
  toIssueModel,
  toStatusEventEntity,
} from './issue.mapper';
import type { CreateIssueInput, Issue, IssueEvent, SaveIssueChangeInput } from './issue.model';
import { IssueRepository } from './issue.repository';
import { IssueCounterEntity } from './issue-counter.entity';
import { IssueEventEntity } from './issue-event.entity';

// 번호 카운터 테이블의 하나뿐인 행 id
const ISSUE_COUNTER_ID = 1;

/**
 * sqlite에 이슈와 이슈 이력을 읽고 쓰는 repository 구현체다.
 *
 * - 쓰기는 트랜잭션으로 묶고 한 번에 하나씩만 실행한다
 *   (DB 연결 하나를 모든 요청이 함께 써서, 겹쳐 시작한 트랜잭션은 서로 격리되지 않는다)
 */
@Injectable()
export class TypeOrmIssueRepository extends IssueRepository {
  // 앞 쓰기가 끝난 뒤에 다음 쓰기를 시작하게 잇는 줄
  private writeQueue: Promise<unknown> = Promise.resolve();

  constructor(@InjectDataSource() private readonly dataSource: DataSource) {
    super();
  }

  // 번호 카운터를 올리고 이슈와 만든 이력을 한 트랜잭션으로 저장함
  async create(input: CreateIssueInput): Promise<Issue> {
    const saveNewIssue = async (manager: EntityManager): Promise<Issue> => {
      const number = await this.incrementIssueCounter(manager);
      const at = input.now.toISOString();

      const issue = manager.create(IssueEntity, {
        projectId: input.projectId,
        number,
        title: input.title,
        due: input.due,
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

  // 바뀐 이슈와 상태 변경 이력을 한 트랜잭션으로 저장함 (기대한 version의 행이 없으면 null)
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

  // id로 이슈 하나를 찾음 (없으면 null)
  async findById(id: number): Promise<Issue | null> {
    const entity = await this.dataSource.manager.findOneBy(IssueEntity, { id });
    return entity && toIssueModel(entity);
  }

  // 이슈의 이력을 최신 순으로 limit개까지 찾음
  async findLastEvents(issueId: number, limit: number): Promise<IssueEvent[]> {
    const entities = await this.dataSource.manager.find(IssueEventEntity, {
      where: { issueId },
      order: { id: 'DESC' },
      take: limit,
    });
    return entities.map(toIssueEventModel);
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

  // 트랜잭션으로 묶은 쓰기를 줄 끝에 이어 붙임 (앞 쓰기가 실패해도 다음 쓰기는 돌도록 줄에는 실패를 삼킨 Promise를 남김)
  private write<T>(work: (manager: EntityManager) => Promise<T>): Promise<T> {
    const result = this.writeQueue.then(() => this.dataSource.transaction(work));
    this.writeQueue = result.catch(() => undefined);
    return result;
  }
}
