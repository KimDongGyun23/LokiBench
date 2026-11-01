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
