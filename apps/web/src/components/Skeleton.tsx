import type { ReactNode } from 'react';

import { cn } from '@/lib/cn';

interface SkeletonProps {
  label: string;
  className?: string;
  children: ReactNode;
}

/**
 * 내용을 받는 동안 그 자리에 깜빡이는 자리 표시를 그린다.
 *
 * @param props.label 무엇을 받는 중인지 알리는 이름 (예: 프로젝트 불러오는 중)
 * @param props.children 자리 표시 조각
 */
export function Skeleton({ label, className, children }: SkeletonProps) {
  return (
    <div
      role="status"
      aria-label={label}
      className={cn('animate-pulse', className)}
    >
      {children}
    </div>
  );
}

interface SkeletonBarProps {
  className?: string;
}

/**
 * 자리 표시 조각 하나를 둥근 막대로 그린다.
 */
export function SkeletonBar({ className }: SkeletonBarProps) {
  return <span className={cn('bg-raised block rounded-full', className)} />;
}
