import type { DataSource } from 'typeorm';

// 연결마다 마지막으로 차례를 받은 작업 (연결이 사라지면 함께 사라짐)
const lastWorkByDataSource = new WeakMap<DataSource, Promise<unknown>>();

interface ExclusiveWork<T> {
  dataSource: DataSource;
  work: () => Promise<T>;
}

/**
 * 같은 DB 연결에 들어온 작업을 들어온 순서대로 하나씩 실행한다.
 *
 * - better-sqlite3 드라이버는 연결 하나를 모든 repository가 나눠 써서, 작업이 겹치면 트랜잭션끼리 격리되지 않는다
 *   (끼어든 읽기는 커밋 전 값을 보고, 끼어든 트랜잭션은 SAVEPOINT가 되어 앞 트랜잭션과 함께 롤백된다)
 * - 그래서 읽기도 쓰기와 같이 차례를 기다린다
 * - work 안에서 runExclusive를 다시 부르면 바깥 작업이 끝나기를 기다리게 되어 영원히 끝나지 않는다
 *
 * @param params.dataSource 작업을 실행할 DB 연결 (연결마다 차례를 따로 매김)
 * @param params.work 차례가 오면 실행할 작업
 * @returns work의 결과 (work가 실패하면 그 오류로 거부되고, 다음 작업은 그대로 실행됨)
 */
export function runExclusive<T>({ dataSource, work }: ExclusiveWork<T>): Promise<T> {
  const lastWork = lastWorkByDataSource.get(dataSource) ?? Promise.resolve();
  const result = lastWork.then(work);

  // 실패를 삼킨 Promise를 남겨 다음 작업이 앞 작업의 실패와 상관없이 돌게 함
  lastWorkByDataSource.set(
    dataSource,
    result.catch(() => undefined),
  );
  return result;
}
