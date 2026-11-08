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
