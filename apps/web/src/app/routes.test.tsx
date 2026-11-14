import type { Project } from '@lokibench/contracts';
import { screen } from '@testing-library/react';
import { http, HttpResponse } from 'msw';

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

beforeEach(() => {
  // Given: 서버에 프로젝트가 만든 순서대로 3개 있음
  server.use(http.get('/api/projects', () => HttpResponse.json(PROJECTS)));
});

describe('사이드바', () => {
  test('만든 순서를 그대로 믿을 수 있도록 프로젝트를 서버가 준 순서대로 보인다', async () => {
    // When
    renderApp({ route: '/dashboard' });

    // Then
    const items = await screen.findAllByRole('link', { name: /독서 기록|가계부|블로그/ });
    expect(items.map((item) => item.textContent)).toEqual(['독서 기록', '가계부', '블로그']);
  });

  test('지금 어느 화면인지 알 수 있도록 현재 화면 항목만 선택 상태로 둔다', async () => {
    // When
    renderApp({ route: '/projects-admin' });

    // Then
    expect(await screen.findByRole('link', { name: '프로젝트 관리' })).toHaveAttribute(
      'aria-current',
      'page',
    );
    expect(screen.getByRole('link', { name: '대시보드' })).not.toHaveAttribute('aria-current');
  });

  test('api가 꺼져 있어도 다른 화면으로 갈 수 있도록 프로젝트 묶음에만 불러오기 실패를 보인다', async () => {
    // Given
    server.use(http.get('/api/projects', () => HttpResponse.error()));

    // When
    renderApp({ route: '/dashboard' });

    // Then
    expect(await screen.findByText('불러오지 못함')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '다시 시도' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: '대시보드' })).toBeInTheDocument();
  });
});

describe('경로', () => {
  test('지워졌거나 잘못된 주소에서 길을 잃지 않도록 없는 프로젝트 id는 대시보드로 가는 길과 함께 알린다', async () => {
    // When
    renderApp({ route: '/projects/999' });

    // Then
    expect(
      await screen.findByRole('heading', { name: '존재하지 않는 프로젝트' }),
    ).toBeInTheDocument();
    expect(screen.getByRole('link', { name: '대시보드로 이동' })).toHaveAttribute(
      'href',
      '/dashboard',
    );
  });

  test('주소가 가리키는 프로젝트를 알 수 있도록 프로젝트 화면 제목에 그 이름을 보인다', async () => {
    // When
    renderApp({ route: '/projects/2' });

    // Then
    expect(await screen.findByRole('heading', { name: '가계부' })).toBeInTheDocument();
  });

  test('잘못된 주소에서 길을 잃지 않도록 없는 경로는 대시보드로 가는 길과 함께 알린다', async () => {
    // When
    renderApp({ route: '/nope' });

    // Then
    expect(
      await screen.findByRole('heading', { name: '존재하지 않는 페이지' }),
    ).toBeInTheDocument();
    expect(screen.getByRole('link', { name: '대시보드로 이동' })).toHaveAttribute(
      'href',
      '/dashboard',
    );
  });

  test('첫 화면을 따로 고르지 않도록 / 는 대시보드로 보낸다', async () => {
    // When
    renderApp({ route: '/' });

    // Then
    expect(await screen.findByRole('heading', { name: '대시보드' })).toBeInTheDocument();
  });
});
