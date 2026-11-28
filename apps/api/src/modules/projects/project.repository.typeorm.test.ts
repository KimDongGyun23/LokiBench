import { DataSource } from 'typeorm';

import { createDataSourceOptions } from '@/database/data-source-options';
import { runExclusive } from '@/database/utils/run-exclusive';
import { TypeOrmIssueRepository } from '@/modules/issues/issue.repository.typeorm';

import { ProjectEntity } from './project.entity';
import { TypeOrmProjectRepository } from './project.repository.typeorm';

let dataSource: DataSource;
let repository: TypeOrmProjectRepository;

beforeEach(async () => {
  // HTTP와 service 없이 repository만 확인하려고 인메모리 DB 연결만 띄움
  dataSource = await new DataSource(createDataSourceOptions(':memory:')).initialize();
  repository = new TypeOrmProjectRepository(dataSource.getRepository(ProjectEntity));
});

afterEach(async () => {
  await dataSource.destroy();
});

describe('이름 유일 규칙', () => {
  test('두 탭 동시 추가에 대비하기 위해 service 조회를 지나친 중복도 DB 제약에서 PROJECT_NAME_TAKEN으로 바꾼다', async () => {
    // Given: service 조회 없이 repository로 직접 같은 이름을 넣음
    await repository.create({ name: '독서 기록', color: 'indigo' });

    // When
    const attempt = repository.create({ name: '독서 기록', color: 'sky' });

    // Then
    await expect(attempt).rejects.toMatchObject({ code: 'PROJECT_NAME_TAKEN' });
  });

  test('두 탭 동시 이름 변경에 대비하기 위해 수정에서도 DB 제약 위반을 PROJECT_NAME_TAKEN으로 바꾼다', async () => {
    // Given: service 조회 없이 repository로 직접 다른 프로젝트의 이름으로 바꿈
    await repository.create({ name: '독서 기록', color: 'indigo' });
    const blog = await repository.create({ name: '블로그', color: 'sky' });

    // When
    const attempt = repository.update(blog.id, { name: '독서 기록' });

    // Then
    await expect(attempt).rejects.toMatchObject({ code: 'PROJECT_NAME_TAKEN' });
  });
});

describe('수정', () => {
  test('구현체가 바뀌어도 500이 나가지 않도록 없는 id는 예외 대신 null을 준다', async () => {
    // When: service의 존재 확인 없이 repository를 직접 부름
    const updated = await repository.update(999, { color: 'sky' });

    // Then
    expect(updated).toBeNull();
  });
});

describe('저장할 필드 고르기', () => {
  test('요청 검증이 느슨해져도 엔티티가 오염되지 않도록 추가 입력의 모르는 필드는 저장하지 않는다', async () => {
    // Given: 타입에 없는 id가 실행 중에 섞여 들어온 입력
    const input = { name: '독서 기록', color: 'indigo' as const, id: 999 };

    // When
    const project = await repository.create(input);

    // Then: 999번 행은 생기지 않음
    const stored = await repository.findById(project.id);
    const forged = await repository.findById(999);
    expect(forged).toBeNull();
    expect(stored).toEqual(project);
  });

  test('수정으로 id가 바뀌지 않도록 수정 입력의 모르는 필드는 저장하지 않는다', async () => {
    // Given
    const blog = await repository.create({ name: '블로그', color: 'sky' });
    const changes = { color: 'rose' as const, id: 999 };

    // When
    const updated = await repository.update(blog.id, changes);

    // Then: 반환값과 저장된 행 모두 색만 바뀜
    const stored = await repository.findById(blog.id);
    const expected = { ...blog, color: 'rose' };
    expect(updated).toEqual(expected);
    expect(stored).toEqual(expected);
  });
});

describe('다른 repository와 연결 나눠 쓰기', () => {
  test('트랜잭션 도중의 값을 읽지 않도록 같은 연결의 앞 작업이 끝난 뒤에 읽는다', async () => {
    // Given: 같은 연결에 늦게 끝나는 작업을 먼저 걸어 둠
    const project = await repository.create({ name: '독서 기록', color: 'indigo' });
    const steps: string[] = [];
    const slowWork = runExclusive({
      dataSource,
      work: async () => {
        await new Promise((resolve) => setTimeout(resolve, 5));
        steps.push('앞 작업 끝');
      },
    });

    // When: 앞 작업을 기다리지 않고 세 읽기를 시작함
    await Promise.all([
      slowWork,
      repository.findAll().then(() => steps.push('목록 읽기 끝')),
      repository.findById(project.id).then(() => steps.push('id 읽기 끝')),
      repository.findByName(project.name).then(() => steps.push('이름 읽기 끝')),
    ]);

    // Then
    expect(steps).toEqual(['앞 작업 끝', '목록 읽기 끝', 'id 읽기 끝', '이름 읽기 끝']);
  });

  test('성공으로 응답한 변경이 사라지지 않도록 함께 시작한 이슈 저장이 실패해도 프로젝트 추가는 남는다', async () => {
    // Given: 이력 저장이 실패하도록 테이블 이름을 바꿔 둠
    const project = await repository.create({ name: '독서 기록', color: 'indigo' });
    const issues = new TypeOrmIssueRepository(dataSource);
    await dataSource.query(`ALTER TABLE issue_events RENAME TO issue_events_broken`);

    // When: 이슈 만들기를 기다리지 않고 프로젝트 추가를 함께 시작함
    const [issueResult, projectResult] = await Promise.allSettled([
      issues.create({
        projectId: project.id,
        title: '읽은 책 별점 입력',
        due: null,
        now: new Date(),
      }),
      repository.create({ name: '가계부', color: 'teal' }),
    ]);

    // Then
    expect(issueResult.status).toBe('rejected');
    expect(projectResult.status).toBe('fulfilled');
    expect(await repository.findByName('가계부')).not.toBeNull();
  });
});
