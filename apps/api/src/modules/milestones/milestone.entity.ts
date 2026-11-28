import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

/**
 * milestones 테이블의 한 행을 TypeORM에 알려 주는 엔티티다.
 */
@Entity('milestones')
export class MilestoneEntity {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ name: 'project_id', type: 'integer' })
  projectId!: number;

  @Column({ type: 'text' })
  title!: string;

  // 시각 없이 YYYY-MM-DD 날짜만 저장함
  @Column({ name: 'start_date', type: 'text', nullable: true })
  startDate!: string | null;

  // 시각 없이 YYYY-MM-DD 날짜만 저장함
  @Column({ type: 'text', nullable: true })
  due!: string | null;

  // 네 칸은 비어 있으면 null이 아니라 빈 글
  @Column({ type: 'text', default: '' })
  background!: string;

  @Column({ type: 'text', default: '' })
  solution!: string;

  @Column({ name: 'expected_effect', type: 'text', default: '' })
  expectedEffect!: string;

  @Column({ type: 'text', default: '' })
  memo!: string;

  @Column({ name: 'created_at', type: 'text' })
  createdAt!: string;

  @Column({ name: 'closed_at', type: 'text', nullable: true })
  closedAt!: string | null;

  // 지운 표시. 값이 있으면 어디에도 보이지 않고, 되살리면 다시 비움
  @Column({ name: 'deleted_at', type: 'text', nullable: true })
  deletedAt!: string | null;
}
