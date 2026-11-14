import { EmptyState } from '@/components/EmptyState';

/**
 * 어느 화면에도 해당하지 않는 주소에서 안내와 대시보드로 가는 버튼을 그린다.
 */
export function NotFoundPage() {
  return (
    <EmptyState
      title="존재하지 않는 페이지"
      description="주소가 잘못되었거나 삭제된 페이지입니다."
      action={{ label: '대시보드로 이동', to: '/dashboard' }}
    />
  );
}
