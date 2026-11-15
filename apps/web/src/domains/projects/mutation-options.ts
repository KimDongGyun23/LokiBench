import {
  type CreateProjectRequest,
  projectSchema,
  type UpdateProjectRequest,
} from '@lokibench/contracts';
import { mutationOptions, type QueryClient } from '@tanstack/react-query';

import { apiRequest } from '@/lib/api-client';

import type { ProjectColor } from './colors.constant';
import { projectQueries } from './query-options';

// 색 변경에 넘길 값
interface ChangeProjectColorVariables {
  projectId: number;
  color: ProjectColor;
}

/**
 * 받아 둔 프로젝트 목록에서 한 프로젝트의 색만 바꾼다.
 *
 * @param client 목록을 받아 둔 조회 캐시
 * @param projectId 색을 바꿀 프로젝트
 * @param color 바꿀 색
 */
function setCachedColor(client: QueryClient, projectId: number, color: ProjectColor) {
  client.setQueryData(projectQueries.list().queryKey, (projects) =>
    projects?.map((project) => (project.id === projectId ? { ...project, color } : project)),
  );
}

/**
 * 프로젝트 변경 설정 모음
 *
 * - 받아 둔 목록을 맞추는 일까지 담는다
 * - 결과를 어떻게 알릴지는 부르는 화면이 정한다
 */
export const projectMutations = {
  /**
   * 프로젝트를 추가한다.
   *
   * - 성공하면 목록을 다시 받지 않고 받아 둔 목록 끝에 붙인다
   * - 같은 이름처럼 거절이 흔해서, 응답을 받기 전에는 목록을 고치지 않는다
   *
   * @returns 프로젝트 추가 설정
   */
  create: () =>
    mutationOptions({
      mutationFn: (request: CreateProjectRequest) =>
        apiRequest('/projects', projectSchema, { method: 'POST', body: JSON.stringify(request) }),
      onSuccess: (createdProject, _request, _onMutateResult, { client }) => {
        client.setQueryData(projectQueries.list().queryKey, (projects) =>
          projects === undefined ? undefined : [...projects, createdProject],
        );
      },
    }),

  /**
   * 프로젝트 색을 바꾼다.
   *
   * - 누른 즉시 보이도록 응답을 기다리지 않고 받아 둔 목록의 색을 먼저 바꾼다
   * - 실패하면 그 프로젝트의 색만 원래대로 되돌린다
   *
   * @returns 프로젝트 색 변경 설정
   */
  changeColor: () =>
    mutationOptions({
      mutationFn: ({ projectId, color }: ChangeProjectColorVariables) => {
        const request: UpdateProjectRequest = { color };

        return apiRequest(`/projects/${projectId}`, projectSchema, {
          method: 'PATCH',
          body: JSON.stringify(request),
        });
      },
      onMutate: async ({ projectId, color }, { client }) => {
        // 먼저 나간 목록 조회가 늦게 도착해 바꾼 색을 덮어쓰지 않게 멈춤
        await client.cancelQueries({ queryKey: projectQueries.list().queryKey });

        const previousColor = client
          .getQueryData(projectQueries.list().queryKey)
          ?.find((project) => project.id === projectId)?.color;
        setCachedColor(client, projectId, color);

        return { previousColor };
      },
      onError: (_error, { projectId }, onMutateResult, { client }) => {
        if (onMutateResult?.previousColor === undefined) return;

        setCachedColor(client, projectId, onMutateResult.previousColor);
      },
    }),
};
