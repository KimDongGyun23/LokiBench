import { existsSync } from 'node:fs';
import { mkdir, mkdtemp, readdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { Logger } from '@nestjs/common';
import Database from 'better-sqlite3';

import {
  BACKUP_KEEP_COUNT,
  backupFileName,
  runStartupBackup,
  selectBackupsToDelete,
} from './backup';

let workDir: string;
let databasePath: string;

beforeEach(async () => {
  // 실제 파일 백업을 확인하려고 테스트마다 빈 임시 폴더에 sqlite 파일을 만듦
  workDir = await mkdtemp(join(tmpdir(), 'lokibench-backup-'));
  databasePath = join(workDir, 'app.db');
  const database = new Database(databasePath);
  database.exec('CREATE TABLE notes (id INTEGER PRIMARY KEY)');
  database.close();
});

afterEach(async () => {
  await rm(workDir, { recursive: true, force: true });
});

// 2026-10-01부터 하루씩 늘린 백업 파일 이름을 만듦
function backupNames(count: number) {
  return Array.from({ length: count }, (_, index) => {
    const day = String(index + 1).padStart(2, '0');
    return `app-2026-10-${day}.db`;
  });
}

describe('기동 백업', () => {
  test('디스크를 무한히 쓰지 않기 위해 보관 개수를 넘으면 가장 오래된 파일부터 지운다', () => {
    // Given: 보관 개수보다 하나 많음
    const fileNames = backupNames(BACKUP_KEEP_COUNT + 1);

    // When
    const toDelete = selectBackupsToDelete(fileNames, BACKUP_KEEP_COUNT);

    // Then
    expect(toDelete).toEqual(['app-2026-10-01.db']);
  });

  test('사용자가 둔 파일을 잃지 않기 위해 백업 모양이 아닌 파일은 지우지 않는다', () => {
    // Given
    const fileNames = ['notes.txt', ...backupNames(BACKUP_KEEP_COUNT + 1)];

    // When
    const toDelete = selectBackupsToDelete(fileNames, BACKUP_KEEP_COUNT);

    // Then
    expect(toDelete).not.toContain('notes.txt');
    expect(toDelete).toEqual(['app-2026-10-01.db']);
  });

  test('마이그레이션 직전 백업도 보관 개수에 함께 세어 오래된 것부터 지운다', () => {
    // Given: 가장 오래된 날에 마이그레이션 직전 백업이 하나 더 있음
    const fileNames = ['app-2026-10-01-pre-1792886400000.db', ...backupNames(BACKUP_KEEP_COUNT)];

    // When
    const toDelete = selectBackupsToDelete(fileNames, BACKUP_KEEP_COUNT);

    // Then
    expect(toDelete).toEqual(['app-2026-10-01-pre-1792886400000.db']);
  });

  test('이름 형식이 바뀌어도 보관 개수 제한이 깨지지 않도록 만든 백업 이름은 모두 정리 대상으로 알아본다', () => {
    // Given: 그날 백업과 마이그레이션 직전 백업 이름을 만들고, 그보다 새 백업을 보관 개수만큼 둠
    const date = new Date(2026, 8, 1, 9, 0);
    const created = [backupFileName(date, null), backupFileName(date, 1792886400000)];
    const fileNames = [...created, ...backupNames(BACKUP_KEEP_COUNT)];

    // When
    const toDelete = selectBackupsToDelete(fileNames, BACKUP_KEEP_COUNT);

    // Then: 가장 오래된 두 이름이 백업으로 인식되어 지울 대상이 됨
    expect(toDelete.sort()).toEqual([...created].sort());
  });

  test('하루 1회만 남기기 위해 같은 날 재기동해도 백업을 새로 만들지 않는다', async () => {
    // Given
    const backupDir = join(workDir, 'backups');
    const now = new Date(2026, 10, 1, 9, 0);
    await runStartupBackup({ databasePath, backupDir, now, migrationTimestamp: null });

    // When
    const result = await runStartupBackup({
      databasePath,
      backupDir,
      now,
      migrationTimestamp: null,
    });

    // Then
    expect(result).toBe('skipped');
  });

  test('처음 기동이라 백업 폴더가 없어도 만들고 진행한다', async () => {
    // Given: backups 폴더가 아직 없음
    const backupDir = join(workDir, 'backups');

    // When
    const result = await runStartupBackup({
      databasePath,
      backupDir,
      now: new Date(2026, 10, 1, 9, 0),
      migrationTimestamp: null,
    });

    // Then
    expect(result).toBe('created');
    expect(existsSync(join(backupDir, 'app-2026-11-01.db'))).toBe(true);
  });

  test('사고가 났을 때 복원할 수 있도록 백업 파일에 원본의 행이 그대로 들어 있다', async () => {
    // Given: 원본 DB에 행 하나를 넣음
    const backupDir = join(workDir, 'backups');
    const source = new Database(databasePath);
    source.prepare('INSERT INTO notes (id) VALUES (?)').run(42);
    source.close();

    // When
    await runStartupBackup({
      databasePath,
      backupDir,
      now: new Date(2026, 10, 1, 9, 0),
      migrationTimestamp: null,
    });

    // Then: 백업 파일을 읽기 전용으로 열어 같은 행이 읽힘
    const backup = new Database(join(backupDir, 'app-2026-11-01.db'), { readonly: true });
    const rows = backup.prepare('SELECT id FROM notes').all();
    backup.close();
    expect(rows).toEqual([{ id: 42 }]);
  });

  test('마이그레이션 전에 백업하므로 처음 기동이라 DB 파일이 아직 없으면 백업하지 않는다', async () => {
    // Given: DB 파일이 아직 만들어지지 않음
    const backupDir = join(workDir, 'backups');
    await rm(databasePath);

    // When
    const result = await runStartupBackup({
      databasePath,
      backupDir,
      now: new Date(2026, 10, 1, 9, 0),
      migrationTimestamp: null,
    });

    // Then: 빈 백업 파일도, DB 파일도 새로 생기지 않음
    expect(result).toBe('no-database');
    expect(existsSync(join(backupDir, 'app-2026-11-01.db'))).toBe(false);
    expect(existsSync(databasePath)).toBe(false);
  });

  test('같은 날 새 마이그레이션이 생겨도 실행 직전 상태를 남기기 위해 그날 백업과 따로 백업한다', async () => {
    // Given: 아침에 띄워 그날 백업이 이미 있음
    const backupDir = join(workDir, 'backups');
    await runStartupBackup({
      databasePath,
      backupDir,
      now: new Date(2026, 10, 1, 9, 0),
      migrationTimestamp: null,
    });

    // When: 같은 날 남은 마이그레이션이 있는 코드로 다시 띄움
    const result = await runStartupBackup({
      databasePath,
      backupDir,
      now: new Date(2026, 10, 1, 15, 0),
      migrationTimestamp: 1792886400000,
    });

    // Then
    expect(result).toBe('created');
    expect(existsSync(join(backupDir, 'app-2026-11-01.db'))).toBe(true);
    expect(existsSync(join(backupDir, 'app-2026-11-01-pre-1792886400000.db'))).toBe(true);
  });

  test('같은 마이그레이션 직전 상태를 두 번 남기지 않도록 마이그레이션 직전 백업이 있으면 건너뛴다', async () => {
    // Given: 마이그레이션 직전 백업을 이미 만듦
    const backupDir = join(workDir, 'backups');
    const options = {
      databasePath,
      backupDir,
      now: new Date(2026, 10, 1, 15, 0),
      migrationTimestamp: 1792886400000,
    };
    await runStartupBackup(options);

    // When
    const result = await runStartupBackup(options);

    // Then
    expect(result).toBe('skipped');
  });

  test('정리 경로가 어긋나 다른 파일을 지우지 않도록 실제 폴더에서 가장 오래된 백업만 지운다', async () => {
    // Given: 지난 백업이 보관 개수만큼 있고, 사용자가 둔 파일도 있음
    const backupDir = join(workDir, 'backups');
    await mkdir(backupDir);
    const previous = backupNames(BACKUP_KEEP_COUNT);
    await Promise.all(
      [...previous, 'notes.txt'].map((fileName) => writeFile(join(backupDir, fileName), '')),
    );

    // When: 오늘 백업이 더해져 보관 개수를 하나 넘음
    await runStartupBackup({
      databasePath,
      backupDir,
      now: new Date(2026, 10, 1, 9, 0),
      migrationTimestamp: null,
    });

    // Then: 가장 오래된 백업만 지워지고, 오늘 백업과 notes.txt는 남음
    const remaining = await readdir(backupDir);
    const expected = [...previous.slice(1), 'app-2026-11-01.db', 'notes.txt'];
    expect(remaining.sort()).toEqual(expected.sort());
  });

  test('덜 만든 파일이 그날 백업으로 남지 않도록 강제 종료로 남은 임시 파일을 지우고 다시 백업한다', async () => {
    // Given: 지난 기동에서 백업 도중 강제 종료되어 임시 파일만 남음
    const backupDir = join(workDir, 'backups');
    await mkdir(backupDir);
    await writeFile(join(backupDir, 'app-2026-11-01.db.tmp'), 'broken');

    // When
    const result = await runStartupBackup({
      databasePath,
      backupDir,
      now: new Date(2026, 10, 1, 9, 0),
      migrationTimestamp: null,
    });

    // Then: 임시 파일은 사라지고 완성된 백업만 남음
    expect(result).toBe('created');
    expect(await readdir(backupDir)).toEqual(['app-2026-11-01.db']);
  });

  test('임시 파일이 백업 폴더에 쌓이지 않도록 다른 날 강제 종료로 남은 임시 파일도 정리한다', async () => {
    // Given: 전날 백업 도중 강제 종료되어 남은 임시 파일과, 사용자가 둔 비슷한 이름의 파일
    const backupDir = join(workDir, 'backups');
    await mkdir(backupDir);
    await writeFile(join(backupDir, 'app-2026-10-31.db.tmp'), 'broken');
    await writeFile(join(backupDir, 'notes.db.tmp'), '');

    // When
    await runStartupBackup({
      databasePath,
      backupDir,
      now: new Date(2026, 10, 1, 9, 0),
      migrationTimestamp: null,
    });

    // Then: 백업 모양의 임시 파일만 지워짐
    const remaining = await readdir(backupDir);
    expect(remaining.sort()).toEqual(['app-2026-11-01.db', 'notes.db.tmp']);
  });

  test('백업이 없다고 오해하지 않도록 오래된 백업 정리가 실패해도 만든 백업은 created로 알린다', async () => {
    // Given: 가장 오래된 백업 자리에 지울 수 없는 폴더가 있음
    const backupDir = join(workDir, 'backups');
    const [oldest, ...rest] = backupNames(BACKUP_KEEP_COUNT);
    await mkdir(join(backupDir, oldest), { recursive: true });
    await Promise.all(rest.map((fileName) => writeFile(join(backupDir, fileName), '')));
    const warn = vi.spyOn(Logger, 'warn').mockImplementation(() => undefined);

    // When
    const result = await runStartupBackup({
      databasePath,
      backupDir,
      now: new Date(2026, 10, 1, 9, 0),
      migrationTimestamp: null,
    });

    // Then: 오늘 백업은 남고, 지우지 못한 파일만 경고함
    expect(result).toBe('created');
    expect(existsSync(join(backupDir, 'app-2026-11-01.db'))).toBe(true);
    expect(warn).toHaveBeenCalledWith(expect.stringContaining(oldest), 'Backup');
    warn.mockRestore();
  });
});
