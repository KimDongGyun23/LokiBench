import { DataSource } from 'typeorm';

import { createDataSourceOptions } from '@/database/data-source-options';
import { ProjectEntity } from '@/modules/projects/project.entity';
import { TypeOrmProjectRepository } from '@/modules/projects/project.repository.typeorm';

import type { Issue, SaveIssueChangeInput } from './issue.model';
import { TypeOrmIssueRepository } from './issue.repository.typeorm';
import { IssuesService } from './issues.service';

let dataSource: DataSource;

beforeEach(async () => {
  dataSource = await new DataSource(createDataSourceOptions(':memory:')).initialize();
});

afterEach(async () => {
  await dataSource.destroy();
});

// 저장 직전에 다른 탭의 저장이 먼저 끝난 것처럼 version을 올려 두는 repository
class RacingIssueRepository extends TypeOrmIssueRepository {
  async saveChange(input: SaveIssueChangeInput): Promise<Issue | null> {
    await dataSource.query(`UPDATE issues SET version = version + 1 WHERE id = ?`, [
      input.issue.id,
    ]);
    return super.saveChange(input);
  }
}

describe('이슈 수정 충돌', () => {
  test('조회와 저장 사이에 들어온 수정을 덮어쓰지 않도록 저장이 거절되면 ISSUE_VERSION_CONFLICT를 던진다', async () => {
    // Given: 조회 뒤 저장 전에 다른 수정이 끼어드는 상황
    const projects = new TypeOrmProjectRepository(dataSource.getRepository(ProjectEntity));
    const project = await projects.create({ name: '가계부', color: 'teal' });
    const issues = new RacingIssueRepository(dataSource);
    const service = new IssuesService(issues, projects);
    const issue = await service.create({ projectId: project.id, title: '영수증 정리' });

    // When
    const attempt = service.update(issue.id, { version: issue.version, status: 'IN_PROGRESS' });

    // Then
    await expect(attempt).rejects.toMatchObject({ code: 'ISSUE_VERSION_CONFLICT' });
  });
});
