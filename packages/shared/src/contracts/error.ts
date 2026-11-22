import { z } from 'zod';

import { DOMAIN_ERROR_CODES } from '../values';

// 오류 코드 목록 (web은 상태 코드가 아니라 이 코드로 화면 문구를 고름)
export const ERROR_CODES = ['VALIDATION', 'NOT_FOUND', ...DOMAIN_ERROR_CODES, 'INTERNAL'] as const;
export type ErrorCode = (typeof ERROR_CODES)[number];

// 오류 응답 (처리하지 못한 500까지 모든 오류가 이 모양)
export const errorResponseSchema = z.object({
  code: z.enum(ERROR_CODES),
  message: z.string(),
  details: z.record(z.string(), z.unknown()).optional(),
});
export type ErrorResponse = z.infer<typeof errorResponseSchema>;
