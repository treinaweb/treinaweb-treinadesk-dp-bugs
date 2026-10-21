// ts-jest compila para CommonJS, mas o client gerado pelo Prisma usa
// import.meta.url, que só existe em ESM. Troca pelo equivalente em CommonJS
// antes de compilar; o resto é o ts-jest sem alteração.
const tsJest = require('ts-jest').default;

const IMPORT_META_URL = /import\.meta\.url/g;
const CJS_FILE_URL = "require('node:url').pathToFileURL(__filename).href";

function patch(source) {
  return source.replace(IMPORT_META_URL, CJS_FILE_URL);
}

module.exports = {
  createTransformer(options) {
    const transformer = tsJest.createTransformer(options);
    return {
      canInstrument: transformer.canInstrument,
      getCacheKey: (source, path, config) =>
        transformer.getCacheKey(patch(source), path, config),
      getCacheKeyAsync: (source, path, config) =>
        transformer.getCacheKeyAsync(patch(source), path, config),
      process: (source, path, config) =>
        transformer.process(patch(source), path, config),
      processAsync: (source, path, config) =>
        transformer.processAsync(patch(source), path, config),
    };
  },
};
