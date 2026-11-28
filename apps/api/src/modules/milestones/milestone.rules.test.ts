import type { Milestone } from './milestone.model';
import {
  assertCanCloseMilestone,
  assertCanDeleteMilestone,
  sortMilestones,
} from './milestone.rules';

// 바꿀 칸만 넘겨받아 독서 기록 프로젝트의 열린 마일스톤을 만듦
function milestone(overrides: Partial<Milestone> & Pick<Milestone, 'id'>): Milestone {
  return {
    projectId: 1,
    title: `마일스톤 ${overrides.id}`,
    startDate: null,
    due: null,
    background: '',
    solution: '',
    expectedEffect: '',
    memo: '',
    createdAt: new Date('2026-11-01T00:00:00.000Z'),
    closedAt: null,
    ...overrides,
  };
}

describe('마일스톤 닫기', () => {
  test('닫힌 마일스톤에 할 일이 남지 않도록 열린 이슈가 있으면 남은 번호를 담아 거부한다', () => {
    // When
    const attempt = () => assertCanCloseMilestone({ issueCount: 3, openIssueNumbers: [18, 22] });

    // Then
    expect(attempt).toThrow(
      expect.objectContaining({
        code: 'MILESTONE_HAS_OPEN_ISSUES',
        details: { openIssueNumbers: [18, 22] },
      }),
    );
  });

  test('일이 모두 끝났으면 닫을 수 있도록 이슈가 모두 닫혔으면 허용한다', () => {
    expect(() => assertCanCloseMilestone({ issueCount: 2, openIssueNumbers: [] })).not.toThrow();
  });

  test('계획만 세우고 접은 마일스톤도 닫을 수 있도록 이슈가 없으면 허용한다', () => {
    expect(() => assertCanCloseMilestone({ issueCount: 0, openIssueNumbers: [] })).not.toThrow();
  });
});

describe('마일스톤 삭제', () => {
  test('끝난 이슈의 기록을 잃지 않도록 닫힌 이슈만 있어도 이슈 수를 담아 거부한다', () => {
    // When
    const attempt = () => assertCanDeleteMilestone({ issueCount: 1, openIssueNumbers: [] });

    // Then
    expect(attempt).toThrow(
      expect.objectContaining({ code: 'MILESTONE_HAS_ISSUES', details: { issueCount: 1 } }),
    );
  });

  test('잘못 만든 마일스톤을 치울 수 있도록 이슈가 없으면 허용한다', () => {
    expect(() => assertCanDeleteMilestone({ issueCount: 0, openIssueNumbers: [] })).not.toThrow();
  });
});

describe('마일스톤 순서', () => {
  test('보드 레인과 같은 순서로 보이도록 열린 것은 마감 빠른 순, 마감 없는 것은 뒤, 닫힌 것은 최근에 닫은 순으로 그 아래 둔다', () => {
    // Given
    const milestones = [
      milestone({ id: 1, due: '2026-12-01' }),
      milestone({ id: 2 }),
      milestone({ id: 3, due: '2026-11-20' }),
      // 닫힌 것은 마감이 가장 빨라도 열린 것 아래에 옴
      milestone({ id: 4, due: '2026-10-01', closedAt: new Date('2026-11-01T00:00:00.000Z') }),
      milestone({ id: 5, due: '2026-10-02', closedAt: new Date('2026-11-05T00:00:00.000Z') }),
    ];

    // When
    const sorted = sortMilestones(milestones);

    // Then
    expect(sorted.map(({ id }) => id)).toEqual([3, 1, 2, 5, 4]);
  });

  test('마감이 없는 것끼리는 순서가 흔들리지 않도록 먼저 만든 것을 앞에 둔다', () => {
    // Given
    const milestones = [
      milestone({ id: 1, createdAt: new Date('2026-11-03T00:00:00.000Z') }),
      milestone({ id: 2, createdAt: new Date('2026-11-02T00:00:00.000Z') }),
    ];

    // When
    const sorted = sortMilestones(milestones);

    // Then
    expect(sorted.map(({ id }) => id)).toEqual([2, 1]);
  });

  test('같은 마감, 같은 시각에 만든 것도 순서가 정해지도록 id가 작은 것을 앞에 둔다', () => {
    // Given
    const milestones = [
      milestone({ id: 7, due: '2026-12-01' }),
      milestone({ id: 6, due: '2026-12-01' }),
    ];

    // When
    const sorted = sortMilestones(milestones);

    // Then
    expect(sorted.map(({ id }) => id)).toEqual([6, 7]);
  });

  test('부른 쪽의 목록이 바뀌지 않도록 새 배열로 돌려준다', () => {
    // Given
    const milestones = [milestone({ id: 1 }), milestone({ id: 2, due: '2026-11-20' })];

    // When
    sortMilestones(milestones);

    // Then
    expect(milestones.map(({ id }) => id)).toEqual([1, 2]);
  });
});
