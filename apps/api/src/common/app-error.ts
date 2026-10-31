import type { ErrorCode } from '@lokibench/contracts';
import { HttpStatus } from '@nestjs/common';

// 오류 코드별로 응답에 실을 HTTP 상태 코드
export const ERROR_STATUS: Record<ErrorCode, HttpStatus> = {
  VALIDATION: HttpStatus.BAD_REQUEST,
  NOT_FOUND: HttpStatus.NOT_FOUND,
  PROJECT_NOT_FOUND: HttpStatus.NOT_FOUND,
  PROJECT_NAME_TAKEN: HttpStatus.CONFLICT,
  INTERNAL: HttpStatus.INTERNAL_SERVER_ERROR,
};

// service가 계약의 오류 코드를 담아 던지는 예외 (필터가 응답으로 바꿈)
export class AppError extends Error {
  constructor(
    readonly code: ErrorCode,
    message: string = code,
    readonly details?: Record<string, unknown>,
  ) {
    super(message);
    this.name = 'AppError';
  }
}
