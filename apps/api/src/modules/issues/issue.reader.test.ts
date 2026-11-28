import { DataSource } from 'typeorm';

import { createDataSourceOptions } from '@/database/data-source-options';

import { readMilestoneIssueSummary } from './issue.reader';

const AT = '2026-11-28T00:00:00.000Z';

let dataSource: DataSource;

beforeEach(async () => {
  // 마일스톤 둘을 두고, 1에는 TODO #3, DONE #2, TODO #1, 2에는 TODO #4를 넣고 시작함
  dataSource = await new DataSource(createDataSourceOptions(':memory:')).initialize();
  await dataSource.query(
    `INSERT INTO projects (name, color, created_at) VALUES ('독서 기록', 'indigo', '${AT}')`,
  );
  await dataSource.query(
    `INSERT INTO milestones (id, project_id, title, created_at) VALUES
       (1, 1, '별점과 서평', '${AT}'),
       (2, 1, '독서 목록 정리', '${AT}'),
       (3, 1, '빈 마일스톤', '${AT}')`,
  );
  await dataSource.query(
    `INSERT INTO issues
       (project_id, milestone_id, number, title, status, status_changed_at, version, created_at, closed_at)
     VALUES
       (1, 1, 3, '서평 쓰기', 'TODO', '${AT}', 1, '${AT}', NULL),
       (1, 1, 2, '별점 입력', 'DONE', '${AT}', 2, '${AT}', '${AT}'),
       (1, 1, 1, '책 고르기', 'IN_REVIEW', '${AT}', 2, '${AT}', NULL),
       (1, 2, 4, '목록 가져오기', 'TODO', '${AT}', 1, '${AT}', NULL)`,
  );
});

afterEach(async () => {
  await dataSource.destroy();
});

describe('마일스톤 저장소가 읽는 이슈 요약', () => {
  test('닫기 거부에 남은 번호를 순서대로 보일 수 있도록 열린 이슈 번호를 오름차순으로 주고 닫힌 이슈까지 센다', async () => {
    // When
    const summary = await readMilestoneIssueSummary({
      manager: dataSource.manager,
      milestoneId: 1,
    });

    // Then: 다른 마일스톤의 #4는 세지 않음
    expect(summary).toEqual({ issueCount: 3, openIssueNumbers: [1, 3] });
  });

  test('이슈가 없는 마일스톤은 닫고 지울 수 있도록 0과 빈 목록을 준다', async () => {
    // When
    const summary = await readMilestoneIssueSummary({
      manager: dataSource.manager,
      milestoneId: 3,
    });

    // Then
    expect(summary).toEqual({ issueCount: 0, openIssueNumbers: [] });
  });
});
