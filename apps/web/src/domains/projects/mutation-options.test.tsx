import type { Project } from '@lokibench/contracts';
import { QueryClientProvider, useMutation, useQuery } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react';
import { delay, http, HttpResponse } from 'msw';
import type { ReactNode } from 'react';

import { createQueryClient } from '@/lib/query-client';
import { server } from '@/test/server';

import { projectMutations } from './mutation-options';
import { projectQueries } from './query-options';

const READING: Project = {
  id: 1,
  name: '독서 기록',
  color: 'indigo',
  createdAt: '2026-10-01T00:00:00.000Z',
  archivedAt: null,
};
const BUDGET: Project = {
  id: 2,
  name: '가계부',
  color: 'teal',
  createdAt: '2026-10-02T00:00:00.000Z',
  archivedAt: null,
};
const BLOG: Project = {
  id: 3,
  name: '블로그',
  color: 'rose',
  createdAt: '2026-10-03T00:00:00.000Z',
  archivedAt: null,
};

// 목록 조회 요청이 나간 횟수
let listRequestCount = 0;

beforeEach(() => {
  // Given: 서버에 프로젝트가 2개 있음
  listRequestCount = 0;
  server.use(
    http.get('/api/projects', () => {
      listRequestCount += 1;
      return HttpResponse.json([READING, BUDGET]);
    }),
  );
});

/**
 * 목록 조회와 두 변경을 같은 조회 캐시 위에 올리고, 목록을 받을 때까지 기다린다.
 */
async function renderProjectHooks() {
  const queryClient = createQueryClient();
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
  const { result } = renderHook(
    () => ({
      projects: useQuery(projectQueries.list()),
      createProject: useMutation(projectMutations.create()),
      changeColor: useMutation(projectMutations.changeColor()),
    }),
    { wrapper },
  );
  await waitFor(() => {
    expect(result.current.projects.data).toHaveLength(2);
  });

  return result;
}

describe('프로젝트 추가', () => {
  test('목록을 다시 받지 않고 바로 보이기 위해 추가한 프로젝트를 받아 둔 목록 끝에 붙인다', async () => {
    // Given
    server.use(http.post('/api/projects', () => HttpResponse.json(BLOG, { status: 201 })));
    const result = await renderProjectHooks();

    // When
    await act(() => result.current.createProject.mutateAsync({ name: '블로그' }));

    // Then
    expect(result.current.projects.data).toEqual([READING, BUDGET, BLOG]);
    expect(listRequestCount).toBe(1);
  });

  test('없는 프로젝트가 보이지 않게 하기 위해 추가가 거절되면 목록을 그대로 둔다', async () => {
    // Given
    server.use(
      http.post('/api/projects', () =>
        HttpResponse.json(
          { code: 'PROJECT_NAME_TAKEN', message: 'name already taken' },
          { status: 409 },
        ),
      ),
    );
    const result = await renderProjectHooks();

    // When
    const failure = await act(() =>
      result.current.createProject.mutateAsync({ name: '가계부' }).catch((error: unknown) => error),
    );

    // Then
    expect(failure).toMatchObject({ code: 'PROJECT_NAME_TAKEN' });
    expect(result.current.projects.data).toEqual([READING, BUDGET]);
  });
});

describe('프로젝트 색 변경', () => {
  test('누른 즉시 반영되기 위해 응답을 기다리지 않고 목록의 색을 먼저 바꾼다', async () => {
    // Given
    server.use(
      http.patch('/api/projects/2', async () => {
        await delay(50);
        return HttpResponse.json({ ...BUDGET, color: 'violet' });
      }),
    );
    const result = await renderProjectHooks();

    // When
    act(() => {
      result.current.changeColor.mutate({ projectId: 2, color: 'violet' });
    });

    // Then
    await waitFor(() => {
      expect(result.current.projects.data).toEqual([READING, { ...BUDGET, color: 'violet' }]);
    });
    expect(result.current.changeColor.isPending).toBe(true);
    await waitFor(() => {
      expect(result.current.changeColor.isSuccess).toBe(true);
    });
    expect(result.current.projects.data).toEqual([READING, { ...BUDGET, color: 'violet' }]);
  });

  test('저장되지 않은 색이 남지 않게 하기 위해 색 변경이 실패하면 원래 색으로 되돌린다', async () => {
    // Given
    server.use(
      http.patch('/api/projects/2', async () => {
        await delay(50);
        return HttpResponse.json({ code: 'INTERNAL', message: 'boom' }, { status: 500 });
      }),
    );
    const result = await renderProjectHooks();

    // When
    act(() => {
      result.current.changeColor.mutate({ projectId: 2, color: 'violet' });
    });
    await waitFor(() => {
      expect(result.current.projects.data).toEqual([READING, { ...BUDGET, color: 'violet' }]);
    });

    // Then
    await waitFor(() => {
      expect(result.current.changeColor.isError).toBe(true);
    });
    expect(result.current.projects.data).toEqual([READING, BUDGET]);
  });
});
