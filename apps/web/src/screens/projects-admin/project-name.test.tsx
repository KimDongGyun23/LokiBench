import { fireEvent, render, screen } from '@testing-library/react';

import { EMPTY_NAME_MESSAGE, isSubmitKey, validateProjectName } from './project-name';

describe('프로젝트 이름 검사', () => {
  test('서버와 같은 이름으로 저장하기 위해 앞뒤 공백을 지운 이름을 돌려준다', () => {
    // When
    const result = validateProjectName('  독서 기록  ');

    // Then
    expect(result).toEqual({ isValid: true, name: '독서 기록' });
  });

  test('보낼 필요 없는 요청을 막기 위해 공백뿐인 이름은 비어 있다는 문구와 함께 거절한다', () => {
    // When
    const result = validateProjectName('   ');

    // Then
    expect(result).toEqual({ isValid: false, message: EMPTY_NAME_MESSAGE });
  });

  test('가운데 공백이 다른 이름을 구분하기 위해 이름 안쪽 공백은 그대로 둔다', () => {
    // When
    const result = validateProjectName('독서  기록');

    // Then
    expect(result).toEqual({ isValid: true, name: '독서  기록' });
  });
});

describe('제출 키 판단', () => {
  /**
   * 입력칸 하나를 그리고, 누른 키마다 제출 키였는지를 모아 돌려준다.
   */
  function renderInput(): boolean[] {
    const results: boolean[] = [];
    render(
      <input
        aria-label="이름"
        onKeyDown={(event) => results.push(isSubmitKey(event))}
      />,
    );

    return results;
  }

  test('키보드만으로 제출하기 위해 Enter는 제출 키로 본다', () => {
    // Given
    const results = renderInput();

    // When
    fireEvent.keyDown(screen.getByLabelText('이름'), { key: 'Enter' });

    // Then
    expect(results).toEqual([true]);
  });

  test('한글 마지막 글자가 두 번 제출되지 않게 하기 위해 조합 중 Enter는 제출 키로 보지 않는다', () => {
    // Given
    const results = renderInput();

    // When
    fireEvent.keyDown(screen.getByLabelText('이름'), { key: 'Enter', isComposing: true });

    // Then
    expect(results).toEqual([false]);
  });

  test('글자 입력을 제출로 오해하지 않기 위해 Enter가 아닌 키는 제출 키로 보지 않는다', () => {
    // Given
    const results = renderInput();

    // When
    fireEvent.keyDown(screen.getByLabelText('이름'), { key: 'a' });

    // Then
    expect(results).toEqual([false]);
  });
});
