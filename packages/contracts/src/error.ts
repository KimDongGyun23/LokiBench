import { DOMAIN_ERROR_CODES } from '@lokibench/domain';
import { z } from 'zod';

// 같은 409, 400도 기능마다 뜻이 갈려서 web은 상태 코드가 아니라 이 코드로 화면 문구를 고름
// 도메인 오류 코드에 요청 검증, 없는 경로, 서버 오류처럼 HTTP 사정의 코드를 더함
export const ERROR_CODES = ['VALIDATION', 'NOT_FOUND', ...DOMAIN_ERROR_CODES, 'INTERNAL'] as const;
export type ErrorCode = (typeof ERROR_CODES)[number];

// 처리하지 못한 500까지 모든 오류 응답이 이 모양이라 web은 파싱 경로가 하나임
export const errorResponseSchema = z.object({
  code: z.enum(ERROR_CODES),
  message: z.string(),
  details: z.record(z.string(), z.unknown()).optional(),
});
export type ErrorResponse = z.infer<typeof errorResponseSchema>;
