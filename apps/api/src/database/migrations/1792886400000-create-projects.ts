import { PROJECT_COLORS } from '@lokibench/contracts';
import type { MigrationInterface, QueryRunner } from 'typeorm';

const COLOR_CHECK = PROJECT_COLORS.map((color) => `'${color}'`).join(', ');

/**
 * 프로젝트를 저장하는 projects 테이블을 만든다.
 *
 * - 색 CHECK 목록은 계약의 팔레트에서 만든다
 * - 이미 실행된 DB는 다시 실행하지 않으므로 팔레트를 바꿀 때는 새 마이그레이션이 필요하다
 * - 이름 UNIQUE는 두 탭이 동시에 같은 이름을 추가해도 DB에서 한 번 더 막는다
 * - 아카이브 열은 아카이브 기능에서 쓰지만 마이그레이션을 한 번 줄이려고 지금 만든다
 */
export class CreateProjects1792886400000 implements MigrationInterface {
  /**
   * projects 테이블을 만든다.
   *
   * - 기동할 때 이 마이그레이션이 기록에 없으면 한 번만 실행된다
   *
   * @param queryRunner 마이그레이션 트랜잭션 안에서 SQL을 실행하는 연결
   */
  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE projects (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL UNIQUE,
        color TEXT NOT NULL CHECK (color IN (${COLOR_CHECK})),
        created_at TEXT NOT NULL,
        archived_at TEXT
      )
    `);
  }

  /**
   * up을 되돌려 projects 테이블을 지운다.
   *
   * - 기동 때는 실행되지 않고, 마이그레이션을 직접 되돌릴 때만 쓴다
   * - 테이블의 데이터도 함께 사라진다
   *
   * @param queryRunner 마이그레이션 트랜잭션 안에서 SQL을 실행하는 연결
   */
  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE projects`);
  }
}
