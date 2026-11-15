import { render, screen } from '@testing-library/react';

import { Field, FieldError } from './Field';

describe('입력칸 오류 문구', () => {
  test('오류가 생긴 것을 바로 알리기 위해 문구가 있으면 알림으로 보인다', () => {
    // Given, When
    render(
      <Field>
        <input aria-label="이름" />
        <FieldError>이름을 입력해 주세요.</FieldError>
      </Field>,
    );

    // Then
    expect(screen.getByRole('alert')).toHaveTextContent('이름을 입력해 주세요.');
  });

  test('빈 알림이 읽히지 않게 하기 위해 문구가 없으면 아무것도 그리지 않는다', () => {
    // Given, When
    render(
      <Field>
        <input aria-label="이름" />
        <FieldError>{undefined}</FieldError>
      </Field>,
    );

    // Then
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });
});
