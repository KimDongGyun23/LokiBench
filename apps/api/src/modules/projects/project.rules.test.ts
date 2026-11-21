import type { ProjectColor } from '@lokibench/domain';

import { pickProjectColor } from './project.rules';

describe('새 프로젝트 색 자동 배정', () => {
  test('첫 프로젝트는 팔레트 첫 색인 indigo를 받는다', () => {
    // Given: 프로젝트가 하나도 없음
    const projects: never[] = [];

    // When
    const color = pickProjectColor(projects);

    // Then
    expect(color).toBe('indigo');
  });

  test('색 구분을 넓히기 위해 가장 적게 쓰인 색을 고른다', () => {
    // Given: indigo, teal, rose가 한 번씩 쓰임
    const projects: { color: ProjectColor }[] = [
      { color: 'indigo' },
      { color: 'teal' },
      { color: 'rose' },
    ];

    // When
    const color = pickProjectColor(projects);

    // Then: 안 쓰인 색 중 팔레트 순서가 가장 앞인 sky
    expect(color).toBe('sky');
  });

  test('동률이면 팔레트 순서가 앞인 색을 고른다', () => {
    // Given: 6색이 한 번씩 쓰이고 indigo만 한 번 더 쓰임
    const projects: { color: ProjectColor }[] = [
      { color: 'indigo' },
      { color: 'sky' },
      { color: 'teal' },
      { color: 'violet' },
      { color: 'rose' },
      { color: 'orange' },
      { color: 'indigo' },
    ];

    // When
    const color = pickProjectColor(projects);

    // Then
    expect(color).toBe('sky');
  });
});
