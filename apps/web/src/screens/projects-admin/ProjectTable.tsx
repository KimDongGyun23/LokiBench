import type { Project } from '@lokibench/shared/contracts';
import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';

import { Skeleton, SkeletonBar } from '@/components/Skeleton';
import { issueQueries } from '@/domains/issues/query-options';

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
 * - 이름은 한 번에 한 행만 고칠 수 있어서, 한 행을 고치는 동안 다른 행의 수정은 누를 수 없다
 * - 열린 이슈 수는 받는 중이거나 받지 못했으면 칸을 비우고, 표의 다른 일은 막지 않는다
 *
 * @param props.projects 표에 그릴 프로젝트 목록
 */
export function ProjectTable({ projects }: ProjectTableProps) {
  const [editingProjectId, setEditingProjectId] = useState<number | null>(null);
  const { data: openCountsByProject } = useQuery(issueQueries.openCounts());

  // 수를 받았으면 목록에 없는 프로젝트는 열린 이슈가 없는 것이라 0
  const getOpenIssueCount = (projectId: number) => {
    if (openCountsByProject === undefined) return undefined;
    const projectCount = openCountsByProject.find((item) => item.projectId === projectId);
    return projectCount?.count ?? 0;
  };

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
              className="w-17.5 px-2.5 py-3 font-medium"
            >
              열린 이슈
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
              openIssueCount={getOpenIssueCount(project.id)}
              isEditing={editingProjectId === project.id}
              canEdit={editingProjectId === null}
              onEditStart={() => setEditingProjectId(project.id)}
              onEditEnd={() => setEditingProjectId(null)}
            />
          ))}
          {projects.length === 0 && (
            <tr className="border-line border-b">
              <td
                colSpan={4}
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
