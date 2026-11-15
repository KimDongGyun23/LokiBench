import type { Project } from '@lokibench/contracts';

import { Skeleton, SkeletonBar } from '@/components/Skeleton';

import { CreateProjectForm } from './CreateProjectForm';
import { ProjectRow } from './ProjectRow';

/**
 * 프로젝트 목록을 받는 동안 표 자리에 깜빡이는 줄을 그린다.
 */
export function ProjectTableSkeleton() {
  return (
    <Skeleton
      label="프로젝트 불러오는 중"
      className="flex flex-col gap-3"
    >
      <SkeletonBar className="h-4 w-56" />
      <SkeletonBar className="h-4 w-40" />
    </Skeleton>
  );
}

interface ProjectTableProps {
  projects: Project[];
}

/**
 * 프로젝트를 한 줄씩 보여 주는 표와 그 아래의 추가 줄을 그린다.
 *
 * - 프로젝트가 없으면 어디서 추가하는지 안내하는 줄을 대신 보인다
 *
 * @param props.projects 표에 그릴 프로젝트 목록
 */
export function ProjectTable({ projects }: ProjectTableProps) {
  return (
    <div className="border-line bg-surface overflow-hidden rounded-xl border">
      <table
        aria-label="프로젝트"
        className="w-full table-fixed border-collapse text-left text-xs"
      >
        <thead>
          <tr className="border-line text-muted-fg border-b text-[11px]">
            <th
              scope="col"
              className="py-3 pl-5 font-medium"
            >
              프로젝트
            </th>
            <th
              scope="col"
              className="w-42 px-2.5 py-3 font-medium"
            >
              색상
            </th>
            <th
              scope="col"
              className="w-32 py-3 pr-5"
            >
              <span className="sr-only">이름 수정</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {projects.map((project) => (
            <ProjectRow
              key={project.id}
              project={project}
            />
          ))}
          {projects.length === 0 && (
            <tr className="border-line border-b">
              <td
                colSpan={3}
                className="text-faint px-5 py-3 leading-7"
              >
                아직 프로젝트가 없습니다. 아래에서 새 프로젝트를 추가해 주세요.
              </td>
            </tr>
          )}
        </tbody>
      </table>
      <CreateProjectForm />
    </div>
  );
}
