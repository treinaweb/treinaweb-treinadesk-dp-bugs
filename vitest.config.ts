import swc from 'unplugin-swc';
import { defineConfig } from 'vitest/config';

// SWC compila os testes: o esbuild do Vite não emite os metadados de
// decorators que a injeção de dependência do Nest usa.
export default defineConfig({
  test: {
    globals: true,
    include: ['src/**/*.spec.ts'],
    coverage: { provider: 'v8', include: ['src/**/*.ts'] },
  },
  plugins: [swc.vite({ module: { type: 'es6' } })],
});
