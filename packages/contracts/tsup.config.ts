import { defineConfig } from 'tsup';

export default defineConfig((options) => ({
  entry: ['src/index.ts'],
  format: ['cjs', 'esm'],
  dts: true,
  // 감시 모드에서 dist를 비우면 타입 파일이 다시 써지기 전에 api 컴파일이 시작되어 실패함
  clean: !options.watch,
}));
