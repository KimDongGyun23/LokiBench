import type { ProjectColor } from '@lokibench/contracts';

import { pickProjectColor } from './pick-project-color';

// 아카이브되지 않아 화면에 보이는 프로젝트를 만듦
function active(color: ProjectColor) {
  return { color, archivedAt: null };
}

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
    const projects = [active('indigo'), active('teal'), active('rose')];

    // When
    const color = pickProjectColor(projects);

    // Then: 안 쓰인 색 중 팔레트 순서가 가장 앞인 sky
    expect(color).toBe('sky');
  });

  test('동률이면 팔레트 순서가 앞인 색을 고른다', () => {
    // Given: 6색이 한 번씩 쓰이고 indigo만 한 번 더 쓰임
    const projects = [
      active('indigo'),
      active('sky'),
      active('teal'),
      active('violet'),
      active('rose'),
      active('orange'),
      active('indigo'),
    ];

    // When
    const color = pickProjectColor(projects);

    // Then
    expect(color).toBe('sky');
  });

  test('숨겨진 프로젝트 색은 화면에서 겹치지 않으므로 아카이브된 프로젝트는 세지 않는다', () => {
    // Given: sky는 아카이브된 프로젝트만 쓰고, 나머지 5색은 한 번씩 쓰임
    const projects = [
      { color: 'sky' as const, archivedAt: '2026-10-01T00:00:00.000Z' },
      active('indigo'),
      active('teal'),
      active('violet'),
      active('rose'),
      active('orange'),
    ];

    // When
    const color = pickProjectColor(projects);

    // Then
    expect(color).toBe('sky');
  });
});
