import { parseStoredInstant } from './parse-stored-instant';

describe('저장된 시각 읽기', () => {
  test('도메인이 시각으로 바로 계산하도록 ISO 문자열을 같은 순간의 Date로 바꿔 준다', () => {
    // Given
    const stored = { value: '2026-10-01T00:00:00.000Z', column: 'projects.created_at', id: 1 };

    // When
    const date = parseStoredInstant(stored);

    // Then
    expect(date).toEqual(new Date('2026-10-01T00:00:00.000Z'));
  });

  test('깨진 행을 바로 찾도록 시각으로 읽을 수 없으면 넘겨받은 열 이름과 행 id를 담아 던진다', () => {
    // Given: 시각으로 읽을 수 없는 값
    const stored = { value: '어제', column: 'issues.closed_at', id: 7 };

    // When
    const attempt = () => parseStoredInstant(stored);

    // Then
    expect(attempt).toThrow('issues.closed_at 시각 형식이 잘못됨: id=7');
  });
});
