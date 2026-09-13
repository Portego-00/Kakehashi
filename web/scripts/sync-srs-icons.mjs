import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const scriptDirectory = dirname(fileURLToPath(import.meta.url));
const webRoot = resolve(scriptDirectory, "..");
const mobileSource = resolve(webRoot, "../src/components/SrsLevelIcon.tsx");
const output = resolve(webRoot, "public/srs/srs-icons.svg");

const stages = [
  ["apprentice-1", 'case "apprentice":', 'case "apprentice ii":'],
  ["apprentice-2", 'case "apprentice ii":', 'case "apprentice iii":'],
  ["apprentice-3", 'case "apprentice iii":', 'case "apprentice iv":'],
  ["apprentice-4", 'case "apprentice iv":', 'case "guru":'],
  ["guru-1", 'case "guru":', 'case "guru ii":'],
  ["guru-2", 'case "guru ii":', 'case "master":'],
  ["master", 'case "master":', 'case "enlightened":'],
  ["enlightened", 'case "enlightened":', 'case "burned":'],
  ["burned", 'case "burned":', "default:"],
];

function stageSymbol(source, [id, startMarker, endMarker]) {
  const start = source.indexOf(startMarker);
  const end = source.indexOf(endMarker, start + startMarker.length);
  if (start < 0 || end < 0) throw new Error(`Could not find native SRS stage ${id}.`);
  const block = source.slice(start, end);
  const viewBox = block.match(/viewBox="([^"]+)"/)?.[1];
  const path = block.match(/<Path\s+d="([^"]+)"/)?.[1];
  if (!viewBox || !path) throw new Error(`Native SRS stage ${id} is missing its SVG geometry.`);
  const circles = [...block.matchAll(/<Circle\s+cx="([^"]+)"\s+cy="([^"]+)"\s+r="([^"]+)"/g)]
    .map((match) => `<circle cx="${match[1]}" cy="${match[2]}" r="${match[3]}" fill="currentColor"/>`)
    .join("");
  return `<symbol id="${id}" viewBox="${viewBox}"><path d="${path}" fill="currentColor"/>${circles}</symbol>`;
}

const source = await readFile(mobileSource, "utf8");
const symbols = stages.map((stage) => stageSymbol(source, stage)).join("");
const sprite = `<!-- Generated from src/components/SrsLevelIcon.tsx. Run npm run sync:srs-icons after native artwork changes. -->\n<svg xmlns="http://www.w3.org/2000/svg">${symbols}</svg>\n`;

await mkdir(dirname(output), { recursive: true });
await writeFile(output, sprite, "utf8");

