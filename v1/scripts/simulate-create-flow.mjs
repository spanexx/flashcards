// WHY: The create flow ends in a static Library page, so the rehearsal must run
// after a build and fail early when the page is missing. Vitest owns the walk
// through the real router; this wrapper keeps the command and its guard in one
// place.
// PACK: library-create-flow
// 2026-10-21 opencode: created for the post-implementation create-flow rehearsal [pack: library-create-flow]

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
  [vitest, "run", "tests/simulate-create-flow.test.ts", "--reporter=verbose"],
  { cwd: projectRoot, stdio: "inherit" },
);

child.on("exit", (code) => {
  process.exit(code ?? 1);
});
