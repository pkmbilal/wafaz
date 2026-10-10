// Starts `next dev` for Playwright and copies its output to .e2e/server.log, where the WhatsApp
// OTP test reads the dry-run code. Env comes from playwright.config.ts (webServer.env).
import { spawn } from "node:child_process";
import { createWriteStream, mkdirSync } from "node:fs";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "../..");
const logFile = path.join(root, ".e2e", "server.log");
mkdirSync(path.dirname(logFile), { recursive: true });
const log = createWriteStream(logFile, { flags: "w" });

const port = process.env.E2E_PORT ?? "3000";
// One command string: pnpm is a .cmd shim on Windows, so it needs a shell.
const child = spawn(`pnpm exec next dev --port ${Number(port)}`, {
  cwd: root,
  env: process.env,
  shell: true,
  stdio: ["ignore", "pipe", "pipe"],
});

for (const stream of [child.stdout, child.stderr]) {
  stream.on("data", (chunk) => {
    log.write(chunk);
    process.stdout.write(chunk);
  });
}

const stop = () => child.kill();
process.on("SIGINT", stop);
process.on("SIGTERM", stop);
child.on("exit", (code) => {
  log.end();
  process.exit(code ?? 0);
});
