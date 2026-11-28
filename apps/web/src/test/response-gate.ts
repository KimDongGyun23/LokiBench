// 테스트가 풀어 줄 때까지 가짜 응답을 붙잡아 두는 문
export interface ResponseGate {
  // 핸들러가 응답을 보내기 전에 기다림
  wait: () => Promise<void>;
  // 붙잡아 둔 응답을 보냄
  release: () => void;
}

/**
 * 테스트가 풀어 줄 때까지 가짜 응답을 붙잡아 두는 문을 만든다.
 *
 * - 응답을 시간으로 늦추면 느린 환경에서는 확인하기 전에 응답이 먼저 오므로, 응답 시점을 테스트가 정한다
 * - 한 번 풀면 그 뒤에 기다리는 응답도 바로 보낸다
 *
 * @returns 핸들러가 기다릴 함수와 테스트가 풀 함수
 */
export function createResponseGate(): ResponseGate {
  let open = () => {};
  const opened = new Promise<void>((resolve) => {
    open = resolve;
  });

  return { wait: () => opened, release: () => open() };
}
