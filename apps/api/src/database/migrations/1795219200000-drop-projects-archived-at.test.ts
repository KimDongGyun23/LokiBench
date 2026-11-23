import { DataSource } from 'typeorm';

import { createDataSourceOptions } from '@/database/data-source-options';

import { CreateProjects1792886400000 } from './1792886400000-create-projects';
import { DropProjectsArchivedAt1795219200000 } from './1795219200000-drop-projects-archived-at';

let dataSource: DataSource | undefined;

afterEach(async () => {
  await dataSource?.destroy();
  dataSource = undefined;
});

describe('projects 테이블에서 아카이브 열 지우기', () => {
  test('쓰던 프로젝트를 잃지 않도록 열을 지워도 이미 있는 행의 나머지 값은 그대로 둔다', async () => {
    // Given: 열을 지우기 전 스키마에 프로젝트가 하나 있음
    const options = {
      ...createDataSourceOptions(':memory:'),
      migrations: [CreateProjects1792886400000],
    };
    dataSource = await new DataSource(options).initialize();
    await dataSource.query(
      `INSERT INTO projects (name, color, created_at) VALUES ('독서 기록', 'indigo', '2026-10-31T00:00:00.000Z')`,
    );

    // When
    const queryRunner = dataSource.createQueryRunner();
    await new DropProjectsArchivedAt1795219200000().up(queryRunner);
    await queryRunner.release();

    // Then: 행은 남고 아카이브 열만 사라짐
    const rows: unknown = await dataSource.query(`SELECT * FROM projects`);
    expect(rows).toEqual([
      { id: 1, name: '독서 기록', color: 'indigo', created_at: '2026-10-31T00:00:00.000Z' },
    ]);
  });
});
