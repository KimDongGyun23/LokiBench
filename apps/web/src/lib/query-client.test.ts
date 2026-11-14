import { ApiError } from './api-client';
import { createQueryClient } from './query-client';

/**
 * 조회 캐시의 기본 재시도 판단을 꺼내 실패 횟수와 오류로 불러 본다.
 */
function shouldRetry(failureCount: number, error: Error): boolean {
  const retry = createQueryClient().getDefaultOptions().queries?.retry;
  if (typeof retry !== 'function') throw new Error('재시도 판단이 함수가 아님');

  return retry(failureCount, error);
}

describe('조회 재시도', () => {
  test('api가 꺼졌을 때 실패 안내를 바로 보이기 위해 응답을 받지 못한 실패는 다시 시도하지 않는다', () => {
    // Given
    const error = new ApiError('INTERNAL', 0);

    // When
    const result = shouldRetry(0, error);

    // Then
    expect(result).toBe(false);
  });

  test('잠깐의 서버 오류를 넘기기 위해 응답을 받은 실패는 3번까지 다시 시도한다', () => {
    // Given
    const error = new ApiError('INTERNAL', 500);

    // When
    const results = [0, 1, 2, 3].map((failureCount) => shouldRetry(failureCount, error));

    // Then
    expect(results).toEqual([true, true, true, false]);
  });
});
