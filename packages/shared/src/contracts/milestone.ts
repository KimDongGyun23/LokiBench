import { z } from 'zod';

import { MILESTONE_TEXT_MAX_LENGTH, MILESTONE_TITLE_MAX_LENGTH } from '../values';
import { dateOnlySchema } from './date';

// 시작과 마감 중 하나라도 없으면 순서를 따지지 않음 (YYYY-MM-DD라 글자 비교가 날짜 비교와 같음)
function isDateOrderValid(fields: { startDate: string | null; due: string | null }): boolean {
  if (fields.startDate === null || fields.due === null) return true;
  return fields.startDate <= fields.due;
}

// 기간이 거꾸로일 때 화면이 시작 칸에 오류를 붙이도록 알리는 경로
const DATE_ORDER_ISSUE = { message: '시작은 마감보다 늦을 수 없음', path: ['startDate'] };

// 마일스톤 제목 입력 규칙 (앞뒤 공백을 지운 뒤 길이를 봄)
export const milestoneTitleSchema = z.string().trim().min(1).max(MILESTONE_TITLE_MAX_LENGTH);

// 배경, 해결방안, 기대효과, 메모 한 칸의 입력 규칙 (비어 있어도 됨)
export const milestoneTextSchema = z.string().max(MILESTONE_TEXT_MAX_LENGTH);

// 마일스톤 응답 (지운 마일스톤은 응답에 나오지 않아 지운 표시가 없음)
export const milestoneSchema = z.object({
  id: z.number().int().positive(),
  projectId: z.number().int().positive(),
  title: z.string(),
  startDate: dateOnlySchema.nullable(),
  due: dateOnlySchema.nullable(),
  background: z.string(),
  solution: z.string(),
  expectedEffect: z.string(),
  memo: z.string(),
  createdAt: z.iso.datetime(),
  closedAt: z.iso.datetime().nullable(),
});
export type Milestone = z.infer<typeof milestoneSchema>;

// 만들기와 수정이 함께 쓰는 칸 (수정 화면이 늘 전부를 한꺼번에 보냄)
const milestoneFieldsSchema = z.object({
  title: milestoneTitleSchema,
  startDate: dateOnlySchema.nullable(),
  due: dateOnlySchema.nullable(),
  background: milestoneTextSchema,
  solution: milestoneTextSchema,
  expectedEffect: milestoneTextSchema,
  memo: milestoneTextSchema,
});

// 마일스톤 만들기 요청
export const createMilestoneRequestSchema = milestoneFieldsSchema
  .extend({ projectId: z.number().int().positive() })
  .refine(isDateOrderValid, DATE_ORDER_ISSUE);
export type CreateMilestoneRequest = z.infer<typeof createMilestoneRequestSchema>;

// 마일스톤 수정 요청 (프로젝트는 바꿀 수 없어 들어와도 버림)
export const updateMilestoneRequestSchema = milestoneFieldsSchema.refine(
  isDateOrderValid,
  DATE_ORDER_ISSUE,
);
export type UpdateMilestoneRequest = z.infer<typeof updateMilestoneRequestSchema>;

// 마일스톤 목록 조회 쿼리 (쿼리는 글자로 오므로 숫자로 바꿔서 검사)
export const listMilestonesQuerySchema = z.object({
  projectId: z.coerce.number().int().positive(),
});
export type ListMilestonesQuery = z.infer<typeof listMilestonesQuerySchema>;

// 열린 이슈가 있어 닫지 못했을 때 오류에 실리는 값 (번호 오름차순, 전부)
export const milestoneHasOpenIssuesDetailsSchema = z.object({
  openIssueNumbers: z.array(z.number().int().positive()),
});

// 이슈가 있어 지우지 못했을 때 오류에 실리는 값
export const milestoneHasIssuesDetailsSchema = z.object({
  issueCount: z.number().int().nonnegative(),
});
