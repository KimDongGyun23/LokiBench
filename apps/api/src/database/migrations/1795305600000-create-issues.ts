import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * 이슈, 이슈 이력, 번호 카운터를 저장하는 테이블을 만든다.
 *
 * - 상태 CHECK는 작성 시점의 네 상태를 SQL에 고정한다 (도메인 상수를 불러오면 DB마다 제약이 달라짐)
 * - 닫힌 이슈와 닫은 시각, 상태 변경 기록과 그 내용은 늘 함께 있도록 CHECK로 묶는다
 * - 번호 카운터는 행이 하나뿐이도록 id를 1로 고정하고, 첫 이슈가 1번을 받게 0에서 시작한다
 */
export class CreateIssues1795305600000 implements MigrationInterface {
  /**
   * issues, issue_events, issue_counter 테이블을 만든다.
   *
   * @param queryRunner 마이그레이션 트랜잭션 안에서 SQL을 실행하는 연결
   */
  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE issues (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        project_id INTEGER NOT NULL REFERENCES projects (id),
        number INTEGER NOT NULL UNIQUE,
        title TEXT NOT NULL,
        due TEXT,
        status TEXT NOT NULL CHECK (status IN ('TODO', 'IN_PROGRESS', 'IN_REVIEW', 'DONE')),
        status_changed_at TEXT NOT NULL,
        version INTEGER NOT NULL,
        created_at TEXT NOT NULL,
        closed_at TEXT,
        CHECK ((status = 'DONE') = (closed_at IS NOT NULL))
      )
    `);
    await queryRunner.query(`CREATE INDEX issues_project_id ON issues (project_id)`);

    await queryRunner.query(`
      CREATE TABLE issue_events (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        issue_id INTEGER NOT NULL REFERENCES issues (id),
        at TEXT NOT NULL,
        kind TEXT NOT NULL CHECK (kind IN ('CREATED', 'STATUS')),
        payload TEXT,
        CHECK ((kind = 'STATUS') = (payload IS NOT NULL))
      )
    `);
    await queryRunner.query(`CREATE INDEX issue_events_issue_id_id ON issue_events (issue_id, id)`);

    await queryRunner.query(`
      CREATE TABLE issue_counter (
        id INTEGER PRIMARY KEY CHECK (id = 1),
        value INTEGER NOT NULL
      )
    `);
    await queryRunner.query(`INSERT INTO issue_counter (id, value) VALUES (1, 0)`);
  }

  /**
   * up을 되돌려 세 테이블을 지운다.
   *
   * - 기동 때는 실행되지 않고, 마이그레이션을 직접 되돌릴 때만 쓴다
   * - 이슈와 이슈 이력, 번호 카운터가 함께 사라진다
   *
   * @param queryRunner 마이그레이션 트랜잭션 안에서 SQL을 실행하는 연결
   */
  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE issue_counter`);
    await queryRunner.query(`DROP TABLE issue_events`);
    await queryRunner.query(`DROP TABLE issues`);
  }
}
