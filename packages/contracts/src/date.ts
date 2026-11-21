import { z } from 'zod';

// 마감처럼 시각이 없는 날짜. YYYY-MM-DD 모양이고 달력에 있는 날짜만 받음
export const dateOnlySchema = z.iso.date();
