import { projectSchema } from '@lokibench/shared/contracts';

import { toProjectModel, toProjectResponse } from './project.mapper';

describe('도메인 모양', () => {
  test('도메인이 시각으로 바로 계산하도록 DB의 ISO 문자열을 Date로 바꿔 준다', () => {
    // Given: DB에서 읽은 행
    const entity = {
      id: 1,
      name: '이사 준비',
      color: 'sky' as const,
      createdAt: '2026-10-01T00:00:00.000Z',
    };

    // When
    const project = toProjectModel(entity);

    // Then
    expect(project).toEqual({
      id: 1,
      name: '이사 준비',
      color: 'sky',
      createdAt: new Date('2026-10-01T00:00:00.000Z'),
    });
  });

  test('DB를 직접 고쳐 깨진 행을 바로 찾도록 시각으로 읽을 수 없으면 행 id와 열 이름을 담아 던진다', () => {
    // Given: 시각으로 읽을 수 없는 created_at
    const entity = { id: 7, name: '가계부', color: 'teal' as const, createdAt: '' };

    // When
    const attempt = () => toProjectModel(entity);

    // Then
    expect(attempt).toThrow('projects.created_at 시각 형식이 잘못됨: id=7');
  });
});

describe('프로젝트 응답 모양', () => {
  test('JSON에는 날짜 타입이 없으므로 시각을 계약의 ISO 문자열로 바꿔 준다', () => {
    // Given
    const project = {
      id: 1,
      name: '독서 기록',
      color: 'indigo' as const,
      createdAt: new Date('2026-10-01T00:00:00.000Z'),
    };

    // When
    const response = toProjectResponse(project);

    // Then: 계약 스키마를 통과하고 시각은 UTC ISO 문자열임
    expect(projectSchema.parse(response)).toEqual({
      id: 1,
      name: '독서 기록',
      color: 'indigo',
      createdAt: '2026-10-01T00:00:00.000Z',
    });
  });
});
