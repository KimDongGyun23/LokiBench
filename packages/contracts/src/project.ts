import { PROJECT_COLORS, PROJECT_NAME_MAX_LENGTH } from '@lokibench/domain';
import { z } from 'zod';

export const projectColorSchema = z.enum(PROJECT_COLORS);

// 앞뒤 공백을 먼저 지워서 길이와 같은 이름 판단을 본문 기준으로 함
export const projectNameSchema = z.string().trim().min(1).max(PROJECT_NAME_MAX_LENGTH);

// 응답은 이미 저장된 값이라 이름에 입력 규칙(projectNameSchema)을 다시 걸지 않음
export const projectSchema = z.object({
  id: z.number().int().positive(),
  name: z.string(),
  color: projectColorSchema,
  createdAt: z.iso.datetime(),
  archivedAt: z.iso.datetime().nullable(),
});
export type Project = z.infer<typeof projectSchema>;

// 색은 서버가 자동 배정하므로 요청에 들어와도 버림
export const createProjectRequestSchema = z.object({ name: projectNameSchema });
export type CreateProjectRequest = z.infer<typeof createProjectRequestSchema>;

// 화면에서 이름 수정과 색 변경이 따로 일어나서 바꾸는 칸 하나만 보내도 되게 함
export const updateProjectRequestSchema = z
  .object({ name: projectNameSchema, color: projectColorSchema })
  .partial()
  .refine((body) => body.name !== undefined || body.color !== undefined, {
    message: '이름과 색 중 하나는 있어야 함',
  });
export type UpdateProjectRequest = z.infer<typeof updateProjectRequestSchema>;
