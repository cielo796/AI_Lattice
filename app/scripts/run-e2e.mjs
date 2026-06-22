import { spawn } from "node:child_process";
import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import process from "node:process";

const projectRoot = process.cwd();
const port = Number(process.env.PLAYWRIGHT_PORT ?? 3100);
const baseURL = process.env.PLAYWRIGHT_BASE_URL ?? `http://127.0.0.1:${port}`;
const env = {
  ...process.env,
  PLAYWRIGHT_BASE_URL: baseURL,
  PLAYWRIGHT_EXTERNAL_SERVER: "true",
};

function spawnNode(args, options = {}) {
  return spawn(process.execPath, args, {
    cwd: projectRoot,
    env,
    stdio: "inherit",
    windowsHide: true,
    ...options,
  });
}

function createServerWorkspace() {
  if (process.platform !== "win32") {
    return { cwd: projectRoot, cleanup: async () => undefined };
  }

  const workspace = path.join(os.tmpdir(), "ai-lattice-e2e-workspace");
  const excluded = new Set([
    ".git",
    ".next",
    "node_modules",
    "playwright-report",
    "test-results",
  ]);

  fs.mkdirSync(workspace, { recursive: true });
  for (const entry of fs.readdirSync(workspace)) {
    if (entry !== "node_modules" && entry !== ".next") {
      fs.rmSync(path.join(workspace, entry), {
        recursive: true,
        force: true,
        maxRetries: 10,
        retryDelay: 250,
      });
    }
  }

  const sourceNodeModules = path.join(projectRoot, "node_modules");
  const stagedNodeModules = path.join(workspace, "node_modules");
  const markerPath = path.join(stagedNodeModules, ".ai-lattice-e2e-lock-hash");
  const lockHash = crypto
    .createHash("sha256")
    .update(fs.readFileSync(path.join(projectRoot, "package-lock.json")))
    .digest("hex");
  const currentHash = fs.existsSync(markerPath)
    ? fs.readFileSync(markerPath, "utf8").trim()
    : "";

  if (currentHash !== lockHash) {
    console.log("Copying node_modules to the local E2E workspace (first run only).");
    fs.rmSync(stagedNodeModules, {
      recursive: true,
      force: true,
      maxRetries: 10,
      retryDelay: 250,
    });
    fs.cpSync(sourceNodeModules, stagedNodeModules, {
      recursive: true,
      dereference: true,
    });
    fs.writeFileSync(markerPath, lockHash);
  }

  fs.cpSync(projectRoot, workspace, {
    recursive: true,
    filter(source) {
      const relative = path.relative(projectRoot, source);
      const topLevel = relative.split(path.sep)[0];
      return !excluded.has(topLevel);
    },
  });

  return {
    cwd: workspace,
    cleanup: async () => undefined,
  };
}

async function waitForServer() {
  const deadline = Date.now() + 120_000;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(`${baseURL}/login`);
      if (response.ok) return;
    } catch {
      // The dev server is still starting.
    }
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  throw new Error(`Timed out waiting for ${baseURL}`);
}

async function stopProcessTree(child) {
  if (!child.pid || child.exitCode !== null) return;

  if (process.platform === "win32") {
    await new Promise((resolve) => {
      const killer = spawn("taskkill", ["/pid", String(child.pid), "/T", "/F"], {
        stdio: "ignore",
        windowsHide: true,
      });
      killer.once("exit", resolve);
      killer.once("error", resolve);
    });
    return;
  }

  child.kill("SIGTERM");
}

const serverWorkspace = createServerWorkspace();
if (serverWorkspace.cwd !== projectRoot) {
  console.log(`Staged E2E server workspace at ${serverWorkspace.cwd}`);
}
const server = spawnNode([
  "node_modules/next/dist/bin/next",
  "dev",
  "--webpack",
  "--hostname",
  "127.0.0.1",
  "--port",
  String(port),
], { cwd: serverWorkspace.cwd });
console.log(`Starting Next.js for E2E at ${baseURL} (pid ${server.pid ?? "unknown"})`);
const serverExit = new Promise((_, reject) => {
  server.once("exit", (code) => {
    reject(new Error(`Next.js exited before E2E completed (code ${code ?? "unknown"}).`));
  });
  server.once("error", reject);
});

let exitCode = 1;
try {
  await Promise.race([waitForServer(), serverExit]);
  console.log("Next.js is ready. Starting Playwright.");
  const runner = spawnNode([
    "node_modules/@playwright/test/cli.js",
    "test",
    ...process.argv.slice(2),
  ]);
  exitCode = await new Promise((resolve) => {
    runner.once("exit", (code) => {
      console.log(`Playwright exited with code ${code ?? "unknown"}.`);
      resolve(code ?? 1);
    });
    runner.once("error", () => resolve(1));
  });
} catch (error) {
  console.error(error);
} finally {
  await stopProcessTree(server);
  await serverWorkspace.cleanup();
}

process.exitCode = exitCode;
