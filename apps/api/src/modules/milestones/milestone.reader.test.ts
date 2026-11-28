import { DataSource } from 'typeorm';

import { createDataSourceOptions } from '@/database/data-source-options';

import { readMilestoneGuard } from './milestone.reader';

const AT = '2026-11-28T00:00:00.000Z';

let dataSource: DataSource;

beforeEach(async () => {
  // 프로젝트 둘에 열린 것, 닫힌 것, 지운 것 마일스톤을 하나씩 넣고 시작함
  dataSource = await new DataSource(createDataSourceOptions(':memory:')).initialize();
  await dataSource.query(
    `INSERT INTO projects (name, color, created_at)
     VALUES ('독서 기록', 'indigo', '${AT}'), ('가계부', 'teal', '${AT}')`,
  );
  await dataSource.query(
    `INSERT INTO milestones (id, project_id, title, created_at, closed_at, deleted_at) VALUES
       (1, 2, '12월 정리', '${AT}', NULL, NULL),
       (2, 1, '독서 목록 정리', '${AT}', '${AT}', NULL),
       (3, 1, '별점과 서평', '${AT}', NULL, '${AT}')`,
  );
});

afterEach(async () => {
  await dataSource.destroy();
});

describe('이슈 저장소가 읽는 마일스톤 상태', () => {
  test('이슈를 넣을 프로젝트와 비교할 수 있도록 열린 마일스톤은 프로젝트와 열림을 준다', async () => {
    // When
    const guard = await readMilestoneGuard({ manager: dataSource.manager, milestoneId: 1 });

    // Then
    expect(guard).toEqual({ projectId: 2, isClosed: false });
  });

  test('닫힌 마일스톤에 이슈가 열리지 않도록 닫힌 마일스톤은 닫힘을 준다', async () => {
    // When
    const guard = await readMilestoneGuard({ manager: dataSource.manager, milestoneId: 2 });

    // Then
    expect(guard).toEqual({ projectId: 1, isClosed: true });
  });

  test('지운 마일스톤에 이슈가 들어가지 않도록 지운 것과 없는 id는 null을 준다', async () => {
    // When
    const deleted = await readMilestoneGuard({ manager: dataSource.manager, milestoneId: 3 });
    const missing = await readMilestoneGuard({ manager: dataSource.manager, milestoneId: 999 });

    // Then
    expect(deleted).toBeNull();
    expect(missing).toBeNull();
  });
});
