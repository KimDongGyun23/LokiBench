import { act, render, screen } from '@testing-library/react';
import { toast } from 'sonner';

import { notify } from '@/lib/toast';

import { Toaster } from './Toaster';

/**
 * 가짜 시계를 주어진 시간만큼 돌린다.
 */
function advance(ms: number): void {
  act(() => {
    vi.advanceTimersByTime(ms);
  });
}

beforeEach(() => {
  vi.useFakeTimers();
});

// sonner는 토스트 목록을 모듈 전역에 들고 있어서, 남은 토스트가 다음 테스트에 보이지 않게 지움
afterEach(() => {
  act(() => {
    toast.dismiss();
  });
  advance(1000);
  vi.useRealTimers();
});

describe('토스트 닫힘', () => {
  test('화면을 계속 가리지 않도록 완료 토스트는 3초 뒤 스스로 닫힌다', () => {
    // Given
    render(<Toaster />);
    act(() => {
      notify.success('프로젝트 가계부 추가됨');
    });
    advance(2900);
    expect(screen.getByText('프로젝트 가계부 추가됨')).toBeInTheDocument();

    // When
    advance(1000);

    // Then
    expect(screen.queryByText('프로젝트 가계부 추가됨')).not.toBeInTheDocument();
  });

  test('닫는 동작을 따로 요구하지 않도록 오류 토스트도 3초 뒤 스스로 닫힌다', () => {
    // Given
    render(<Toaster />);
    act(() => {
      notify.error('색을 바꾸지 못함');
    });
    advance(2900);
    expect(screen.getByText('색을 바꾸지 못함')).toBeInTheDocument();

    // When
    advance(1000);

    // Then
    expect(screen.queryByText('색을 바꾸지 못함')).not.toBeInTheDocument();
  });

  test('긴 문구를 읽을 시간을 주기 위해 long 단계를 넘겨받으면 8초까지 남는다', () => {
    // Given
    render(<Toaster />);
    act(() => {
      notify.error('같은 이름의 프로젝트가 이미 있음', { duration: 'long' });
    });

    // When: 기본 3초를 한참 넘김
    advance(7900);

    // Then
    expect(screen.getByText('같은 이름의 프로젝트가 이미 있음')).toBeInTheDocument();

    // When: 8초를 넘김
    advance(1000);

    // Then
    expect(screen.queryByText('같은 이름의 프로젝트가 이미 있음')).not.toBeInTheDocument();
  });
});

describe('토스트 종류', () => {
  test('색을 구분하지 못해도 결과를 알 수 있도록 완료 토스트에 이름 있는 완료 아이콘이 붙는다', () => {
    // Given
    render(<Toaster />);

    // When
    act(() => {
      notify.success('프로젝트 가계부 추가됨');
    });
    advance(100);

    // Then
    expect(screen.getByRole('img', { name: '완료' })).toBeInTheDocument();
    expect(screen.queryByRole('img', { name: '오류' })).not.toBeInTheDocument();
  });

  test('실패를 완료로 읽지 않도록 오류 토스트에 이름 있는 오류 아이콘이 붙는다', () => {
    // Given
    render(<Toaster />);

    // When
    act(() => {
      notify.error('색을 바꾸지 못함');
    });
    advance(100);

    // Then
    expect(screen.getByRole('img', { name: '오류' })).toBeInTheDocument();
    expect(screen.queryByRole('img', { name: '완료' })).not.toBeInTheDocument();
  });
});
