import { QueryFailedError } from 'typeorm';

/**
 * sqlite의 UNIQUE 제약 위반인지 확인한다.
 *
 * - 어느 열의 제약인지는 가리지 않으므로, 부르는 쪽이 그 테이블의 UNIQUE 열을 알고 뜻을 정한다
 *
 * @param error 저장 중 난 예외
 * @returns UNIQUE 위반이면 true
 */
export function isUniqueViolation(error: unknown): boolean {
  // 쿼리 실패가 아닌 예외는 제약 위반이 아님
  if (!(error instanceof QueryFailedError)) {
    return false;
  }

  const driverError: unknown = error.driverError;

  return (
    typeof driverError === 'object' &&
    driverError !== null &&
    'code' in driverError &&
    driverError.code === 'SQLITE_CONSTRAINT_UNIQUE'
  );
}
