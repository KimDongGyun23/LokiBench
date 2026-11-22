import type { IssueStatus } from '@lokibench/shared/values';
import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

/**
 * issues 테이블의 한 행을 TypeORM에 알려 주는 엔티티다.
 *
 * - 테이블 구조는 마이그레이션이 만들고, 이 클래스는 읽고 쓸 때의 열 이름만 맞춘다
 * - repository 밖으로는 내보내지 않고 도메인 Issue로 바꿔서 넘긴다
 */
@Entity('issues')
export class IssueEntity {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ name: 'project_id', type: 'integer' })
  projectId!: number;

  // 프로젝트와 무관하게 1부터 이어지는 번호
  @Column({ type: 'integer', unique: true })
  number!: number;

  @Column({ type: 'text' })
  title!: string;

  // 시각 없이 YYYY-MM-DD 날짜만 저장함
  @Column({ type: 'text', nullable: true })
  due!: string | null;

  @Column({ type: 'text' })
  status!: IssueStatus;

  @Column({ name: 'status_changed_at', type: 'text' })
  statusChangedAt!: string;

  // 수정 충돌을 가리려고 바뀔 때마다 1씩 올림
  @Column({ type: 'integer' })
  version!: number;

  @Column({ name: 'created_at', type: 'text' })
  createdAt!: string;

  @Column({ name: 'closed_at', type: 'text', nullable: true })
  closedAt!: string | null;
}
