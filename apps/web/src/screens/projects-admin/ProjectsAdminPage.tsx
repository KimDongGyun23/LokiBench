import { useQuery } from '@tanstack/react-query';

import { Button } from '@/components/Button';
import { PageNotice } from '@/components/PageNotice';
import { TopBar } from '@/components/TopBar';
import { projectQueries } from '@/domains/projects/query-options';

import { ProjectTable, ProjectTableSkeleton } from './ProjectTable';

/**
 * 프로젝트를 한 줄씩 보여 주고 색을 바꾸는 프로젝트 관리 화면을 그린다.
 *
 * - 목록을 한 번도 받지 못했을 때만 실패 안내와 다시 시도 버튼을 보인다
 * - 이미 받은 목록이 있으면 다시 받기에 실패해도 표를 그대로 둔다
 */
export function ProjectsAdminPage() {
  const { data: projects, isError, isFetching, refetch } = useQuery(projectQueries.list());

  if (projects === undefined && isError) {
    return (
      <>
        <TopBar title="프로젝트 관리" />
        <PageNotice
          title="프로젝트를 불러오지 못했습니다"
          description="잠시 후 다시 시도해 주세요."
          action={
            <Button
              variant="primary"
              disabled={isFetching}
              onClick={() => refetch()}
            >
              다시 시도
            </Button>
          }
        />
      </>
    );
  }

  return (
    <>
      <TopBar title="프로젝트 관리" />
      <div className="px-7 pt-2.5 pb-10">
        {projects === undefined ? <ProjectTableSkeleton /> : <ProjectTable projects={projects} />}
        <p className="text-muted-fg mt-4 text-[11.5px] leading-[1.6]">
          새 프로젝트에는 사용 빈도가 가장 낮은 색이 자동으로 배정되며, 여러 프로젝트에서 같은 색을
          사용할 수 있습니다.
          <br />
          이슈 번호는 프로젝트 구분 없이 전체 프로젝트에 걸쳐 순차적으로 부여됩니다.
        </p>
      </div>
    </>
  );
}
