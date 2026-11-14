import { replace, type RouteObject } from 'react-router';

import { EmptyState } from '@/components/EmptyState';
import { TopBar } from '@/components/TopBar';
import { ErrorPage } from '@/screens/error/ErrorPage';
import { NotFoundPage } from '@/screens/not-found/NotFoundPage';
import { ProjectPage } from '@/screens/project/ProjectPage';

import { AppLayout } from './AppLayout';

interface PlaceholderPageEntry {
  path: string;
  title: string;
  featureNumber: number;
}

// 아직 만들지 않은 화면. 화면을 만드는 기능에서 여기서 빼고 경로 표에 한 줄을 더함
const PLACEHOLDER_PAGES: PlaceholderPageEntry[] = [
  { path: 'dashboard', title: '대시보드', featureNumber: 9 },
  { path: 'my', title: '내 작업', featureNumber: 7 },
  { path: 'today', title: '오늘', featureNumber: 8 },
  { path: 'week', title: '주간', featureNumber: 8 },
  { path: 'milestones', title: '마일스톤 관리', featureNumber: 3 },
  { path: 'archive', title: '아카이브', featureNumber: 10 },
  { path: 'projects-admin', title: '프로젝트 관리', featureNumber: 1 },
];

/**
 * 아직 만들지 않은 화면 한 줄을 제목과 준비 중 안내만 있는 경로로 바꾼다.
 *
 * @param page 주소, 제목, 만들 기능 번호
 * @returns 자리 화면 경로
 */
function toPlaceholderRoute({ path, title, featureNumber }: PlaceholderPageEntry): RouteObject {
  return {
    path,
    element: (
      <>
        <TopBar title={title} />
        <EmptyState
          title="준비 중인 화면"
          description={`${featureNumber}번 기능에서 구현됩니다.`}
        />
      </>
    ),
  };
}

/**
 * 주소마다 보일 화면
 *
 * - 모든 화면은 사이드바가 있는 같은 틀(AppLayout) 안에 그려짐
 * - 화면이 그리다 오류를 던지면 틀은 남기고 본문 자리에만 오류 화면을 그림
 */
export const routes: RouteObject[] = [
  {
    element: <AppLayout />,
    errorElement: <ErrorPage />,
    children: [
      {
        errorElement: <ErrorPage />,
        children: [
          { index: true, loader: () => replace('/dashboard') },
          { path: 'projects/:projectId', element: <ProjectPage /> },
          ...PLACEHOLDER_PAGES.map(toPlaceholderRoute),
          { path: '*', element: <NotFoundPage /> },
        ],
      },
    ],
  },
];
