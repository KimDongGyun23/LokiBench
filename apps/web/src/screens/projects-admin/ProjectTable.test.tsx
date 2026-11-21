import type { Project } from '@lokibench/contracts';
import { QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { createQueryClient } from '@/lib/query-client';

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

describe('프로젝트 표', () => {
  test('만든 순서를 그대로 믿을 수 있도록 프로젝트를 받은 순서대로 한 줄씩 보인다', () => {
    // Given, When: 만든 순서대로 프로젝트 3개를 받음
    renderProjectTable(PROJECTS);

    // Then: 첫 줄은 표 머리이고, 줄마다 이름 뒤에 수정 버튼이 붙음
    const rows = screen.getAllByRole('row');
    expect(rows.map((row) => row.textContent)).toEqual([
      '프로젝트색상이름 수정',
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
