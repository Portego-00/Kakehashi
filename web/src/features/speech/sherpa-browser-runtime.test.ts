import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { expect, it } from "vitest";
import { browserSherpaGlue } from "./sherpa-browser-runtime";
it("produces the browser-tested serial runtime from the pinned upstream release", () => {
  const source = readFileSync(
    join(process.cwd(), "node_modules/sherpa-onnx/sherpa-onnx-wasm-nodejs.js"),
    "utf8",
  );
  const path = readFileSync(
    join(process.cwd(), "node_modules/path-browserify/index.js"),
    "utf8",
  );
  expect(
    createHash("sha256").update(browserSherpaGlue(source, path)).digest("hex"),
  ).toBe("be3158d3ee0cbe90668bc4770596e02af98a74e4086ef97ad9d6d5f9f8c805f0");
  expect(() => browserSherpaGlue("unexpected release", path)).toThrow(
    "must be reviewed",
  );
});
