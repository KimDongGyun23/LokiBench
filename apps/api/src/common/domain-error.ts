import type { DomainErrorCode } from '@lokibench/domain';

// service와 저장소가 업무 규칙 위반을 도메인 오류 코드에 담아 던지는 예외
// 응답으로 바꾸는 일은 필터가 맡음
export class DomainError extends Error {
  constructor(
    readonly code: DomainErrorCode,
    message: string = code,
    readonly details?: Record<string, unknown>,
  ) {
    super(message);
    this.name = 'DomainError';
  }
}
