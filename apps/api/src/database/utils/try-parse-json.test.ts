import { tryParseJson } from './try-parse-json';

describe('저장된 JSON 읽기', () => {
  test('호출한 쪽이 모양을 검사할 수 있도록 JSON 글자를 값으로 바꿔 준다', () => {
    // Given
    const text = '{"from":"TODO","to":"IN_PROGRESS"}';

    // When
    const value = tryParseJson(text);

    // Then
    expect(value).toEqual({ from: 'TODO', to: 'IN_PROGRESS' });
  });

  test('깨진 행을 호출한 쪽이 자기 오류로 알리도록 JSON으로 읽히지 않는 글자는 던지지 않고 undefined를 준다', () => {
    // Given
    const text = '{"from":';

    // When
    const value = tryParseJson(text);

    // Then
    expect(value).toBeUndefined();
  });

  test('비어 있는 칸도 같은 검사에서 걸리도록 null이면 undefined를 준다', () => {
    // When
    const value = tryParseJson(null);

    // Then
    expect(value).toBeUndefined();
  });
});
