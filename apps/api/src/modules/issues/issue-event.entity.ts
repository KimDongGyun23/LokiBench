import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

import type { IssueEvent } from './issue.model';

/**
 * issue_events 테이블의 한 행을 TypeORM에 알려 주는 엔티티다.
 */
@Entity('issue_events')
export class IssueEventEntity {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ name: 'issue_id', type: 'integer' })
  issueId!: number;

  @Column({ type: 'text' })
  at!: string;

  @Column({ type: 'text' })
  kind!: IssueEvent['kind'];

  // 상태 변경 기록만 이전 상태와 새 상태를 JSON 글자로 가짐
  @Column({ type: 'text', nullable: true })
  payload!: string | null;
}
