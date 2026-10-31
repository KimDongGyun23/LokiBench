import type { ErrorResponse } from '@lokibench/contracts';
import {
  type ArgumentsHost,
  Catch,
  type ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import type { Response } from 'express';

import { AppError, ERROR_STATUS } from './app-error';

/**
 * 모든 예외를 계약의 오류 응답 모양으로 바꾼다.
 *
 * - 검증 실패와 본문 해석 실패는 모두 VALIDATION으로 묶는다
 * - 예상하지 못한 예외는 원래 예외를 로그로 남기고 INTERNAL로 감춘다
 */
@Catch()
export class AppExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(AppExceptionFilter.name);

  // Nest가 예외마다 부르는 진입점으로, 상태 코드도 바뀐 오류 코드에서 정해 본문과 어긋나지 않게 함
  catch(exception: unknown, host: ArgumentsHost): void {
    const response = host.switchToHttp().getResponse<Response>();
    const body = this.toErrorResponse(exception);
    response.status(ERROR_STATUS[body.code]).json(body);
  }

  /**
   * 예외 종류를 계약의 오류 응답으로 옮긴다.
   *
   * - 위에서부터 먼저 맞는 종류를 쓰므로 AppError를 가장 먼저 본다
   * - 어느 종류에도 맞지 않으면 INTERNAL로 감추고 원래 예외는 로그에만 남긴다
   *
   * @param exception Nest가 잡은 예외
   * @returns 응답 본문에 그대로 실을 오류 응답
   */
  private toErrorResponse(exception: unknown): ErrorResponse {
    if (exception instanceof AppError) {
      return {
        code: exception.code,
        message: exception.message,
        ...(exception.details && { details: exception.details }),
      };
    }

    const clientErrorStatus = getClientErrorStatus(exception);
    if (clientErrorStatus === HttpStatus.NOT_FOUND) {
      return { code: 'NOT_FOUND', message: getMessage(exception) };
    }

    // 검증 실패, 깨진 JSON, 본문 크기 초과처럼 요청 쪽 잘못은 화면이 한 가지로 다루므로 VALIDATION으로 묶음
    if (clientErrorStatus !== undefined) {
      return { code: 'VALIDATION', message: getMessage(exception) };
    }

    this.logger.error(exception);
    return { code: 'INTERNAL', message: HttpStatus[HttpStatus.INTERNAL_SERVER_ERROR] };
  }
}

/**
 * 요청 쪽 잘못(4xx)으로 난 예외면 그 상태 코드를 꺼낸다.
 *
 * - Nest의 HTTP 예외는 상태 코드를 메서드로 준다
 * - 본문 해석기(body-parser)는 Nest 예외가 아니라 status 값을 가진 일반 Error를 던진다
 *
 * @param exception Nest가 잡은 예외
 * @returns 4xx 상태 코드, 요청 쪽 잘못이 아니면 undefined
 */
function getClientErrorStatus(exception: unknown): number | undefined {
  const hasStatusField =
    typeof exception === 'object' && exception !== null && 'status' in exception;

  let status: unknown = undefined;
  if (exception instanceof HttpException) {
    status = exception.getStatus();
  } else if (hasStatusField) {
    status = exception.status;
  }

  if (typeof status !== 'number') {
    return undefined;
  }

  return status >= 400 && status < 500 ? status : undefined;
}

/**
 * 오류 응답의 message 칸에 실을 문구를 꺼낸다.
 *
 * - Error가 아닌 값이 던져져도 응답 모양이 깨지지 않게 문자열로 바꾼다
 *
 * @param exception Nest가 잡은 예외
 * @returns 개발자가 로그에서 읽을 오류 메시지
 */
function getMessage(exception: unknown): string {
  return exception instanceof Error ? exception.message : String(exception);
}
