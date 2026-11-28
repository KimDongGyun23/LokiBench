import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * 마일스톤 테이블을 만들고 이슈에 마일스톤 열을 더한다.
 *
 * - 제목은 지우지 않은 마일스톤끼리만 겹치지 않게 해서, 지운 마일스톤의 이름을 새 마일스톤이 다시 쓸 수 있다
 * - 네 칸(배경, 해결방안, 기대효과, 메모)은 비어 있으면 빈 글로 둔다
 * - 이슈와 마일스톤의 프로젝트가 같은지, 닫힌 마일스톤인지는 제약으로 걸지 않는다
 *   (sqlite에서는 트리거가 필요해 규칙이 두 곳으로 나뉘므로 쓰기 트랜잭션에서 검사함)
 */
export class CreateMilestones1795910400000 implements MigrationInterface {
  /**
   * milestones 테이블을 만들고 issues에 milestone_id 열을 더한다.
   *
   * @param queryRunner 마이그레이션 트랜잭션 안에서 SQL을 실행하는 연결
   */
  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE milestones (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        project_id INTEGER NOT NULL REFERENCES projects (id),
        title TEXT NOT NULL,
        start_date TEXT,
        due TEXT,
        background TEXT NOT NULL DEFAULT '',
        solution TEXT NOT NULL DEFAULT '',
        expected_effect TEXT NOT NULL DEFAULT '',
        memo TEXT NOT NULL DEFAULT '',
        created_at TEXT NOT NULL,
        closed_at TEXT,
        deleted_at TEXT,
        CHECK (start_date IS NULL OR due IS NULL OR start_date <= due)
      )
    `);
    await queryRunner.query(`CREATE INDEX milestones_project_id ON milestones (project_id)`);
    await queryRunner.query(`
      CREATE UNIQUE INDEX milestones_project_id_title_active
      ON milestones (project_id, title) WHERE deleted_at IS NULL
    `);

    // 기본값이 NULL이라 sqlite가 참조를 단 열 추가를 허락하고, 이미 있는 이슈는 미지정이 됨
    await queryRunner.query(
      `ALTER TABLE issues ADD COLUMN milestone_id INTEGER REFERENCES milestones (id)`,
    );
    await queryRunner.query(`CREATE INDEX issues_milestone_id ON issues (milestone_id)`);
  }

  /**
   * up을 되돌려 이슈의 마일스톤 열과 마일스톤 테이블을 지운다.
   *
   * - 기동 때는 실행되지 않고, 마이그레이션을 직접 되돌릴 때만 쓴다
   * - 이슈는 남고 어느 마일스톤에 들었는지만 사라진다
   *
   * @param queryRunner 마이그레이션 트랜잭션 안에서 SQL을 실행하는 연결
   */
  async down(queryRunner: QueryRunner): Promise<void> {
    // 인덱스가 걸린 열은 지울 수 없어서 인덱스부터 지움
    await queryRunner.query(`DROP INDEX issues_milestone_id`);
    await queryRunner.query(`ALTER TABLE issues DROP COLUMN milestone_id`);
    await queryRunner.query(`DROP TABLE milestones`);
  }
}
