import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * projects 테이블에서 쓰지 않는 archived_at 열을 지운다.
 *
 * - 프로젝트 아카이브 기능을 만들지 않기로 해서, 값을 채울 길이 없는 열을 남기지 않는다
 * - 이미 실행된 테이블 생성 마이그레이션은 고치지 않고 새 마이그레이션으로 바꾼다
 *   - 고치면 이미 만들어진 DB와 새로 만든 DB의 스키마가 달라짐
 */
export class DropProjectsArchivedAt1795219200000 implements MigrationInterface {
  /**
   * archived_at 열을 지운다.
   *
   * - 다른 열과 행은 그대로 남는다
   *
   * @param queryRunner 마이그레이션 트랜잭션 안에서 SQL을 실행하는 연결
   */
  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE projects DROP COLUMN archived_at`);
  }

  /**
   * up을 되돌려 archived_at 열을 다시 만든다.
   *
   * - 기동 때는 실행되지 않고, 마이그레이션을 직접 되돌릴 때만 쓴다
   * - 지우기 전에 들어 있던 값은 돌아오지 않고 모두 비어 있다
   *
   * @param queryRunner 마이그레이션 트랜잭션 안에서 SQL을 실행하는 연결
   */
  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE projects ADD COLUMN archived_at TEXT`);
  }
}
