import { DataSource } from 'typeorm';

import { createDataSourceOptions } from '../../database/data-source-options';
import { ProjectEntity } from './project.entity';
import { TypeOrmProjectRepository } from './typeorm-project.repository';

let dataSource: DataSource;
let repository: TypeOrmProjectRepository;

beforeEach(async () => {
  // HTTP와 service 없이 저장소만 확인하려고 인메모리 DB 연결만 띄움
  dataSource = await new DataSource(createDataSourceOptions(':memory:')).initialize();
  repository = new TypeOrmProjectRepository(dataSource.getRepository(ProjectEntity));
});

afterEach(async () => {
  await dataSource.destroy();
});

describe('이름 유일 규칙', () => {
  test('두 탭 동시 추가에 대비하기 위해 service 조회를 지나친 중복도 DB 제약에서 PROJECT_NAME_TAKEN으로 바꾼다', async () => {
    // Given: service 조회 없이 저장소로 직접 같은 이름을 넣음
    await repository.create({ name: '독서 기록', color: 'indigo' });

    // When
    const attempt = repository.create({ name: '독서 기록', color: 'sky' });

    // Then
    await expect(attempt).rejects.toMatchObject({ code: 'PROJECT_NAME_TAKEN' });
  });

  test('두 탭 동시 이름 변경에 대비하기 위해 수정에서도 DB 제약 위반을 PROJECT_NAME_TAKEN으로 바꾼다', async () => {
    // Given: service 조회 없이 저장소로 직접 다른 프로젝트의 이름으로 바꿈
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
    // When: service의 존재 확인 없이 저장소를 직접 부름
    const updated = await repository.update(999, { color: 'sky' });

    // Then
    expect(updated).toBeNull();
  });
});

describe('도메인 모양', () => {
  test('도메인이 시각으로 바로 계산하도록 DB의 ISO 문자열을 Date로 바꿔 준다', async () => {
    // Given: DB에 아카이브된 행을 직접 넣음
    await dataSource.query(
      `INSERT INTO projects (name, color, created_at, archived_at)
       VALUES ('이사 준비', 'sky', '2026-10-01T00:00:00.000Z', '2026-10-02T00:00:00.000Z')`,
    );

    // When
    const [project] = await repository.findAll({ includeArchived: true });

    // Then
    expect(project.createdAt).toEqual(new Date('2026-10-01T00:00:00.000Z'));
    expect(project.archivedAt).toEqual(new Date('2026-10-02T00:00:00.000Z'));
  });

  test('DB를 직접 고쳐 깨진 행을 바로 찾도록 시각으로 읽을 수 없으면 행 id와 열 이름을 담아 던진다', async () => {
    // Given: 시각으로 읽을 수 없는 created_at을 직접 넣음
    await dataSource.query(
      `INSERT INTO projects (id, name, color, created_at) VALUES (7, '가계부', 'teal', '')`,
    );

    // When
    const attempt = repository.findAll({ includeArchived: true });

    // Then
    await expect(attempt).rejects.toThrow('projects.created_at 시각 형식이 잘못됨: id=7');
  });
});

describe('저장할 필드 고르기', () => {
  test('요청 검증이 느슨해져도 엔티티가 오염되지 않도록 추가 입력의 모르는 필드는 저장하지 않는다', async () => {
    // Given: 타입에 없는 id, archivedAt이 실행 중에 섞여 들어온 입력
    const input = { name: '독서 기록', color: 'indigo' as const, id: 999, archivedAt: 'x' };

    // When
    const project = await repository.create(input);

    // Then: 999번 행은 생기지 않고, 저장된 행은 아카이브되지 않음
    const stored = await repository.findById(project.id);
    const forged = await repository.findById(999);
    expect(forged).toBeNull();
    expect(stored).toEqual(project);
    expect(project.archivedAt).toBeNull();
  });

  test('수정으로 아카이브나 id가 바뀌지 않도록 수정 입력의 모르는 필드는 저장하지 않는다', async () => {
    // Given
    const blog = await repository.create({ name: '블로그', color: 'sky' });
    const changes = { color: 'rose' as const, id: 999, archivedAt: '2026-10-02T00:00:00.000Z' };

    // When
    const updated = await repository.update(blog.id, changes);

    // Then: 반환값과 저장된 행 모두 색만 바뀜
    const stored = await repository.findById(blog.id);
    const expected = { ...blog, color: 'rose' };
    expect(updated).toEqual(expected);
    expect(stored).toEqual(expected);
  });
});
