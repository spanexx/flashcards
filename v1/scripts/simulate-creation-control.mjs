// WHY: The creation-control proof ends in a static Library page, so the command
// must refuse to run before a build. Vitest owns the five-step walk through the
// real router; this wrapper keeps the guard, the command and its failure in one
// place.
// PACK: creation-control
// 2026-10-22 opencode: created for the post-implementation creation-control rehearsal [pack: creation-control]

import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const projectRoot = fileURLToPath(new URL("..", import.meta.url));

if (!existsSync(path.join(projectRoot, "out", "library", "index.html"))) {
  console.error("No static build found. Run: npm run build");
  process.exit(1);
}

const vitest = path.join(projectRoot, "node_modules", "vitest", "vitest.mjs");
const child = spawn(
  process.execPath,
  [vitest, "run", "tests/simulate-creation-control.test.ts", "--reporter=verbose"],
  { cwd: projectRoot, stdio: "inherit" },
);

child.on("exit", (code) => {
  process.exit(code ?? 1);
});
