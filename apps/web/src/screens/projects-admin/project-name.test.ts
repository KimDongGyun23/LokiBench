import { EMPTY_NAME_MESSAGE, projectNameFormSchema } from './project-name';

describe('프로젝트 이름 폼 검사', () => {
  test('서버와 같은 이름으로 저장하기 위해 앞뒤 공백을 지운 이름을 돌려준다', () => {
    // When
    const result = projectNameFormSchema.safeParse({ name: '  독서 기록  ' });

    // Then
    expect(result.data).toEqual({ name: '독서 기록' });
  });

  test('보낼 필요 없는 요청을 막기 위해 공백뿐인 이름은 비어 있다는 문구와 함께 거절한다', () => {
    // When
    const result = projectNameFormSchema.safeParse({ name: '   ' });

    // Then
    expect(result.error?.issues.map((issue) => issue.message)).toEqual([EMPTY_NAME_MESSAGE]);
  });

  test('가운데 공백이 다른 이름을 구분하기 위해 이름 안쪽 공백은 그대로 둔다', () => {
    // When
    const result = projectNameFormSchema.safeParse({ name: '독서  기록' });

    // Then
    expect(result.data).toEqual({ name: '독서  기록' });
  });
});
