import { Outlet } from 'react-router';

import { Toaster } from '@/components/Toaster';

import { Sidebar } from './Sidebar';

/**
 * 모든 화면이 함께 쓰는 틀을 그린다.
 */
export function AppLayout() {
  return (
    <div className="flex h-dvh">
      <Sidebar />
      <main className="flex min-w-0 flex-1 flex-col overflow-y-auto pt-5">
        <Outlet />
      </main>
      <Toaster />
    </div>
  );
}
