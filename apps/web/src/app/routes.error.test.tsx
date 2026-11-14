import { screen } from '@testing-library/react';
import { http, HttpResponse } from 'msw';

import { renderApp } from '@/test/render';
import { server } from '@/test/server';

// 없는 경로 화면이 그리는 도중 오류를 던지게 바꿈
vi.mock('@/screens/not-found/NotFoundPage', () => ({
  NotFoundPage: () => {
    throw new Error('화면을 그리다 난 오류');
  },
}));

beforeEach(() => {
  // Given: 프로젝트가 없고, React가 콘솔에 남기는 오류 기록은 가림
  server.use(http.get('/api/projects', () => HttpResponse.json([])));
  vi.spyOn(console, 'error').mockImplementation(() => undefined);
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('화면 오류', () => {
  test('다른 화면으로 빠져나갈 수 있도록 화면이 그리다 오류를 던지면 사이드바는 남기고 본문에만 안내를 보인다', async () => {
    // When
    renderApp({ route: '/nope' });

    // Then
    expect(
      await screen.findByRole('heading', { name: '화면을 표시하지 못했습니다' }),
    ).toBeInTheDocument();
    expect(screen.getByRole('link', { name: '대시보드로 이동' })).toHaveAttribute(
      'href',
      '/dashboard',
    );
    expect(screen.getByRole('navigation', { name: '주 메뉴' })).toBeInTheDocument();
  });
});
