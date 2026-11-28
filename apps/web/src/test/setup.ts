import '@testing-library/jest-dom/vitest';

import { configure } from '@testing-library/react';

import { server } from './server';

// 느린 CI에서 findBy와 waitFor가 기본 1초를 넘겨 실패하지 않도록 3초까지 기다림
configure({ asyncUtilTimeout: 3000 });

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
