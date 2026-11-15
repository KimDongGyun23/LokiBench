import { Link } from 'react-router';

import { Button } from '@/components/Button';
import { PageNotice } from '@/components/PageNotice';

/**
 * 화면이 그리는 도중 오류가 났을 때 안내와 대시보드로 가는 버튼을 그린다.
 */
export function ErrorPage() {
  return (
    <PageNotice
      title="화면을 표시하지 못했습니다"
      description="잠시 후 다시 시도해 주세요."
      action={
        <Button
          asChild
          variant="primary"
        >
          <Link to="/dashboard">대시보드로 이동</Link>
        </Button>
      }
    />
  );
}
