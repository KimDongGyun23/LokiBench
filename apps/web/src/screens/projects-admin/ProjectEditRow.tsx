import { zodResolver } from '@hookform/resolvers/zod';
import { type Project, projectNameSchema } from '@lokibench/shared/contracts';
import { useMutation } from '@tanstack/react-query';
import { type KeyboardEvent, useId } from 'react';
import { useForm } from 'react-hook-form';

import { Button } from '@/components/Button';
import { Field, FieldError } from '@/components/Field';
import { Input } from '@/components/Input';
import type { ProjectColor } from '@/domains/projects/colors.constant';
import { projectMutations } from '@/domains/projects/mutation-options';
import { ProjectColorDot } from '@/domains/projects/ProjectColorDot';
import { ApiError } from '@/lib/api-client';
import { notify } from '@/lib/toast';

import { ColorPicker } from './ColorPicker';
import {
  NAME_TAKEN_MESSAGE,
  projectNameFormSchema,
  type ProjectNameFormValues,
} from './project-name';

interface ProjectEditRowProps {
  project: Project;
  openIssueCount: number | undefined;
  color: ProjectColor;
  onColorChange: (color: ProjectColor) => void;
  onEditEnd: () => void;
}

/**
 * 프로젝트 하나의 이름을 입력칸에서 고쳐 저장하는 행을 그린다.
 *
 * - 표에서는 행을 폼으로 감쌀 수 없어서, 이름 칸의 폼을 맨 끝 칸의 저장 버튼이 id로 가리켜 제출한다
 * - 이름이 그대로면 저장해도 요청하지 않고 닫는다
 * - 저장하는 중에는 취소했는데 이름이 바뀌는 일이 없게 취소 버튼과 ESC도 막는다
 * - 이름이 비어 있거나 같은 이름이 이미 있으면 토스트 대신 입력칸 아래에 오류를 보인다
 * - 저장에 성공하면 목록에 새 이름이 온 뒤에 토스트 없이 닫는다
 * - 닫으면 입력한 글자와 오류가 함께 사라지도록, 고치는 동안에만 그린다
 *
 * @param props.project 이름을 고칠 프로젝트
 * @param props.openIssueCount 열린 이슈 수 (비어 있으면 칸을 비움)
 * @param props.color 지금 보여 줄 색
 * @param props.onColorChange 다른 색을 눌렀을 때 그 색을 받는 함수
 * @param props.onEditEnd 저장에 성공했거나 취소했을 때 부르는 함수
 */
export function ProjectEditRow({
  project,
  openIssueCount,
  color,
  onColorChange,
  onEditEnd,
}: ProjectEditRowProps) {
  const formId = useId();
  const errorId = useId();
  const { mutate: rename, isPending: isRenamePending } = useMutation(projectMutations.rename());

  const {
    register,
    handleSubmit,
    setError,
    formState: { errors },
  } = useForm({
    resolver: zodResolver(projectNameFormSchema),
    defaultValues: { name: project.name },
  });

  const errorMessage = errors.name?.message;
  const hasError = errorMessage !== undefined;

  const handleRenameError = (error: Error) => {
    // 같은 이름은 고쳐서 다시 시도할 일이라 토스트 대신 입력칸 아래에 오류를 보임
    const isNameTaken = error instanceof ApiError && error.code === 'PROJECT_NAME_TAKEN';
    if (isNameTaken) {
      setError('name', { message: NAME_TAKEN_MESSAGE });
      return;
    }

    notify.error('이름을 변경하지 못했습니다. 다시 시도해 주세요.');
  };

  const handleValidSubmit = ({ name }: ProjectNameFormValues) => {
    if (name === project.name) {
      onEditEnd();
      return;
    }
    rename({ projectId: project.id, name }, { onSuccess: onEditEnd, onError: handleRenameError });
  };

  // 저장하는 중에 닫으면 취소한 것처럼 보이는데 이름은 바뀌므로, 저장이 끝날 때까지 닫지 않음
  const handleCancel = () => {
    if (isRenamePending) return;
    onEditEnd();
  };

  const handleNameKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Escape') handleCancel();
  };

  return (
    <tr className="border-line border-b">
      <td className="py-3 pl-5 align-top">
        <div className="flex items-start gap-2">
          <div className="flex h-7 items-center">
            <ProjectColorDot color={color} />
          </div>
          <form
            id={formId}
            noValidate
            className="min-w-0 flex-1"
            onSubmit={handleSubmit(handleValidSubmit)}
          >
            <Field>
              <Input
                autoFocus
                size="sm"
                aria-label={`${project.name}의 새 이름`}
                maxLength={projectNameSchema.maxLength ?? undefined}
                readOnly={isRenamePending}
                aria-invalid={hasError}
                aria-describedby={hasError ? errorId : undefined}
                onKeyDown={handleNameKeyDown}
                {...register('name')}
              />
              <FieldError id={errorId}>{errorMessage}</FieldError>
            </Field>
          </form>
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
      <td className="px-2.5 py-3 align-top">
        <div className="text-muted-fg flex h-7 items-center">{openIssueCount}</div>
      </td>
      <td className="py-3 pr-5 align-top">
        <div className="flex justify-end gap-1.5">
          <Button
            type="submit"
            form={formId}
            size="sm"
            variant="primary"
            disabled={isRenamePending}
          >
            저장
          </Button>
          <Button
            size="sm"
            disabled={isRenamePending}
            onClick={handleCancel}
          >
            취소
          </Button>
        </div>
      </td>
    </tr>
  );
}
