import { defineConfig } from 'tsup';

export default defineConfig((options) => ({
  entry: { 'values/index': 'src/values/index.ts', 'contracts/index': 'src/contracts/index.ts' },
  format: ['cjs', 'esm'],
  dts: true,
  clean: !options.watch,
}));
