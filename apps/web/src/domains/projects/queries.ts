import { projectSchema } from '@lokibench/contracts';
import { useQuery } from '@tanstack/react-query';
import { z } from 'zod';

import { apiRequest } from '@/lib/api-client';

// 프로젝트 조회 캐시 키 (추가, 수정 뒤 all로 목록을 다시 받음)
export const projectKeys = {
  all: ['projects'] as const,
};

/**
 * 사이드바와 프로젝트 화면이 함께 쓰는 프로젝트 목록을 조회한다.
 *
 * - 보관하지 않은 프로젝트를 만든 순서대로 받는다
 *
 * @returns 프로젝트 목록 쿼리 결과
 */
export function useProjectsQuery() {
  return useQuery({
    queryKey: projectKeys.all,
    queryFn: () => apiRequest('/projects', z.array(projectSchema)),
  });
}
