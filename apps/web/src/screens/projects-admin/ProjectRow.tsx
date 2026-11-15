import type { Project } from '@lokibench/contracts';
import { useMutation } from '@tanstack/react-query';
import { useState } from 'react';

import type { ProjectColor } from '@/domains/projects/colors.constant';
import { projectMutations } from '@/domains/projects/mutation-options';
import { notify } from '@/lib/toast';

import { ProjectEditRow } from './ProjectEditRow';
import { ProjectViewRow } from './ProjectViewRow';

interface ProjectRowProps {
  project: Project;
}

/**
 * 프로젝트 관리 표에서 프로젝트 하나를 보는 행 또는 이름을 고치는 행으로 그린다.
 *
 * - 색을 누르면 응답을 기다리지 않고 누른 색을 먼저 보여 준다
 * - 색 저장에 실패하면 원래 색으로 돌아가고 오류 토스트를 띄운다
 * - 이름을 고치는 중에도 색을 바꿀 수 있게, 색 변경은 두 행이 함께 쓴다
 * - 이름을 고치는 중인지는 행마다 따로 기억해서, 여러 행을 함께 고칠 수 있다
 *
 * @param props.project 그릴 프로젝트
 */
export function ProjectRow({ project }: ProjectRowProps) {
  const [isEditing, setIsEditing] = useState(false);

  const {
    mutate: changeColor,
    isPending: isChangeColorPending,
    variables: changeColorVariables,
  } = useMutation(projectMutations.changeColor());

  const handleColorChange = (color: ProjectColor) => {
    changeColor(
      { projectId: project.id, color },
      { onError: () => notify.error('색을 바꾸지 못했습니다.') },
    );
  };

  const handleEditStart = () => setIsEditing(true);
  const handleEditEnd = () => setIsEditing(false);

  // 저장과 목록 다시 받기가 끝날 때까지는 누른 색을 보여 줌
  const shownColor = isChangeColorPending ? changeColorVariables.color : project.color;

  if (isEditing) {
    return (
      <ProjectEditRow
        project={project}
        color={shownColor}
        onColorChange={handleColorChange}
        onEditEnd={handleEditEnd}
      />
    );
  }

  return (
    <ProjectViewRow
      project={project}
      color={shownColor}
      onColorChange={handleColorChange}
      onEditStart={handleEditStart}
    />
  );
}
