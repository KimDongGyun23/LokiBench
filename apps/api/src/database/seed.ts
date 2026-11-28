import { mkdirSync } from 'node:fs';

import {
  CLOSED_ISSUE_STATUS,
  INITIAL_ISSUE_STATUS,
  type IssueStatus,
} from '@lokibench/shared/values';
import { DataSource } from 'typeorm';

import { IssueEntity } from '@/modules/issues/issue.entity';
import { TypeOrmIssueRepository } from '@/modules/issues/issue.repository.typeorm';
import { applyIssueUpdate } from '@/modules/issues/issue.rules';
import { MilestoneEntity } from '@/modules/milestones/milestone.entity';
import type { MilestoneFields } from '@/modules/milestones/milestone.model';
import { TypeOrmMilestoneRepository } from '@/modules/milestones/milestone.repository.typeorm';
import { ProjectEntity } from '@/modules/projects/project.entity';
import type { CreateProjectInput } from '@/modules/projects/project.model';
import { TypeOrmProjectRepository } from '@/modules/projects/project.repository.typeorm';

import { createDataSourceOptions } from './data-source-options';
import { DATA_DIR, resolveDatabaseLocation } from './database-location';

const SEED_PROJECTS: ReadonlyArray<CreateProjectInput> = [
  { name: '독서 기록', color: 'indigo' },
  { name: '가계부', color: 'teal' },
  { name: '블로그', color: 'rose' },
];

// 개발용 마일스톤 한 개 (isClosed면 이슈를 넣은 뒤 닫음)
interface SeedMilestone {
  projectName: string;
  fields: MilestoneFields;
  isClosed: boolean;
}

// 비어 있는 마일스톤 칸 (마일스톤마다 바꿀 칸만 덮어씀)
const EMPTY_MILESTONE_FIELDS: Omit<MilestoneFields, 'title'> = {
  startDate: null,
  due: null,
  background: '',
  solution: '',
  expectedEffect: '',
  memo: '',
};

// 개발용 마일스톤 (열림과 닫힘, 날짜가 있는 것과 없는 것이 섞임)
const SEED_MILESTONES: ReadonlyArray<SeedMilestone> = [
  {
    projectName: '독서 기록',
    fields: {
      ...EMPTY_MILESTONE_FIELDS,
      title: '별점과 서평',
      due: '2026-12-20',
      background: '- 읽은 책을 다시 고를 때 기억이 나지 않음',
    },
    isClosed: false,
  },
  {
    projectName: '독서 기록',
    fields: {
      ...EMPTY_MILESTONE_FIELDS,
      title: '독서 목록 정리',
      startDate: '2026-11-01',
      due: '2026-11-20',
    },
    isClosed: true,
  },
  {
    projectName: '가계부',
    fields: {
      ...EMPTY_MILESTONE_FIELDS,
      title: '12월 정리',
      startDate: '2026-12-01',
      due: '2026-12-31',
    },
    isClosed: false,
  },
  {
    projectName: '블로그',
    fields: { ...EMPTY_MILESTONE_FIELDS, title: '태그 기능' },
    isClosed: false,
  },
];

// 개발용 이슈 한 건 (만든 뒤 status로 옮김)
interface SeedIssue {
  projectName: string;
  title: string;
  status: IssueStatus;
  // 같은 프로젝트의 시드 마일스톤 제목 (없으면 미지정)
  milestoneTitle?: string;
}

// 개발용 이슈 (프로젝트마다 열린 이슈 수가 3, 2, 1로 다르고 닫힌 이슈와 미지정 이슈도 섞임)
const SEED_ISSUES: ReadonlyArray<SeedIssue> = [
  {
    projectName: '독서 기록',
    title: '읽은 책 별점 입력',
    status: 'TODO',
    milestoneTitle: '별점과 서평',
  },
  { projectName: '독서 기록', title: '월별 읽은 권수 그래프', status: 'TODO' },
  {
    projectName: '독서 기록',
    title: '책 표지 이미지 넣기',
    status: 'IN_PROGRESS',
    milestoneTitle: '별점과 서평',
  },
  {
    projectName: '독서 기록',
    title: '독서 목록 가져오기',
    status: 'DONE',
    milestoneTitle: '독서 목록 정리',
  },
  {
    projectName: '가계부',
    title: '이번 달 영수증 정리',
    status: 'TODO',
    milestoneTitle: '12월 정리',
  },
  { projectName: '가계부', title: '고정 지출 자동 입력', status: 'IN_REVIEW' },
  {
    projectName: '블로그',
    title: '글 목록에 태그 필터 추가',
    status: 'TODO',
    milestoneTitle: '태그 기능',
  },
  { projectName: '블로그', title: '글 초안 저장', status: 'DONE' },
];

// 시드가 쓰는 repository 묶음
interface SeedRepositories {
  projects: TypeOrmProjectRepository;
  issues: TypeOrmIssueRepository;
  milestones: TypeOrmMilestoneRepository;
}

// 이번 실행에서 만든 마일스톤의 id ("프로젝트 이름/제목"으로 찾음)
type SeedMilestoneIds = ReadonlyMap<string, number>;

/**
 * 개발용 프로젝트 3개, 마일스톤 4개, 이슈 8건을 개발용 DB에 넣는다.
 *
 * - 실사용 DB에 예시가 섞이지 않도록 LOKIBENCH_DB 값과 관계없이 dev.db에만 넣는다
 * - 같은 이름의 프로젝트가 이미 있으면 건너뛰어서 여러 번 실행해도 행이 늘지 않는다
 * - 마일스톤과 이슈는 각각 한 건이라도 있으면 통째로 건너뛴다
 *   (넣다가 실패하면 다시 돌려도 남은 행이 들어가지 않으므로 dev.db를 지우고 다시 돌린다)
 * - 이슈가 이미 있는 DB에 마일스톤만 새로 넣으면 시드 이슈를 찾아 마일스톤에 넣는다
 */
async function seed(): Promise<void> {
  const { databasePath } = resolveDatabaseLocation({ dataDir: DATA_DIR, target: 'dev' });
  mkdirSync(DATA_DIR, { recursive: true });

  const dataSource = await new DataSource(createDataSourceOptions(databasePath)).initialize();
  const repositories: SeedRepositories = {
    projects: new TypeOrmProjectRepository(dataSource.getRepository(ProjectEntity)),
    issues: new TypeOrmIssueRepository(dataSource),
    milestones: new TypeOrmMilestoneRepository(dataSource),
  };

  try {
    for (const project of SEED_PROJECTS) {
      if (await repositories.projects.findByName(project.name)) continue;
      await repositories.projects.create(project);
    }

    // 손으로 넣은 마일스톤과 섞이지 않도록 마일스톤이 하나라도 있으면 건너뜀
    const hasMilestones = await dataSource.getRepository(MilestoneEntity).exists();
    const milestoneIds = hasMilestones
      ? new Map<string, number>()
      : await createSeedMilestones(repositories);

    // 손으로 넣은 이슈와 섞이지 않도록 이슈가 하나라도 있으면 새로 만들지 않고 마일스톤에 넣기만 함
    const hasIssues = await dataSource.getRepository(IssueEntity).exists();
    for (const seedIssue of SEED_ISSUES) {
      const milestoneId = findSeedMilestoneId({ milestoneIds, seedIssue });
      if (hasIssues) {
        await assignSeedIssue({ repositories, seedIssue, milestoneId });
      } else {
        await createSeedIssue({ repositories, seedIssue, milestoneId });
      }
    }

    // 닫힌 마일스톤에 열린 이슈가 남지 않도록 이슈를 다 넣은 뒤에 닫음
    for (const seedMilestone of SEED_MILESTONES) {
      const id = milestoneIds.get(
        toMilestoneKey({
          projectName: seedMilestone.projectName,
          title: seedMilestone.fields.title,
        }),
      );
      if (!seedMilestone.isClosed || id === undefined) continue;
      await repositories.milestones.close({ id, now: new Date() });
    }
  } finally {
    await dataSource.destroy();
  }
}

/**
 * 개발용 마일스톤을 열린 상태로 만든다.
 *
 * @param repositories 시드가 쓰는 repository 묶음
 * @returns 만든 마일스톤의 id ("프로젝트 이름/제목"으로 찾음)
 */
async function createSeedMilestones({
  projects,
  milestones,
}: SeedRepositories): Promise<SeedMilestoneIds> {
  const ids = new Map<string, number>();

  for (const seedMilestone of SEED_MILESTONES) {
    const project = await projects.findByName(seedMilestone.projectName);

    // 시드 프로젝트의 이름을 손으로 바꿨으면 그 프로젝트의 마일스톤은 넣지 않음
    if (!project) continue;

    const created = await milestones.create({
      ...seedMilestone.fields,
      projectId: project.id,
      now: new Date(),
    });
    ids.set(
      toMilestoneKey({ projectName: seedMilestone.projectName, title: created.title }),
      created.id,
    );
  }

  return ids;
}

// 시드 이슈의 마일스톤 id를 찾을 때 넘기는 값
interface FindSeedMilestoneIdParams {
  milestoneIds: SeedMilestoneIds;
  seedIssue: SeedIssue;
}

/**
 * 시드 이슈가 들어갈 마일스톤의 id를 찾는다.
 *
 * @param params.milestoneIds 이번 실행에서 만든 마일스톤의 id
 * @param params.seedIssue 마일스톤을 찾을 이슈
 * @returns 마일스톤 id, 미지정이거나 이번에 만든 마일스톤이 아니면 null
 */
function findSeedMilestoneId({
  milestoneIds,
  seedIssue,
}: FindSeedMilestoneIdParams): number | null {
  if (!seedIssue.milestoneTitle) return null;
  return (
    milestoneIds.get(
      toMilestoneKey({ projectName: seedIssue.projectName, title: seedIssue.milestoneTitle }),
    ) ?? null
  );
}

// 마일스톤 id를 찾는 열쇠를 만들 때 넘기는 값
interface MilestoneKeyParams {
  projectName: string;
  title: string;
}

// 마일스톤 id를 찾는 열쇠 (마일스톤 제목은 프로젝트 안에서만 겹치지 않음)
function toMilestoneKey({ projectName, title }: MilestoneKeyParams): string {
  return `${projectName}/${title}`;
}

// 시드 이슈 한 건을 넣거나 마일스톤에 넣을 때 넘기는 값
interface SeedIssueParams {
  repositories: SeedRepositories;
  seedIssue: SeedIssue;
  milestoneId: number | null;
}

/**
 * 개발용 이슈 한 건을 만들고, 처음 상태가 아니면 수정 규칙으로 옮겨 이력이 실제 사용처럼 쌓이게 한다.
 *
 * - 닫힌 이슈는 마일스톤을 바꿀 수 없으므로 마일스톤은 만들 때 함께 넣는다
 *
 * @param params.repositories 시드가 쓰는 repository 묶음
 * @param params.seedIssue 넣을 이슈
 * @param params.milestoneId 넣을 마일스톤 id (미지정이면 null)
 */
async function createSeedIssue({
  repositories: { projects, issues },
  seedIssue,
  milestoneId,
}: SeedIssueParams): Promise<void> {
  const project = await projects.findByName(seedIssue.projectName);

  // 시드 프로젝트의 이름을 손으로 바꿨으면 그 프로젝트의 이슈는 넣지 않음
  if (!project) return;

  const now = new Date();
  const created = await issues.create({
    projectId: project.id,
    title: seedIssue.title,
    due: null,
    milestoneId,
    now,
  });
  if (seedIssue.status === INITIAL_ISSUE_STATUS) return;

  const result = applyIssueUpdate(created, { status: seedIssue.status }, now);
  if (result.kind === 'unchanged') return;

  await issues.saveChange({
    issue: result.issue,
    expectedVersion: created.version,
    event: result.event,
  });
}

/**
 * 이미 있는 시드 이슈를 찾아 마일스톤에 넣는다.
 *
 * @param params.repositories 시드가 쓰는 repository 묶음
 * @param params.seedIssue 찾을 이슈 (프로젝트 이름과 제목으로 찾음)
 * @param params.milestoneId 넣을 마일스톤 id (미지정이면 null)
 */
async function assignSeedIssue({
  repositories: { projects, issues },
  seedIssue,
  milestoneId,
}: SeedIssueParams): Promise<void> {
  // 미지정 이슈는 바꿀 것이 없음
  if (milestoneId === null) return;

  const project = await projects.findByName(seedIssue.projectName);
  if (!project) return;

  const issue = (await issues.findByProject(project.id)).find(
    ({ title }) => title === seedIssue.title,
  );

  // 손으로 지우거나 제목, 상태를 바꾼 이슈는 건드리지 않음
  if (!issue || issue.status !== seedIssue.status) return;

  // 닫힌 이슈는 마일스톤을 바꿀 수 없으므로 건너뜀
  if (issue.status === CLOSED_ISSUE_STATUS) return;

  const result = applyIssueUpdate(issue, { milestoneId }, new Date());
  if (result.kind === 'unchanged') return;

  await issues.saveChange({
    issue: result.issue,
    expectedVersion: issue.version,
    event: result.event,
  });
}

void seed();
