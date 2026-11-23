import { dateOnlySchema } from './date';

describe('날짜 규칙', () => {
  test('마감은 시각 없이 날짜만 다루므로 YYYY-MM-DD 모양만 받는다', () => {
    expect(dateOnlySchema.safeParse('2026-02-28').success).toBe(true);
    expect(dateOnlySchema.safeParse('2026-2-3').success).toBe(false);
    expect(dateOnlySchema.safeParse('2026-02-28T00:00:00Z').success).toBe(false);
  });

  test('달력에 없는 날짜는 거부한다', () => {
    expect(dateOnlySchema.safeParse('2026-02-30').success).toBe(false);
  });
});
