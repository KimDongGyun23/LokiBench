import type { Project } from '@lokibench/shared/contracts';
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
  },
  { id: 2, name: '가계부', color: 'teal', createdAt: '2026-10-02T00:00:00.000Z' },
  { id: 3, name: '블로그', color: 'rose', createdAt: '2026-10-03T00:00:00.000Z' },
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

describe('프로젝트 관리 추가', () => {
  test('추가한 것을 바로 쓸 수 있도록 새 프로젝트가 표와 사이드바의 맨 끝에 나타난다', async () => {
    // Given: 서버가 추가한 프로젝트를 목록 끝에 붙임
    const user = userEvent.setup();
    const moving: Project = {
      id: 4,
      name: '이사 준비',
      color: 'sky',
      createdAt: '2026-10-04T00:00:00.000Z',
    };
    let serverProjects = PROJECTS;
    server.use(
      http.get('/api/projects', () => HttpResponse.json(serverProjects)),
      http.post('/api/projects', () => {
        serverProjects = [...serverProjects, moving];
        return HttpResponse.json(moving, { status: 201 });
      }),
    );
    renderApp({ route: '/projects-admin' });
    const table = await screen.findByRole('table', { name: '프로젝트' });

    // When
    await user.type(screen.getByRole('textbox', { name: '프로젝트 이름' }), '이사 준비{Enter}');

    // Then
    expect(await within(table).findByRole('row', { name: /이사 준비/ })).toBeInTheDocument();
    const rows = within(table).getAllByRole('row');
    expect(rows.at(-1)).toHaveTextContent('이사 준비');
    const links = within(screen.getByRole('navigation', { name: '주 메뉴' })).getAllByRole('link', {
      name: /독서 기록|가계부|블로그|이사 준비/,
    });
    expect(links.at(-1)).toHaveTextContent('이사 준비');
  });
});

describe('프로젝트 관리 이름 변경', () => {
  test('바뀐 이름을 어디서나 바로 볼 수 있도록 이름을 바꾸면 표와 사이드바에 함께 반영된다', async () => {
    // Given: 서버가 가계부의 이름을 바꿔 저장함
    const user = userEvent.setup();
    let serverProjects = PROJECTS;
    server.use(
      http.get('/api/projects', () => HttpResponse.json(serverProjects)),
      http.patch('/api/projects/2', () => {
        serverProjects = serverProjects.map((project) =>
          project.id === 2 ? { ...project, name: '생활비' } : project,
        );

        return HttpResponse.json({ ...PROJECTS[1], name: '생활비' });
      }),
    );
    renderApp({ route: '/projects-admin' });
    const table = await screen.findByRole('table', { name: '프로젝트' });

    // When
    await user.click(await within(table).findByRole('button', { name: '가계부 이름 수정' }));
    const input = within(table).getByRole('textbox', { name: '가계부의 새 이름' });
    await user.clear(input);
    await user.type(input, '생활비{Enter}');

    // Then
    expect(await within(table).findByRole('row', { name: /생활비/ })).toBeInTheDocument();
    const navigation = screen.getByRole('navigation', { name: '주 메뉴' });
    expect(within(navigation).getByRole('link', { name: /생활비/ })).toBeInTheDocument();
    expect(within(navigation).queryByRole('link', { name: /가계부/ })).not.toBeInTheDocument();
  });
});
