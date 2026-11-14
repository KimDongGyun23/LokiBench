import { QueryClient } from '@tanstack/react-query';

import { ApiError, NO_RESPONSE_STATUS } from './api-client';

// 응답을 받은 실패를 다시 시도하는 최대 횟수
const MAX_RETRY_COUNT = 3;

/**
 * 실패한 조회를 다시 시도할지 정한다.
 *
 * - 응답을 받지 못한 실패는 다시 시도하지 않아서 실패 안내가 바로 보인다
 * - 그 밖의 실패는 3번까지 다시 시도한다
 *
 * @param failureCount 지금까지 실패한 횟수
 * @param error 조회가 던진 오류
 * @returns 다시 시도할지
 */
function shouldRetryQuery(failureCount: number, error: Error): boolean {
  const isNoResponseError = error instanceof ApiError && error.status === NO_RESPONSE_STATUS;
  if (isNoResponseError) return false;

  return failureCount < MAX_RETRY_COUNT;
}

/**
 * 앱과 테스트가 함께 쓰는 기본 옵션으로 조회 캐시를 만든다.
 *
 * @returns 새 조회 캐시
 */
export function createQueryClient(): QueryClient {
  return new QueryClient({ defaultOptions: { queries: { retry: shouldRetryQuery } } });
}
