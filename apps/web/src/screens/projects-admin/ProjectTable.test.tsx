import type { Project } from '@lokibench/shared/contracts';
import { QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';

import { createQueryClient } from '@/lib/query-client';
import { server } from '@/test/server';

import { ProjectTable } from './ProjectTable';

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

/**
 * 받은 프로젝트 목록으로 표를 그린다.
 *
 * @param projects 표에 그릴 프로젝트 목록
 */
function renderProjectTable(projects: Project[]) {
  render(
    <QueryClientProvider client={createQueryClient()}>
      <ProjectTable projects={projects} />
    </QueryClientProvider>,
  );
}

/**
 * 프로젝트 행의 열린 이슈 칸에 보이는 글자를 읽는다.
 *
 * @param projectName 읽을 행의 프로젝트 이름
 * @returns 열린 이슈 칸의 글자
 */
function readOpenIssueCell(projectName: string) {
  const row = screen.getByRole('row', { name: new RegExp(projectName) });
  const openIssueColumnIndex = screen
    .getAllByRole('columnheader')
    .findIndex((header) => header.textContent === '열린 이슈');

  return within(row).getAllByRole('cell')[openIssueColumnIndex]?.textContent;
}

describe('프로젝트 표', () => {
  test('만든 순서를 그대로 믿을 수 있도록 프로젝트를 받은 순서대로 한 줄씩 보인다', () => {
    // Given, When: 만든 순서대로 프로젝트 3개를 받음
    renderProjectTable(PROJECTS);

    // Then: 첫 줄은 표 머리이고, 줄마다 이름 뒤에 수정 버튼이 붙음
    const rows = screen.getAllByRole('row');
    expect(rows.map((row) => row.textContent)).toEqual([
      '프로젝트색상열린 이슈이름 수정',
      '독서 기록수정',
      '가계부수정',
      '블로그수정',
    ]);
  });

  test('빈 표가 고장으로 보이지 않게 하기 위해 프로젝트가 없으면 어디서 추가하는지 안내한다', () => {
    // Given, When: 프로젝트가 없음
    renderProjectTable([]);

    // Then
    expect(
      screen.getByText('아직 프로젝트가 없습니다. 아래에서 새 프로젝트를 추가해 주세요.'),
    ).toBeInTheDocument();
  });

  test('쓰던 이름을 잃지 않게 하기 위해 한 행을 고치는 동안에는 다른 행의 수정을 누를 수 없다', async () => {
    // Given
    const user = userEvent.setup();
    renderProjectTable(PROJECTS);

    // When: 가계부의 이름을 고치기 시작함
    await user.click(screen.getByRole('button', { name: '가계부 이름 수정' }));

    // Then
    expect(screen.getByRole('button', { name: '독서 기록 이름 수정' })).toBeDisabled();
    expect(screen.getByRole('button', { name: '블로그 이름 수정' })).toBeDisabled();
  });

  test('이어서 다른 이름을 고칠 수 있도록 고치기를 끝내면 모든 행의 수정을 다시 누를 수 있다', async () => {
    // Given: 가계부의 이름을 고치는 중임
    const user = userEvent.setup();
    renderProjectTable(PROJECTS);
    await user.click(screen.getByRole('button', { name: '가계부 이름 수정' }));

    // When
    await user.click(screen.getByRole('button', { name: '취소' }));

    // Then
    expect(screen.getByRole('button', { name: '독서 기록 이름 수정' })).toBeEnabled();
    expect(screen.getByRole('button', { name: '가계부 이름 수정' })).toBeEnabled();
    expect(screen.getByRole('button', { name: '블로그 이름 수정' })).toBeEnabled();
  });
});

describe('프로젝트 표의 열린 이슈 열', () => {
  test('남은 일의 양을 보이도록 받은 수를 보이고 목록에 없는 프로젝트는 0으로 보인다', async () => {
    // Given: 독서 기록만 열린 이슈가 3건 있음
    server.use(
      http.get('/api/issues/open-counts', () => HttpResponse.json([{ projectId: 1, count: 3 }])),
    );

    // When
    renderProjectTable(PROJECTS);

    // Then
    await waitFor(() => expect(readOpenIssueCell('독서 기록')).toBe('3'));
    expect(readOpenIssueCell('가계부')).toBe('0');
    expect(readOpenIssueCell('블로그')).toBe('0');
  });

  test('숫자 하나 때문에 표를 막지 않도록 수를 받지 못하면 표는 그대로 두고 칸만 비운다', async () => {
    // Given: 수 조회에 서버가 응답하지 않음
    let openCountRequestCount = 0;
    server.use(
      http.get('/api/issues/open-counts', () => {
        openCountRequestCount += 1;
        return HttpResponse.error();
      }),
    );

    // When
    renderProjectTable(PROJECTS);
    await waitFor(() => expect(openCountRequestCount).toBe(1));

    // Then
    expect(screen.getByRole('button', { name: '가계부 이름 수정' })).toBeEnabled();
    expect(readOpenIssueCell('독서 기록')).toBe('');
    expect(readOpenIssueCell('가계부')).toBe('');
  });

  test('고치는 중에도 남은 일을 볼 수 있도록 이름을 고치는 행에도 수를 보인다', async () => {
    // Given: 독서 기록에 열린 이슈가 3건 있음
    const user = userEvent.setup();
    server.use(
      http.get('/api/issues/open-counts', () => HttpResponse.json([{ projectId: 1, count: 3 }])),
    );
    renderProjectTable(PROJECTS);
    await waitFor(() => expect(readOpenIssueCell('독서 기록')).toBe('3'));

    // When
    await user.click(screen.getByRole('button', { name: '독서 기록 이름 수정' }));

    // Then
    expect(screen.getByRole('textbox', { name: '독서 기록의 새 이름' })).toBeInTheDocument();
    expect(readOpenIssueCell('독서 기록')).toBe('3');
  });
});
