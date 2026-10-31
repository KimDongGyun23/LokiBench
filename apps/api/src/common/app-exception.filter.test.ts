import { Logger } from '@nestjs/common';
import { ExecutionContextHost } from '@nestjs/core/helpers/execution-context-host';

import { AppError } from './app-error';
import { AppExceptionFilter } from './app-exception.filter';

// express Response 중 필터가 쓰는 status, json만 흉내 내고 결과를 기록함
function createFakeResponse() {
  const sent: { status?: number; body?: unknown } = {};
  const response = {
    status(code: number) {
      sent.status = code;
      return response;
    },
    json(body: unknown) {
      sent.body = body;
      return response;
    },
  };
  return { response, sent };
}

function runFilter(exception: unknown) {
  const { response, sent } = createFakeResponse();
  new AppExceptionFilter().catch(exception, new ExecutionContextHost([{}, response]));
  return sent;
}

beforeAll(() => {
  // INTERNAL 분기가 남기는 오류 로그가 테스트 출력에 섞이지 않게 함
  Logger.overrideLogger(false);
});

describe('서비스가 던진 오류', () => {
  test('서비스가 정한 코드를 지키기 위해 AppError는 담긴 코드와 details를 그대로 싣는다', () => {
    // Given: 이름 중복으로 서비스가 던진 오류
    const exception = new AppError('PROJECT_NAME_TAKEN', '같은 이름이 있음', { id: 1 });

    // When
    const sent = runFilter(exception);

    // Then
    expect(sent.status).toBe(409);
    expect(sent.body).toEqual({
      code: 'PROJECT_NAME_TAKEN',
      message: '같은 이름이 있음',
      details: { id: 1 },
    });
  });

  test('details가 없으면 응답에도 details 칸을 두지 않는다', () => {
    // Given
    const exception = new AppError('PROJECT_NOT_FOUND');

    // When
    const sent = runFilter(exception);

    // Then
    expect(sent.status).toBe(404);
    expect(sent.body).toEqual({ code: 'PROJECT_NOT_FOUND', message: 'PROJECT_NOT_FOUND' });
  });
});

describe('예상하지 못한 오류', () => {
  test('내부 정보 노출을 막기 위해 원래 메시지를 응답에 싣지 않고 INTERNAL로 감춘다', () => {
    // Given: 내부 정보가 담긴 예상하지 못한 오류
    const exception = new Error('db password=secret');

    // When
    const sent = runFilter(exception);

    // Then
    expect(sent.status).toBe(500);
    expect(sent.body).toMatchObject({ code: 'INTERNAL' });
    expect(JSON.stringify(sent.body)).not.toContain('secret');
  });
});
