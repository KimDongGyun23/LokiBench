import { zodResolver } from '@hookform/resolvers/zod';
import { type Project, projectNameSchema } from '@lokibench/contracts';
import { useMutation } from '@tanstack/react-query';
import { useId } from 'react';
import { useForm } from 'react-hook-form';

import { Button } from '@/components/Button';
import { Field, FieldError } from '@/components/Field';
import { Input } from '@/components/Input';
import { projectMutations } from '@/domains/projects/mutation-options';
import { ApiError } from '@/lib/api-client';
import { notify } from '@/lib/toast';

import {
  NAME_TAKEN_MESSAGE,
  projectNameFormSchema,
  type ProjectNameFormValues,
} from './project-name';

/**
 * 프로젝트 이름을 입력받아 새 프로젝트를 추가한다.
 *
 * - 이름이 비어 있거나 같은 이름이 이미 있으면 토스트 대신 입력칸 아래에 오류를 보인다
 * - 실패했을 때는 고쳐서 다시 시도할 수 있게 입력한 글자를 남긴다
 * - 추가하는 중에는 같은 이름이 두 번 추가되지 않게 다시 제출하지 못한다
 * - 추가하는 중에는 성공 뒤 입력칸을 비울 때 다음 이름이 지워지지 않게 입력도 받지 않는다
 */
export function CreateProjectForm() {
  const errorId = useId();
  const { mutate: createProject, isPending: isCreateProjectPending } = useMutation(
    projectMutations.create(),
  );

  const {
    register,
    handleSubmit,
    setError,
    reset,
    formState: { errors },
  } = useForm({
    resolver: zodResolver(projectNameFormSchema),
    defaultValues: { name: '' },
  });

  const errorMessage = errors.name?.message;
  const hasError = errorMessage !== undefined;

  const handleCreateSuccess = (project: Project) => {
    reset();
    notify.success(`${project.name} 프로젝트를 추가했습니다.`);
  };

  const handleCreateError = (error: Error) => {
    // 같은 이름은 고쳐서 다시 시도할 일이라 토스트 대신 입력칸 아래에 오류를 보임
    const isNameTaken = error instanceof ApiError && error.code === 'PROJECT_NAME_TAKEN';
    if (isNameTaken) {
      setError('name', { message: NAME_TAKEN_MESSAGE });
      return;
    }

    notify.error('프로젝트를 추가하지 못했습니다. 다시 시도해 주세요.');
  };

  const handleValidSubmit = ({ name }: ProjectNameFormValues) => {
    if (isCreateProjectPending) return;
    createProject({ name }, { onSuccess: handleCreateSuccess, onError: handleCreateError });
  };

  return (
    <form
      noValidate
      className="flex items-start gap-2 px-5 py-3.5"
      onSubmit={handleSubmit(handleValidSubmit)}
    >
      <Field className="flex-1">
        <Input
          aria-label="프로젝트 이름"
          placeholder="프로젝트 이름"
          maxLength={projectNameSchema.maxLength ?? undefined}
          readOnly={isCreateProjectPending}
          aria-invalid={hasError}
          aria-describedby={hasError ? errorId : undefined}
          {...register('name')}
        />
        <FieldError id={errorId}>{errorMessage}</FieldError>
      </Field>
      <Button
        type="submit"
        variant="primary"
        disabled={isCreateProjectPending}
      >
        추가
      </Button>
    </form>
  );
}
