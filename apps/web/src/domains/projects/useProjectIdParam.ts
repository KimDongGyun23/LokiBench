import { useParams } from 'react-router';

// 프로젝트 id로 받아들이는 주소 표기 (앞자리가 0이 아닌 양의 정수)
const PROJECT_ID_PATTERN = /^[1-9]\d*$/;

/**
 * 주소의 프로젝트 id 조각(`:projectId`)을 숫자로 읽는다.
 *
 * - 01, 1.0, 1e0처럼 같은 숫자로 읽히는 다른 표기는 받지 않는다
 *
 * @returns 프로젝트 id, 양의 정수 표기가 아니면 undefined
 */
export function useProjectIdParam(): number | undefined {
  const { projectId } = useParams();

  const isInvalidProjectId = projectId === undefined || !PROJECT_ID_PATTERN.test(projectId);
  if (isInvalidProjectId) return undefined;

  return Number(projectId);
}
