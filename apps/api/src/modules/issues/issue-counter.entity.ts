import { Column, Entity, PrimaryColumn } from 'typeorm';

/**
 * issue_counter 테이블의 하나뿐인 행을 TypeORM에 알려 주는 엔티티다.
 */
@Entity('issue_counter')
export class IssueCounterEntity {
  @PrimaryColumn({ type: 'integer' })
  id!: number;

  // 마지막으로 내준 이슈 번호
  @Column({ type: 'integer' })
  value!: number;
}
