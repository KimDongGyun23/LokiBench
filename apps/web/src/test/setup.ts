import '@testing-library/jest-dom/vitest';

import { server } from './server';

// MSW 서버를 켜고, 응답을 정하지 않은 요청은 테스트 실패로 처리함
beforeAll(() => {
  server.listen({ onUnhandledFrame: 'error' });
});

// 한 테스트가 정한 응답이 다음 테스트에 남지 않게 지움
afterEach(() => {
  server.resetHandlers();
});

// 테스트 파일이 끝나면 요청 가로채기를 멈춤
afterAll(() => {
  server.close();
});
