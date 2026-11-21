import { readdirSync } from 'node:fs';
import { join } from 'node:path';

import { createDataSourceOptions } from './data-source-options';

// 이름 끝의 시각 숫자. 파일은 '<시각>-<이름>.ts', 클래스는 '<이름><시각>' 모양
const TIMESTAMP_IN_FILE = /^(\d+)-.+\.ts$/;
const TIMESTAMP_IN_CLASS = /(\d+)$/;

/**
 * migrations 폴더에 있는 마이그레이션 파일의 시각을 모은다.
 *
 * @returns 테스트 파일을 뺀 마이그레이션 파일의 시각 (오름차순)
 */
function listMigrationFileTimestamps(): string[] {
  return readdirSync(join(__dirname, 'migrations'))
    .filter((fileName) => !fileName.endsWith('.test.ts'))
    .flatMap((fileName) => TIMESTAMP_IN_FILE.exec(fileName)?.[1] ?? [])
    .sort();
}

/**
 * 연결 설정에 등록된 마이그레이션 클래스의 시각을 모은다.
 *
 * @returns 등록된 마이그레이션 클래스의 시각 (오름차순)
 */
function listRegisteredTimestamps(): string[] {
  const { migrations } = createDataSourceOptions(':memory:');
  if (!Array.isArray(migrations)) return [];

  return migrations
    .flatMap((migration: unknown) => {
      if (typeof migration !== 'function') return [];
      return TIMESTAMP_IN_CLASS.exec(migration.name)?.[1] ?? [];
    })
    .sort();
}

describe('마이그레이션 등록', () => {
  test('만들어 놓고 실행되지 않는 마이그레이션이 없도록 migrations 폴더의 파일을 모두 등록한다', () => {
    // When
    const registered = listRegisteredTimestamps();

    // Then
    expect(registered).toEqual(listMigrationFileTimestamps());
    expect(registered.length).toBeGreaterThan(0);
  });
});
