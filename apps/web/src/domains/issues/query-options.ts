import { openIssueCountSchema } from '@lokibench/shared/contracts';
import { queryOptions } from '@tanstack/react-query';
import { z } from 'zod';

import { apiRequest } from '@/lib/api-client';

// 이슈 조회 설정 모음
export const issueQueries = {
  all: () => ['issues'] as const,

  // 프로젝트 관리 표가 쓰는, 열린 이슈가 1건 이상인 프로젝트별 열린 이슈 수
  openCounts: () =>
    queryOptions({
      queryKey: [...issueQueries.all(), 'open-counts'],
      queryFn: () => apiRequest('/issues/open-counts', z.array(openIssueCountSchema)),
    }),
};
