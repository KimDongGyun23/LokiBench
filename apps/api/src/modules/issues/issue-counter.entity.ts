import { Column, Entity, PrimaryColumn } from 'typeorm';

/**
 * issue_counter 테이블의 하나뿐인 행을 TypeORM에 알려 주는 엔티티다.
 *
 * - 테이블 구조는 마이그레이션이 만들고, 이 클래스는 읽고 쓸 때의 열 이름만 맞춘다
 */
@Entity('issue_counter')
export class IssueCounterEntity {
  @PrimaryColumn({ type: 'integer' })
  id!: number;

  // 마지막으로 내준 이슈 번호
  @Column({ type: 'integer' })
  value!: number;
}
