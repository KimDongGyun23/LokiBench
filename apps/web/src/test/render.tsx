import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, type RenderResult } from '@testing-library/react';
import { createMemoryRouter, RouterProvider } from 'react-router';

import { routes } from '@/app/routes';

interface RenderAppOptions {
  route?: string;
}

/**
 * 앱 전체를 실제 경로 표와 새 조회 캐시로 그린다.
 *
 * - 조회 캐시는 부를 때마다 새로 만들어서 테스트끼리 응답이 섞이지 않는다
 * - 실패 화면을 바로 확인하도록 조회 재시도를 끈다
 *
 * @param options.route 처음 열 주소 (기본 `/`)
 * @returns Testing Library의 렌더 결과
 */
export function renderApp({ route = '/' }: RenderAppOptions = {}): RenderResult {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const router = createMemoryRouter(routes, { initialEntries: [route] });

  return render(
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  );
}
