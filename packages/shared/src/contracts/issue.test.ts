import {
  createIssueRequestSchema,
  issueTitleSchema,
  listIssuesQuerySchema,
  updateIssueRequestSchema,
} from './issue';

describe('이슈 제목 규칙', () => {
  test('입력 실수 허용을 위해 앞뒤 공백은 지운 뒤 검사한다', () => {
    expect(issueTitleSchema.parse('  영수증 정리  ')).toBe('영수증 정리');
  });

  test('공백만 있는 제목은 거부한다', () => {
    expect(issueTitleSchema.safeParse('   ').success).toBe(false);
  });

  test('한 줄로 읽히는 길이를 지키기 위해 공백을 지운 뒤 200자를 넘으면 거부한다', () => {
    expect(issueTitleSchema.safeParse('가'.repeat(201)).success).toBe(false);
    expect(issueTitleSchema.parse(` ${'가'.repeat(200)} `)).toBe('가'.repeat(200));
  });
});

describe('이슈 추가 요청', () => {
  test('상태와 번호는 서버가 정하므로 요청에 들어와도 버린다', () => {
    expect(
      createIssueRequestSchema.parse({
        projectId: 1,
        title: '글 초안 저장',
        status: 'DONE',
        number: 9,
      }),
    ).toEqual({ projectId: 1, title: '글 초안 저장' });
  });
});

describe('이슈 수정 요청', () => {
  test('빈 수정 요청을 막기 위해 제목, 마감, 상태 중 하나는 있어야 한다', () => {
    expect(updateIssueRequestSchema.safeParse({ version: 1 }).success).toBe(false);
    expect(updateIssueRequestSchema.safeParse({ version: 1, status: 'DONE' }).success).toBe(true);
  });

  test('마감을 지우는 요청을 받기 위해 마감 null은 바꿀 값으로 본다', () => {
    expect(updateIssueRequestSchema.parse({ version: 1, due: null })).toEqual({
      version: 1,
      due: null,
    });
  });

  test('번호처럼 못 바꾸는 칸은 버리고, 그것만 보냈으면 빈 요청으로 거부한다', () => {
    expect(updateIssueRequestSchema.safeParse({ version: 1, number: 9 }).success).toBe(false);
    expect(updateIssueRequestSchema.parse({ version: 1, title: '새 제목', number: 9 })).toEqual({
      version: 1,
      title: '새 제목',
    });
  });

  test('수정 충돌을 가리기 위해 version이 없으면 거부한다', () => {
    expect(updateIssueRequestSchema.safeParse({ title: '새 제목' }).success).toBe(false);
  });
});

describe('이슈 목록 조회', () => {
  test('쿼리는 글자로 오므로 프로젝트 id를 숫자로 바꿔 받는다', () => {
    expect(listIssuesQuerySchema.parse({ projectId: '3' })).toEqual({ projectId: 3 });
  });

  test('숫자가 아니거나 정수가 아닌 프로젝트 id, 빠진 프로젝트 id는 거부한다', () => {
    expect(listIssuesQuerySchema.safeParse({ projectId: 'abc' }).success).toBe(false);
    expect(listIssuesQuerySchema.safeParse({ projectId: '1.5' }).success).toBe(false);
    expect(listIssuesQuerySchema.safeParse({}).success).toBe(false);
  });

  test('경로의 id와 같은 기준을 지키기 위해 숫자 글자가 아닌 표기는 거부한다', () => {
    expect(listIssuesQuerySchema.safeParse({ projectId: '1e2' }).success).toBe(false);
    expect(listIssuesQuerySchema.safeParse({ projectId: '0x10' }).success).toBe(false);
    expect(listIssuesQuerySchema.safeParse({ projectId: ' 3 ' }).success).toBe(false);
    expect(listIssuesQuerySchema.safeParse({ projectId: '0' }).success).toBe(false);
  });
});

describe('이슈의 마일스톤 칸', () => {
  test('만들 때 마일스톤을 고를 수 있도록 마일스톤 id를 받는다', () => {
    expect(
      createIssueRequestSchema.parse({ projectId: 1, title: '글 초안 저장', milestoneId: 3 }),
    ).toEqual({ projectId: 1, title: '글 초안 저장', milestoneId: 3 });
  });

  test('마일스톤에서 빼는 것도 수정이므로 milestoneId null만 보내도 받는다', () => {
    expect(updateIssueRequestSchema.parse({ version: 1, milestoneId: null })).toEqual({
      version: 1,
      milestoneId: null,
    });
  });
});
