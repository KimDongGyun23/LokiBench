/**
 * JSON 글자를 값으로 바꾼다.
 *
 * - 읽을 수 없는 글자는 예외 대신 undefined로 돌려 호출한 쪽의 모양 검사에서 걸리게 한다
 *
 * @param text DB에 저장된 JSON 글자 (값이 없는 칸이면 null)
 * @returns 읽은 값, 읽을 수 없으면 undefined
 */
export function tryParseJson(text: string | null): unknown {
  // 칸이 비어 있으면 읽을 값이 없음
  if (text === null) return undefined;

  try {
    return JSON.parse(text);
  } catch {
    return undefined;
  }
}
