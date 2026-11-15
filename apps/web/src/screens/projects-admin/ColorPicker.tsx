import { projectColorSchema } from '@lokibench/contracts';

import { PROJECT_COLOR_HEX, type ProjectColor } from '@/domains/projects/colors.constant';
import { cn } from '@/lib/cn';

interface ColorPickerProps {
  value: ProjectColor;
  onChange: (color: ProjectColor) => void;
}

/**
 * 프로젝트 색을 팔레트 6색 가운데 하나로 고르게 한다.
 *
 * - 색 이름은 화면에 보이지 않고 스크린 리더에만 읽힌다
 * - 이미 고른 색을 다시 누르면 변경을 알리지 않는다
 *
 * @param props.value 지금 색
 * @param props.onChange 다른 색을 눌렀을 때 그 색을 받는 함수
 */
export function ColorPicker({ value, onChange }: ColorPickerProps) {
  // 이미 고른 색을 다시 누른 경우는 알리지 않음
  const handleColorClick = (color: ProjectColor) => {
    if (color === value) return;
    onChange(color);
  };

  return (
    <div className="flex items-center gap-2">
      {projectColorSchema.options.map((color) => {
        const isSelected = color === value;

        return (
          <button
            key={color}
            type="button"
            aria-label={color}
            aria-pressed={isSelected}
            className={cn(
              'focus-visible:outline-sky size-4.5 shrink-0 rounded-full outline-offset-1 transition-transform duration-150 focus-visible:outline-2',
              isSelected
                ? 'ring-fg ring-offset-surface ring-2 ring-offset-2'
                : 'cursor-pointer hover:scale-115',
            )}
            style={{ backgroundColor: PROJECT_COLOR_HEX[color] }}
            onClick={() => {
              handleColorClick(color);
            }}
          />
        );
      })}
    </div>
  );
}
