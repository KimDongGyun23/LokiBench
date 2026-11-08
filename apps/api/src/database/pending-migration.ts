import { existsSync } from 'node:fs';

import { DataSource, MigrationExecutor } from 'typeorm';

import { createDataSourceOptions } from './data-source-options';

/**
 * 아직 실행하지 않은 첫 마이그레이션의 시각을 찾는다.
 *
 * - 백업보다 먼저 스키마가 바뀌지 않도록 마이그레이션은 실행하지 않고 기록만 읽는다
 * - 처음 기동이라 DB 파일이 없으면 열지 않는다
 *   - 열면 빈 DB 파일이 생겨 백업 대상이 됨
 *
 * @param databasePath 확인할 DB 파일 경로
 * @returns 첫 마이그레이션의 시각 (남은 것이 없거나 DB 파일이 없으면 null)
 */
export async function findPendingMigrationTimestamp(databasePath: string): Promise<number | null> {
  if (!existsSync(databasePath)) return null;

  const options = { ...createDataSourceOptions(databasePath), migrationsRun: false };
  const dataSource = await new DataSource(options).initialize();
  try {
    const pending = await new MigrationExecutor(dataSource).getPendingMigrations();
    return pending.length > 0 ? pending[0].timestamp : null;
  } finally {
    await dataSource.destroy();
  }
}
