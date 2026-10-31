import { Server } from 'node:net';

import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { DataSource } from 'typeorm';

import { AppModule } from '../src/app.module';
import { configureApp } from '../src/configure-app';

/**
 * 인메모리 sqlite로 실제 앱과 같은 설정의 Nest 앱을 띄운다.
 *
 * - 테스트마다 새 DB라서 서로의 데이터가 섞이지 않는다
 * - 마이그레이션도 실제 기동과 같은 경로로 실행된다
 *
 * @returns 초기화된 앱, DB 연결, supertest에 넘길 HTTP 서버
 */
export async function createTestApp(): Promise<{
  app: INestApplication;
  dataSource: DataSource;
  server: Server;
}> {
  const moduleRef = await Test.createTestingModule({
    imports: [AppModule.forRoot({ databasePath: ':memory:' })],
  }).compile();

  const app = moduleRef.createNestApplication({ logger: false });
  configureApp(app);
  await app.init();

  // Nest는 HTTP 서버를 any로 돌려주므로 단언 대신 실제 타입을 확인해서 넘김
  const server: unknown = app.getHttpServer();
  if (!(server instanceof Server)) {
    throw new Error('HTTP 서버를 찾지 못함');
  }

  return { app, dataSource: app.get(DataSource), server };
}
