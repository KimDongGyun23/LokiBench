import { EmptyState } from '@/components/EmptyState';
import { TopBar, TopBarSkeleton } from '@/components/TopBar';
import { ProjectColorDot } from '@/domains/projects/ProjectColorDot';
import { useProjectsQuery } from '@/domains/projects/queries';
import { useProjectIdParam } from '@/domains/projects/useProjectIdParam';

/**
 * 주소의 프로젝트 id에 해당하는 프로젝트 화면을 그린다.
 *
 * - 목록에 없거나 양의 정수 표기가 아닌 id면 존재하지 않는 프로젝트라는 안내와 대시보드로 가는 버튼을 보인다
 * - 목록을 받는 동안은 제목 자리에 깜빡이는 줄을 보이고, 받지 못하면 실패 문구를 보인다
 */
export function ProjectPage() {
  const projectId = useProjectIdParam();
  const { data: projects, isPending, isError } = useProjectsQuery();

  if (isPending) return <TopBarSkeleton label="프로젝트 불러오는 중" />;
  if (isError) return <EmptyState title="프로젝트를 불러오지 못했습니다" />;

  const project = projects.find((candidate) => candidate.id === projectId);
  if (project === undefined) {
    return (
      <EmptyState
        title="존재하지 않는 프로젝트"
        description="주소가 잘못되었거나 삭제된 프로젝트입니다."
        action={{ label: '대시보드로 이동', to: '/dashboard' }}
      />
    );
  }

  return (
    <>
      <TopBar
        title={project.name}
        leading={
          <ProjectColorDot
            color={project.color}
            className="size-2.5"
          />
        }
      />
      <EmptyState
        title="준비 중인 화면"
        description="4번 기능에서 구현됩니다."
      />
    </>
  );
}
