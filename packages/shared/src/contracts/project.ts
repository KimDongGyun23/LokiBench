import { z } from 'zod';

import { PROJECT_COLORS, PROJECT_NAME_MAX_LENGTH } from '../values';

// 프로젝트 색 규칙
export const projectColorSchema = z.enum(PROJECT_COLORS);

// 프로젝트 이름 입력 규칙 (앞뒤 공백을 지운 뒤 길이를 봄)
export const projectNameSchema = z.string().trim().min(1).max(PROJECT_NAME_MAX_LENGTH);

// 프로젝트 응답 (이미 저장된 값이라 이름에 입력 규칙을 다시 걸지 않음)
export const projectSchema = z.object({
  id: z.number().int().positive(),
  name: z.string(),
  color: projectColorSchema,
  createdAt: z.iso.datetime(),
});
export type Project = z.infer<typeof projectSchema>;

// 프로젝트 추가 요청 (색은 서버가 자동 배정하므로 들어와도 버림)
export const createProjectRequestSchema = z.object({ name: projectNameSchema });
export type CreateProjectRequest = z.infer<typeof createProjectRequestSchema>;

// 프로젝트 수정 요청 (이름과 색 중 바꾸는 칸 하나만 보내도 됨)
export const updateProjectRequestSchema = z
  .object({ name: projectNameSchema, color: projectColorSchema })
  .partial()
  .refine((body) => body.name !== undefined || body.color !== undefined, {
    message: '이름과 색 중 하나는 있어야 함',
  });
export type UpdateProjectRequest = z.infer<typeof updateProjectRequestSchema>;
