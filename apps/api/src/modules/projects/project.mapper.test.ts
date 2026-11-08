import { projectSchema } from '@lokibench/contracts';

import { toProjectResponse } from './project.mapper';

describe('프로젝트 응답 모양', () => {
  test('JSON에는 날짜 타입이 없으므로 시각을 계약의 ISO 문자열로 바꿔 준다', () => {
    // Given
    const project = {
      id: 1,
      name: '독서 기록',
      color: 'indigo' as const,
      createdAt: new Date('2026-10-01T00:00:00.000Z'),
      archivedAt: new Date('2026-10-02T00:00:00.000Z'),
    };

    // When
    const response = toProjectResponse(project);

    // Then: 계약 스키마를 통과하고 시각은 UTC ISO 문자열임
    expect(projectSchema.parse(response)).toEqual({
      id: 1,
      name: '독서 기록',
      color: 'indigo',
      createdAt: '2026-10-01T00:00:00.000Z',
      archivedAt: '2026-10-02T00:00:00.000Z',
    });
  });

  test('아카이브되지 않은 프로젝트는 아카이브 시각을 null로 준다', () => {
    // Given
    const project = {
      id: 1,
      name: '가계부',
      color: 'teal' as const,
      createdAt: new Date('2026-10-01T00:00:00.000Z'),
      archivedAt: null,
    };

    // When
    const response = toProjectResponse(project);

    // Then
    expect(response.archivedAt).toBeNull();
  });
});
