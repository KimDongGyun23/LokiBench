import { mkdirSync } from 'node:fs';
import { basename } from 'node:path';

import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';

import { AppModule } from './app.module';
import { configureApp } from './configure-app';
import { DATA_DIR, resolveDatabaseLocation } from './database/database-location';

/**
 * api 서버를 띄운다.
 *
 * - LOKIBENCH_DB 값으로 실사용 DB와 개발용 DB 중 하나를 고른다
 * - DB를 열 때 남은 마이그레이션이 먼저 실행되고, 그 뒤에 요청을 받기 시작한다
 * - 테스트와 같은 요청 처리 규칙을 쓰도록 configureApp을 거친다
 */
async function bootstrap(): Promise<void> {
  const { databasePath } = resolveDatabaseLocation({
    dataDir: DATA_DIR,
    target: process.env.LOKIBENCH_DB,
  });
  // 개발용 DB로 띄웠는지 헷갈리지 않게 기동 로그에 파일 이름을 남김
  Logger.log(`DB 파일: ${basename(databasePath)}`, 'Database');

  // 처음 기동이면 data 폴더가 없어서 sqlite가 파일을 만들지 못함
  mkdirSync(DATA_DIR, { recursive: true });

  const app = await NestFactory.create(AppModule.forRoot({ databasePath }));
  configureApp(app);

  // 혼자 쓰는 로컬 도구라 다른 기기에서 접근하지 못하게 루프백에만 바인딩
  await app.listen(3001, '127.0.0.1');
}

void bootstrap();
