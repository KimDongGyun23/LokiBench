import { ISSUE_STATUSES } from '@lokibench/domain';
import { DataSource } from 'typeorm';

import { createDataSourceOptions } from '../data-source-options';
import { CreateProjects1792886400000 } from './1792886400000-create-projects';
import { DropProjectsArchivedAt1795219200000 } from './1795219200000-drop-projects-archived-at';
import { CreateIssues1795305600000 } from './1795305600000-create-issues';

const AT = '2026-11-22T00:00:00.000Z';

// SQLite가 제약 종류별로 내는 오류 문구
const CHECK_VIOLATION = /CHECK constraint failed/;
const FOREIGN_KEY_VIOLATION = /FOREIGN KEY constraint failed/;

let dataSource: DataSource;

beforeEach(async () => {
  // 이슈 테이블이 생기기 전 스키마에 프로젝트가 하나 있는 상태에서 시작함
  const options = {
    ...createDataSourceOptions(':memory:'),
    migrations: [CreateProjects1792886400000, DropProjectsArchivedAt1795219200000],
  };
  dataSource = await new DataSource(options).initialize();
  await dataSource.query(
    `INSERT INTO projects (name, color, created_at) VALUES ('독서 기록', 'indigo', '${AT}')`,
  );

  const queryRunner = dataSource.createQueryRunner();
  await new CreateIssues1795305600000().up(queryRunner);
  await queryRunner.release();
});

afterEach(async () => {
  await dataSource.destroy();
});

// 바꿀 열만 넘겨받아 프로젝트 1에 TODO 이슈 하나를 넣는 SQL을 만듦
function insertIssueSql(overrides: Record<string, string> = {}): string {
  const columns: Record<string, string> = {
    project_id: '1',
    number: '1',
    title: `'읽은 책 별점 입력'`,
    status: `'TODO'`,
    status_changed_at: `'${AT}'`,
    version: '1',
    created_at: `'${AT}'`,
    closed_at: 'NULL',
    ...overrides,
  };
  return `INSERT INTO issues (${Object.keys(columns).join(', ')}) VALUES (${Object.values(columns).join(', ')})`;
}

describe('이슈 테이블 만들기', () => {
  test('쓰던 프로젝트를 잃지 않도록 테이블을 더해도 이미 있는 프로젝트는 그대로 둔다', async () => {
    // When
    const projects: unknown = await dataSource.query(`SELECT * FROM projects`);

    // Then
    expect(projects).toEqual([{ id: 1, name: '독서 기록', color: 'indigo', created_at: AT }]);
  });

  test('첫 이슈가 1번을 받도록 번호 카운터를 0인 행 하나로 시작한다', async () => {
    // When
    const counter: unknown = await dataSource.query(`SELECT * FROM issue_counter`);

    // Then
    expect(counter).toEqual([{ id: 1, value: 0 }]);
  });

  test('카운터가 둘로 갈리지 않도록 카운터 행을 하나 더 넣지 못한다', async () => {
    // When
    const insert = dataSource.query(`INSERT INTO issue_counter (id, value) VALUES (2, 0)`);

    // Then
    await expect(insert).rejects.toThrow(CHECK_VIOLATION);
  });
});

describe('이슈 행의 제약', () => {
  test('도메인이 아는 상태를 저장하지 못하는 일이 없도록 모든 상태의 이슈를 넣을 수 있다', async () => {
    // When
    for (const [index, status] of ISSUE_STATUSES.entries()) {
      await dataSource.query(
        insertIssueSql({
          number: String(index + 1),
          status: `'${status}'`,
          closed_at: status === 'DONE' ? `'${AT}'` : 'NULL',
        }),
      );
    }

    // Then
    const rows: unknown = await dataSource.query(`SELECT status FROM issues ORDER BY number`);
    expect(rows).toEqual(ISSUE_STATUSES.map((status) => ({ status })));
  });

  test('주인 없는 이슈가 생기지 않도록 없는 프로젝트의 이슈를 거부한다', async () => {
    // When
    const insert = dataSource.query(insertIssueSql({ project_id: '999' }));

    // Then
    await expect(insert).rejects.toThrow(FOREIGN_KEY_VIOLATION);
  });

  test('번호로 이슈 하나를 가리킬 수 있도록 같은 번호를 거부한다', async () => {
    // Given
    await dataSource.query(insertIssueSql());

    // When
    const insert = dataSource.query(insertIssueSql());

    // Then
    await expect(insert).rejects.toThrow(/UNIQUE constraint failed: issues\.number/);
  });

  test('네 상태 밖의 값은 거부한다', async () => {
    // When
    const insert = dataSource.query(insertIssueSql({ status: `'BACKLOG'` }));

    // Then
    await expect(insert).rejects.toThrow(CHECK_VIOLATION);
  });

  test('닫힌 이슈와 닫은 시각이 어긋나지 않도록 DONE인데 닫은 시각이 없으면 거부한다', async () => {
    // When
    const insert = dataSource.query(insertIssueSql({ status: `'DONE'` }));

    // Then
    await expect(insert).rejects.toThrow(CHECK_VIOLATION);
  });

  test('닫힌 이슈와 닫은 시각이 어긋나지 않도록 열린 이슈에 닫은 시각이 있으면 거부한다', async () => {
    // When
    const insert = dataSource.query(insertIssueSql({ closed_at: `'${AT}'` }));

    // Then
    await expect(insert).rejects.toThrow(CHECK_VIOLATION);
  });
});

describe('활동 기록 행의 제약', () => {
  beforeEach(async () => {
    await dataSource.query(insertIssueSql());
  });

  test('만든 기록과 상태 변경 기록을 넣을 수 있다', async () => {
    // When
    await dataSource.query(
      `INSERT INTO activities (issue_id, at, kind, payload) VALUES (1, '${AT}', 'CREATED', NULL)`,
    );
    await dataSource.query(
      `INSERT INTO activities (issue_id, at, kind, payload) VALUES (1, '${AT}', 'STATUS', '{"from":"TODO","to":"IN_PROGRESS"}')`,
    );

    // Then
    const rows: unknown[] = await dataSource.query(`SELECT id FROM activities`);
    expect(rows).toHaveLength(2);
  });

  test('되돌리기가 이전 상태를 읽을 수 있도록 상태 변경 기록에 내용이 없으면 거부한다', async () => {
    // When
    const insert = dataSource.query(
      `INSERT INTO activities (issue_id, at, kind, payload) VALUES (1, '${AT}', 'STATUS', NULL)`,
    );

    // Then
    await expect(insert).rejects.toThrow(CHECK_VIOLATION);
  });

  test('만든 기록이 상태 변경으로 읽히지 않도록 만든 기록에 내용이 있으면 거부한다', async () => {
    // When
    const insert = dataSource.query(
      `INSERT INTO activities (issue_id, at, kind, payload) VALUES (1, '${AT}', 'CREATED', '{"from":"TODO","to":"IN_PROGRESS"}')`,
    );

    // Then
    await expect(insert).rejects.toThrow(CHECK_VIOLATION);
  });

  test('두 종류 밖의 기록은 거부한다', async () => {
    // When
    const insert = dataSource.query(
      `INSERT INTO activities (issue_id, at, kind, payload) VALUES (1, '${AT}', 'COMMENT', NULL)`,
    );

    // Then
    await expect(insert).rejects.toThrow(CHECK_VIOLATION);
  });

  test('없는 이슈의 기록을 거부한다', async () => {
    // When
    const insert = dataSource.query(
      `INSERT INTO activities (issue_id, at, kind, payload) VALUES (999, '${AT}', 'CREATED', NULL)`,
    );

    // Then
    await expect(insert).rejects.toThrow(FOREIGN_KEY_VIOLATION);
  });
});
