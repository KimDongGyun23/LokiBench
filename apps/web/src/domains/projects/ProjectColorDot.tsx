import { cn } from '@/lib/cn';

import { PROJECT_COLOR_HEX, type ProjectColor } from './colors.constant';

interface ProjectColorDotProps {
  color: ProjectColor;
  className?: string;
}

/**
 * 프로젝트 색을 작은 원으로 보여 준다.
 *
 * - 지름 8px이고 줄어들지 않아 긴 이름 옆에서도 모양을 지킨다
 * - 이름이 함께 보이는 자리에 쓰므로 스크린 리더에는 읽히지 않는다
 * - 크기를 바꾸려면 className으로 덮어쓴다
 *
 * @param props.color 팔레트 색 이름
 */
export function ProjectColorDot({ color, className }: ProjectColorDotProps) {
  return (
    <span
      aria-hidden
      className={cn('inline-block size-2 shrink-0 rounded-full', className)}
      style={{ backgroundColor: PROJECT_COLOR_HEX[color] }}
    />
  );
}
