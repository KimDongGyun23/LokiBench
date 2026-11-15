import type { KeyboardEvent } from 'react';

// 이름이 비어 있을 때 입력칸 아래에 보일 문구
export const EMPTY_NAME_MESSAGE = '이름을 입력해 주세요.';

// 프로젝트 이름 검사 결과
type ProjectNameValidation = { isValid: true; name: string } | { isValid: false; message: string };

/**
 * 입력한 프로젝트 이름을 요청 전에 검사한다.
 *
 * - 앞뒤 공백을 지운 뒤 한 글자도 없으면 거절한다
 * - 길이는 입력칸이 막으므로 여기서 검사하지 않는다
 *
 * @param raw 입력칸의 글자 그대로
 * @returns 통과하면 앞뒤 공백을 지운 이름, 아니면 보여 줄 문구
 */
export function validateProjectName(raw: string): ProjectNameValidation {
  const name = raw.trim();
  if (name === '') return { isValid: false, message: EMPTY_NAME_MESSAGE };

  return { isValid: true, name };
}

/**
 * 입력칸에서 누른 키가 제출하라는 뜻인지 판단한다.
 *
 * - 한글 조합 중의 Enter는 글자를 확정하는 키라서 제출로 보지 않는다
 *
 * @param event 입력칸의 keydown 이벤트
 * @returns 조합 중이 아닌 Enter인지
 */
export function isSubmitKey(event: KeyboardEvent<HTMLInputElement>): boolean {
  return event.key === 'Enter' && !event.nativeEvent.isComposing;
}
