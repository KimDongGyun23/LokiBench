import { createProjectRequestSchema, type Project } from '@lokibench/contracts';
import { QueryClientProvider } from '@tanstack/react-query';
import { act, fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { toast } from 'sonner';

import { Toaster } from '@/components/Toaster';
import { createQueryClient } from '@/lib/query-client';
import { server } from '@/test/server';

import { CreateProjectForm } from './CreateProjectForm';

// 추가 요청에 서버가 어떻게 답할지
type CreateResponsePlan = 'success' | 'nameTaken' | 'failure';

/**
 * 프로젝트 추가 요청에 정한 대로 답하게 한다.
 *
 * - 성공으로 답하면 요청에 담긴 이름 그대로 새 프로젝트를 돌려준다
 *
 * @param plan 성공, 같은 이름 거절, 그 밖의 실패 중 하나
 */
function respondToCreate(plan: CreateResponsePlan) {
  server.use(
    http.get('/api/projects', () => HttpResponse.json([])),
    http.post('/api/projects', async ({ request }) => {
      if (plan === 'nameTaken') {
        return HttpResponse.json({ code: 'PROJECT_NAME_TAKEN', message: 'taken' }, { status: 409 });
      }
      if (plan === 'failure') {
        return HttpResponse.json({ code: 'INTERNAL', message: 'boom' }, { status: 500 });
      }

      const { name } = createProjectRequestSchema.parse(await request.json());
      const project: Project = {
        id: 4,
        name,
        color: 'sky',
        createdAt: '2026-10-04T00:00:00.000Z',
        archivedAt: null,
      };

      return HttpResponse.json(project, { status: 201 });
    }),
  );
}

/**
 * 추가 줄을 그리고 이름 입력칸을 돌려준다.
 *
 * @returns 이름 입력칸
 */
function renderCreateProjectForm() {
  render(
    <QueryClientProvider client={createQueryClient()}>
      <CreateProjectForm />
      <Toaster />
    </QueryClientProvider>,
  );

  return screen.getByRole('textbox', { name: '프로젝트 이름' });
}

// sonner는 토스트 목록을 모듈 전역에 들고 있어서, 남은 토스트가 다음 테스트에 보이지 않게 지움
afterEach(() => {
  act(() => {
    toast.dismiss();
  });
});

describe('프로젝트 추가', () => {
  test('추가된 것을 알리고 이어서 입력할 수 있도록 성공하면 완료 토스트를 띄우고 입력칸을 비운다', async () => {
    // Given
    const user = userEvent.setup();
    respondToCreate('success');
    const input = renderCreateProjectForm();

    // When: 앞뒤에 공백을 붙여 입력하고 추가를 누름
    await user.type(input, '  블로그  ');
    await user.click(screen.getByRole('button', { name: '추가' }));

    // Then: 공백을 지운 이름으로 추가됨
    expect(await screen.findByText('블로그 프로젝트를 추가했습니다.')).toBeInTheDocument();
    expect(input).toHaveValue('');
  });

  test('마우스 없이 추가할 수 있도록 입력칸에서 Enter를 누르면 추가한다', async () => {
    // Given
    const user = userEvent.setup();
    respondToCreate('success');
    const input = renderCreateProjectForm();

    // When
    await user.type(input, '블로그{Enter}');

    // Then
    expect(await screen.findByText('블로그 프로젝트를 추가했습니다.')).toBeInTheDocument();
  });

  test('쓰다 만 이름이 추가되지 않게 하기 위해 한글 조합 중의 Enter로는 추가하지 않는다', async () => {
    // Given
    const user = userEvent.setup();
    respondToCreate('success');
    const input = renderCreateProjectForm();
    await user.type(input, '블로그');

    // When: 조합 중에 Enter를 누름
    fireEvent.keyDown(input, { key: 'Enter', isComposing: true });

    // Then
    expect(input).toHaveValue('블로그');
    expect(screen.queryByText('블로그 프로젝트를 추가했습니다.')).not.toBeInTheDocument();
  });

  test('길이 오류 문구를 없애기 위해 입력칸이 40자를 넘는 입력을 막는다', () => {
    // Given, When
    const input = renderCreateProjectForm();

    // Then
    expect(input).toHaveAttribute('maxLength', '40');
  });
});

describe('프로젝트 추가 오류', () => {
  test('보낼 필요 없는 요청을 막기 위해 이름이 비어 있으면 입력칸 아래에 오류를 보인다', async () => {
    // Given
    const user = userEvent.setup();
    respondToCreate('success');
    const input = renderCreateProjectForm();

    // When: 공백만 입력하고 추가를 누름
    await user.type(input, '   ');
    await user.click(screen.getByRole('button', { name: '추가' }));

    // Then
    expect(input).toBeInvalid();
    expect(input).toHaveAccessibleDescription('이름을 입력해 주세요.');
  });

  test('고친 뒤에도 오류가 남아 보이지 않게 하기 위해 입력이 바뀌면 오류를 지운다', async () => {
    // Given: 빈 이름 오류가 보임
    const user = userEvent.setup();
    const input = renderCreateProjectForm();
    await user.click(screen.getByRole('button', { name: '추가' }));
    expect(input).toBeInvalid();

    // When
    await user.type(input, '블');

    // Then
    expect(input).toBeValid();
    expect(screen.queryByText('이름을 입력해 주세요.')).not.toBeInTheDocument();
  });

  test('이름을 고쳐 다시 시도할 수 있도록 같은 이름이 있으면 글자를 남긴 채 입력칸 아래에 오류를 보인다', async () => {
    // Given
    const user = userEvent.setup();
    respondToCreate('nameTaken');
    const input = renderCreateProjectForm();

    // When
    await user.type(input, '가계부{Enter}');

    // Then: 토스트가 아니라 입력칸의 설명으로 보임
    expect(await screen.findByText('같은 이름의 프로젝트가 이미 있습니다.')).toBeInTheDocument();
    expect(input).toBeInvalid();
    expect(input).toHaveAccessibleDescription('같은 이름의 프로젝트가 이미 있습니다.');
    expect(input).toHaveValue('가계부');
  });

  test('입력한 이름을 잃지 않도록 그 밖의 실패에는 글자를 남긴 채 오류 토스트를 띄운다', async () => {
    // Given
    const user = userEvent.setup();
    respondToCreate('failure');
    const input = renderCreateProjectForm();

    // When
    await user.type(input, '블로그{Enter}');

    // Then
    expect(await screen.findByText('프로젝트를 추가하지 못했습니다.')).toBeInTheDocument();
    expect(input).toHaveValue('블로그');
    expect(input).toBeValid();
  });
});
