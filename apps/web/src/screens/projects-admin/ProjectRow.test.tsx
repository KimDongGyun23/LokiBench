import { type Project, updateProjectRequestSchema } from '@lokibench/shared/contracts';
import { QueryClientProvider, useIsMutating, useQuery } from '@tanstack/react-query';
import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { useState } from 'react';
import { toast } from 'sonner';

import { Toaster } from '@/components/Toaster';
import { projectQueries } from '@/domains/projects/query-options';
import { createQueryClient } from '@/lib/query-client';
import { createResponseGate, type ResponseGate } from '@/test/response-gate';
import { server } from '@/test/server';

import { ProjectRow } from './ProjectRow';

const BUDGET: Project = {
  id: 2,
  name: '가계부',
  color: 'teal',
  createdAt: '2026-10-02T00:00:00.000Z',
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
  gate?: ResponseGate;
  isFailure: boolean;
}

/**
 * 가계부의 색 변경 요청에 정한 대로 답하게 한다.
 *
 * - 성공으로 답하면 서버가 들고 있는 색도 바꾼다
 * - 문을 넘기면 응답을 테스트가 풀 때까지 붙잡아 둔다
 *
 * @param plan 응답을 붙잡아 둘 문과 실패 여부
 */
function respondToColorChange({ gate, isFailure }: ColorResponsePlan) {
  server.use(
    http.patch('/api/projects/2', async ({ request }) => {
      const { color } = updateProjectRequestSchema.parse(await request.json());
      await gate?.wait();
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

// 이름 변경 요청에 서버가 어떻게 답할지
type RenameResponsePlan = 'success' | 'failure';

/**
 * 가계부의 이름 변경 요청에 정한 대로 답하게 한다.
 *
 * - 성공으로 답하면 서버가 들고 있는 이름도 바꾼다
 *
 * @param plan 성공 또는 실패
 */
function respondToRename(plan: RenameResponsePlan) {
  server.use(
    http.patch('/api/projects/2', async ({ request }) => {
      const { name } = updateProjectRequestSchema.parse(await request.json());
      if (plan === 'failure' || name === undefined) {
        return HttpResponse.json({ code: 'INTERNAL', message: 'boom' }, { status: 500 });
      }

      serverProjects = serverProjects.map((project) =>
        project.id === BUDGET.id ? { ...project, name } : project,
      );

      return HttpResponse.json({ ...BUDGET, name });
    }),
  );
}

/**
 * 받은 프로젝트 목록을 행으로 그리고, 어느 행을 고치는 중인지 기억한다.
 *
 * - 저장하는 동안에는 "저장 중"을 보여 테스트가 시간 대신 이 글자로 끝을 기다린다
 */
function ProjectRows() {
  const { data: projects } = useQuery(projectQueries.list());
  const [editingProjectId, setEditingProjectId] = useState<number | null>(null);
  const savingCount = useIsMutating();

  return (
    <>
      {/* 저장과 그 뒤의 목록 다시 받기가 끝났는지 테스트가 알 수 있게 보임 */}
      {savingCount > 0 && <p>저장 중</p>}
      <table>
        <tbody>
          {projects?.map((project) => (
            <ProjectRow
              key={project.id}
              project={project}
              openIssueCount={undefined}
              isEditing={editingProjectId === project.id}
              canEdit={editingProjectId === null}
              onEditStart={() => setEditingProjectId(project.id)}
              onEditEnd={() => setEditingProjectId(null)}
            />
          ))}
        </tbody>
      </table>
    </>
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

/**
 * 가계부 행을 그린 뒤 수정을 눌러 이름 입력칸을 연다.
 *
 * @returns 이름 입력칸
 */
async function renderEditingProjectRow() {
  await renderProjectRow();
  await userEvent.click(screen.getByRole('button', { name: '가계부 이름 수정' }));

  return screen.getByRole('textbox', { name: '가계부의 새 이름' });
}

describe('프로젝트 행', () => {
  test('어느 프로젝트의 무슨 색인지 알리기 위해 이름과 함께 지금 색을 고른 상태로 보인다', async () => {
    // Given, When
    await renderProjectRow();

    // Then
    expect(screen.getByRole('button', { name: 'teal', pressed: true })).toBeInTheDocument();
  });

  test('누른 즉시 반영되기 위해 응답을 기다리지 않고 누른 색을 고른 상태로 보인다', async () => {
    // Given: 응답을 붙잡아 둠
    const user = userEvent.setup();
    const gate = createResponseGate();
    respondToColorChange({ gate, isFailure: false });
    await renderProjectRow();

    // When
    await user.click(screen.getByRole('button', { name: 'rose' }));

    // Then
    expect(screen.getByRole('button', { name: 'rose', pressed: true })).toBeInTheDocument();
    expect(serverProjects).toEqual([BUDGET]);
    gate.release();
    await waitFor(() => expect(screen.queryByText('저장 중')).not.toBeInTheDocument());
  });

  test('저장된 색을 계속 보이기 위해 색 변경에 성공하면 누른 색이 고른 상태로 남는다', async () => {
    // Given
    const user = userEvent.setup();
    respondToColorChange({ isFailure: false });
    await renderProjectRow();

    // When: 저장과 목록 다시 받기가 끝날 때까지 기다림
    await user.click(screen.getByRole('button', { name: 'rose' }));
    await waitFor(() => expect(screen.queryByText('저장 중')).not.toBeInTheDocument());

    // Then
    expect(serverProjects).toEqual([{ ...BUDGET, color: 'rose' }]);
    expect(screen.getByRole('button', { name: 'rose', pressed: true })).toBeInTheDocument();
  });

  test('저장되지 않은 색이 남지 않게 하기 위해 색 변경이 실패하면 원래 색으로 돌아가고 오류 토스트를 띄운다', async () => {
    // Given
    const user = userEvent.setup();
    const gate = createResponseGate();
    respondToColorChange({ gate, isFailure: true });
    await renderProjectRow();

    // When: 누른 색이 먼저 보인 뒤 실패 응답이 옴
    await user.click(screen.getByRole('button', { name: 'rose' }));
    expect(screen.getByRole('button', { name: 'rose', pressed: true })).toBeInTheDocument();
    gate.release();

    // Then
    expect(
      await screen.findByText('색을 변경하지 못했습니다. 다시 시도해 주세요.'),
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'teal', pressed: true })).toBeInTheDocument();
  });
});

describe('프로젝트 이름 변경', () => {
  test('이름을 그 자리에서 고칠 수 있도록 수정을 누르면 이름이 입력칸으로, 버튼이 저장과 취소로 바뀐다', async () => {
    // Given, When
    const input = await renderEditingProjectRow();

    // Then
    expect(input).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '저장' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '취소' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '가계부 이름 수정' })).not.toBeInTheDocument();
  });

  test('바뀐 이름을 바로 확인할 수 있도록 저장에 성공하면 토스트 없이 입력칸을 닫고 새 이름을 보인다', async () => {
    // Given
    const user = userEvent.setup();
    respondToRename('success');
    const input = await renderEditingProjectRow();

    // When: 앞뒤에 공백을 붙여 입력하고 저장을 누름
    await user.clear(input);
    await user.type(input, '  생활비  ');
    await user.click(screen.getByRole('button', { name: '저장' }));

    // Then: 공백을 지운 이름으로 바뀜
    expect(await screen.findByRole('button', { name: '생활비 이름 수정' })).toBeInTheDocument();
    expect(screen.getByText('생활비')).toBeInTheDocument();
    expect(screen.queryByRole('textbox', { name: '가계부의 새 이름' })).not.toBeInTheDocument();
    expect(screen.queryByRole('listitem')).not.toBeInTheDocument();
  });

  test('마우스 없이 저장할 수 있도록 입력칸에서 Enter를 누르면 저장한다', async () => {
    // Given
    const user = userEvent.setup();
    respondToRename('success');
    const input = await renderEditingProjectRow();

    // When
    await user.clear(input);
    await user.type(input, '생활비{Enter}');

    // Then
    expect(await screen.findByRole('button', { name: '생활비 이름 수정' })).toBeInTheDocument();
  });

  test('필요 없는 요청을 보내지 않기 위해 이름이 그대로면 저장을 눌러도 요청 없이 입력칸을 닫는다', async () => {
    // Given: 요청이 나가면 실패해서 오류 토스트가 뜸
    const user = userEvent.setup();
    respondToRename('failure');
    const input = await renderEditingProjectRow();

    // When: 뒤에 공백만 덧붙이고 저장함
    await user.type(input, ' {Enter}');

    // Then: 요청이 나갔다면 실패 응답 때문에 입력칸이 닫히지 않았을 것임
    expect(screen.queryByRole('textbox', { name: '가계부의 새 이름' })).not.toBeInTheDocument();
    expect(screen.getByText('가계부')).toBeInTheDocument();
  });

  test('고치던 것을 버릴 수 있도록 취소를 누르면 입력한 글자를 버리고 원래 이름을 보인다', async () => {
    // Given
    const user = userEvent.setup();
    const input = await renderEditingProjectRow();
    await user.clear(input);
    await user.type(input, '생활비');

    // When
    await user.click(screen.getByRole('button', { name: '취소' }));

    // Then: 다시 열어도 원래 이름으로 채워짐
    expect(screen.getByText('가계부')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: '가계부 이름 수정' }));
    expect(screen.getByRole('textbox', { name: '가계부의 새 이름' })).toHaveValue('가계부');
  });

  test('마우스 없이 취소할 수 있도록 입력칸에서 ESC를 누르면 취소한다', async () => {
    // Given
    const user = userEvent.setup();
    const input = await renderEditingProjectRow();
    await user.clear(input);

    // When
    await user.type(input, '생활비{Escape}');

    // Then
    expect(screen.queryByRole('textbox', { name: '가계부의 새 이름' })).not.toBeInTheDocument();
    expect(screen.getByText('가계부')).toBeInTheDocument();
  });

  test('취소했는데 이름이 바뀌는 일이 없게 하기 위해 저장하는 중에는 ESC를 눌러도 닫지 않는다', async () => {
    // Given: 저장 응답을 붙잡아 둠
    const user = userEvent.setup();
    const gate = createResponseGate();
    server.use(
      http.patch('/api/projects/2', async () => {
        await gate.wait();

        return HttpResponse.json({ ...BUDGET, name: '생활비' });
      }),
    );
    const input = await renderEditingProjectRow();
    await user.clear(input);
    await user.type(input, '생활비{Enter}');
    await waitFor(() => {
      expect(screen.getByRole('button', { name: '저장' })).toBeDisabled();
    });

    // When
    await user.type(input, '{Escape}');

    // Then
    expect(input).toBeInTheDocument();
    gate.release();
    await waitFor(() => expect(screen.queryByText('저장 중')).not.toBeInTheDocument());
  });

  test('다시 열었을 때 지난 오류가 보이지 않게 하기 위해 취소하면 오류도 함께 버린다', async () => {
    // Given: 이름을 비우고 저장해서 오류가 보임
    const user = userEvent.setup();
    const input = await renderEditingProjectRow();
    await user.clear(input);
    await user.type(input, '{Enter}');
    await screen.findByRole('alert');

    // When: 취소한 뒤 다시 엶
    await user.click(screen.getByRole('button', { name: '취소' }));
    await user.click(screen.getByRole('button', { name: '가계부 이름 수정' }));

    // Then
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: '가계부의 새 이름' })).toBeValid();
  });
});
