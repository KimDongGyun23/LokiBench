import { z } from 'zod';

// 이름이 비어 있을 때 입력칸 아래에 보일 문구
export const EMPTY_NAME_MESSAGE = '이름을 입력해 주세요.';

// 같은 이름의 프로젝트가 이미 있을 때 입력칸 아래에 보일 문구
export const NAME_TAKEN_MESSAGE = '같은 이름의 프로젝트가 이미 있습니다.';

// 프로젝트 이름 입력 폼의 검사 규칙
export const projectNameFormSchema = z.object({
  name: z.string().trim().min(1, EMPTY_NAME_MESSAGE),
});

// 프로젝트 이름 입력 폼의 값
export type ProjectNameFormValues = z.infer<typeof projectNameFormSchema>;
