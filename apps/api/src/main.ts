import { mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

import { NestFactory } from '@nestjs/core';

import { AppModule } from './app.module';
import { configureApp } from './configure-app';

const DATABASE_PATH = resolve(__dirname, '../data/app.db');

/**
 * api 서버를 띄운다.
 *
 * - DB를 열 때 남은 마이그레이션이 먼저 실행되고, 그 뒤에 요청을 받기 시작한다
 * - 테스트와 같은 요청 처리 규칙을 쓰도록 configureApp을 거친다
 */
async function bootstrap(): Promise<void> {
  // 처음 기동이면 data 폴더가 없어서 sqlite가 파일을 만들지 못함
  mkdirSync(dirname(DATABASE_PATH), { recursive: true });

  const app = await NestFactory.create(AppModule.forRoot({ databasePath: DATABASE_PATH }));
  configureApp(app);

  // 혼자 쓰는 로컬 도구라 다른 기기에서 접근하지 못하게 루프백에만 바인딩
  await app.listen(3001, '127.0.0.1');
}

void bootstrap();
