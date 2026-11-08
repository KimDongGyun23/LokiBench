import { existsSync } from 'node:fs';
import { mkdir, readdir, rename, rm } from 'node:fs/promises';
import { join } from 'node:path';

import { Logger } from '@nestjs/common';
import Database from 'better-sqlite3';

export const BACKUP_KEEP_COUNT = 7;

const BACKUP_FILE_PREFIX = 'app-';
const PRE_MIGRATION_MARKER = '-pre-';

const BACKUP_FILE_NAME = `^${BACKUP_FILE_PREFIX}\\d{4}-\\d{2}-\\d{2}(${PRE_MIGRATION_MARKER}\\d+)?\\.db`;
const BACKUP_FILE_PATTERN = new RegExp(`${BACKUP_FILE_NAME}$`);

const TEMPORARY_SUFFIX = '.tmp';
const TEMPORARY_FILE_PATTERN = new RegExp(`${BACKUP_FILE_NAME}\\${TEMPORARY_SUFFIX}$`);

/**
 * 백업 파일 이름을 만든다.
 *
 * - 사용자가 보는 날짜와 맞추려고 UTC가 아닌 로컬 날짜를 쓴다
 * - 남은 마이그레이션이 있으면 그날 백업과 겹치지 않게 그 마이그레이션 시각을 붙인다
 *
 * @param date 백업 기준 시각
 * @param migrationTimestamp 아직 실행하지 않은 첫 마이그레이션의 시각 (없으면 null)
 * @returns `app-YYYY-MM-DD.db` 또는 `app-YYYY-MM-DD-pre-<시각>.db` 모양의 파일 이름
 */
export function backupFileName(date: Date, migrationTimestamp: number | null): string {
  const year = String(date.getFullYear());
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const suffix =
    migrationTimestamp === null ? '' : `${PRE_MIGRATION_MARKER}${String(migrationTimestamp)}`;
  return `${BACKUP_FILE_PREFIX}${year}-${month}-${day}${suffix}.db`;
}

/**
 * 보관 개수를 넘은 오래된 백업 파일을 고른다.
 *
 * - 이름에 날짜가 들어 있어 이름 내림차순이 곧 최신순이다
 * - 백업 모양이 아닌 파일은 대상에서 뺀다
 *
 * @param fileNames 백업 폴더의 파일 이름 전체
 * @param keepCount 남길 최신 백업 개수
 * @returns 지울 파일 이름
 */
export function selectBackupsToDelete(fileNames: string[], keepCount: number): string[] {
  const backups = fileNames.filter((fileName) => BACKUP_FILE_PATTERN.test(fileName));
  const backupsNewestFirst = backups.sort().reverse();
  return backupsNewestFirst.slice(keepCount);
}

/**
 * 보관 개수를 넘은 오래된 백업과 강제 종료로 남은 임시 파일을 지운다.
 *
 * - 백업은 이미 만들어졌으므로 정리에 실패해도 던지지 않고 경고만 남긴다
 * - 한 파일을 지우지 못해도 나머지 파일은 계속 지운다
 *
 * @param backupDir 백업 파일을 둔 폴더
 */
async function removeOldBackups(backupDir: string): Promise<void> {
  let fileNames: string[];
  try {
    fileNames = await readdir(backupDir);
  } catch (error) {
    Logger.warn(`오래된 백업 목록을 읽지 못함: ${describeError(error)}`, 'Backup');
    return;
  }

  const leftovers = fileNames.filter((fileName) => TEMPORARY_FILE_PATTERN.test(fileName));
  const toDelete = [...selectBackupsToDelete(fileNames, BACKUP_KEEP_COUNT), ...leftovers];
  const results = await Promise.allSettled(
    toDelete.map((fileName) => rm(join(backupDir, fileName))),
  );
  results.forEach((result, index) => {
    if (result.status === 'fulfilled') return;

    const fileName = toDelete[index];
    Logger.warn(`오래된 백업을 지우지 못함: ${fileName} ${describeError(result.reason)}`, 'Backup');
  });
}

/**
 * 경고 로그에 남길 오류 설명을 만든다.
 *
 * - 원인을 찾을 수 있게 Error면 stack을 남긴다
 *
 * @param error 잡은 오류
 * @returns 로그에 남길 문자열
 */
export function describeError(error: unknown): string {
  if (error instanceof Error) return error.stack ?? error.message;
  return String(error);
}

/**
 * 기동할 때 DB를 백업하고 오래된 백업을 정리한다.
 *
 * - 마이그레이션 직전 상태를 남기려고 앱이 DB를 열기 전에 부른다
 * - 남은 마이그레이션이 없으면 하루 1회만 백업한다
 * - 남은 마이그레이션이 있으면 그날 백업이 있어도 마이그레이션 직전 백업을 따로 만든다
 * - 처음 기동이라 DB 파일이 없으면 백업할 것이 없어 건너뛴다
 * - 처음 기동이라 백업 폴더가 없으면 만든다
 * - 앱 연결과 별개로 읽기 전용 연결을 열어 sqlite 온라인 백업을 쓴다
 * - 강제 종료로 덜 만든 파일이 그날 백업으로 남지 않도록 임시 이름으로 쓴 뒤 이름을 바꾼다
 *
 * @param options.databasePath 백업할 DB 파일 경로
 * @param options.backupDir 백업 파일을 둘 폴더
 * @param options.now 백업 날짜를 정할 기준 시각
 * @param options.migrationTimestamp 아직 실행하지 않은 첫 마이그레이션의 시각 (없으면 null)
 * @returns 새로 만들었으면 'created', 같은 백업이 이미 있으면 'skipped', DB 파일이 없으면 'no-database'
 */
export async function runStartupBackup(options: {
  databasePath: string;
  backupDir: string;
  now: Date;
  migrationTimestamp: number | null;
}): Promise<'created' | 'skipped' | 'no-database'> {
  const { databasePath, backupDir, now, migrationTimestamp } = options;
  if (!existsSync(databasePath)) return 'no-database';

  await mkdir(backupDir, { recursive: true });

  const target = join(backupDir, backupFileName(now, migrationTimestamp));
  if (existsSync(target)) return 'skipped';

  // 임시 이름은 백업 패턴에 맞지 않아 보관 개수에 섞이지 않음
  const temporary = `${target}${TEMPORARY_SUFFIX}`;
  await rm(temporary, { force: true });

  const source = new Database(databasePath, { readonly: true });
  try {
    await source.backup(temporary);
  } finally {
    source.close();
  }
  await rename(temporary, target);

  await removeOldBackups(backupDir);
  return 'created';
}
