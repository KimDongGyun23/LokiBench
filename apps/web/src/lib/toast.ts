import { toast } from 'sonner';

// 토스트가 떠 있는 시간 단계. 짧은 완료 문구는 short, 길수록 medium, long을 씀
const TOAST_DURATION_MS = {
  short: 3000,
  medium: 5000,
  long: 8000,
} as const;

// 토스트가 떠 있는 시간 단계의 이름
type ToastDuration = keyof typeof TOAST_DURATION_MS;

const DEFAULT_DURATION: ToastDuration = 'short';

interface NotifyOptions {
  duration?: ToastDuration;
}

/**
 * 어느 화면에서나 토스트를 띄우는 입구.
 *
 * - success는 초록 체크 아이콘, error는 빨간 경고 아이콘으로 뜬다
 * - 떠 있는 시간은 short(3초), medium(5초), long(8초) 중에서 고르고 기본은 short다
 * - 화면에 보이려면 앱에 Toaster가 한 번 놓여 있어야 한다
 */
export const notify = {
  /**
   * 완료 토스트를 띄운다. (초록 체크 아이콘)
   *
   * @param message 보여 줄 문구
   * @param options.duration 떠 있는 시간 단계. 기본 short
   */
  success(message: string, options: NotifyOptions = {}): void {
    toast.success(message, {
      duration: TOAST_DURATION_MS[options.duration ?? DEFAULT_DURATION],
    });
  },

  /**
   * 오류 토스트를 띄운다. (빨간 경고 아이콘)
   *
   * @param message 보여 줄 문구
   * @param options.duration 떠 있는 시간 단계. 기본 short
   */
  error(message: string, options: NotifyOptions = {}): void {
    toast.error(message, {
      duration: TOAST_DURATION_MS[options.duration ?? DEFAULT_DURATION],
    });
  },
};
