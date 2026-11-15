import { type Project, updateProjectRequestSchema } from '@lokibench/contracts';
import { QueryClientProvider, useMutation, useQuery } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react';
import { delay, http, HttpResponse } from 'msw';
import type { ReactNode } from 'react';

import { createQueryClient } from '@/lib/query-client';
import { server } from '@/test/server';

import type { ProjectColor } from './colors.constant';
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
// 서버가 들고 있는 프로젝트 목록
let serverProjects: Project[] = [];

beforeEach(() => {
  // Given: 서버에 프로젝트가 2개 있음
  listRequestCount = 0;
  serverProjects = [READING, BUDGET];
  server.use(
    http.get('/api/projects', () => {
      listRequestCount += 1;
      return HttpResponse.json(serverProjects);
    }),
  );
});

/**
 * 블로그 추가 요청을 서버에 저장하고 성공으로 답하게 한다.
 *
 * @param delayMs 저장한 뒤 응답을 보내기까지 걸릴 시간
 */
function respondToCreate(delayMs: number) {
  server.use(
    http.post('/api/projects', async () => {
      serverProjects = [...serverProjects, BLOG];
      await delay(delayMs);

      return HttpResponse.json(BLOG, { status: 201 });
    }),
  );
}

// 색 변경 요청 하나에 서버가 어떻게 답할지
interface ColorResponsePlan {
  delayMs: number;
  isFailure: boolean;
}

/**
 * 가계부의 색 변경 요청에 색마다 정한 대로 답하게 한다.
 *
 * - 성공으로 답하면 서버가 들고 있는 색도 바꾼다
 *
 * @param plans 요청한 색마다 걸릴 시간과 실패 여부
 */
function respondToColorChange(plans: Partial<Record<ProjectColor, ColorResponsePlan>>) {
  server.use(
    http.patch('/api/projects/2', async ({ request }) => {
      const { color } = updateProjectRequestSchema.parse(await request.json());
      const plan = color === undefined ? undefined : plans[color];
      if (color === undefined || plan === undefined) {
        return HttpResponse.json({ code: 'VALIDATION', message: 'unexpected' }, { status: 400 });
      }

      await delay(plan.delayMs);
      if (plan.isFailure) {
        return HttpResponse.json({ code: 'INTERNAL', message: 'boom' }, { status: 500 });
      }

      serverProjects = serverProjects.map((project) =>
        project.id === BUDGET.id ? { ...project, color } : project,
      );

      return HttpResponse.json({ ...BUDGET, color });
    }),
  );
}

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
  test('추가한 프로젝트가 목록에 보이도록 추가에 성공하면 목록을 다시 받는다', async () => {
    // Given
    respondToCreate(0);
    const result = await renderProjectHooks();

    // When
    await act(() => result.current.createProject.mutateAsync({ name: '블로그' }));

    // Then
    await waitFor(() => {
      expect(result.current.projects.data).toEqual([READING, BUDGET, BLOG]);
    });
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
    expect(listRequestCount).toBe(1);
  });

  test('같은 프로젝트가 두 줄로 보이지 않게 하기 위해 응답 전에 받은 목록에 이미 있어도 한 번만 보인다', async () => {
    // Given: 서버에 저장된 뒤 추가 응답이 늦게 도착함
    respondToCreate(100);
    const result = await renderProjectHooks();

    // When: 추가 응답이 오기 전에 목록을 다시 받음
    act(() => {
      result.current.createProject.mutate({ name: '블로그' });
    });
    await waitFor(() => {
      expect(serverProjects).toHaveLength(3);
    });
    await act(() => result.current.projects.refetch());
    await waitFor(() => {
      expect(result.current.createProject.isSuccess).toBe(true);
    });

    // Then
    expect(result.current.projects.data).toEqual([READING, BUDGET, BLOG]);
  });
});

describe('프로젝트 색 변경', () => {
  test('저장된 색이 목록에 보이도록 색 변경에 성공하면 목록을 다시 받는다', async () => {
    // Given
    respondToColorChange({ violet: { delayMs: 0, isFailure: false } });
    const result = await renderProjectHooks();

    // When
    await act(() => result.current.changeColor.mutateAsync({ projectId: 2, color: 'violet' }));

    // Then
    await waitFor(() => {
      expect(result.current.projects.data).toEqual([READING, { ...BUDGET, color: 'violet' }]);
    });
  });

  test('되돌릴 일을 만들지 않기 위해 응답을 받기 전에는 목록의 색을 바꾸지 않는다', async () => {
    // Given
    respondToColorChange({ violet: { delayMs: 50, isFailure: false } });
    const result = await renderProjectHooks();

    // When
    act(() => {
      result.current.changeColor.mutate({ projectId: 2, color: 'violet' });
    });
    await waitFor(() => {
      expect(result.current.changeColor.isPending).toBe(true);
    });

    // Then
    expect(result.current.projects.data).toEqual([READING, BUDGET]);
    await waitFor(() => {
      expect(result.current.changeColor.isSuccess).toBe(true);
    });
  });

  test('저장되지 않은 색이 보이지 않게 하기 위해 색 변경이 실패하면 목록을 그대로 둔다', async () => {
    // Given
    respondToColorChange({ violet: { delayMs: 0, isFailure: true } });
    const result = await renderProjectHooks();

    // When
    const failure = await act(() =>
      result.current.changeColor
        .mutateAsync({ projectId: 2, color: 'violet' })
        .catch((error: unknown) => error),
    );

    // Then
    expect(failure).toMatchObject({ code: 'INTERNAL' });
    expect(result.current.projects.data).toEqual([READING, BUDGET]);
    expect(listRequestCount).toBe(1);
  });

  test('뒤에 저장된 색이 지워지지 않게 하기 위해 앞선 색 변경이 실패해도 뒤에 성공한 색을 남긴다', async () => {
    // Given: 먼저 누른 색은 실패하고, 뒤에 누른 색은 더 늦게 성공함
    respondToColorChange({
      violet: { delayMs: 60, isFailure: true },
      rose: { delayMs: 150, isFailure: false },
    });
    const result = await renderProjectHooks();

    // When
    act(() => {
      result.current.changeColor.mutate({ projectId: 2, color: 'violet' });
    });
    act(() => {
      result.current.changeColor.mutate({ projectId: 2, color: 'rose' });
    });
    await waitFor(() => {
      expect(result.current.changeColor.isSuccess).toBe(true);
    });

    // Then
    expect(result.current.projects.data).toEqual([READING, { ...BUDGET, color: 'rose' }]);
  });

  test('저장되지 않은 색이 남지 않게 하기 위해 겹친 색 변경이 모두 실패하면 처음 색을 그대로 둔다', async () => {
    // Given
    respondToColorChange({
      violet: { delayMs: 60, isFailure: true },
      rose: { delayMs: 150, isFailure: true },
    });
    const result = await renderProjectHooks();

    // When
    act(() => {
      result.current.changeColor.mutate({ projectId: 2, color: 'violet' });
    });
    act(() => {
      result.current.changeColor.mutate({ projectId: 2, color: 'rose' });
    });
    await waitFor(() => {
      expect(result.current.changeColor.isError).toBe(true);
    });

    // Then
    expect(result.current.projects.data).toEqual([READING, BUDGET]);
  });
});
