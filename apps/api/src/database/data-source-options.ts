import type { DataSourceOptions } from 'typeorm';

import { ProjectEntity } from '../modules/projects/project.entity';
import { CreateProjects1792886400000 } from './migrations/1792886400000-create-projects';

/**
 * sqlite 연결 설정을 만든다.
 *
 * - 스키마는 마이그레이션으로만 바꾸고, 기동할 때마다 남은 마이그레이션을 실행한다
 * - 빌드 결과 경로가 달라도 찾을 수 있게 마이그레이션은 glob 대신 클래스로 넘긴다
 *
 * @param databasePath DB 파일 경로. 테스트는 ':memory:'
 * @returns TypeORM 연결 설정
 */
export function createDataSourceOptions(databasePath: string): DataSourceOptions {
  return {
    type: 'better-sqlite3',
    database: databasePath,
    entities: [ProjectEntity],
    migrations: [CreateProjects1792886400000],
    migrationsRun: true,
    synchronize: false,
  };
}
