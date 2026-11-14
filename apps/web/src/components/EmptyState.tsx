import { Link } from 'react-router';

import { Button } from './Button';

interface EmptyStateAction {
  label: string;
  to: string;
}

interface EmptyStateProps {
  title: string;
  description?: string;
  action?: EmptyStateAction;
}

/**
 * 본문에 보여 줄 내용이 없을 때 제목, 설명, 이동 버튼을 본문 영역의 가운데에 그린다.
 *
 * @param props.title 무슨 상황인지 알리는 큰 글자
 * @param props.description 제목 아래 회색 설명
 * @param props.action 설명 아래 버튼의 이름과 이동할 주소
 */
export function EmptyState({ title, description, action }: EmptyStateProps) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-3.5 px-7 pb-5 text-center">
      <h2 className="text-[30px] font-bold tracking-[-0.02em]">{title}</h2>
      {description !== undefined && <p className="text-muted-fg text-[15px]">{description}</p>}
      {action !== undefined && (
        <Button
          asChild
          variant="primary"
          className="mt-6"
        >
          <Link to={action.to}>{action.label}</Link>
        </Button>
      )}
    </div>
  );
}
