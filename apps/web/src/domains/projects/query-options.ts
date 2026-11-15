import { projectSchema } from '@lokibench/contracts';
import { queryOptions } from '@tanstack/react-query';
import { z } from 'zod';

import { apiRequest } from '@/lib/api-client';

// 프로젝트 조회 설정 모음
export const projectQueries = {
  all: () => ['projects'] as const,

  // 사이드바와 프로젝트 화면이 함께 쓰는, 보관하지 않은 프로젝트 목록 (만든 순서)
  list: () =>
    queryOptions({
      queryKey: [...projectQueries.all(), 'list'],
      queryFn: () => apiRequest('/projects', z.array(projectSchema)),
    }),
};
