// Teste de mutação: o Stryker altera o código (inverte condições, troca
// operadores, remove chamadas) e roda os testes contra cada versão. Mutante
// que sobrevive = mudança de comportamento que nenhum teste percebeu.
/** @type {import('@stryker-mutator/api/core').PartialStrykerOptions} */
export default {
  testRunner: 'vitest',
  vitest: { configFile: 'vitest.config.ts' },
  mutate: ['src/tickets/tickets.service.ts'],
  coverageAnalysis: 'perTest',
  reporters: ['clear-text', 'progress', 'html'],
  htmlReporter: { fileName: 'reports/mutation/index.html' },
  incremental: true,
  incrementalFile: 'reports/stryker-incremental.json',
};
