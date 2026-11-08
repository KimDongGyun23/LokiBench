import { mkdirSync } from 'node:fs';

import { DataSource } from 'typeorm';

import { ProjectEntity } from '../modules/projects/project.entity';
import type { CreateProjectInput } from '../modules/projects/project.model';
import { TypeOrmProjectRepository } from '../modules/projects/typeorm-project.repository';
import { createDataSourceOptions } from './data-source-options';
import { DATA_DIR, resolveDatabaseLocation } from './database-location';

const SEED_PROJECTS: ReadonlyArray<CreateProjectInput> = [
  { name: '독서 기록', color: 'indigo' },
  { name: '가계부', color: 'teal' },
  { name: '블로그', color: 'rose' },
];

/**
 * 개발용 프로젝트 3개를 개발용 DB에 넣는다.
 *
 * - 실사용 DB에 예시가 섞이지 않도록 LOKIBENCH_DB 값과 관계없이 dev.db에만 넣는다
 * - 같은 이름이 이미 있으면 건너뛰어서 여러 번 실행해도 행이 늘지 않는다
 */
async function seed(): Promise<void> {
  const { databasePath } = resolveDatabaseLocation({ dataDir: DATA_DIR, target: 'dev' });
  mkdirSync(DATA_DIR, { recursive: true });

  const dataSource = await new DataSource(createDataSourceOptions(databasePath)).initialize();
  const repository = new TypeOrmProjectRepository(dataSource.getRepository(ProjectEntity));

  try {
    for (const project of SEED_PROJECTS) {
      if (await repository.findByName(project.name)) continue;
      await repository.create(project);
    }
  } finally {
    await dataSource.destroy();
  }
}

void seed();
