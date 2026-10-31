import type { ErrorResponse } from '@lokibench/contracts';
import {
  type ArgumentsHost,
  BadRequestException,
  Catch,
  type ExceptionFilter,
  HttpStatus,
  Logger,
  NotFoundException,
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

    // nestjs-zod의 검증 예외와 깨진 JSON 본문 모두 BadRequestException으로 들어옴
    if (exception instanceof BadRequestException) {
      return { code: 'VALIDATION', message: exception.message };
    }
    if (exception instanceof NotFoundException) {
      return { code: 'NOT_FOUND', message: exception.message };
    }

    this.logger.error(exception);
    return { code: 'INTERNAL', message: HttpStatus[HttpStatus.INTERNAL_SERVER_ERROR] };
  }
}
