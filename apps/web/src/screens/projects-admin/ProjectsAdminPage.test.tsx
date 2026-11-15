import type { Project } from '@lokibench/contracts';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { delay, http, HttpResponse } from 'msw';

import { renderApp } from '@/test/render';
import { server } from '@/test/server';

const PROJECTS: Project[] = [
  {
    id: 1,
    name: '독서 기록',
    color: 'indigo',
    createdAt: '2026-10-01T00:00:00.000Z',
    archivedAt: null,
  },
  { id: 2, name: '가계부', color: 'teal', createdAt: '2026-10-02T00:00:00.000Z', archivedAt: null },
  { id: 3, name: '블로그', color: 'rose', createdAt: '2026-10-03T00:00:00.000Z', archivedAt: null },
];

describe('프로젝트 관리 불러오기 실패', () => {
  test('새로고침 없이 다시 받을 수 있도록 실패 안내와 함께 다시 시도 버튼을 보인다', async () => {
    // Given: 서버가 응답하지 않음
    const user = userEvent.setup();
    server.use(http.get('/api/projects', () => HttpResponse.error()));
    renderApp({ route: '/projects-admin' });
    const main = screen.getByRole('main');
    expect(await within(main).findByText('프로젝트를 불러오지 못했습니다')).toBeInTheDocument();

    // When: 서버가 돌아온 뒤 다시 시도를 누름
    server.use(http.get('/api/projects', () => HttpResponse.json(PROJECTS)));
    await user.click(within(main).getByRole('button', { name: '다시 시도' }));

    // Then
    const table = await screen.findByRole('table', { name: '프로젝트' });
    expect(await within(table).findByText('가계부')).toBeInTheDocument();
    expect(within(main).queryByText('프로젝트를 불러오지 못했습니다')).not.toBeInTheDocument();
  });
});

describe('프로젝트 관리 다시 받기 실패', () => {
  test('보던 표를 잃지 않도록 이미 받은 목록이 있으면 다시 받기에 실패해도 표를 그대로 둔다', async () => {
    // Given: 표가 보인 뒤 서버가 목록에 응답하지 않게 됨
    const user = userEvent.setup();
    server.use(http.get('/api/projects', () => HttpResponse.json(PROJECTS)));
    renderApp({ route: '/projects-admin' });
    const table = await screen.findByRole('table', { name: '프로젝트' });
    const budgetRow = await within(table).findByRole('row', { name: /가계부/ });

    let failedListRequestCount = 0;
    server.use(
      http.get('/api/projects', () => {
        failedListRequestCount += 1;
        return HttpResponse.error();
      }),
      http.patch('/api/projects/2', () => HttpResponse.json({ ...PROJECTS[1], color: 'rose' })),
    );

    // When: 색을 바꿔서 목록을 다시 받게 함
    await user.click(within(budgetRow).getByRole('button', { name: 'rose' }));
    await waitFor(() => expect(failedListRequestCount).toBe(1));
    await delay(50);

    // Then
    expect(screen.getByRole('table', { name: '프로젝트' })).toBeInTheDocument();
    expect(
      within(screen.getByRole('main')).queryByText('프로젝트를 불러오지 못했습니다'),
    ).not.toBeInTheDocument();
  });
});
