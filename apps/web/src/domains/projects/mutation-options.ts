import {
  type CreateProjectRequest,
  projectSchema,
  type UpdateProjectRequest,
} from '@lokibench/shared/contracts';
import { mutationOptions } from '@tanstack/react-query';

import { apiRequest } from '@/lib/api-client';

import type { ProjectColor } from './colors.constant';
import { projectQueries } from './query-options';

// 색 변경에 넘길 값
interface ChangeProjectColorVariables {
  projectId: number;
  color: ProjectColor;
}

// 이름 변경에 넘길 값
interface RenameProjectVariables {
  projectId: number;
  name: string;
}

/**
 * 프로젝트 하나의 일부 값을 바꿔 달라고 서버에 요청한다.
 *
 * @param projectId 바꿀 프로젝트 id
 * @param request 바꿀 값
 * @returns 바뀐 뒤의 프로젝트
 */
function updateProject(projectId: number, request: UpdateProjectRequest) {
  return apiRequest(`/projects/${projectId}`, projectSchema, {
    method: 'PATCH',
    body: JSON.stringify(request),
  });
}

/**
 * 프로젝트 변경 설정 모음
 *
 * - 변경에 성공하면 프로젝트 조회를 다시 받아 서버와 맞춘다
 * - 다시 받기가 끝날 때까지 변경은 진행 중으로 남는다
 * - 결과를 어떻게 알릴지는 부르는 화면이 `mutate`의 둘째 인자로 덧붙여 정한다
 * - 설정을 펼쳐서 콜백을 덮어쓰면 다시 받기가 사라지므로 그렇게 쓰지 않는다
 */
export const projectMutations = {
  /**
   * 프로젝트를 추가한다.
   *
   * @returns 프로젝트 추가 설정
   */
  create: () =>
    mutationOptions({
      mutationFn: (request: CreateProjectRequest) =>
        apiRequest('/projects', projectSchema, { method: 'POST', body: JSON.stringify(request) }),
      onSuccess: (_project, _request, _onMutateResult, { client }) =>
        client.invalidateQueries({ queryKey: projectQueries.all() }),
    }),

  /**
   * 프로젝트 색을 바꾼다.
   *
   * - 누른 색을 응답 전에 먼저 보여 주는 일은 부르는 화면이 맡는다
   *
   * @returns 프로젝트 색 변경 설정
   */
  changeColor: () =>
    mutationOptions({
      mutationFn: ({ projectId, color }: ChangeProjectColorVariables) =>
        updateProject(projectId, { color }),
      onSuccess: (_project, _variables, _onMutateResult, { client }) =>
        client.invalidateQueries({ queryKey: projectQueries.all() }),
    }),

  /**
   * 프로젝트 이름을 바꾼다.
   *
   * @returns 프로젝트 이름 변경 설정
   */
  rename: () =>
    mutationOptions({
      mutationFn: ({ projectId, name }: RenameProjectVariables) =>
        updateProject(projectId, { name }),
      onSuccess: (_project, _variables, _onMutateResult, { client }) =>
        client.invalidateQueries({ queryKey: projectQueries.all() }),
    }),
};
