import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

import type { IssueEvent } from './issue.model';

/**
 * issue_events 테이블의 한 행을 TypeORM에 알려 주는 엔티티다.
 *
 * - 테이블 구조는 마이그레이션이 만들고, 이 클래스는 읽고 쓸 때의 열 이름만 맞춘다
 * - repository 밖으로는 내보내지 않고 도메인 IssueEvent로 바꿔서 넘긴다
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
