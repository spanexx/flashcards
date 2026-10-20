// WHY: The browser build has no server to rehearse against. This script walks
// the PRD contract through the real router and the memory store, then checks the
// static pages exist. It refuses to run before a build so the last check is real.
// PACK: browser-app
// 2026-10-20 opencode: created for the browser-owned build.

import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const projectRoot = fileURLToPath(new URL("..", import.meta.url));

if (!existsSync(path.join(projectRoot, "out", "index.html"))) {
  console.error("No static build found. Run: npm run build");
  process.exit(1);
}

const vitest = path.join(projectRoot, "node_modules", "vitest", "vitest.mjs");
const child = spawn(
  process.execPath,
  [vitest, "run", "tests/simulate-browser.test.ts", "--reporter=verbose"],
  { cwd: projectRoot, stdio: "inherit" },
);

child.on("exit", (code) => {
  process.exit(code ?? 1);
});
