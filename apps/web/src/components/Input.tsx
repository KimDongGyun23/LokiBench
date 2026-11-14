import { cva, type VariantProps } from 'class-variance-authority';
import type { ComponentProps } from 'react';

import { cn } from '@/lib/cn';

const inputVariants = cva(
  'border-border bg-canvas text-fg placeholder:text-faint focus-visible:border-sky focus-visible:ring-ring aria-invalid:border-coral aria-invalid:ring-ring-error w-full min-w-0 border transition-colors outline-none focus-visible:ring-3 disabled:pointer-events-none disabled:opacity-50 aria-invalid:ring-3',
  {
    variants: {
      size: {
        sm: 'h-control-sm rounded-control-sm text-control-sm px-2',
        md: 'h-control-md rounded-control-md text-control-md px-2.5',
        lg: 'h-control-lg rounded-control-md text-control-lg px-2.5 font-semibold',
      },
    },
    defaultVariants: {
      size: 'md',
    },
  },
);

interface InputProps
  extends Omit<ComponentProps<'input'>, 'size'>, VariantProps<typeof inputVariants> {}

/**
 * 앱 전체에서 쓰는 공용 한 줄 입력칸을 그린다.
 *
 * - 가장 어두운 면에 테두리를 두고, 안내 글자(placeholder)는 흐린 회색으로 보인다
 * - 크기는 sm(28px), md(32px), lg(40px, 굵은 글자) 세 가지이고 기본은 md다
 * - 포커스하면 하늘색 테두리와 링이 생긴다
 * - aria-invalid면 코랄 테두리와 링으로 오류를 보여 준다
 * - disabled면 흐려지고 입력할 수 없다
 * - 기본 input의 size 속성(글자 수) 대신 크기 단계를 size로 받는다
 *
 * @param props.size sm 28px, md 32px, lg 40px
 */
export function Input({ className, size, ...props }: InputProps) {
  return (
    <input
      data-slot="input"
      className={cn(inputVariants({ size, className }))}
      {...props}
    />
  );
}
