import { type Project, projectNameSchema } from '@lokibench/contracts';
import { useMutation } from '@tanstack/react-query';
import { type ChangeEvent, type KeyboardEvent, useId, useState } from 'react';

import { Button } from '@/components/Button';
import { Input } from '@/components/Input';
import { projectMutations } from '@/domains/projects/mutation-options';
import { ApiError } from '@/lib/api-client';
import { notify } from '@/lib/toast';

import { isSubmitKey, NAME_TAKEN_MESSAGE, validateProjectName } from './project-name';

/**
 * 프로젝트 이름을 입력받아 새 프로젝트를 추가한다.
 *
 * - 이름이 비어 있거나 같은 이름이 이미 있으면 토스트 대신 입력칸 아래에 오류를 보인다
 * - 실패했을 때는 고쳐서 다시 시도할 수 있게 입력한 글자를 남긴다
 * - 추가하는 중에는 같은 이름이 두 번 추가되지 않게 다시 제출하지 못한다
 * - 추가하는 중에는 성공 뒤 입력칸을 비울 때 다음 이름이 지워지지 않게 입력도 받지 않는다
 */
export function CreateProjectForm() {
  const [name, setName] = useState('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const hasError = errorMessage !== null;
  const errorId = useId();

  const { mutate: createProject, isPending: isCreateProjectPending } = useMutation(
    projectMutations.create(),
  );

  const handleCreateSuccess = (project: Project) => {
    setName('');
    notify.success(`${project.name} 프로젝트를 추가했습니다.`);
  };

  const handleCreateError = (error: Error) => {
    // 같은 이름은 고쳐서 다시 시도할 일이라 토스트 대신 입력칸 아래에 오류를 보임
    const isNameTaken = error instanceof ApiError && error.code === 'PROJECT_NAME_TAKEN';
    if (isNameTaken) {
      setErrorMessage(NAME_TAKEN_MESSAGE);
      return;
    }

    notify.error('프로젝트를 추가하지 못했습니다.');
  };

  const handleSubmit = () => {
    // 추가하는 중에는 같은 이름이 두 번 추가되지 않게 막음
    if (isCreateProjectPending) return;

    // 이름이 비어 있으면 요청하지 않고 입력칸 아래에 오류를 보임
    const validation = validateProjectName(name);
    if (!validation.isValid) {
      setErrorMessage(validation.message);
      return;
    }

    // 앞뒤 공백을 지운 이름으로 추가를 요청함
    createProject(
      { name: validation.name },
      { onSuccess: handleCreateSuccess, onError: handleCreateError },
    );
  };

  const handleNameChange = (event: ChangeEvent<HTMLInputElement>) => {
    setName(event.target.value);
    setErrorMessage(null);
  };

  const handleNameKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (isSubmitKey(event)) handleSubmit();
  };

  return (
    <div className="flex items-start gap-2 px-5 py-3.5">
      <div className="flex min-w-0 flex-1 flex-col">
        <Input
          aria-label="프로젝트 이름"
          placeholder="프로젝트 이름"
          maxLength={projectNameSchema.maxLength ?? undefined}
          value={name}
          readOnly={isCreateProjectPending}
          aria-invalid={hasError}
          aria-describedby={hasError ? errorId : undefined}
          onChange={handleNameChange}
          onKeyDown={handleNameKeyDown}
        />
        {hasError && (
          <p
            id={errorId}
            className="text-coral mt-1.25 text-[11.5px]"
          >
            {errorMessage}
          </p>
        )}
      </div>
      <Button
        variant="primary"
        disabled={isCreateProjectPending}
        onClick={handleSubmit}
      >
        추가
      </Button>
    </div>
  );
}
