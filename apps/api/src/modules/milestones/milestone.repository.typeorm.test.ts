import { DataSource } from 'typeorm';

import { createDataSourceOptions } from '@/database/data-source-options';

import type { CreateMilestoneInput, Milestone, MilestoneFields } from './milestone.model';
import { TypeOrmMilestoneRepository } from './milestone.repository.typeorm';

const NOW = new Date('2026-11-28T09:00:00.000Z');
const LATER = new Date('2026-11-28T09:05:00.000Z');

// 비어 있는 칸 (테스트마다 바꿀 칸만 덮어씀)
const EMPTY_FIELDS: MilestoneFields = {
  title: '별점과 서평',
  startDate: null,
  due: null,
  background: '',
  solution: '',
  expectedEffect: '',
  memo: '',
};

let dataSource: DataSource;
let repository: TypeOrmMilestoneRepository;

beforeEach(async () => {
  // HTTP와 service 없이 repository만 확인하려고 인메모리 DB에 프로젝트 둘만 넣고 시작함
  dataSource = await new DataSource(createDataSourceOptions(':memory:')).initialize();
  await dataSource.query(
    `INSERT INTO projects (name, color, created_at) VALUES
       ('독서 기록', 'indigo', '2026-11-01T00:00:00.000Z'),
       ('가계부', 'teal', '2026-11-01T00:00:00.000Z')`,
  );
  repository = new TypeOrmMilestoneRepository(dataSource);
});

afterEach(async () => {
  await dataSource.destroy();
});

// 프로젝트 1에 마일스톤 하나를 만듦
function createMilestone(overrides: Partial<CreateMilestoneInput> = {}): Promise<Milestone> {
  return repository.create({ ...EMPTY_FIELDS, projectId: 1, now: NOW, ...overrides });
}

// 마일스톤에 이슈 한 건을 SQL로 넣음 (이슈 저장소는 아직 마일스톤을 받지 않음)
async function insertIssue({
  milestoneId,
  number,
  status,
}: {
  milestoneId: number;
  number: number;
  status: 'TODO' | 'DONE';
}): Promise<void> {
  const closedAt = status === 'DONE' ? `'${NOW.toISOString()}'` : 'NULL';
  await dataSource.query(
    `INSERT INTO issues
       (project_id, milestone_id, number, title, status, status_changed_at, version, created_at, closed_at)
     VALUES (1, ${milestoneId}, ${number}, '이슈 ${number}', '${status}', '${NOW.toISOString()}', 1,
       '${NOW.toISOString()}', ${closedAt})`,
  );
}

describe('마일스톤 만들기', () => {
  test('바로 상세로 갈 수 있도록 만든 마일스톤을 id와 만든 시각을 채워 준다', async () => {
    // When
    const milestone = await createMilestone({ due: '2026-12-01', memo: '- 서평 양식 정하기' });

    // Then
    expect(milestone).toEqual({
      ...EMPTY_FIELDS,
      id: 1,
      projectId: 1,
      due: '2026-12-01',
      memo: '- 서평 양식 정하기',
      createdAt: NOW,
      closedAt: null,
    });
  });

  test('프로젝트 안에서 이름으로 가릴 수 있도록 같은 프로젝트에 같은 제목이면 거부한다', async () => {
    // Given
    await createMilestone();

    // When
    const attempt = createMilestone();

    // Then
    await expect(attempt).rejects.toMatchObject({ code: 'MILESTONE_TITLE_TAKEN' });
  });

  test('프로젝트마다 같은 이름의 묶음이 있을 수 있도록 다른 프로젝트에는 같은 제목을 만든다', async () => {
    // Given
    await createMilestone();

    // When
    const other = await createMilestone({ projectId: 2 });

    // Then
    expect(other.projectId).toBe(2);
  });
});

describe('마일스톤 조회', () => {
  test('관리 화면 순서를 서버가 정하도록 프로젝트의 마일스톤을 열린 것 마감순, 닫힌 것 순서로 준다', async () => {
    // Given
    await createMilestone({ title: '마감 없음' });
    await createMilestone({ title: '12월', due: '2026-12-01' });
    const closed = await createMilestone({ title: '닫힘', due: '2026-11-01' });
    await repository.close({ id: closed.id, now: LATER });
    await createMilestone({ title: '다른 프로젝트', projectId: 2 });

    // When
    const milestones = await repository.findByProject(1);

    // Then
    expect(milestones.map(({ title }) => title)).toEqual(['12월', '마감 없음', '닫힘']);
  });

  test('지운 마일스톤이 어디에도 다시 보이지 않도록 목록과 한 건 조회에서 빼낸다', async () => {
    // Given
    const milestone = await createMilestone();
    await repository.softDelete({ id: milestone.id, now: LATER });

    // When
    const found = await repository.findById(milestone.id);
    const listed = await repository.findByProject(1);

    // Then
    expect(found).toBeNull();
    expect(listed).toEqual([]);
  });
});

describe('마일스톤 수정', () => {
  test('칸 전부를 한 번에 고칠 수 있도록 넘긴 칸으로 바꾸고 만든 시각과 닫힘은 그대로 둔다', async () => {
    // Given
    const milestone = await createMilestone();

    // When
    const updated = await repository.update({
      id: milestone.id,
      fields: { ...EMPTY_FIELDS, title: '별점과 서평 (2차)', startDate: '2026-12-01' },
    });

    // Then
    expect(updated).toEqual({
      ...milestone,
      title: '별점과 서평 (2차)',
      startDate: '2026-12-01',
    });
  });

  test('다른 마일스톤과 이름이 겹치지 않도록 같은 프로젝트의 다른 제목으로 바꾸면 거부한다', async () => {
    // Given
    await createMilestone({ title: '가' });
    const other = await createMilestone({ title: '나' });

    // When
    const attempt = repository.update({ id: other.id, fields: { ...EMPTY_FIELDS, title: '가' } });

    // Then
    await expect(attempt).rejects.toMatchObject({ code: 'MILESTONE_TITLE_TAKEN' });
  });

  test('지운 마일스톤은 고칠 수 없도록 null을 준다', async () => {
    // Given
    const milestone = await createMilestone();
    await repository.softDelete({ id: milestone.id, now: LATER });

    // When
    const updated = await repository.update({ id: milestone.id, fields: EMPTY_FIELDS });

    // Then
    expect(updated).toBeNull();
  });
});

describe('마일스톤 닫기와 재오픈', () => {
  test('닫힌 마일스톤에 할 일이 남지 않도록 열린 이슈가 있으면 거부하고 닫지 않는다', async () => {
    // Given
    const milestone = await createMilestone();
    await insertIssue({ milestoneId: milestone.id, number: 3, status: 'TODO' });
    await insertIssue({ milestoneId: milestone.id, number: 1, status: 'TODO' });

    // When
    const attempt = repository.close({ id: milestone.id, now: LATER });

    // Then
    await expect(attempt).rejects.toMatchObject({
      code: 'MILESTONE_HAS_OPEN_ISSUES',
      details: { openIssueNumbers: [1, 3] },
    });
    expect((await repository.findById(milestone.id))?.closedAt).toBeNull();
  });

  test('일이 끝난 마일스톤을 닫을 수 있도록 이슈가 모두 닫혔으면 그 시각으로 닫는다', async () => {
    // Given
    const milestone = await createMilestone();
    await insertIssue({ milestoneId: milestone.id, number: 1, status: 'DONE' });

    // When
    const closed = await repository.close({ id: milestone.id, now: LATER });

    // Then
    expect(closed?.closedAt).toEqual(LATER);
  });

  test('언제 닫았는지가 바뀌지 않도록 이미 닫힌 마일스톤을 다시 닫으면 닫은 시각을 그대로 둔다', async () => {
    // Given
    const milestone = await createMilestone();
    await repository.close({ id: milestone.id, now: NOW });

    // When
    const closedAgain = await repository.close({ id: milestone.id, now: LATER });

    // Then
    expect(closedAgain?.closedAt).toEqual(NOW);
  });

  test('두 탭에서 함께 눌러도 닫은 시각이 하나로 남도록 동시에 닫으면 둘 다 먼저 닫은 시각을 받는다', async () => {
    // Given
    const milestone = await createMilestone();

    // When: 기다리지 않고 함께 시작함
    const [first, second] = await Promise.all([
      repository.close({ id: milestone.id, now: NOW }),
      repository.close({ id: milestone.id, now: LATER }),
    ]);

    // Then
    expect(first?.closedAt).toEqual(NOW);
    expect(second?.closedAt).toEqual(NOW);
  });

  test('닫은 것을 되돌릴 수 있도록 재오픈하면 닫은 시각을 비우고, 열린 것을 재오픈해도 그대로 둔다', async () => {
    // Given
    const milestone = await createMilestone();
    await repository.close({ id: milestone.id, now: NOW });

    // When
    const reopened = await repository.reopen(milestone.id);
    const reopenedAgain = await repository.reopen(milestone.id);

    // Then
    expect(reopened?.closedAt).toBeNull();
    expect(reopenedAgain).toEqual(reopened);
  });

  test('없는 마일스톤은 닫거나 열 수 없도록 null을 준다', async () => {
    expect(await repository.close({ id: 999, now: NOW })).toBeNull();
    expect(await repository.reopen(999)).toBeNull();
  });
});

describe('마일스톤 삭제와 되살리기', () => {
  test('끝난 이슈의 기록을 잃지 않도록 닫힌 이슈만 있어도 거부하고 지우지 않는다', async () => {
    // Given
    const milestone = await createMilestone();
    await insertIssue({ milestoneId: milestone.id, number: 1, status: 'DONE' });

    // When
    const attempt = repository.softDelete({ id: milestone.id, now: LATER });

    // Then
    await expect(attempt).rejects.toMatchObject({
      code: 'MILESTONE_HAS_ISSUES',
      details: { issueCount: 1 },
    });
    expect(await repository.findById(milestone.id)).not.toBeNull();
  });

  test('지운 직후 되돌릴 수 있도록 되살리면 같은 id와 칸, 닫힘 상태로 돌아온다', async () => {
    // Given: 내용을 채우고 닫은 뒤 지운 마일스톤
    const milestone = await createMilestone({ background: '- 읽은 책이 흩어져 있음' });
    const closed = await repository.close({ id: milestone.id, now: NOW });
    const deleted = await repository.softDelete({ id: milestone.id, now: LATER });

    // When
    const restored = await repository.restore(milestone.id);

    // Then
    expect(deleted).toBe(true);
    expect(restored).toEqual(closed);
  });

  test('지운 뒤 같은 이름을 새로 만든 경우 둘이 겹치지 않도록 되살리기를 거부한다', async () => {
    // Given
    const milestone = await createMilestone();
    await repository.softDelete({ id: milestone.id, now: LATER });
    await createMilestone();

    // When
    const attempt = repository.restore(milestone.id);

    // Then
    await expect(attempt).rejects.toMatchObject({ code: 'MILESTONE_TITLE_TAKEN' });
  });

  test('되돌리기를 두 번 눌러도 문제없도록 지우지 않은 마일스톤을 되살리면 그대로 준다', async () => {
    // Given
    const milestone = await createMilestone();

    // When
    const restored = await repository.restore(milestone.id);

    // Then
    expect(restored).toEqual(milestone);
  });

  test('없는 마일스톤은 지우거나 되살릴 수 없도록 false와 null을 준다', async () => {
    expect(await repository.softDelete({ id: 999, now: NOW })).toBe(false);
    expect(await repository.restore(999)).toBeNull();
  });
});
