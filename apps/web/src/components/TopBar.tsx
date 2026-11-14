import type { ReactNode } from 'react';

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
