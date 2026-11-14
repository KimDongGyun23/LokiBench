import type { CSSProperties } from 'react';
import { Toaster as SonnerToaster } from 'sonner';

// sonner의 색 변수를 우리 색 토큰으로 바꾸고, 사이드바를 뺀 본문 영역의 가운데로 옮김
const TOASTER_STYLE: CSSProperties & Record<`--${string}`, string> = {
  left: 'calc(50% + var(--sidebar-width) / 2)',
  '--normal-bg': 'var(--primary)',
  '--normal-text': 'var(--primary-fg)',
  '--normal-border': 'transparent',
};

// 면은 종류와 상관없이 같고, 아이콘 색으로만 완료와 오류를 구분함
const TOAST_CLASS_NAMES = {
  success: '[&_[data-icon]]:text-mint-deep',
  error: '[&_[data-icon]]:text-coral-deep',
};

/**
 * notify로 띄운 토스트를 화면 아래에 보여 준다. 앱에 한 번만 둔다.
 *
 * - 화면 아래, 사이드바를 뺀 본문 영역의 가로 가운데에 뜬다
 * - 완료와 오류 모두 밝은 면에 어두운 글자이고, 아이콘으로 구분한다
 * - 완료는 초록 체크 아이콘, 오류는 빨간 경고 아이콘이다
 * - 여러 개가 뜨면 겹쳐 쌓이고, 마우스를 올리면 펼쳐진다
 */
export function Toaster() {
  return (
    <SonnerToaster
      theme="dark"
      position="bottom-center"
      style={TOASTER_STYLE}
      containerAriaLabel="알림"
      toastOptions={{ classNames: TOAST_CLASS_NAMES }}
    />
  );
}
