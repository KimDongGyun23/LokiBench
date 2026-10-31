import { errorResponseSchema } from '@lokibench/contracts';
import type { INestApplication } from '@nestjs/common';
import request from 'supertest';

import { createTestApp } from './create-test-app';

let app: INestApplication | undefined;

afterEach(async () => {
  await app?.close();
  app = undefined;
});

describe('기동', () => {
  test('마이그레이션이 실행되어 projects 테이블이 생긴다', async () => {
    // Given: 빈 인메모리 DB로 앱 기동
    const testApp = await createTestApp();
    app = testApp.app;

    // When: 테이블 목록과 상태 확인 경로 조회
    const tables: unknown[] = await testApp.dataSource.query(
      `SELECT name FROM sqlite_master WHERE type='table' AND name='projects'`,
    );
    const health = await request(testApp.server).get('/api/health');

    // Then: 테이블이 있고 상태 확인이 성공함
    expect(tables).toHaveLength(1);
    expect(health.status).toBe(200);
    expect(health.body).toEqual({ ok: true });
  });
});

describe('오류 응답 모양', () => {
  test('web이 코드로 분기하도록 없는 경로도 계약 모양으로 404를 준다', async () => {
    // Given
    const testApp = await createTestApp();
    app = testApp.app;

    // When
    const response = await request(testApp.server).get('/api/nope');

    // Then
    expect(response.status).toBe(404);
    expect(errorResponseSchema.parse(response.body).code).toBe('NOT_FOUND');
  });

  test('깨진 JSON 본문은 VALIDATION으로 준다', async () => {
    // Given: 컨트롤러가 없어도 본문 해석 단계에서 걸러져야 함
    const testApp = await createTestApp();
    app = testApp.app;

    // When
    const response = await request(testApp.server)
      .post('/api/projects')
      .set('Content-Type', 'application/json')
      .send('{');

    // Then
    expect(response.status).toBe(400);
    expect(errorResponseSchema.parse(response.body).code).toBe('VALIDATION');
  });
});

describe('클라이언트 오류 분류', () => {
  test('서버 장애로 오해하지 않도록 본문 크기 초과는 500이 아니라 VALIDATION으로 준다', async () => {
    // Given: 본문 해석기의 기본 한도(100KB)를 넘는 본문
    const testApp = await createTestApp();
    app = testApp.app;
    const oversizedBody = JSON.stringify({ name: 'a'.repeat(200_000) });

    // When
    const response = await request(testApp.server)
      .post('/api/projects')
      .set('Content-Type', 'application/json')
      .send(oversizedBody);

    // Then
    expect(response.status).toBe(400);
    expect(errorResponseSchema.parse(response.body).code).toBe('VALIDATION');
  });

  test('서버 장애로 오해하지 않도록 지원하지 않는 문자셋은 500이 아니라 VALIDATION으로 준다', async () => {
    // Given
    const testApp = await createTestApp();
    app = testApp.app;

    // When
    const response = await request(testApp.server)
      .post('/api/projects')
      .set('Content-Type', 'application/json; charset=latin9')
      .send('{}');

    // Then
    expect(response.status).toBe(400);
    expect(errorResponseSchema.parse(response.body).code).toBe('VALIDATION');
  });
});
