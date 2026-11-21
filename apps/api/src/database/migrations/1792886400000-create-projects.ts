import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * 프로젝트를 저장하는 projects 테이블을 만든다.
 *
 * - 색 CHECK는 작성 시점의 팔레트 6색을 SQL에 고정한다 (도메인 상수를 불러오면 DB마다 제약이 달라짐)
 * - 팔레트를 바꿀 때는 도메인 상수와 함께 새 마이그레이션으로 제약을 바꾼다
 * - 이름 UNIQUE는 두 탭이 동시에 같은 이름을 추가해도 DB에서 한 번 더 막는다
 * - archived_at 열은 쓰지 않게 되어 뒤 마이그레이션(1795219200000)에서 지운다
 *   - 이미 실행된 마이그레이션이라 여기의 SQL은 고치지 않음
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
        color TEXT NOT NULL CHECK (color IN ('indigo', 'sky', 'teal', 'violet', 'rose', 'orange')),
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
