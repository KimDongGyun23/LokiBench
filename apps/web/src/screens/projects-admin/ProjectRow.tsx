import type { Project } from '@lokibench/contracts';
import { useMutation } from '@tanstack/react-query';

import type { ProjectColor } from '@/domains/projects/colors.constant';
import { projectMutations } from '@/domains/projects/mutation-options';
import { ProjectColorDot } from '@/domains/projects/ProjectColorDot';
import { notify } from '@/lib/toast';

import { ColorPicker } from './ColorPicker';

interface ProjectRowProps {
  project: Project;
}

/**
 * 프로젝트 관리 표에서 프로젝트 하나의 이름과 색을 한 줄로 그린다.
 *
 * - 색을 누르면 응답을 기다리지 않고 누른 색을 먼저 보여 준다
 * - 저장에 실패하면 원래 색으로 돌아가고 오류 토스트를 띄운다
 * - 이름이 길어 잘리면 마우스를 올렸을 때 전체 이름이 보인다
 *
 * @param props.project 그릴 프로젝트
 */
export function ProjectRow({ project }: ProjectRowProps) {
  const {
    mutate: changeColor,
    isPending: isChangeColorPending,
    variables: changeColorVariables,
  } = useMutation(projectMutations.changeColor());

  // 저장과 목록 다시 받기가 끝날 때까지는 누른 색을 보여 줌
  const shownColor = isChangeColorPending ? changeColorVariables.color : project.color;

  const handleColorChange = (color: ProjectColor) => {
    changeColor(
      { projectId: project.id, color },
      { onError: () => notify.error('색을 바꾸지 못했습니다.') },
    );
  };

  return (
    <tr className="border-line border-b">
      <td className="py-3 pl-5">
        <div className="flex min-h-7 items-center gap-2 font-medium">
          <ProjectColorDot color={shownColor} />
          <span
            className="truncate"
            title={project.name}
          >
            {project.name}
          </span>
        </div>
      </td>
      <td className="py-3 pr-5 pl-2.5">
        <ColorPicker
          value={shownColor}
          onChange={handleColorChange}
        />
      </td>
    </tr>
  );
}
