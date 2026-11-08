import { join } from 'node:path';

import { resolveDatabaseLocation } from './database-location';

const DATA_DIR = '/tmp/lokibench-data';

describe('개발용 DB 분리', () => {
  test('매일 쓰는 방식을 그대로 두기 위해 값이 없으면 실사용 DB를 쓰고 백업한다', () => {
    // When
    const location = resolveDatabaseLocation({ dataDir: DATA_DIR, target: undefined });

    // Then
    expect(location).toEqual({
      databasePath: join(DATA_DIR, 'app.db'),
      backupDir: join(DATA_DIR, 'backups'),
    });
  });

  test('개발 중 실수가 실제 데이터에 닿지 않도록 dev면 개발용 DB를 쓰고 백업하지 않는다', () => {
    // When
    const location = resolveDatabaseLocation({ dataDir: DATA_DIR, target: 'dev' });

    // Then: 개발용 DB는 지워져도 시드로 다시 만들 수 있어 백업하지 않음
    expect(location).toEqual({ databasePath: join(DATA_DIR, 'dev.db'), backupDir: null });
  });

  test('오타로 실사용 DB를 건드리지 않도록 모르는 값이면 기동을 멈춘다', () => {
    // When
    const resolve = () => resolveDatabaseLocation({ dataDir: DATA_DIR, target: 'deb' });

    // Then
    expect(resolve).toThrow('LOKIBENCH_DB');
  });
});
