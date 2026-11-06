const expoPreset = require("jest-expo/jest-preset");

module.exports = {
  ...expoPreset,
  setupFiles: [require.resolve("./jest.runtime-setup.cjs")],
};
