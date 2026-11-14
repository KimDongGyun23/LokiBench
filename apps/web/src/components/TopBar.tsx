import type { ReactNode } from 'react';

import { Skeleton, SkeletonBar } from './Skeleton';

interface TopBarProps {
  title: string;
  leading?: ReactNode;
}

/**
 * 화면 맨 위에 그 화면의 제목을 그린다.
 *
 * @param props.title 화면 제목
 * @param props.leading 제목 앞에 붙일 요소
 */
export function TopBar({ title, leading }: TopBarProps) {
  return (
    <header className="flex min-h-17 items-center px-7 pt-3.5 pb-1.5">
      <h1 className="flex min-w-0 items-center gap-2.5 text-[22px] font-bold tracking-[-0.02em]">
        {leading}
        <span className="truncate">{title}</span>
      </h1>
    </header>
  );
}

interface TopBarSkeletonProps {
  label: string;
}

/**
 * 화면 제목을 아직 모를 때 상단 바 자리에 깜빡이는 줄을 그린다.
 *
 * @param props.label 무엇을 받는 중인지 알리는 이름
 */
export function TopBarSkeleton({ label }: TopBarSkeletonProps) {
  return (
    <Skeleton
      label={label}
      className="flex min-h-17 items-center px-7 pt-3.5 pb-1.5"
    >
      <SkeletonBar className="h-6 w-40" />
    </Skeleton>
  );
}
