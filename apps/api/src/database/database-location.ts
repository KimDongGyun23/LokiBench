import { join, resolve } from 'node:path';

// src/database와 빌드 결과 dist/database가 같은 깊이라 둘 다 apps/api/data를 가리킴
export const DATA_DIR = resolve(__dirname, '../../data');

/**
 * 어느 DB 파일을 쓰고 어디에 백업할지 정한다.
 *
 * - 값이 없거나 app이면 매일 쓰는 실사용 DB(app.db)를 쓰고 backups 폴더에 백업한다
 * - dev면 개발용 DB(dev.db)를 쓰고, 시드로 다시 만들 수 있어 백업하지 않는다
 * - 모르는 값이면 오타로 실사용 DB에 쓰는 일이 없도록 예외를 던진다
 *
 * @param options.dataDir DB와 백업을 두는 폴더
 * @param options.target LOKIBENCH_DB 환경 변수 값
 * @returns DB 파일 경로와 백업 폴더 (백업하지 않으면 null)
 */
export function resolveDatabaseLocation(options: { dataDir: string; target: string | undefined }): {
  databasePath: string;
  backupDir: string | null;
} {
  const { dataDir, target } = options;
  if (target === undefined || target === 'app') {
    return { databasePath: join(dataDir, 'app.db'), backupDir: join(dataDir, 'backups') };
  }

  if (target === 'dev') {
    return { databasePath: join(dataDir, 'dev.db'), backupDir: null };
  }

  throw new Error(`LOKIBENCH_DB는 app 또는 dev만 쓸 수 있음: ${target}`);
}
