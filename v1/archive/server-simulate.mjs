// WHY: The simulation is the honest rehearsal: a real production server, a
// throwaway data folder, and the ten promises from the contract checked one by
// one from outside the app. It never touches the learner's real folders.
// PACK: v1-prototype
// 2026-10-19 opencode: created for the v1 prototype [pack: v1-prototype]

import { spawn } from "node:child_process";
import { cp, mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import net from "node:net";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = fileURLToPath(new URL("..", import.meta.url));
const nextBin = path.join(projectRoot, "node_modules", "next", "dist", "bin", "next");

if (!existsSync(path.join(projectRoot, ".next", "BUILD_ID"))) {
  console.error("No production build found. Run: npm run build");
  process.exit(1);
}

const port = await freePort();
const base = `http://127.0.0.1:${port}`;
const workspace = await mkdtemp(path.join(os.tmpdir(), "flashcards-sim-"));
const dataDir = path.join(workspace, "data");
const packsDir = path.join(workspace, "packs");
const evidenceFile = path.join(dataDir, "evidence.jsonl");

const checks = [];
const state = {};

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function freePort() {
  return await new Promise((resolve, reject) => {
    const server = net.createServer();
    server.on("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      server.close(() => resolve(address.port));
    });
  });
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function request(method, pathname, body) {
  const response = await fetch(base + pathname, {
    method,
    headers: body === undefined ? undefined : { "content-type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
    signal: AbortSignal.timeout(20000),
  });
  const text = await response.text();
  let json = null;
  try {
    json = JSON.parse(text);
  } catch {
    json = null;
  }
  return { status: response.status, text, json };
}

async function getJson(pathname) {
  const answer = await request("GET", pathname);
  assert(answer.status === 200, `${pathname} answered ${answer.status}: ${answer.text.slice(0, 200)}`);
  return answer.json;
}

function postJson(pathname, body) {
  return request("POST", pathname, body);
}

async function startServer(env) {
  const child = spawn(process.execPath, [nextBin, "start", "-H", "127.0.0.1", "-p", String(port)], {
    cwd: projectRoot,
    env,
    stdio: ["ignore", "pipe", "pipe"],
  });
  let output = "";
  child.stdout.on("data", (chunk) => {
    output += chunk.toString();
  });
  child.stderr.on("data", (chunk) => {
    output += chunk.toString();
  });

  const deadline = Date.now() + 90000;
  while (Date.now() < deadline) {
    if (child.exitCode !== null) {
      throw new Error(`the server stopped early:\n${output.slice(-2000)}`);
    }
    try {
      const answer = await fetch(`${base}/api/health`, { signal: AbortSignal.timeout(2000) });
      if (answer.ok) return child;
    } catch {
      // Not up yet.
    }
    await sleep(400);
  }
  child.kill("SIGKILL");
  throw new Error(`the server never answered /api/health:\n${output.slice(-2000)}`);
}

async function stopServer(child) {
  if (child.exitCode !== null) return;
  child.kill("SIGTERM");
  const deadline = Date.now() + 8000;
  while (Date.now() < deadline && child.exitCode === null) await sleep(200);
  if (child.exitCode === null) child.kill("SIGKILL");
}

async function point(number, name, job) {
  try {
    const detail = await job();
    checks.push({ number, name, ok: true, detail: detail ?? "" });
    console.log(`PASS  point ${String(number).padStart(2)}  ${name}${detail ? `  (${detail})` : ""}`);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    checks.push({ number, name, ok: false, detail: message });
    console.log(`FAIL  point ${String(number).padStart(2)}  ${name}  --  ${message}`);
  }
}

/** Cloze cards in the plan, in order, that the sim has not touched yet. */
function takeClozeCard() {
  const card = state.plan.cards.find(
    (entry) =>
      !state.used.has(entry.id) &&
      entry.answerDef.mode === "cloze" &&
      (entry.answerDef.blanks?.length ?? 0) === 1 &&
      (entry.answerDef.blanks[0].expected?.length ?? 0) > 0,
  );
  assert(card, "the plan did not have a spare cloze card");
  state.used.add(card.id);
  return card;
}

function correctAnswers(card) {
  const blank = card.answerDef.blanks[0];
  return { [blank.id]: blank.expected[0] };
}

async function readEvidenceLines() {
  try {
    const text = await readFile(evidenceFile, "utf8");
    return text
      .split("\n")
      .map((line) => line.trim())
      .filter((line) => line.length > 0)
      .map((line) => JSON.parse(line));
  } catch {
    return [];
  }
}

// A throwaway library: the real Polish pack plus one deliberately broken pack.
await mkdir(dataDir, { recursive: true });
await cp(path.join(projectRoot, "packs", "polish-starter"), path.join(packsDir, "polish-starter"), {
  recursive: true,
});
await mkdir(path.join(packsDir, "broken-pack"), { recursive: true });
await writeFile(path.join(packsDir, "broken-pack", "pack.json"), "{ this is not json", "utf8");

// A .env file next to the app would otherwise leak the learner's real provider
// into the simulation. Defined-but-empty variables beat the file: Next's env
// loader never overwrites variables that already exist in the process.
const cleanEnv = {
  ...process.env,
  FLASHCARDS_PROVIDER_URL: "",
  FLASHCARDS_PROVIDER_MODEL: "",
  FLASHCARDS_PROVIDER_KEY: "",
};

const serverEnv = {
  ...cleanEnv,
  FLASHCARDS_DATA_DIR: dataDir,
  FLASHCARDS_PACKS_DIR: packsDir,
  FLASHCARDS_HOST: "127.0.0.1",
  FLASHCARDS_PORT: String(port),
};

console.log(`Simulation workspace: ${workspace}`);
console.log(`Production server: ${base}`);
console.log("");

// --- Phase A: no provider anywhere -----------------------------------------
let server = await startServer(serverEnv);
try {
  await point(1, "the Polish pack loads; a broken pack is named without blocking", async () => {
    const packs = await getJson("/api/packs");
    const polish = packs.packs.find((entry) => entry.name === "polish-starter");
    assert(polish && !polish.error, "the Polish pack did not load cleanly");
    assert(polish.cardCount >= 26, `the Polish pack only offered ${polish.cardCount} cards`);
    const broken = packs.packs.find((entry) => entry.error);
    assert(broken, "the broken pack was not reported at all");
    assert(/json/i.test(broken.error), `the broken pack's reason was not plain: ${broken.error}`);
    const health = await getJson("/api/health");
    assert(health.ok === true && health.version === "0.1.0", "health did not answer plainly");
    return `${polish.cardCount} cards; broken pack named`;
  });

  await point(2, "a plan comes back with cards, groups, reasons and the default algorithm", async () => {
    const answer = await getJson("/api/plan");
    const plan = answer.plan;
    assert(plan, `no plan was offered: ${answer.message ?? "(no message)"}`);
    assert(plan.cards.length >= 5, `the plan only had ${plan.cards.length} cards`);
    assert(plan.algorithm === "default", `the plan used ${plan.algorithm}`);
    assert(plan.fallbackCount === 0, `the receipt already counted ${plan.fallbackCount} fallbacks`);
    assert(plan.groups.length >= 1, "the plan had no reason groups");
    for (const group of plan.groups) {
      assert(group.label && group.reason, "a group was missing its label or reason");
    }
    const settings = await getJson("/api/settings");
    assert(settings.settings.algorithm.lastAlgorithm === "default", "the receipt did not record the default algorithm");
    assert(settings.provider.configured === false, "a provider appeared out of nowhere");
    state.plan = plan;
    state.used = new Set();
    return `${plan.cards.length} cards, ${plan.groups.length} groups`;
  });

  await point(3, "a cloze answer is judged per blank and shares one attempt's rows", async () => {
    // Prefer a two-blank card so "per blank" is shown, not just claimed.
    const card =
      state.plan.cards.find(
        (entry) =>
          !state.used.has(entry.id) &&
          entry.answerDef.mode === "cloze" &&
          (entry.answerDef.blanks?.length ?? 0) >= 2,
      ) ?? takeClozeCard();
    state.used.add(card.id);
    const blankCount = card.answerDef.blanks.length;
    const answers = Object.fromEntries(card.answerDef.blanks.map((blank) => [blank.id, blank.expected[0]]));

    const answer = await postJson("/api/answer", {
      cardId: card.id,
      attemptId: "sim-answer-1",
      answers,
      timeMs: 2500,
      hintUsed: false,
    });
    assert(answer.status === 200 && answer.json, `the answer route answered ${answer.status}: ${answer.text.slice(0, 200)}`);
    const result = answer.json;
    assert(result.cardOutcome === "got_it", `a correct answer was judged ${result.cardOutcome}`);
    assert(result.judge === "local", `the judge claimed to be ${result.judge}`);
    assert(result.rows.length === blankCount, `${blankCount} blanks wrote ${result.rows.length} row(s)`);
    assert(result.rows.every((row) => row.kind === "answer"), "an evidence row was not a plain answer");
    assert(result.rows.every((row) => row.attemptId === "sim-answer-1"), "the rows did not share the attempt id");
    assert(
      new Set(result.rows.map((row) => row.region)).size === blankCount,
      "the rows did not carry one region per blank",
    );
    const lines = await readEvidenceLines();
    assert(
      lines.filter((row) => row.attemptId === "sim-answer-1").length === blankCount,
      "the rows never reached evidence.jsonl",
    );
    state.correctCard = card;
    return `${blankCount} blanks, ${result.rows.length} shared row(s)`;
  });

  await point(4, "a wrong answer is marked not-done and can return once at the end", async () => {
    const card = takeClozeCard();
    const blank = card.answerDef.blanks[0];
    const wrong = await postJson("/api/answer", {
      cardId: card.id,
      attemptId: "sim-answer-2",
      answers: { [blank.id]: "to-nie-jest-odpowiedz" },
      timeMs: 900,
      hintUsed: false,
    });
    assert(wrong.status === 200 && wrong.json, `the answer route answered ${wrong.status}`);
    assert(wrong.json.cardOutcome === "no" || wrong.json.cardOutcome === "again", `a clearly wrong answer was judged ${wrong.json.cardOutcome}`);
    state.wrongCard = card;

    const returned = await postJson("/api/answer", {
      cardId: card.id,
      attemptId: "sim-answer-3",
      answers: correctAnswers(card),
      timeMs: 2100,
      hintUsed: false,
    });
    assert(returned.status === 200 && returned.json, `the return pass answered ${returned.status}`);
    assert(returned.json.cardOutcome === "got_it", "the return pass was not judged correct");
    assert(returned.json.rows[0].seenBefore === 1, `the return pass thought it had been seen ${returned.json.rows[0].seenBefore} times before`);
    return "wrong, then right on return";
  });

  await point(5, "a hint works without a provider, and using it caps the card at Nearly", async () => {
    const card = takeClozeCard();
    assert((card.hints?.length ?? 0) > 0, "the chosen card had no pack hint");
    const hint = await postJson("/api/provider/hint", {
      cardId: card.id,
      approved: false,
      usedHints: [],
      outcomeCategory: "not answered yet",
    });
    assert(hint.status === 200 && hint.json, `the hint route answered ${hint.status}`);
    assert(hint.json.source === "pack", `the hint came from ${hint.json.source}`);
    assert(typeof hint.json.text === "string" && hint.json.text.length > 0, "the pack hint was empty");

    const answer = await postJson("/api/answer", {
      cardId: card.id,
      attemptId: "sim-answer-4",
      answers: correctAnswers(card),
      timeMs: 3200,
      hintUsed: true,
    });
    assert(answer.json.cardOutcome === "nearly", `a hinted correct answer was judged ${answer.json.cardOutcome}`);
    assert(answer.json.capped === true, "the cap was not stated as a fact");
    return "pack hint, capped at Nearly";
  });

  await point(6, "a correction resolves the record without editing the original row", async () => {
    const card = takeClozeCard();
    const blank = card.answerDef.blanks[0];
    const wrong = await postJson("/api/answer", {
      cardId: card.id,
      attemptId: "sim-answer-5",
      answers: { [blank.id]: "jeszcze-nie" },
      timeMs: 700,
      hintUsed: false,
    });
    const original = wrong.json.rows[0];

    const correction = await postJson("/api/evidence/correction", {
      rowId: original.id,
      outcome: "got_it",
    });
    assert(correction.status === 200 && correction.json, `the correction route answered ${correction.status}`);
    assert(correction.json.correction.kind === "correction", "the correction row was not marked as one");
    assert(correction.json.correction.supersedes === original.id, "the correction did not point at the row it answers");

    const lines = await readEvidenceLines();
    const stored = lines.find((row) => row.id === original.id);
    assert(stored, "the original row disappeared");
    assert(stored.outcome === original.outcome && stored.kind === "answer", "the original row was edited");

    const drawer = await getJson(`/api/evidence?cardId=${encodeURIComponent(card.id)}`);
    const attempt = drawer.attempts.find((entry) => entry.attemptId === "sim-answer-5");
    assert(attempt && attempt.outcome === "got_it", "the drawer still shows the old judgement");
    assert(attempt.regions.every((region) => region.corrected), "the drawer does not mark the correction");
    return `${lines.length} rows on disk, none erased`;
  });

  await point(7, "a wrong-then-right history names the card as now doable", async () => {
    const progress = await getJson("/api/progress");
    const improved = progress.progress.improvements.find((item) => item.cardId === state.wrongCard.id);
    assert(improved, "the recovered card was not named as an improvement");
    assert(improved.attempts >= 2, `the improvement only counted ${improved.attempts} attempts`);
    assert(improved.summary, "the improvement had no card name");
    return `"${improved.summary}"`;
  });

  await point(8, "a malformed import is refused with its item index; a valid batch lands", async () => {
    const before = (await getJson("/api/cards")).cards.length;
    const bad = await postJson("/api/cards/import", {
      json: JSON.stringify([
        { front: "Dzień dobry", back: "Good morning", topics: ["basics"] },
        { front: "Bez odpowiedzi" },
      ]),
    });
    assert(bad.status === 400, `the bad batch answered ${bad.status}`);
    assert(Array.isArray(bad.json?.detail) && bad.json.detail.length > 0, "the refusal named no problem");
    assert(bad.json.detail[0].index === 1, `the refusal blamed item ${bad.json.detail[0].index}`);
    const during = (await getJson("/api/cards")).cards.length;
    assert(during === before, "the refused batch wrote a card anyway");

    const good = await postJson("/api/cards/import", {
      json: JSON.stringify([{ front: "Dzień dobry", back: "Good morning", topics: ["basics"] }]),
    });
    assert(good.status === 200 && good.json.imported === 1, `the good batch imported ${good.json?.imported}`);
    const after = await getJson("/api/cards");
    assert(
      after.cards.some((card) => card.summary.includes("Dzień dobry")),
      "the imported card is not in the deck",
    );
    return "refused at item 2, then imported cleanly";
  });

  await point(9, "a prompt can be prepared before any provider exists; sending changes nothing", async () => {
    const prepared = await postJson("/api/provider/prepare", {
      packName: "polish-starter",
      topic: "cases",
      count: 3,
    });
    assert(prepared.status === 200 && prepared.json, `prepare answered ${prepared.status}: ${prepared.text.slice(0, 200)}`);
    assert(typeof prepared.json.requestId === "string" && prepared.json.requestId.length > 0, "no prompt id came back");
    assert(prepared.json.prompt.includes("Write 3"), "the prompt text does not carry the chosen count");
    assert(prepared.json.prompt.includes("cases"), "the prompt text does not carry the chosen topic");

    const before = (await getJson("/api/cards")).cards.length;
    const send = await postJson("/api/provider/generate", { requestId: prepared.json.requestId });
    assert(send.status >= 400, `sending without a provider answered ${send.status}`);
    assert(typeof send.json?.error === "string" && send.json.error.length > 0, "the refusal was not in plain words");
    assert(/no provider is set up/i.test(send.json.error), `the refusal read: ${send.json.error}`);
    const after = (await getJson("/api/cards")).cards.length;
    assert(after === before, "the refused send changed the deck");
    const log = await getJson("/api/prompts?limit=10");
    assert(log.entries.length === 0, `the refused send still logged ${log.entries.length} prompt(s)`);
    return `prompt of ${prepared.json.prompt.length} characters, nothing sent`;
  });
} finally {
  await stopServer(server);
}

// --- Phase B: a provider key exists and must never surface ------------------
const marker = "SIM-KEY-c9124e-do-not-share";
server = await startServer({
  ...serverEnv,
  FLASHCARDS_PROVIDER_URL: "http://127.0.0.1:9/v1",
  FLASHCARDS_PROVIDER_MODEL: "sim-model",
  FLASHCARDS_PROVIDER_KEY: marker,
});
try {
  await point(10, "no response body ever contains the provider key", async () => {
    const settings = await request("GET", "/api/settings");
    assert(settings.status === 200, `/api/settings answered ${settings.status}`);
    assert(!settings.text.includes(marker), "the key appeared in /api/settings");
    assert(settings.json.provider.hasKey === true, "the key was not noticed at all");
    assert(settings.json.provider.keyStore === "environment", `the key store was ${settings.json.provider.keyStore}`);
    assert(settings.json.provider.configured === true, "the provider did not look configured");

    const prompts = await request("GET", "/api/prompts?limit=10");
    assert(!prompts.text.includes(marker), "the key appeared in the prompt log");

    const health = await request("GET", "/api/health");
    assert(!health.text.includes(marker), "the key appeared in /api/health");

    const prepared = await postJson("/api/provider/prepare", {
      packName: "polish-starter",
      topic: "cases",
      count: 2,
    });
    assert(prepared.status === 200, `prepare answered ${prepared.status}`);

    // Sweep the other bodies a browser can reach, including failed calls.
    const cards = await getJson("/api/cards");
    const oneCard = cards.cards[0];
    assert(oneCard, "the deck was empty in the key sweep");
    const sweeps = [
      await request("GET", "/api/plan"),
      await request("GET", "/api/cards"),
      await request("GET", "/api/progress"),
      await request("GET", `/api/evidence?cardId=${encodeURIComponent(oneCard.id)}`),
      await request("GET", "/api/packs"),
      await postJson("/api/provider/hint", {
        cardId: oneCard.id,
        approved: true,
        usedHints: [],
        outcomeCategory: "not answered yet",
      }),
      await postJson("/api/provider/test", {}),
      await postJson("/api/provider/generate", { requestId: "not-a-real-id" }),
      await postJson("/api/evidence/correction", { rowId: "not-a-real-row", outcome: "got_it" }),
    ];
    for (const body of [...sweeps, prepared]) {
      assert(!body.text.includes(marker), `the key appeared in ${body.status} ${body.text.slice(0, 120)}`);
    }
    return `key active in the environment, absent from ${sweeps.length + 5} bodies`;
  });
} finally {
  await stopServer(server);
  await rm(workspace, { recursive: true, force: true });
}

const failed = checks.filter((check) => !check.ok);
console.log("");
console.log(`${checks.length} checks: ${checks.length - failed.length} passed, ${failed.length} failed`);
for (const check of failed) {
  console.log(`  - point ${check.number}: ${check.name}`);
  console.log(`    ${check.detail}`);
}
process.exit(failed.length === 0 ? 0 : 1);
