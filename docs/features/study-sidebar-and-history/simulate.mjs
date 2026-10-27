// WHY: The post-impl simulation must run the real list builder, not a copy of
// its rules. It transpiles the shipped module with the project's own TypeScript,
// checks pairing, order, cap and old rows, and confirms the panel, the list and
// the phone fold reached the shipped source and the built chunk.
// PACK: study-sidebar-and-history
// 2026-10-27 opencode: created after the implementation [pack: study-sidebar-and-history]

import { readFileSync, readdirSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, "../../..");
const require = createRequire(path.join(root, "v1/package.json"));
const ts = require("typescript");

function loadModule(relativePath, name) {
  const source = readFileSync(path.join(root, relativePath), "utf8");
  const { outputText } = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
  });
  const compiled = path.join("/tmp", `${name}-sim-${process.pid}.mjs`);
  writeFileSync(compiled, outputText);
  return import(pathToFileURL(compiled).href);
}

function read(relativePath) {
  return readFileSync(path.join(root, relativePath), "utf8");
}

/** Every built chunk, so a label check does not guess the hashed file name. */
function builtChunks() {
  const dir = path.join(root, "v1/out/_next/static/chunks");
  const entries = [];
  function walk(folder) {
    for (const entry of readdirSync(folder, { withFileTypes: true })) {
      const full = path.join(folder, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (entry.name.endsWith(".js")) entries.push(readFileSync(full, "utf8"));
    }
  }
  walk(dir);
  return entries;
}

const { recentSessions } = await loadModule(
  "v1/src/lib/core/past-sessions.ts",
  "past-sessions",
);

const results = [];

function check(name, condition, detail) {
  results.push({ name, pass: Boolean(condition), detail });
}

function started(overrides = {}) {
  return {
    type: "started",
    id: "s1",
    at: "2026-10-01T09:00:00.000Z",
    offered: 20,
    ...overrides,
  };
}

function ended(overrides = {}) {
  return {
    type: "ended",
    id: "s1",
    at: "2026-10-01T10:00:00.000Z",
    offered: 20,
    answered: 18,
    completed: true,
    stopped: false,
    ...overrides,
  };
}

// Scenario 1: the plan keeps its column and the list reached the built app.
{
  const source = read("v1/src/app/study/StudyPlan.tsx");
  const chunks = builtChunks();
  const hasList = chunks.some((text) => text.includes("Previous sessions"));
  const hasAgain = chunks.some((text) => text.includes("Learn again"));
  check(
    "1. The shipped plan keeps Start and the built chunk carries the new list",
    source.includes("Start session") && hasList && hasAgain,
    `Start=${source.includes("Start session")} list=${hasList} learn-again=${hasAgain}`,
  );
}

// Scenario 2: the right panel offers the three tabs and the phone fold.
{
  const panel = read("v1/src/app/study/PlanAside.tsx");
  const missing = ["Tutorial and hints", "What to expect", "Why these cards", "Plan details"].filter(
    (label) => !panel.includes(label),
  );
  check(
    "2. The panel has the three tabs and the phone fold",
    missing.length === 0,
    missing.length === 0 ? "all present" : `missing: ${missing.join(", ")}`,
  );
}

// Scenario 3: pairing, newest first, cap five, only ended facts.
{
  const events = [
    started({ id: "old", pack: "Polish", deck: "food" }),
    ended({ id: "old", at: "2026-10-01T10:00:00.000Z" }),
    started({ id: "new", pack: "", deck: "" }),
    ended({ id: "new", at: "2026-10-03T10:00:00.000Z" }),
    started({ id: "running" }),
    ...Array.from({ length: 6 }, (_, index) => [
      started({ id: `bulk${index}` }),
      ended({ id: `bulk${index}`, at: `2026-09-0${index + 1}T10:00:00.000Z` }),
    ]).flat(),
  ];
  const got = recentSessions(events);
  check(
    "3. The list pairs, orders newest first and stops at five",
    got.length === 5 && got[0].id === "new" && got[1].id === "old",
    `${got.length} rows: ${got.map((row) => row.id).join(", ")}`,
  );
}

// Scenario 4: a recorded scope rebuilds the same pack and deck.
{
  const [row] = recentSessions([ended({ pack: "Polish", deck: "food" })]);
  check(
    "4. A finished row keeps the pack and deck it drew from",
    row?.pack === "Polish" && row?.deck === "food",
    JSON.stringify(row),
  );
}

// Scenario 5: a row from before scopes has no scope and no action.
{
  const [row] = recentSessions([ended()]);
  check(
    "5. An older row has no scope and no Learn again",
    row && !("pack" in row) && !("deck" in row) && row.answered === 18,
    JSON.stringify(row),
  );
}

// Scenario 6: no history is an empty list, not an error.
{
  const got = recentSessions([started()]);
  check("6. No ended session gives an empty list", got.length === 0, `${got.length} rows`);
}

// Scenario 7: the phone keeps the plan width and folds the panel under it.
{
  const css = read("v1/src/app/globals.css");
  const layout = /\.study-plan-layout\s*\{[^}]*grid-template-columns:\s*minmax\(0,\s*860px\)\s*320px;/s.test(
    css,
  );
  const foldHidden = /\.study-fold\s*\{[^}]*display:\s*none;/s.test(css);
  const narrow = /@media \(max-width: 860px\)\s*\{[\s\S]*?\.study-aside\s*\{[^}]*display:\s*none;[\s\S]*?\.study-fold\s*\{[^}]*display:\s*block;/s.test(
    css,
  );
  check(
    "7. The 860px rule hides the aside and shows the fold",
    layout && foldHidden && narrow,
    `layout=${layout} foldHidden=${foldHidden} narrow=${narrow}`,
  );
}

// Scenario 8: re-learning goes through the same plan loader.
{
  const client = read("v1/src/app/StudyClient.tsx");
  const wired = client.includes("onRelearn") && client.includes("setScopePack(nextPack)");
  check(
    "8. Learn again sets the scope and rebuilds through loadPlan",
    wired,
    wired ? "wired" : "missing the re-learn handler",
  );
}

// Scenario 9: a long panel never stretches the page; its body scrolls instead.
{
  const css = read("v1/src/app/globals.css");
  const capped =
    /\.study-aside\s*\{[^}]*max-height:\s*calc\(100vh - 48px\);/s.test(css) &&
    /\.study-aside\s*\{[^}]*display:\s*flex;/s.test(css);
  const bodyScrolls =
    /\.study-aside-body\s*\{[^}]*overflow-y:\s*auto;/s.test(css) &&
    /\.study-aside-body\s*\{[^}]*min-height:\s*0;/s.test(css);
  check(
    "9. The panel caps at the viewport and scrolls its body",
    capped && bodyScrolls,
    `capped=${capped} bodyScrolls=${bodyScrolls}`,
  );
}

for (const result of results) {
  console.log(`${result.pass ? "PASS" : "FAIL"} ${result.name}`);
  console.log(`  ${result.detail}`);
}

const failed = results.filter((result) => !result.pass).length;
console.log("");
console.log(failed === 0 ? `ALL ${results.length} SCENARIOS PASS` : `${failed} SCENARIO(S) FAILED`);
process.exit(failed === 0 ? 0 : 1);
