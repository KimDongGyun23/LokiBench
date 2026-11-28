import { milestoneSchema } from '@lokibench/shared/contracts';

import type { MilestoneEntity } from './milestone.entity';
import { toMilestoneModel, toMilestoneResponse } from './milestone.mapper';

// DB에서 읽은 닫힌 마일스톤 행
const CLOSED_ENTITY = {
  id: 4,
  projectId: 1,
  title: '독서 목록 정리',
  startDate: '2026-11-01',
  due: '2026-11-20',
  background: '- 읽은 책이 흩어져 있음',
  solution: '',
  expectedEffect: '',
  memo: '',
  createdAt: '2026-10-25T00:00:00.000Z',
  closedAt: '2026-11-21T09:00:00.000Z',
  deletedAt: null,
} satisfies MilestoneEntity;

describe('도메인 마일스톤 모양', () => {
  test('도메인이 시각으로 바로 계산하도록 DB의 ISO 문자열을 Date로 바꾸고 날짜는 그대로 둔다', () => {
    // When
    const milestone = toMilestoneModel(CLOSED_ENTITY);

    // Then: 지운 표시는 도메인에 올라오지 않음
    expect(milestone).toEqual({
      id: 4,
      projectId: 1,
      title: '독서 목록 정리',
      startDate: '2026-11-01',
      due: '2026-11-20',
      background: '- 읽은 책이 흩어져 있음',
      solution: '',
      expectedEffect: '',
      memo: '',
      createdAt: new Date('2026-10-25T00:00:00.000Z'),
      closedAt: new Date('2026-11-21T09:00:00.000Z'),
    });
  });

  test('열린 마일스톤이 닫힌 것으로 보이지 않도록 닫은 시각이 없으면 null로 둔다', () => {
    expect(toMilestoneModel({ ...CLOSED_ENTITY, closedAt: null }).closedAt).toBeNull();
  });

  test('어느 행이 깨졌는지 알 수 있도록 읽을 수 없는 시각은 열 이름과 id를 담아 던진다', () => {
    // When
    const attempt = () => toMilestoneModel({ ...CLOSED_ENTITY, closedAt: '2026-11-21' });

    // Then
    expect(attempt).toThrow('milestones.closed_at 시각 형식이 잘못됨: id=4');
  });
});

describe('마일스톤 응답 모양', () => {
  test('JSON에는 날짜 타입이 없으므로 시각을 계약의 ISO 문자열로 바꾸고 날짜는 그대로 둔다', () => {
    // Given
    const milestone = toMilestoneModel(CLOSED_ENTITY);

    // When
    const response = toMilestoneResponse(milestone);

    // Then: 계약 스키마를 통과하고 DB에 있던 글자와 같음
    expect(milestoneSchema.parse(response)).toEqual({
      id: 4,
      projectId: 1,
      title: '독서 목록 정리',
      startDate: '2026-11-01',
      due: '2026-11-20',
      background: '- 읽은 책이 흩어져 있음',
      solution: '',
      expectedEffect: '',
      memo: '',
      createdAt: '2026-10-25T00:00:00.000Z',
      closedAt: '2026-11-21T09:00:00.000Z',
    });
  });

  test('열린 마일스톤이 닫힌 것으로 보이지 않도록 닫은 시각이 없으면 null로 준다', () => {
    // Given
    const milestone = toMilestoneModel({ ...CLOSED_ENTITY, closedAt: null });

    // When
    const response = toMilestoneResponse(milestone);

    // Then
    expect(response.closedAt).toBeNull();
  });
});
