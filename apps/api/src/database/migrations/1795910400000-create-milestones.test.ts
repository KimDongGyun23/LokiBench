import { DataSource } from 'typeorm';

import { createDataSourceOptions } from '@/database/data-source-options';

import { CreateProjects1792886400000 } from './1792886400000-create-projects';
import { DropProjectsArchivedAt1795219200000 } from './1795219200000-drop-projects-archived-at';
import { CreateIssues1795305600000 } from './1795305600000-create-issues';
import { CreateMilestones1795910400000 } from './1795910400000-create-milestones';

const AT = '2026-11-28T00:00:00.000Z';

// SQLite가 제약 종류별로 내는 오류 문구
const CHECK_VIOLATION = /CHECK constraint failed/;
const FOREIGN_KEY_VIOLATION = /FOREIGN KEY constraint failed/;
const UNIQUE_VIOLATION = /UNIQUE constraint failed/;

let dataSource: DataSource;

beforeEach(async () => {
  // 마일스톤이 생기기 전 스키마에 프로젝트와 이슈가 하나씩 있는 상태에서 시작함
  const options = {
    ...createDataSourceOptions(':memory:'),
    migrations: [
      CreateProjects1792886400000,
      DropProjectsArchivedAt1795219200000,
      CreateIssues1795305600000,
    ],
  };
  dataSource = await new DataSource(options).initialize();
  await dataSource.query(
    `INSERT INTO projects (name, color, created_at) VALUES ('독서 기록', 'indigo', '${AT}')`,
  );
  await dataSource.query(
    `INSERT INTO issues (project_id, number, title, status, status_changed_at, version, created_at)
     VALUES (1, 1, '읽은 책 별점 입력', 'TODO', '${AT}', 1, '${AT}')`,
  );

  const queryRunner = dataSource.createQueryRunner();
  await new CreateMilestones1795910400000().up(queryRunner);
  await queryRunner.release();
});

afterEach(async () => {
  await dataSource.destroy();
});

// 바꿀 열만 넘겨받아 프로젝트 1에 마일스톤 하나를 넣는 SQL을 만듦
function insertMilestoneSql(overrides: Record<string, string> = {}): string {
  const columns: Record<string, string> = {
    project_id: '1',
    title: `'별점과 서평'`,
    created_at: `'${AT}'`,
    ...overrides,
  };
  return `INSERT INTO milestones (${Object.keys(columns).join(', ')}) VALUES (${Object.values(columns).join(', ')})`;
}

describe('마일스톤 테이블 만들기', () => {
  test('쓰던 이슈를 잃지 않도록 열을 더해도 이미 있는 이슈는 그대로 두고 미지정으로 둔다', async () => {
    // When
    const issues: unknown = await dataSource.query(`SELECT id, title, milestone_id FROM issues`);

    // Then
    expect(issues).toEqual([{ id: 1, title: '읽은 책 별점 입력', milestone_id: null }]);
  });

  test('빈 칸을 null과 빈 글 두 가지로 다루지 않도록 네 칸을 빼고 넣으면 빈 글로 채운다', async () => {
    // When
    await dataSource.query(insertMilestoneSql());
    const rows: unknown = await dataSource.query(
      `SELECT background, solution, expected_effect, memo FROM milestones`,
    );

    // Then
    expect(rows).toEqual([{ background: '', solution: '', expected_effect: '', memo: '' }]);
  });

  test('기간이 거꾸로 저장되지 않도록 시작이 마감보다 늦은 행은 넣지 못한다', async () => {
    // When
    const insert = dataSource.query(
      insertMilestoneSql({ start_date: `'2026-12-10'`, due: `'2026-12-01'` }),
    );

    // Then
    await expect(insert).rejects.toThrow(CHECK_VIOLATION);
  });

  test('하루짜리 마일스톤도 있으므로 시작과 마감이 같은 날인 행은 넣을 수 있다', async () => {
    // When
    const insert = dataSource.query(
      insertMilestoneSql({ start_date: `'2026-12-01'`, due: `'2026-12-01'` }),
    );

    // Then
    await expect(insert).resolves.toBeDefined();
  });

  test('프로젝트 안에서 마일스톤을 이름으로 가릴 수 있도록 같은 프로젝트에 같은 제목을 두 번 넣지 못한다', async () => {
    // Given
    await dataSource.query(insertMilestoneSql());

    // When
    const insert = dataSource.query(insertMilestoneSql());

    // Then
    await expect(insert).rejects.toThrow(UNIQUE_VIOLATION);
  });

  test('지운 마일스톤의 이름을 다시 쓸 수 있도록 지운 표시가 있는 행과는 제목이 겹쳐도 된다', async () => {
    // Given
    await dataSource.query(insertMilestoneSql({ deleted_at: `'${AT}'` }));

    // When
    const insert = dataSource.query(insertMilestoneSql());

    // Then
    await expect(insert).resolves.toBeDefined();
  });

  test('주인 없는 마일스톤이 생기지 않도록 없는 프로젝트의 마일스톤은 넣지 못한다', async () => {
    // When
    const insert = dataSource.query(insertMilestoneSql({ project_id: '999' }));

    // Then
    await expect(insert).rejects.toThrow(FOREIGN_KEY_VIOLATION);
  });

  test('이슈가 사라진 마일스톤을 가리키지 않도록 없는 마일스톤에는 이슈를 넣지 못한다', async () => {
    // When
    const update = dataSource.query(`UPDATE issues SET milestone_id = 999 WHERE id = 1`);

    // Then
    await expect(update).rejects.toThrow(FOREIGN_KEY_VIOLATION);
  });
});

describe('마일스톤 테이블 되돌리기', () => {
  test('마이그레이션을 직접 되돌리면 이슈는 남기고 마일스톤 열과 테이블만 지운다', async () => {
    // When
    const queryRunner = dataSource.createQueryRunner();
    await new CreateMilestones1795910400000().down(queryRunner);
    await queryRunner.release();

    // Then
    const issues: unknown = await dataSource.query(`SELECT id, title FROM issues`);
    const tables: unknown = await dataSource.query(
      `SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'milestones'`,
    );
    expect(issues).toEqual([{ id: 1, title: '읽은 책 별점 입력' }]);
    expect(tables).toEqual([]);
  });
});
