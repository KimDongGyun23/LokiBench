import { cn } from './cn';

describe('클래스 병합', () => {
  test('주요 버튼 글자가 사라지지 않도록 컨트롤 글자 크기와 글자색을 서로 다른 속성으로 남긴다', () => {
    // When
    const merged = cn('text-primary-fg', 'text-control-md');

    // Then
    expect(merged).toBe('text-primary-fg text-control-md');
  });

  test('화면에서 크기를 바꿀 수 있도록 뒤에 준 높이, 글자 크기, 모서리가 컨트롤 크기를 대신한다', () => {
    // When
    const merged = cn('h-control-md text-control-md rounded-control-md', 'h-10 rounded-lg text-sm');

    // Then
    expect(merged).toBe('h-10 rounded-lg text-sm');
  });
});
