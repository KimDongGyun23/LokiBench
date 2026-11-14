import { useEffect, useRef } from 'react';
import { Outlet, useLocation } from 'react-router';

import { Toaster } from '@/components/Toaster';

import { Sidebar } from './Sidebar';

/**
 * 모든 화면이 함께 쓰는 틀을 그린다.
 */
export function AppLayout() {
  const { pathname } = useLocation();
  const mainRef = useRef<HTMLElement>(null);

  // 본문 요소는 화면이 바뀌어도 그대로 남아서, 주소가 바뀔 때 스크롤을 직접 맨 위로 돌림
  useEffect(() => {
    const main = mainRef.current;
    if (main === null) return;

    main.scrollTop = 0;
  }, [pathname]);

  return (
    <div className="flex h-dvh">
      <Sidebar />
      <main
        ref={mainRef}
        className="flex min-w-0 flex-1 flex-col overflow-y-auto pt-5"
      >
        <Outlet />
      </main>
      <Toaster />
    </div>
  );
}
