import type { ComponentProps } from 'react';

import { cn } from '@/lib/cn';

/**
 * 입력칸 하나와 그 아래의 오류 문구를 세로로 묶는다.
 *
 * - 가로로 놓인 자리에서 남는 폭을 차지하게 하려면 className으로 flex-1을 준다
 */
export function Field({ className, ...props }: ComponentProps<'div'>) {
  return (
    <div
      data-slot="field"
      className={cn('flex min-w-0 flex-col', className)}
      {...props}
    />
  );
}

/**
 * 입력칸 아래에 오류 문구 한 줄을 보여 준다.
 *
 * - 문구가 없으면 아무것도 그리지 않아서, 쓰는 쪽이 오류 여부로 분기하지 않아도 된다
 * - 나타나는 순간 스크린 리더가 읽는다
 * - 입력칸의 aria-describedby와 이으려면 id를 준다
 */
export function FieldError({ className, children, ...props }: ComponentProps<'p'>) {
  if (children === undefined || children === null) return null;

  return (
    <p
      role="alert"
      data-slot="field-error"
      className={cn('text-coral mt-1.25 text-[11.5px]', className)}
      {...props}
    >
      {children}
    </p>
  );
}
