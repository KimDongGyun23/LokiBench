import { z } from 'zod';

import { ISSUE_STATUSES, ISSUE_TITLE_MAX_LENGTH } from '../values';
import { dateOnlySchema } from './date';

// 이슈 상태 규칙
export const issueStatusSchema = z.enum(ISSUE_STATUSES);

// 이슈 제목 입력 규칙 (앞뒤 공백을 지운 뒤 길이를 봄)
export const issueTitleSchema = z.string().trim().min(1).max(ISSUE_TITLE_MAX_LENGTH);

// 이슈 version (수정과 되돌리기 요청이 "내가 본 이슈"를 알리는 값)
const issueVersionSchema = z.number().int().positive();

// 이슈 응답 (이미 저장된 값이라 제목에 입력 규칙을 다시 걸지 않음)
export const issueSchema = z.object({
  id: z.number().int().positive(),
  projectId: z.number().int().positive(),
  number: z.number().int().positive(),
  title: z.string(),
  due: dateOnlySchema.nullable(),
  status: issueStatusSchema,
  statusChangedAt: z.iso.datetime(),
  version: issueVersionSchema,
  createdAt: z.iso.datetime(),
  closedAt: z.iso.datetime().nullable(),
});
export type Issue = z.infer<typeof issueSchema>;

// 이슈 추가 요청 (상태와 번호는 서버가 정하므로 들어와도 버림)
export const createIssueRequestSchema = z.object({
  projectId: z.number().int().positive(),
  title: issueTitleSchema,
  due: dateOnlySchema.nullable().optional(),
});
export type CreateIssueRequest = z.infer<typeof createIssueRequestSchema>;

// 이슈 수정 요청 (바꿀 칸만 담고, 마감은 키가 없으면 그대로 두고 null이면 지움)
export const updateIssueRequestSchema = z
  .object({
    version: issueVersionSchema,
    title: issueTitleSchema.optional(),
    due: dateOnlySchema.nullable().optional(),
    status: issueStatusSchema.optional(),
  })
  .refine(
    (body) => body.title !== undefined || body.due !== undefined || body.status !== undefined,
    { message: '제목, 마감, 상태 중 하나는 있어야 함' },
  );
export type UpdateIssueRequest = z.infer<typeof updateIssueRequestSchema>;

// 이슈 상태 되돌리기 요청
export const undoIssueStatusRequestSchema = z.object({ version: issueVersionSchema });
export type UndoIssueStatusRequest = z.infer<typeof undoIssueStatusRequestSchema>;

// 이슈 목록 조회 쿼리 (쿼리는 글자로 오므로 숫자 글자만 받아 숫자로 바꿈)
export const listIssuesQuerySchema = z.object({
  projectId: z.string().regex(/^\d+$/).transform(Number).pipe(z.number().int().positive()),
});
export type ListIssuesQuery = z.infer<typeof listIssuesQuerySchema>;

// 프로젝트 하나의 열린 이슈 수 응답 (열린 상태는 TODO, IN_PROGRESS, IN_REVIEW)
export const openIssueCountSchema = z.object({
  projectId: z.number().int().positive(),
  count: z.number().int().nonnegative(),
});
export type OpenIssueCount = z.infer<typeof openIssueCountSchema>;
