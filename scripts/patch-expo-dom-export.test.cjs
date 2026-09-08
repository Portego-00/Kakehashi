const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const fs = require("node:fs");
const test = require("node:test");

// Exercise the installed exporter and its real metadata helpers. The SDK 55
// regression loses one DOM component when parallel exports finish together.
const exportAppSource = fs.readFileSync(
  require.resolve("@expo/cli/build/src/export/exportApp.js"),
  "utf8",
);
const helpers = require("@expo/cli/build/src/export/exportDomComponents");
const assignment = exportAppSource.match(
  /domComponentAssetsMetadata\[platform\] = \[[\s\S]*?\n {20}\];/,
)?.[0];
assert.ok(assignment, "Expo changed its DOM exporter; review the SDK 55 patch and this regression test.");

const components = [
  {
    html: "www.bundle/notebook.html",
    content: '<script src="./notebook.js"></script>',
    artifacts: [
      { filename: "notebook.js", type: "js" },
      { filename: "notebook.css", type: "css" },
      { filename: "notebook.map", type: "map" },
    ],
  },
  {
    html: "www.bundle/legacy-note.html",
    content: '<script src="./legacy-note.js"></script>',
    artifacts: [{ filename: "legacy-note.js", type: "js" }],
  },
];

async function exportParallelDomMetadata(metadataAssignment) {
  const files = new Map(components.map(({ html, content }) => [html, { contents: content }]));
  const AsyncFunction = Object.getPrototypeOf(async function () {}).constructor;
  // Use the actual assignment inside the same Promise.all pattern as Expo.
  const run = new AsyncFunction("_exportDomComponents", "files", "components", `
    const domComponentAssetsMetadata = {};
    const platform = "ios";
    await Promise.all(components.map(async (component) => {
      const platformDomComponentsBundle = { artifacts: component.artifacts };
      const htmlOutputName = component.html;
      ${metadataAssignment}
    }));
    return domComponentAssetsMetadata[platform];
  `);
  return run(helpers, files, components);
}

test("parallel DOM exports retain both editors, their styles, and HTML entries", async () => {
  const assets = await exportParallelDomMetadata(assignment);
  const expectedPaths = components.flatMap(({ content, artifacts }) => [
    ...artifacts.filter(({ type }) => type !== "map").map(({ filename }) => `www.bundle/${filename}`),
    `www.bundle/${crypto.createHash("md5").update(content).digest("hex")}.html`,
  ]);
  assert.deepEqual(assets.map(({ path }) => path).sort(), expectedPaths.sort());
});

test("the original SDK 55 await reproduces the missing notebook assets", async () => {
  const originalAssignment = assignment.replace(
    "...(0, _exportDomComponents.addDomBundleToMetadataAsync)",
    "...await (0, _exportDomComponents.addDomBundleToMetadataAsync)",
  );
  assert.notEqual(originalAssignment, assignment, "The installed CLI must have the patch applied.");
  const assets = await exportParallelDomMetadata(originalAssignment);
  assert.equal(assets.length, 2);
  assert.equal(assets.some(({ path }) => path.endsWith("notebook.js")), false);
  assert.equal(assets.some(({ path }) => path.endsWith("legacy-note.js")), true);
});

test("MD5 DOM exports keep lazy modules in the entry bundle", () => {
  const source = fs.readFileSync(require.resolve("@expo/cli/build/src/export/exportDomComponents.js"), "utf8");
  const expression = source.match(/splitChunks: ([^,\n]+),/)?.[1];
  assert.ok(expression, "Expo changed its DOM chunk options; review the SDK 55 patch.");
  const splitChunks = new Function("useMd5Filename", "_env", `return ${expression};`);
  const enabled = { env: { EXPO_NO_BUNDLE_SPLITTING: false } };
  const disabled = { env: { EXPO_NO_BUNDLE_SPLITTING: true } };
  assert.equal(splitChunks(true, enabled), false);
  assert.equal(splitChunks(false, enabled), true);
  assert.equal(splitChunks(false, disabled), false);
});
