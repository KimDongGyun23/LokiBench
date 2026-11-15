import type { Project } from '@lokibench/contracts';
import { useMutation } from '@tanstack/react-query';

import type { ProjectColor } from '@/domains/projects/colors.constant';
import { projectMutations } from '@/domains/projects/mutation-options';
import { notify } from '@/lib/toast';

import { ProjectEditRow } from './ProjectEditRow';
import { ProjectViewRow } from './ProjectViewRow';

interface ProjectRowProps {
  project: Project;
  isEditing: boolean;
  canEdit: boolean;
  onEditStart: () => void;
  onEditEnd: () => void;
}

/**
 * 프로젝트 관리 표에서 프로젝트 하나를 보는 행 또는 이름을 고치는 행으로 그린다.
 *
 * - 색을 누르면 응답을 기다리지 않고 누른 색을 먼저 보여 준다
 * - 색 저장에 실패하면 원래 색으로 돌아가고 오류 토스트를 띄운다
 * - 이름을 고치는 중에도 색을 바꿀 수 있게, 색 변경은 두 행이 함께 쓴다
 * - 이름을 고치는 중인지는 표가 정해서, 한 번에 한 행만 고칠 수 있다
 *
 * @param props.project 그릴 프로젝트
 * @param props.isEditing 이 행의 이름을 고치는 중인지
 * @param props.canEdit 지금 이 행의 수정을 누를 수 있는지
 * @param props.onEditStart 수정을 눌렀을 때 부르는 함수
 * @param props.onEditEnd 저장에 성공했거나 취소했을 때 부르는 함수
 */
export function ProjectRow({
  project,
  isEditing,
  canEdit,
  onEditStart,
  onEditEnd,
}: ProjectRowProps) {
  const {
    mutate: changeColor,
    isPending: isChangeColorPending,
    variables: changeColorVariables,
  } = useMutation(projectMutations.changeColor());

  const handleColorChange = (color: ProjectColor) => {
    changeColor(
      { projectId: project.id, color },
      { onError: () => notify.error('색을 변경하지 못했습니다. 다시 시도해 주세요.') },
    );
  };

  // 저장과 목록 다시 받기가 끝날 때까지는 누른 색을 보여 줌
  const shownColor = isChangeColorPending ? changeColorVariables.color : project.color;

  if (isEditing) {
    return (
      <ProjectEditRow
        project={project}
        color={shownColor}
        onColorChange={handleColorChange}
        onEditEnd={onEditEnd}
      />
    );
  }

  return (
    <ProjectViewRow
      project={project}
      color={shownColor}
      onColorChange={handleColorChange}
      canEdit={canEdit}
      onEditStart={onEditStart}
    />
  );
}
