let processPolyfill;

try {
  processPolyfill = require("process/browser");
} catch {
  processPolyfill = {};
}

if (typeof processPolyfill.nextTick !== "function") {
  processPolyfill.nextTick = (callback, ...args) => {
    if (typeof queueMicrotask === "function") {
      queueMicrotask(() => callback(...args));
      return;
    }

    Promise.resolve().then(() => callback(...args));
  };
}

if (!processPolyfill.env || typeof processPolyfill.env !== "object") {
  processPolyfill.env = {};
}

if (!Array.isArray(processPolyfill.argv)) {
  processPolyfill.argv = [];
}

const globalScope = globalThis;
if (
  !globalScope.process ||
  typeof globalScope.process.nextTick !== "function"
) {
  globalScope.process = processPolyfill;
}

module.exports = processPolyfill;
