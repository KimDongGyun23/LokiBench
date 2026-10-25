import {
  createProjectRequestSchema,
  projectNameSchema,
  updateProjectRequestSchema,
} from './project';

describe('프로젝트 이름 규칙', () => {
  test('입력 실수 허용을 위해 앞뒤 공백은 지운 뒤 검사한다', () => {
    expect(projectNameSchema.parse('  채용관  ')).toBe('채용관');
  });

  test('사이드바 폭을 지키기 위해 공백을 지운 뒤 40자를 넘으면 거부한다', () => {
    expect(projectNameSchema.safeParse('가'.repeat(41)).success).toBe(false);
    expect(projectNameSchema.parse(` ${'가'.repeat(40)} `)).toBe('가'.repeat(40));
  });

  test('공백만 있는 이름은 거부한다', () => {
    expect(projectNameSchema.safeParse('   ').success).toBe(false);
  });
});

describe('프로젝트 수정 요청', () => {
  test('빈 수정 요청을 막기 위해 이름과 색 중 하나는 있어야 한다', () => {
    expect(updateProjectRequestSchema.safeParse({}).success).toBe(false);
    expect(updateProjectRequestSchema.safeParse({ color: 'violet' }).success).toBe(true);
  });

  test('팔레트 밖 색은 거부한다', () => {
    expect(updateProjectRequestSchema.safeParse({ color: 'emerald' }).success).toBe(false);
  });
});

describe('프로젝트 추가 요청', () => {
  test('색은 서버가 정하므로 요청의 색은 버린다', () => {
    expect(createProjectRequestSchema.parse({ name: '블로그', color: 'rose' })).toEqual({
      name: '블로그',
    });
  });
});
