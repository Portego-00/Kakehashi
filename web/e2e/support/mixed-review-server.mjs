import { spawn } from "node:child_process";
import { once } from "node:events";
import { cp, mkdir, mkdtemp, readdir, readFile, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const webRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const repositoryRoot = dirname(webRoot);
const fixtureRoot = await mkdtemp(join(tmpdir(), "kakehashi-review-layout-"));
const fixtureWeb = join(fixtureRoot, "web");

try {
  await mkdir(fixtureWeb);
  // Next's route discovery needs a real source directory. No environment files
  // or existing build output are copied into this disposable application.
  const cssFiles = (await readdir(webRoot)).filter((name) => name.endsWith(".css"));
  await Promise.all([
    ...["src", "tsconfig.json", "package.json", "next-env.d.ts", ...cssFiles].map((name) =>
      cp(join(webRoot, name), join(fixtureWeb, name), { recursive: true })),
    ...["public", "node_modules"].map((name) => symlink(join(webRoot, name), join(fixtureWeb, name), "dir")),
    ...["src", "shared", "assets", "node_modules"].map((name) =>
      symlink(join(repositoryRoot, name), join(fixtureRoot, name), "dir")),
  ]);

  const config = await readFile(join(webRoot, "next.config.ts"), "utf8");
  const rootDeclaration = "const projectRoot = dirname(fileURLToPath(import.meta.url));";
  if (!config.includes(rootDeclaration)) throw new Error("Update the review fixture's projectRoot replacement for next.config.ts.");
  // Keep Webpack resolving packages from the real dependency installation.
  await writeFile(join(fixtureWeb, "next.config.ts"), config.replace(rootDeclaration, `const projectRoot = ${JSON.stringify(webRoot)};`));

  const preload = join(fixtureRoot, "session-fixture.cjs");
  await writeFile(preload, `
const { createHash } = require("node:crypto");
const token = "mixed-layout-test-token";
globalThis.__kakehashiAnalyticsIdentities = new Map([
  [createHash("sha256").update(token).digest("base64url"), {
    expiresAt: Infinity,
    identity: { id: "1", username: "Portego", level: 2 },
  }],
]);
const originalFetch = globalThis.fetch;
globalThis.fetch = async (input, init) => {
  const url = input instanceof Request ? input.url : String(input);
  const headers = new Headers(init?.headers ?? (input instanceof Request ? input.headers : undefined));
  if (url === "https://api.wanikani.com/v2/user" && headers.get("Authorization") === "Bearer " + token) {
    return Response.json({ id: 1, object: "user", data: { username: "Portego", level: 2 } });
  }
  return originalFetch(input, init);
};
`);

  // Pass only runtime settings, never the developer's API keys or backend env.
  const environment = Object.fromEntries(
    ["PATH", "HOME", "TMPDIR", "LANG", "LC_ALL", "TZ", "CI", "SystemRoot"].flatMap((key) =>
      process.env[key] === undefined ? [] : [[key, process.env[key]]]),
  );
  const server = spawn(process.execPath, [
    join(webRoot, "node_modules/next/dist/bin/next"), "dev", "--webpack", fixtureWeb,
    "--hostname", "127.0.0.1", "--port", "3101",
  ], {
    cwd: fixtureWeb,
    stdio: "inherit",
    detached: process.platform !== "win32",
    env: {
      ...environment,
      NODE_ENV: "development",
      NEXT_TELEMETRY_DISABLED: "1",
      SESSION_SECRET: "mixed-layout-test-session-secret-32-characters",
      NODE_OPTIONS: `--require ${JSON.stringify(preload)}`,
    },
  });
  let shutdownTimer;
  const signalServer = (signal) => {
    if (!server.pid || server.exitCode !== null || server.signalCode !== null) return;
    try {
      if (process.platform === "win32") server.kill(signal);
      else process.kill(-server.pid, signal);
    } catch (error) {
      if (error.code !== "ESRCH") throw error;
    }
  };
  const stop = () => {
    if (shutdownTimer) return;
    signalServer("SIGTERM");
    shutdownTimer = setTimeout(() => signalServer("SIGKILL"), 5_000);
    shutdownTimer.unref();
  };
  process.on("SIGINT", stop);
  process.on("SIGTERM", stop);
  try {
    const [code, signal] = await once(server, "exit");
    process.exitCode = code ?? (signal === "SIGTERM" || signal === "SIGINT" ? 0 : 1);
  } finally {
    clearTimeout(shutdownTimer);
    process.off("SIGINT", stop);
    process.off("SIGTERM", stop);
  }
} finally {
  await rm(fixtureRoot, { recursive: true, force: true });
}
