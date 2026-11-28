import { type Project, updateProjectRequestSchema } from '@lokibench/shared/contracts';
import { QueryClientProvider } from '@tanstack/react-query';
import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { delay, http, HttpResponse } from 'msw';
import { toast } from 'sonner';

import { Toaster } from '@/components/Toaster';
import { createQueryClient } from '@/lib/query-client';
import { server } from '@/test/server';

import { ProjectEditRow } from './ProjectEditRow';

const BUDGET: Project = {
  id: 2,
  name: '가계부',
  color: 'teal',
  createdAt: '2026-10-02T00:00:00.000Z',
};

// sonner는 토스트 목록을 모듈 전역에 들고 있어서, 남은 토스트가 다음 테스트에 보이지 않게 지움
afterEach(() => {
  act(() => {
    toast.dismiss();
  });
});

// 이름 변경 요청에 서버가 어떻게 답할지
type RenameResponsePlan = 'slowSuccess' | 'nameTaken' | 'failure';

/**
 * 가계부의 이름 변경 요청에 정한 대로 답하게 한다.
 *
 * @param plan 늦은 성공, 같은 이름 거절, 그 밖의 실패 중 하나
 */
function respondToRename(plan: RenameResponsePlan) {
  server.use(
    http.get('/api/projects', () => HttpResponse.json([BUDGET])),
    http.patch('/api/projects/2', async ({ request }) => {
      if (plan === 'nameTaken') {
        return HttpResponse.json({ code: 'PROJECT_NAME_TAKEN', message: 'taken' }, { status: 409 });
      }
      if (plan === 'failure') {
        return HttpResponse.json({ code: 'INTERNAL', message: 'boom' }, { status: 500 });
      }

      await delay(200);
      const { name } = updateProjectRequestSchema.parse(await request.json());

      return HttpResponse.json({ ...BUDGET, name });
    }),
  );
}

/**
 * 가계부의 이름을 고치는 행을 그리고 이름 입력칸을 돌려준다.
 *
 * @returns 이름 입력칸
 */
function renderProjectEditRow() {
  render(
    <QueryClientProvider client={createQueryClient()}>
      <table>
        <tbody>
          <ProjectEditRow
            project={BUDGET}
            openIssueCount={undefined}
            color={BUDGET.color}
            onColorChange={() => undefined}
            onEditEnd={() => undefined}
          />
        </tbody>
      </table>
      <Toaster />
    </QueryClientProvider>,
  );

  return screen.getByRole('textbox', { name: '가계부의 새 이름' });
}

describe('프로젝트 이름 고치는 행', () => {
  test('고칠 이름을 바로 손볼 수 있도록 입력칸을 지금 이름으로 채우고 포커스를 준다', () => {
    // Given, When
    const input = renderProjectEditRow();

    // Then
    expect(input).toHaveValue('가계부');
    expect(input).toHaveFocus();
  });

  test('같은 저장이 두 번 나가지 않게 하기 위해 저장하는 중에는 저장 버튼과 입력을 막는다', async () => {
    // Given: 저장 응답이 늦게 옴
    const user = userEvent.setup();
    respondToRename('slowSuccess');
    const input = renderProjectEditRow();
    await user.clear(input);

    // When
    await user.type(input, '생활비{Enter}');

    // Then
    await waitFor(() => {
      expect(screen.getByRole('button', { name: '저장' })).toBeDisabled();
    });
    expect(input).toHaveAttribute('readonly');
  });

  test('취소했는데 이름이 바뀌는 일이 없게 하기 위해 저장하는 중에는 취소 버튼을 막는다', async () => {
    // Given: 저장 응답이 늦게 옴
    const user = userEvent.setup();
    respondToRename('slowSuccess');
    const input = renderProjectEditRow();
    await user.clear(input);

    // When
    await user.type(input, '생활비{Enter}');

    // Then
    await waitFor(() => {
      expect(screen.getByRole('button', { name: '취소' })).toBeDisabled();
    });
  });

  test('이름 없는 프로젝트가 생기지 않게 하기 위해 이름을 비우고 저장하면 입력칸 아래에 오류를 보인다', async () => {
    // Given
    const user = userEvent.setup();
    const input = renderProjectEditRow();

    // When
    await user.clear(input);
    await user.type(input, '   {Enter}');

    // Then
    expect(screen.getByRole('alert')).toHaveTextContent('이름을 입력해 주세요.');
    expect(input).toBeInvalid();
  });

  test('고쳐서 다시 저장할 수 있도록 같은 이름이 이미 있으면 토스트 대신 입력칸을 연 채 아래에 오류를 보인다', async () => {
    // Given
    const user = userEvent.setup();
    respondToRename('nameTaken');
    const input = renderProjectEditRow();

    // When
    await user.clear(input);
    await user.type(input, '독서 기록{Enter}');

    // Then
    expect(await screen.findByRole('alert')).toHaveTextContent(
      '같은 이름의 프로젝트가 이미 있습니다.',
    );
    expect(input).toBeInvalid();
    expect(input).toHaveValue('독서 기록');
    expect(screen.queryByRole('listitem')).not.toBeInTheDocument();
  });

  test('고친 뒤에 지난 오류가 남지 않게 하기 위해 고친 이름이 규칙에 맞으면 오류를 지운다', async () => {
    // Given: 같은 이름 오류가 보임
    const user = userEvent.setup();
    respondToRename('nameTaken');
    const input = renderProjectEditRow();
    await user.clear(input);
    await user.type(input, '독서 기록{Enter}');
    await screen.findByRole('alert');

    // When
    await user.type(input, '장');

    // Then
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(input).toBeValid();
  });

  test('다시 시도할 수 있도록 그 밖의 이유로 실패하면 오류 토스트를 띄우고 입력한 글자를 남긴다', async () => {
    // Given
    const user = userEvent.setup();
    respondToRename('failure');
    const input = renderProjectEditRow();

    // When
    await user.clear(input);
    await user.type(input, '생활비{Enter}');

    // Then
    expect(
      await screen.findByText('이름을 변경하지 못했습니다. 다시 시도해 주세요.'),
    ).toBeInTheDocument();
    expect(input).toHaveValue('생활비');
  });

  test('길이 오류가 생기지 않게 하기 위해 입력칸이 40자를 넘는 입력을 막는다', () => {
    // Given, When
    const input = renderProjectEditRow();

    // Then
    expect(input).toHaveAttribute('maxLength', '40');
  });
});
