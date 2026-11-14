import { Archive, Calendar, CircleUserRound, Flag, LayoutGrid, Settings2, Sun } from 'lucide-react';
import type { ReactNode } from 'react';
import { NavLink } from 'react-router';

import { BrandMark } from '@/components/BrandMark';
import { Button } from '@/components/Button';
import { Skeleton, SkeletonBar } from '@/components/Skeleton';
import { ProjectColorDot } from '@/domains/projects/ProjectColorDot';
import { useProjectsQuery } from '@/domains/projects/queries';
import { cn } from '@/lib/cn';

interface SidebarLinkProps {
  to: string;
  label: string;
  icon: ReactNode;
}

/**
 * 사이드바의 한 줄 링크를 아이콘 칸과 이름으로 그린다.
 *
 * - 현재 주소와 같은 항목은 밝은 면과 굵은 글자로 선택 상태를 보인다
 * - 이름이 길면 한 줄로 줄이고, 마우스를 올리면 전체 이름이 보인다
 *
 * @param props.to 이동할 주소
 * @param props.label 항목 이름
 * @param props.icon 이름 앞 칸에 넣을 요소 (아이콘은 14px로 맞춰짐)
 */
function SidebarLink({ to, label, icon }: SidebarLinkProps) {
  return (
    <NavLink
      to={to}
      title={label}
      className="group text-muted-fg hover:text-fg focus-visible:border-sky focus-visible:ring-ring aria-[current=page]:border-border aria-[current=page]:bg-muted aria-[current=page]:text-fg flex items-center gap-2.5 rounded-[9px] border border-transparent px-2 py-1.25 font-medium outline-none focus-visible:ring-3 aria-[current=page]:font-semibold"
    >
      <span
        aria-hidden
        className="bg-raised group-aria-[current=page]:bg-border inline-flex size-6.5 shrink-0 items-center justify-center rounded-lg [&>svg]:size-3.5"
      >
        {icon}
      </span>
      <span className="truncate">{label}</span>
    </NavLink>
  );
}

// 프로젝트 목록을 받는 동안 보일 자리 표시 줄의 너비
const PROJECT_SKELETON_WIDTHS = ['w-24', 'w-32', 'w-20'];

/**
 * 프로젝트 목록을 받는 동안 링크 자리에 깜빡이는 줄을 그린다.
 *
 * - 스크린 리더에는 불러오는 중이라는 상태 하나로 읽힌다
 */
function SidebarProjectsSkeleton() {
  return (
    <Skeleton
      label="프로젝트 목록 불러오는 중"
      className="flex flex-col gap-0.5"
    >
      {PROJECT_SKELETON_WIDTHS.map((width) => (
        <div
          key={width}
          className="flex items-center gap-2.5 px-2 py-1.25"
        >
          <SkeletonBar className="size-6.5 shrink-0 rounded-lg" />
          <SkeletonBar className={cn('h-3', width)} />
        </div>
      ))}
    </Skeleton>
  );
}

/**
 * 사이드바의 프로젝트 묶음을 만든 순서대로 그린다.
 *
 * - 목록을 받는 동안과 다시 시도하는 동안은 자리 표시 줄을 보인다
 * - 받지 못하면 실패 문구와 다시 시도 버튼을 보인다
 */
function SidebarProjects() {
  const { data: projects, isPending, isError, refetch } = useProjectsQuery();

  if (isPending) return <SidebarProjectsSkeleton />;
  if (isError) {
    return (
      <div className="flex items-center justify-between gap-2 px-2 py-1">
        <p className="text-muted-fg">불러오지 못함</p>
        <Button
          size="sm"
          onClick={() => refetch()}
        >
          다시 시도
        </Button>
      </div>
    );
  }

  return projects.map((project) => (
    <SidebarLink
      key={project.id}
      to={`/projects/${project.id}`}
      label={project.name}
      icon={<ProjectColorDot color={project.color} />}
    />
  ));
}

/**
 * 모든 화면 왼쪽에 고정되는 주 메뉴를 그린다.
 */
export function Sidebar() {
  return (
    <nav
      aria-label="주 메뉴"
      className="border-line bg-side flex w-(--sidebar-width) shrink-0 flex-col gap-0.5 overflow-y-auto border-r px-3 pt-5.5 pb-3.5"
    >
      <div className="mb-5.5 flex h-8 items-center gap-2.5 px-2 text-[15px] font-bold tracking-[-0.01em]">
        <BrandMark />
        LokiBench
      </div>

      <p className="text-faint px-2 pb-1.5 text-[11.5px] font-medium">View</p>
      <SidebarLink
        to="/dashboard"
        label="대시보드"
        icon={<LayoutGrid />}
      />
      <SidebarLink
        to="/my"
        label="내 작업"
        icon={<CircleUserRound />}
      />
      <SidebarLink
        to="/today"
        label="오늘"
        icon={<Sun />}
      />
      <SidebarLink
        to="/week"
        label="주간"
        icon={<Calendar />}
      />

      <p className="text-faint mt-7 px-2 pb-1.5 text-[11.5px] font-medium">Projects</p>
      <SidebarProjects />

      <div className="mt-auto flex flex-col gap-0.5 pt-7">
        <SidebarLink
          to="/milestones"
          label="마일스톤 관리"
          icon={<Flag />}
        />
        <SidebarLink
          to="/archive"
          label="아카이브"
          icon={<Archive />}
        />
        <SidebarLink
          to="/projects-admin"
          label="프로젝트 관리"
          icon={<Settings2 />}
        />
      </div>
    </nav>
  );
}
