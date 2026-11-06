// Browser editor tests have a real, non-configurable window. React Native's
// SDK 58 setup replaces that property and is only appropriate for native tests.
if (typeof document === "undefined") {
  for (const setupFile of require("jest-expo/jest-preset").setupFiles) {
    require(setupFile);
  }
}
