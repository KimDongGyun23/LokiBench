import type { Project } from '@lokibench/contracts';

import { Button } from '@/components/Button';
import type { ProjectColor } from '@/domains/projects/colors.constant';
import { ProjectColorDot } from '@/domains/projects/ProjectColorDot';

import { ColorPicker } from './ColorPicker';

interface ProjectViewRowProps {
  project: Project;
  color: ProjectColor;
  onColorChange: (color: ProjectColor) => void;
  onEditStart: () => void;
}

/**
 * 프로젝트 하나의 이름과 색을 보여 주는 행을 그린다.
 *
 * - 이름이 길어 잘리면 마우스를 올렸을 때 전체 이름이 보인다
 * - 수정 버튼은 행마다 글자가 같아서, 스크린 리더에는 프로젝트 이름을 붙여 읽힌다
 *
 * @param props.project 그릴 프로젝트
 * @param props.color 지금 보여 줄 색
 * @param props.onColorChange 다른 색을 눌렀을 때 그 색을 받는 함수
 * @param props.onEditStart 수정을 눌렀을 때 부르는 함수
 */
export function ProjectViewRow({
  project,
  color,
  onColorChange,
  onEditStart,
}: ProjectViewRowProps) {
  return (
    <tr className="border-line border-b">
      <td className="py-3 pl-5 align-top">
        <div className="flex items-start gap-2">
          <div className="flex h-7 items-center">
            <ProjectColorDot color={color} />
          </div>
          <span
            className="truncate leading-7 font-medium"
            title={project.name}
          >
            {project.name}
          </span>
        </div>
      </td>
      <td className="px-2.5 py-3 align-top">
        <div className="flex h-7 items-center">
          <ColorPicker
            value={color}
            onChange={onColorChange}
          />
        </div>
      </td>
      <td className="py-3 pr-5 align-top">
        <div className="flex justify-end">
          <Button
            size="sm"
            aria-label={`${project.name} 이름 수정`}
            onClick={onEditStart}
          >
            수정
          </Button>
        </div>
      </td>
    </tr>
  );
}
