import type { ProjectColor } from '@lokibench/contracts';
import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

/**
 * projects 테이블의 한 행을 TypeORM에 알려 주는 엔티티다.
 *
 * - 테이블 구조는 마이그레이션이 만들고, 이 클래스는 읽고 쓸 때의 열 이름만 맞춘다
 * - repository 밖으로는 내보내지 않고 계약의 Project로 바꿔서 넘긴다
 */
@Entity('projects')
export class ProjectEntity {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ type: 'text', unique: true })
  name!: string;

  @Column({ type: 'text' })
  color!: ProjectColor;

  // ISO 8601 UTC 문자열로 저장해 sqlite를 직접 열어도 읽히게 함
  @Column({ name: 'created_at', type: 'text' })
  createdAt!: string;

  @Column({ name: 'archived_at', type: 'text', nullable: true })
  archivedAt!: string | null;
}
