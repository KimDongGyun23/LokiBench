import type { ProjectColor } from '@lokibench/shared/values';
import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

/**
 * projects 테이블의 한 행을 TypeORM에 알려 주는 엔티티다.
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
}
