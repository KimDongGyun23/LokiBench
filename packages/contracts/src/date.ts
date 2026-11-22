import { z } from 'zod';

// 마감처럼 시각이 없는 날짜
export const dateOnlySchema = z.iso.date();
