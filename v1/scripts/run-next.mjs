// WHY: The app must bind to loopback by default and only widen when the learner
// asks. Wrapping Next keeps one cross-platform start command on Windows and in
// WSL, instead of two shell-specific env-var incantations.
// PACK: v1-prototype
// 2026-10-19 opencode: created for the v1 prototype [pack: v1-prototype]

import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const projectRoot = fileURLToPath(new URL("..", import.meta.url));
const command = process.argv[2] === "start" ? "start" : "dev";
const host = process.env.FLASHCARDS_HOST?.trim() || "127.0.0.1";
const port = process.env.FLASHCARDS_PORT?.trim() || "3000";
const nextBin = path.join(projectRoot, "node_modules", "next", "dist", "bin", "next");

if (!existsSync(nextBin)) {
  console.error(
    "Next.js is not installed. Run npm install inside v1 before starting the app.",
  );
  process.exit(1);
}

if (host === "0.0.0.0") {
  console.log(
    "Binding to every local address. On WSL, open the guest IP, not localhost. " +
      "Run: wsl -d Debian -- hostname -I",
  );
} else {
  console.log(`Local only: http://${host}:${port}`);
}

const child = spawn(
  process.execPath,
  [nextBin, command, "-H", host, "-p", port],
  { stdio: "inherit", cwd: projectRoot, env: process.env },
);

const forward = (signal) => {
  if (!child.killed) child.kill(signal);
};

process.on("SIGINT", () => forward("SIGINT"));
process.on("SIGTERM", () => forward("SIGTERM"));

child.on("exit", (code, signal) => {
  if (signal) process.kill(process.pid, signal);
  else process.exit(code ?? 0);
});
