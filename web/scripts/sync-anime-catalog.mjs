import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import ts from "typescript";

const webRoot = path.resolve(import.meta.dirname, "..");
const repositoryRoot = path.resolve(webRoot, "..");

function evaluateExport(relativePath, exportName) {
  const filename = path.join(repositoryRoot, relativePath);
  const source = fs.readFileSync(filename, "utf8");
  const output = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
    fileName: filename,
  }).outputText;
  const context = { exports: {}, module: { exports: {} }, require: () => ({}) };
  context.module.exports = context.exports;
  vm.runInNewContext(output, context, { filename });
  return context.exports[exportName];
}

const metadata = evaluateExport("src/data/preloadedAnimeInfo.ts", "PRELOADED_ANIME_INFO");
const mappings = evaluateExport("src/data/animeIdMappings.ts", "ANIME_ID_MAPPINGS");
const target = path.join(webRoot, "src/features/anime/catalog-data.generated.json");

fs.mkdirSync(path.dirname(target), { recursive: true });
fs.writeFileSync(target, `${JSON.stringify({ metadata, mappings }, null, 2)}\n`);
console.log(`Synced ${Object.keys(metadata).length} anime records and ${Object.keys(mappings).length} ID mappings.`);
