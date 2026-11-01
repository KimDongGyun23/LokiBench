import { DataSource } from 'typeorm';

import { createDataSourceOptions } from '../data-source-options';

// 계약의 팔레트에 새 색이 더해진 미래 상황을 흉내 냄
vi.mock('@lokibench/contracts', async (importOriginal) => {
  const original = await importOriginal<typeof import('@lokibench/contracts')>();
  return { ...original, PROJECT_COLORS: [...original.PROJECT_COLORS, 'lime'] };
});

let dataSource: DataSource | undefined;

afterEach(async () => {
  await dataSource?.destroy();
  dataSource = undefined;
});

describe('projects 테이블 색 제약', () => {
  test('DB마다 제약이 달라지지 않도록 계약의 팔레트가 바뀌어도 처음 정한 6색만 허용한다', async () => {
    // Given: 팔레트에 lime이 더해진 상태에서 마이그레이션 실행
    dataSource = await new DataSource(createDataSourceOptions(':memory:')).initialize();

    // When: 새 색으로 행을 직접 저장
    const insert = dataSource.query(
      `INSERT INTO projects (name, color, created_at) VALUES ('독서 기록', 'lime', '2026-10-31T00:00:00.000Z')`,
    );

    // Then: 마이그레이션이 만든 CHECK에 걸림
    await expect(insert).rejects.toThrow(/CHECK constraint failed/);
  });
});
