interface StoredInstant {
  value: string;
  column: string;
  id: number;
}

/**
 * DB에 저장한 시각 문자열을 Date로 바꾼다.
 *
 * - 읽을 수 없는 값은 응답 변환에서 원인 모를 RangeError가 나기 전에 여기서 막는다
 *
 * @param params.value DB에 저장된 시각 문자열
 * @param params.column 오류에 적을 테이블과 열 이름 (예: projects.created_at)
 * @param params.id 오류에 적을 행 id
 * @returns 바꾼 시각
 */
export function parseStoredInstant({ value, column, id }: StoredInstant): Date {
  const date = new Date(value);

  // 시각으로 읽히지 않는 값이면 어느 행의 어느 열인지 알림
  if (Number.isNaN(date.getTime())) {
    throw new Error(`${column} 시각 형식이 잘못됨: id=${id}`);
  }

  return date;
}
