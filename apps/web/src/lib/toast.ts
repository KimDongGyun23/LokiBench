import { toast } from 'sonner';

// 토스트가 떠 있는 기본 시간
const DEFAULT_DURATION_MS = 3000;

interface NotifyOptions {
  duration?: number;
}

/**
 * 어느 화면에서나 토스트를 띄우는 입구.
 *
 * - success는 초록 체크 아이콘, error는 빨간 경고 아이콘으로 뜬다
 * - 닫히는 시간을 주지 않으면 3초 뒤 스스로 닫힌다
 * - 화면에 보이려면 앱에 Toaster가 한 번 놓여 있어야 한다
 */
export const notify = {
  /**
   * 완료 토스트를 띄운다. (초록 체크 아이콘)
   *
   * @param message 보여 줄 문구
   * @param options.duration 떠 있는 시간(ms). 기본 3초
   */
  success(message: string, options: NotifyOptions = {}): void {
    toast.success(message, { duration: options.duration ?? DEFAULT_DURATION_MS });
  },

  /**
   * 오류 토스트를 띄운다. (빨간 경고 아이콘)
   *
   * @param message 보여 줄 문구
   * @param options.duration 떠 있는 시간(ms). 기본 3초
   */
  error(message: string, options: NotifyOptions = {}): void {
    toast.error(message, { duration: options.duration ?? DEFAULT_DURATION_MS });
  },
};
