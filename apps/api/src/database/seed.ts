import { mkdirSync } from 'node:fs';

import { INITIAL_ISSUE_STATUS, type IssueStatus } from '@lokibench/shared/values';
import { DataSource } from 'typeorm';

import { IssueEntity } from '@/modules/issues/issue.entity';
import { TypeOrmIssueRepository } from '@/modules/issues/issue.repository.typeorm';
import { applyIssueUpdate } from '@/modules/issues/issue.rules';
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

// 개발용 이슈 한 건 (만든 뒤 status로 옮김)
interface SeedIssue {
  projectName: string;
  title: string;
  status: IssueStatus;
}

// 개발용 이슈 (프로젝트마다 열린 이슈 수가 3, 2, 1로 다르고 닫힌 이슈도 섞임)
const SEED_ISSUES: ReadonlyArray<SeedIssue> = [
  { projectName: '독서 기록', title: '읽은 책 별점 입력', status: 'TODO' },
  { projectName: '독서 기록', title: '월별 읽은 권수 그래프', status: 'TODO' },
  { projectName: '독서 기록', title: '책 표지 이미지 넣기', status: 'IN_PROGRESS' },
  { projectName: '독서 기록', title: '독서 목록 가져오기', status: 'DONE' },
  { projectName: '가계부', title: '이번 달 영수증 정리', status: 'TODO' },
  { projectName: '가계부', title: '고정 지출 자동 입력', status: 'IN_REVIEW' },
  { projectName: '블로그', title: '글 목록에 태그 필터 추가', status: 'TODO' },
  { projectName: '블로그', title: '글 초안 저장', status: 'DONE' },
];

/**
 * 개발용 프로젝트 3개와 이슈 8건을 개발용 DB에 넣는다.
 *
 * - 실사용 DB에 예시가 섞이지 않도록 LOKIBENCH_DB 값과 관계없이 dev.db에만 넣는다
 * - 같은 이름의 프로젝트가 이미 있으면 건너뛰어서 여러 번 실행해도 행이 늘지 않는다
 * - 이슈는 한 건이라도 있으면 통째로 건너뛴다
 *   (이슈를 넣다가 실패하면 다시 돌려도 남은 이슈가 들어가지 않으므로 dev.db를 지우고 다시 돌린다)
 */
async function seed(): Promise<void> {
  const { databasePath } = resolveDatabaseLocation({ dataDir: DATA_DIR, target: 'dev' });
  mkdirSync(DATA_DIR, { recursive: true });

  const dataSource = await new DataSource(createDataSourceOptions(databasePath)).initialize();
  const projects = new TypeOrmProjectRepository(dataSource.getRepository(ProjectEntity));
  const issues = new TypeOrmIssueRepository(dataSource);

  try {
    for (const project of SEED_PROJECTS) {
      if (await projects.findByName(project.name)) continue;
      await projects.create(project);
    }

    // 손으로 넣은 이슈와 섞이지 않도록 이슈가 하나라도 있으면 건너뜀
    const hasIssues = await dataSource.getRepository(IssueEntity).exists();
    if (hasIssues) return;

    for (const seedIssue of SEED_ISSUES) {
      await createSeedIssue({ projects, issues, seedIssue });
    }
  } finally {
    await dataSource.destroy();
  }
}

/**
 * 개발용 이슈 한 건을 만들고, 처음 상태가 아니면 수정 규칙으로 옮겨 이력이 실제 사용처럼 쌓이게 한다.
 *
 * @param params.projects 이슈를 넣을 프로젝트를 찾을 repository
 * @param params.issues 이슈를 저장할 repository
 * @param params.seedIssue 넣을 이슈
 */
async function createSeedIssue({
  projects,
  issues,
  seedIssue,
}: {
  projects: TypeOrmProjectRepository;
  issues: TypeOrmIssueRepository;
  seedIssue: SeedIssue;
}): Promise<void> {
  const project = await projects.findByName(seedIssue.projectName);

  // 시드 프로젝트의 이름을 손으로 바꿨으면 그 프로젝트의 이슈는 넣지 않음
  if (!project) return;

  const now = new Date();
  const created = await issues.create({
    projectId: project.id,
    title: seedIssue.title,
    due: null,
    milestoneId: null,
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

void seed();
