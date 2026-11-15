import { cva, type VariantProps } from 'class-variance-authority';
import { Slot } from 'radix-ui';
import type { ComponentProps } from 'react';

import { cn } from '@/lib/cn';

const buttonVariants = cva(
  'focus-visible:border-sky focus-visible:ring-ring inline-flex shrink-0 cursor-pointer items-center justify-center gap-1.5 border whitespace-nowrap transition-colors outline-none select-none focus-visible:ring-3 disabled:pointer-events-none disabled:opacity-50',
  {
    variants: {
      variant: {
        primary: 'border-primary bg-primary text-primary-fg hover:bg-primary-hover font-semibold',
        secondary: 'border-border text-fg hover:bg-raised bg-transparent font-medium',
      },
      size: {
        sm: 'h-control-sm rounded-control-sm text-control-sm px-2.5',
        md: 'h-control-md rounded-control-md text-control-md px-3',
      },
    },
    defaultVariants: {
      variant: 'secondary',
      size: 'md',
    },
  },
);

interface ButtonProps extends ComponentProps<'button'>, VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

/**
 * 앱 전체에서 쓰는 공용 버튼을 그린다.
 *
 * - type을 주지 않으면 button이라 폼 안에서 눌러도 제출되지 않는다
 * - asChild면 button 대신 링크 같은 자식 요소에 같은 모양을 입히고 type은 붙이지 않는다
 * - 링크는 disabled를 지원하지 않아서 asChild로 링크를 쓰면 disabled가 적용되지 않는다
 *
 * @param props.variant 주요(primary) 또는 보조(secondary)
 * @param props.size sm 28px 또는 md 32px
 * @param props.asChild 자식 요소를 그대로 쓰고 버튼 모양만 입힐지
 */
export function Button({
  className,
  variant,
  size,
  asChild = false,
  type = 'button',
  ...props
}: ButtonProps) {
  const Component = asChild ? Slot.Root : 'button';

  return (
    <Component
      data-slot="button"
      type={asChild ? undefined : type}
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  );
}
