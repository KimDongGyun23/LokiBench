import swc from 'unplugin-swc';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
  },
  // esbuild는 데코레이터 메타데이터를 만들지 못해 Nest 의존성 주입이 깨지므로 swc로 변환
  plugins: [swc.vite({ module: { type: 'es6' } })],
});
