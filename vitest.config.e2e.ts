import swc from 'unplugin-swc';
import { defineConfig } from 'vitest/config';

// Integração: um arquivo por vez, porque as suítes compartilham o banco do
// .env.test e limpam as tabelas que usam.
export default defineConfig({
  test: {
    globals: true,
    include: ['test/**/*.e2e-spec.ts'],
    fileParallelism: false,
  },
  plugins: [swc.vite({ module: { type: 'es6' } })],
});
