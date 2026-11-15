import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';

import type { ProjectColor } from '@/domains/projects/colors.constant';

import { ColorPicker } from './ColorPicker';

interface ColorPickerHarnessProps {
  initialColor: ProjectColor;
}

/**
 * 고른 색을 들고 있다가 색 선택에 다시 넘기고, 색이 바뀐 횟수를 화면에 적는다.
 */
function ColorPickerHarness({ initialColor }: ColorPickerHarnessProps) {
  const [color, setColor] = useState(initialColor);
  const [changeCount, setChangeCount] = useState(0);

  const handleChange = (nextColor: ProjectColor) => {
    setColor(nextColor);
    setChangeCount((count) => count + 1);
  };

  return (
    <>
      <ColorPicker
        value={color}
        onChange={handleChange}
      />
      <p>변경 {changeCount}번</p>
    </>
  );
}

describe('프로젝트 색 선택', () => {
  test('고를 수 있는 색을 모두 알리기 위해 팔레트 6색을 정해진 순서의 버튼으로 보인다', () => {
    // Given, When
    render(<ColorPickerHarness initialColor="indigo" />);

    // Then
    const colorNames = screen
      .getAllByRole('button')
      .map((button) => button.getAttribute('aria-label'));
    expect(colorNames).toEqual(['indigo', 'sky', 'teal', 'violet', 'rose', 'orange']);
  });

  test('지금 색을 알리기 위해 현재 색의 버튼만 눌린 상태로 표시한다', () => {
    // Given, When
    render(<ColorPickerHarness initialColor="teal" />);

    // Then
    expect(screen.getAllByRole('button', { pressed: true })).toHaveLength(1);
    expect(screen.getByRole('button', { name: 'teal', pressed: true })).toBeInTheDocument();
  });

  test('누른 색으로 바꾸기 위해 다른 색을 누르면 그 색이 눌린 상태가 된다', async () => {
    // Given
    const user = userEvent.setup();
    render(<ColorPickerHarness initialColor="teal" />);

    // When
    await user.click(screen.getByRole('button', { name: 'rose' }));

    // Then
    expect(screen.getByRole('button', { name: 'rose', pressed: true })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'teal', pressed: false })).toBeInTheDocument();
    expect(screen.getByText('변경 1번')).toBeInTheDocument();
  });

  test('쓸모없는 저장 요청을 막기 위해 이미 고른 색을 다시 눌러도 변경을 알리지 않는다', async () => {
    // Given
    const user = userEvent.setup();
    render(<ColorPickerHarness initialColor="teal" />);

    // When
    await user.click(screen.getByRole('button', { name: 'teal' }));

    // Then
    expect(screen.getByText('변경 0번')).toBeInTheDocument();
  });
});
