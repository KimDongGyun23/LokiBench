import { type ErrorCode, errorResponseSchema } from '@lokibench/contracts';
import type { z } from 'zod';

const API_PREFIX = '/api';

// 응답을 받지 못한 실패(네트워크, api 꺼짐)의 상태 값
const NO_RESPONSE_STATUS = 0;

/**
 * api 요청 실패를 계약의 오류 코드와 HTTP 상태로 나타낸다.
 *
 * - 화면은 상태가 아니라 code로 문구를 고른다
 * - 계약 밖 실패(네트워크, 알 수 없는 본문, 응답 모양 불일치)는 모두 INTERNAL이다
 * - 응답을 받지 못했으면 status는 0이다
 */
export class ApiError extends Error {
  readonly code: ErrorCode;
  readonly status: number;

  constructor(code: ErrorCode, status: number, message: string = code) {
    super(message);
    this.name = 'ApiError';
    this.code = code;
    this.status = status;
  }
}

/**
 * 응답 본문을 JSON으로 읽고, JSON이 아니면 undefined를 돌려준다.
 */
async function readJson(response: Response): Promise<unknown> {
  try {
    return await response.json();
  } catch {
    return undefined;
  }
}

/**
 * 실패 응답을 계약의 오류 모양으로 파싱해 ApiError로 만든다.
 */
async function toApiError(response: Response): Promise<ApiError> {
  const parsed = errorResponseSchema.safeParse(await readJson(response));
  if (!parsed.success) return new ApiError('INTERNAL', response.status);

  return new ApiError(parsed.data.code, response.status, parsed.data.message);
}

/**
 * `/api` 아래 경로로 요청하고 성공 응답을 스키마로 파싱해 돌려준다.
 *
 * - 본문이 있으면 Content-Type을 JSON으로 붙인다
 * - 스키마에 없는 필드는 버린다
 * - 실패는 모두 ApiError로 던진다
 *
 * @param path `/api` 뒤에 붙는 경로 (예: `/projects`)
 * @param schema 성공 응답을 파싱할 스키마
 * @param init fetch 옵션
 * @returns 파싱한 응답
 */
export async function apiRequest<T>(
  path: string,
  schema: z.ZodType<T>,
  init: RequestInit = {},
): Promise<T> {
  // 본문이 있으면 JSON으로 보냄 (호출한 쪽이 정한 Content-Type은 그대로 둠)
  const headers = new Headers(init.headers);
  if (init.body !== undefined && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }

  // 응답을 받지 못한 실패 (네트워크, api 꺼짐)
  let response: Response;
  try {
    response = await fetch(`${API_PREFIX}${path}`, { ...init, headers });
  } catch {
    throw new ApiError('INTERNAL', NO_RESPONSE_STATUS);
  }

  // 서버가 돌려준 실패 응답
  if (!response.ok) throw await toApiError(response);

  // 성공 응답이 계약과 다르면 화면까지 보내지 않음
  const parsed = schema.safeParse(await readJson(response));
  if (!parsed.success) throw new ApiError('INTERNAL', response.status);

  return parsed.data;
}
