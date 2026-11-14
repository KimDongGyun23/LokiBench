import { http, HttpResponse } from 'msw';
import { z } from 'zod';

import { server } from '@/test/server';

import { ApiError, apiRequest } from './api-client';

const bookSchema = z.object({ title: z.string() });

/**
 * 요청이 던진 오류를 꺼낸다. 던지지 않으면 테스트를 실패시킨다.
 */
async function catchError(promise: Promise<unknown>): Promise<unknown> {
  try {
    await promise;
  } catch (error) {
    return error;
  }
  throw new Error('오류가 나지 않음');
}

describe('API 요청', () => {
  test('화면이 계약에 맞는 값만 받도록 성공 응답을 스키마로 파싱해 돌려준다', async () => {
    // Given
    server.use(http.get('/api/books/1', () => HttpResponse.json({ title: '독서 기록', page: 3 })));

    // When
    const book = await apiRequest('/books/1', bookSchema);

    // Then
    expect(book).toEqual({ title: '독서 기록' });
  });

  test('본문이 있는 요청은 서버가 JSON으로 읽도록 Content-Type을 붙여 보낸다', async () => {
    // Given
    server.use(
      http.post('/api/books', async ({ request }) => {
        const isJson = request.headers.get('Content-Type') === 'application/json';
        return HttpResponse.json(isJson ? await request.json() : { title: '' });
      }),
    );

    // When
    const book = await apiRequest('/books', bookSchema, {
      method: 'POST',
      body: JSON.stringify({ title: '가계부' }),
    });

    // Then
    expect(book).toEqual({ title: '가계부' });
  });
});

describe('API 요청 실패', () => {
  test('화면이 상태 코드가 아니라 오류 코드로 문구를 고르도록 오류 응답의 코드와 상태를 담아 던진다', async () => {
    // Given
    server.use(
      http.post('/api/books', () =>
        HttpResponse.json(
          { code: 'PROJECT_NAME_TAKEN', message: '이미 있는 이름' },
          { status: 409 },
        ),
      ),
    );

    // When
    const error = await catchError(apiRequest('/books', bookSchema, { method: 'POST' }));

    // Then
    expect(error).toBeInstanceOf(ApiError);
    expect(error).toMatchObject({ code: 'PROJECT_NAME_TAKEN', status: 409 });
  });

  test('api가 꺼져 있어도 화면이 같은 경로로 처리하도록 네트워크 실패를 INTERNAL, 상태 0으로 던진다', async () => {
    // Given
    server.use(http.get('/api/books/1', () => HttpResponse.error()));

    // When
    const error = await catchError(apiRequest('/books/1', bookSchema));

    // Then
    expect(error).toBeInstanceOf(ApiError);
    expect(error).toMatchObject({ code: 'INTERNAL', status: 0 });
  });

  test('프록시가 계약 밖 본문을 돌려줘도 화면이 같은 경로로 처리하도록 INTERNAL로 던지고 상태는 남긴다', async () => {
    // Given
    server.use(http.get('/api/books/1', () => new HttpResponse('Bad Gateway', { status: 502 })));

    // When
    const error = await catchError(apiRequest('/books/1', bookSchema));

    // Then
    expect(error).toMatchObject({ code: 'INTERNAL', status: 502 });
  });

  test('계약과 다른 성공 응답이 화면까지 흘러가지 않도록 INTERNAL로 던진다', async () => {
    // Given
    server.use(http.get('/api/books/1', () => HttpResponse.json({ name: '블로그' })));

    // When
    const error = await catchError(apiRequest('/books/1', bookSchema));

    // Then
    expect(error).toMatchObject({ code: 'INTERNAL', status: 200 });
  });
});
