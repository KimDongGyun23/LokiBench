import { createCn } from 'cn/config';

/**
 * 클래스를 합치고, 충돌하면 뒤에 준 쪽을 남긴다.
 *
 * - 컨트롤 크기를 등록해야 글자색과 글자 크기를 구분한다
 */
export const cn = createCn({
  extend: {
    theme: {
      spacing: ['control-sm', 'control-md', 'control-lg'],
      text: ['control-sm', 'control-md', 'control-lg'],
      radius: ['control-sm', 'control-md'],
    },
  },
});
