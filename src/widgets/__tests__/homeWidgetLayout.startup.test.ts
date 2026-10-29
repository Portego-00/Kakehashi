import { execFileSync } from "node:child_process";
import { resolve } from "node:path";

const startupProbe = String.raw`
  const fs = require("node:fs");
  const vm = require("node:vm");
  const babel = require("@babel/core");
  const filename = process.argv[1];
  const isDev = process.argv[2] === "true";
  const transformed = babel.transformSync(fs.readFileSync(filename, "utf8"), {
    filename,
    babelrc: false,
    configFile: false,
    presets: [require.resolve("babel-preset-expo")],
    caller: {
      name: "metro",
      bundler: "metro",
      platform: "ios",
      isDev,
      isHMREnabled: true,
      isServer: false,
      isNodeModule: false,
      engine: "hermes",
      projectRoot: process.cwd(),
      supportsStaticESM: false,
    },
  });
  const context = {
    exports: {},
    require: () => ({}),
    $RefreshReg$: () => {},
    $RefreshSig$: () => (value) => value,
  };
  vm.runInNewContext(transformed.code, context);
  if (typeof context.exports.default !== "string") {
    throw new Error("The widget layout must export its serialized source.");
  }
  const layout = vm.runInNewContext("(" + context.exports.default + ")");
  if (typeof layout !== "function") {
    throw new Error("The serialized widget layout must be executable.");
  }
`;

it.each([true, false])("loads the native widget module with development=%s", (isDev) => {
  expect(() => execFileSync(process.execPath, [
    "-e",
    startupProbe,
    resolve(__dirname, "../homeWidgetLayout.ios.tsx"),
    String(isDev),
  ], { cwd: process.cwd(), stdio: "pipe" })).not.toThrow();
});
