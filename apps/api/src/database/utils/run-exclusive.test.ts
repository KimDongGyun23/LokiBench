import { DataSource } from 'typeorm';

import { createDataSourceOptions } from '@/database/data-source-options';

import { runExclusive } from './run-exclusive';

// 줄의 열쇠로만 쓰는 연결 (연결을 열지 않음)
const dataSource = new DataSource(createDataSourceOptions(':memory:'));

describe('같은 연결의 작업 줄 세우기', () => {
  test('트랜잭션 도중에 다른 작업이 끼지 않도록 앞 작업이 끝난 뒤에 다음 작업을 시작한다', async () => {
    // Given: 작업이 시작하고 끝난 순서를 적음
    const steps: string[] = [];
    const work = (name: string) => async () => {
      steps.push(`${name} 시작`);
      await new Promise((resolve) => setTimeout(resolve, 5));
      steps.push(`${name} 끝`);
    };

    // When: 앞 작업을 기다리지 않고 둘을 함께 시작함
    await Promise.all([
      runExclusive({ dataSource, work: work('앞') }),
      runExclusive({ dataSource, work: work('뒤') }),
    ]);

    // Then
    expect(steps).toEqual(['앞 시작', '앞 끝', '뒤 시작', '뒤 끝']);
  });

  test('한 번의 실패가 뒤 요청을 막지 않도록 앞 작업이 실패해도 다음 작업은 실행한다', async () => {
    // Given
    const failing = runExclusive({
      dataSource,
      work: () => Promise.reject(new Error('저장 실패')),
    });

    // When
    const next = runExclusive({ dataSource, work: () => Promise.resolve('다음 작업') });

    // Then
    await expect(failing).rejects.toThrow('저장 실패');
    await expect(next).resolves.toBe('다음 작업');
  });
});
