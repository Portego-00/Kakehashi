// Learn more https://docs.expo.dev/guides/customizing-metro/
const { getDefaultConfig } = require("expo/metro-config");
const path = require("path");

/** @type {import('expo/metro-config').MetroConfig} */
const config = getDefaultConfig(__dirname);
const processShimPath = path.resolve(__dirname, "src/shims/process.js");
config.resolver.extraNodeModules = {
  ...(config.resolver.extraNodeModules || {}),
  process: processShimPath,
  "process/": processShimPath,
  stream: require.resolve("stream-browserify"),
  zlib: path.resolve(__dirname, "src/shims/zlib.ts"),
};

module.exports = config;
