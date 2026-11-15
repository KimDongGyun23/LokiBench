import { type Project, updateProjectRequestSchema } from '@lokibench/contracts';
import { QueryClientProvider, useQuery } from '@tanstack/react-query';
import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { delay, http, HttpResponse } from 'msw';
import { toast } from 'sonner';

import { Toaster } from '@/components/Toaster';
import { projectQueries } from '@/domains/projects/query-options';
import { createQueryClient } from '@/lib/query-client';
import { server } from '@/test/server';

import { ProjectRow } from './ProjectRow';

const BUDGET: Project = {
  id: 2,
  name: '가계부',
  color: 'teal',
  createdAt: '2026-10-02T00:00:00.000Z',
  archivedAt: null,
};

// 서버가 들고 있는 프로젝트 목록
let serverProjects: Project[] = [];

beforeEach(() => {
  // Given: 서버에 teal 색의 가계부가 있음
  serverProjects = [BUDGET];
  server.use(http.get('/api/projects', () => HttpResponse.json(serverProjects)));
});

// sonner는 토스트 목록을 모듈 전역에 들고 있어서, 남은 토스트가 다음 테스트에 보이지 않게 지움
afterEach(() => {
  act(() => {
    toast.dismiss();
  });
});

// 색 변경 요청에 서버가 어떻게 답할지
interface ColorResponsePlan {
  delayMs: number;
  isFailure: boolean;
}

/**
 * 가계부의 색 변경 요청에 정한 대로 답하게 한다.
 *
 * - 성공으로 답하면 서버가 들고 있는 색도 바꾼다
 *
 * @param plan 걸릴 시간과 실패 여부
 */
function respondToColorChange({ delayMs, isFailure }: ColorResponsePlan) {
  server.use(
    http.patch('/api/projects/2', async ({ request }) => {
      const { color } = updateProjectRequestSchema.parse(await request.json());
      await delay(delayMs);
      if (isFailure || color === undefined) {
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
 * 받은 프로젝트 목록을 행으로 그린다.
 */
function ProjectRows() {
  const { data: projects } = useQuery(projectQueries.list());

  return (
    <table>
      <tbody>
        {projects?.map((project) => (
          <ProjectRow
            key={project.id}
            project={project}
          />
        ))}
      </tbody>
    </table>
  );
}

/**
 * 목록을 받아 가계부 행이 보일 때까지 기다린다.
 */
async function renderProjectRow() {
  render(
    <QueryClientProvider client={createQueryClient()}>
      <ProjectRows />
      <Toaster />
    </QueryClientProvider>,
  );
  await screen.findByText('가계부');
}

describe('프로젝트 행', () => {
  test('어느 프로젝트의 무슨 색인지 알리기 위해 이름과 함께 지금 색을 고른 상태로 보인다', async () => {
    // Given, When
    await renderProjectRow();

    // Then
    expect(screen.getByRole('button', { name: 'teal', pressed: true })).toBeInTheDocument();
  });

  test('누른 즉시 반영되기 위해 응답을 기다리지 않고 누른 색을 고른 상태로 보인다', async () => {
    // Given: 응답이 늦게 옴
    const user = userEvent.setup();
    respondToColorChange({ delayMs: 200, isFailure: false });
    await renderProjectRow();

    // When
    await user.click(screen.getByRole('button', { name: 'rose' }));

    // Then
    expect(screen.getByRole('button', { name: 'rose', pressed: true })).toBeInTheDocument();
    expect(serverProjects).toEqual([BUDGET]);
  });

  test('저장된 색을 계속 보이기 위해 색 변경에 성공하면 누른 색이 고른 상태로 남는다', async () => {
    // Given
    const user = userEvent.setup();
    respondToColorChange({ delayMs: 0, isFailure: false });
    await renderProjectRow();

    // When
    await user.click(screen.getByRole('button', { name: 'rose' }));
    await screen.findByRole('button', { name: 'rose', pressed: true });
    await delay(100);

    // Then
    expect(serverProjects).toEqual([{ ...BUDGET, color: 'rose' }]);
    expect(screen.getByRole('button', { name: 'rose', pressed: true })).toBeInTheDocument();
  });

  test('저장되지 않은 색이 남지 않게 하기 위해 색 변경이 실패하면 원래 색으로 돌아가고 오류 토스트를 띄운다', async () => {
    // Given
    const user = userEvent.setup();
    respondToColorChange({ delayMs: 50, isFailure: true });
    await renderProjectRow();

    // When
    await user.click(screen.getByRole('button', { name: 'rose' }));
    expect(screen.getByRole('button', { name: 'rose', pressed: true })).toBeInTheDocument();

    // Then
    expect(await screen.findByText('색을 바꾸지 못했습니다.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'teal', pressed: true })).toBeInTheDocument();
  });
});
