import {
  createMilestoneRequestSchema,
  milestoneHasOpenIssuesDetailsSchema,
  milestoneTitleSchema,
  updateMilestoneRequestSchema,
} from './milestone';

// 칸을 모두 채운 수정 요청 (테스트마다 바꿀 칸만 덮어씀)
const FILLED_FIELDS = {
  title: '12월 정리',
  startDate: null,
  due: null,
  background: '',
  solution: '',
  expectedEffect: '',
  memo: '',
};

describe('마일스톤 제목 규칙', () => {
  test('입력 실수 허용을 위해 앞뒤 공백은 지운 뒤 검사한다', () => {
    expect(milestoneTitleSchema.parse('  12월 정리  ')).toBe('12월 정리');
  });

  test('공백만 있는 제목은 거부한다', () => {
    expect(milestoneTitleSchema.safeParse('   ').success).toBe(false);
  });

  test('목록 한 줄에 들어가도록 공백을 지운 뒤 50자를 넘으면 거부한다', () => {
    expect(milestoneTitleSchema.parse(` ${'가'.repeat(50)} `)).toBe('가'.repeat(50));
    expect(milestoneTitleSchema.safeParse('가'.repeat(51)).success).toBe(false);
  });
});

describe('마일스톤 만들기 요청', () => {
  test('기간이 거꾸로 저장되지 않도록 시작이 마감보다 늦으면 시작 칸의 오류로 거부한다', () => {
    // When
    const result = createMilestoneRequestSchema.safeParse({
      ...FILLED_FIELDS,
      projectId: 1,
      startDate: '2026-12-10',
      due: '2026-12-01',
    });

    // Then
    expect(result.success).toBe(false);
    expect(result.error?.issues[0]?.path).toEqual(['startDate']);
  });

  test('하루짜리 마일스톤도 있으므로 시작과 마감이 같은 날이면 받는다', () => {
    const result = createMilestoneRequestSchema.safeParse({
      ...FILLED_FIELDS,
      projectId: 1,
      startDate: '2026-12-01',
      due: '2026-12-01',
    });

    expect(result.success).toBe(true);
  });

  test('날짜는 선택이므로 한쪽만 있으면 순서를 따지지 않는다', () => {
    const onlyStart = { ...FILLED_FIELDS, projectId: 1, startDate: '2026-12-10' };
    const onlyDue = { ...FILLED_FIELDS, projectId: 1, due: '2026-12-01' };

    expect(createMilestoneRequestSchema.safeParse(onlyStart).success).toBe(true);
    expect(createMilestoneRequestSchema.safeParse(onlyDue).success).toBe(true);
  });

  test('한 칸에 글이 끝없이 쌓이지 않도록 2,000자를 넘는 메모는 거부한다', () => {
    const request = { ...FILLED_FIELDS, projectId: 1, memo: '가'.repeat(2001) };

    expect(createMilestoneRequestSchema.safeParse(request).success).toBe(false);
    expect(
      createMilestoneRequestSchema.safeParse({ ...request, memo: '가'.repeat(2000) }).success,
    ).toBe(true);
  });
});

describe('마일스톤 수정 요청', () => {
  test('마일스톤은 다른 프로젝트로 옮길 수 없으므로 projectId가 들어와도 버린다', () => {
    const parsed = updateMilestoneRequestSchema.parse({ ...FILLED_FIELDS, projectId: 2 });

    expect(parsed).toEqual(FILLED_FIELDS);
  });

  test('만들기와 같은 기간 규칙을 지키도록 시작이 마감보다 늦으면 거부한다', () => {
    const result = updateMilestoneRequestSchema.safeParse({
      ...FILLED_FIELDS,
      startDate: '2026-12-10',
      due: '2026-12-01',
    });

    expect(result.success).toBe(false);
    expect(result.error?.issues[0]?.path).toEqual(['startDate']);
  });
});

describe('닫기 거부의 details', () => {
  test('화면이 남은 번호를 보여 줄 수 있도록 번호 목록을 받는다', () => {
    expect(
      milestoneHasOpenIssuesDetailsSchema.safeParse({ openIssueNumbers: [1, 3] }).success,
    ).toBe(true);
  });

  test('글자로 온 번호는 계약이 어긋난 것이므로 거부한다', () => {
    expect(milestoneHasOpenIssuesDetailsSchema.safeParse({ openIssueNumbers: ['1'] }).success).toBe(
      false,
    );
  });
});
