import { DataSource } from 'typeorm';

import { createDataSourceOptions } from '@/database/data-source-options';

import { isUniqueViolation } from './is-unique-violation';

let dataSource: DataSource;

beforeEach(async () => {
  // sqlite가 실제로 던지는 예외로 확인하려고 인메모리 DB를 띄움
  dataSource = await new DataSource(createDataSourceOptions(':memory:')).initialize();
});

afterEach(async () => {
  await dataSource.destroy();
});

/**
 * 쿼리를 실행해 sqlite가 던지는 예외를 잡아 돌려준다.
 *
 * @param sql 제약을 어기는 쿼리
 * @returns 잡은 예외 (던지지 않았으면 undefined)
 */
async function catchQueryError(sql: string): Promise<unknown> {
  try {
    await dataSource.query(sql);
    return undefined;
  } catch (error) {
    return error;
  }
}

describe('UNIQUE 위반 판별', () => {
  test('중복 저장을 규칙 오류로 바꿀 수 있도록 UNIQUE 제약 위반이면 true를 준다', async () => {
    // Given: 같은 이름의 프로젝트가 이미 있음
    await dataSource.query(
      `INSERT INTO projects (name, color, created_at)
       VALUES ('독서 기록', 'indigo', '2026-10-01T00:00:00.000Z')`,
    );

    // When
    const error = await catchQueryError(
      `INSERT INTO projects (name, color, created_at)
       VALUES ('독서 기록', 'sky', '2026-10-02T00:00:00.000Z')`,
    );

    // Then
    expect(isUniqueViolation(error)).toBe(true);
  });

  test('다른 제약 위반을 중복으로 잘못 알리지 않기 위해 CHECK 제약 위반이면 false를 준다', async () => {
    // When: 팔레트에 없는 색을 넣음
    const error = await catchQueryError(
      `INSERT INTO projects (name, color, created_at)
       VALUES ('가계부', 'black', '2026-10-01T00:00:00.000Z')`,
    );

    // Then: 예외는 났지만 UNIQUE 위반은 아님
    expect(error).toBeDefined();
    expect(isUniqueViolation(error)).toBe(false);
  });

  test('DB와 무관한 오류를 삼키지 않기 위해 쿼리 실패가 아닌 예외면 false를 준다', () => {
    // Given
    const error = new Error('연결이 끊김');

    // When
    const result = isUniqueViolation(error);

    // Then
    expect(result).toBe(false);
  });
});
