import { ERROR_CODES } from './error';

describe('공개 오류 코드', () => {
  test('도메인에 코드를 더해도 공개 계약이 바뀐다는 것이 contracts diff에 드러나도록 전체 목록을 고정한다', () => {
    // Given: 도메인 오류 코드를 펼쳐 만든 공개 목록

    // When
    const codes = [...ERROR_CODES];

    // Then: 코드를 더하거나 빼면 이 목록도 함께 고쳐야 함
    expect(codes).toEqual([
      'VALIDATION',
      'NOT_FOUND',
      'PROJECT_NOT_FOUND',
      'PROJECT_NAME_TAKEN',
      'INTERNAL',
    ]);
  });
});
