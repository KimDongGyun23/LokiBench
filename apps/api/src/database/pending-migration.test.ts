import { existsSync } from 'node:fs';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import Database from 'better-sqlite3';
import { DataSource } from 'typeorm';

import { createDataSourceOptions } from './data-source-options';
import { findPendingMigrationTimestamp } from './pending-migration';

let workDir: string;
let databasePath: string;

beforeEach(async () => {
  // 실제 DB 파일의 마이그레이션 기록을 읽으려고 테스트마다 빈 임시 폴더를 씀
  workDir = await mkdtemp(join(tmpdir(), 'lokibench-pending-'));
  databasePath = join(workDir, 'app.db');
});

afterEach(async () => {
  await rm(workDir, { recursive: true, force: true });
});

describe('남은 마이그레이션 찾기', () => {
  test('마이그레이션 직전에 따로 백업하도록 아직 실행하지 않은 첫 마이그레이션의 시각을 준다', async () => {
    // Given: 마이그레이션 기록이 없는 DB 파일
    new Database(databasePath).close();

    // When
    const timestamp = await findPendingMigrationTimestamp(databasePath);

    // Then
    expect(timestamp).toBe(1792886400000);
  });

  test('따로 백업할 필요가 없도록 모든 마이그레이션을 실행했으면 null을 준다', async () => {
    // Given: 앱처럼 마이그레이션을 실행해 둔 DB 파일
    const dataSource = await new DataSource(createDataSourceOptions(databasePath)).initialize();
    await dataSource.destroy();

    // When
    const timestamp = await findPendingMigrationTimestamp(databasePath);

    // Then
    expect(timestamp).toBeNull();
  });

  test('빈 DB 파일이 백업되지 않도록 처음 기동이라 DB 파일이 없으면 만들지 않고 null을 준다', async () => {
    // When: DB 파일이 아직 없음
    const timestamp = await findPendingMigrationTimestamp(databasePath);

    // Then
    expect(timestamp).toBeNull();
    expect(existsSync(databasePath)).toBe(false);
  });
});
