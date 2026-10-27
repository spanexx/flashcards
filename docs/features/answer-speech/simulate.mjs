// WHY: The post-impl simulation must run the real helper, not a copy of its
// rules. It transpiles the shipped module with the project's own TypeScript,
// then checks the exact words and language tag each spoken line receives, the
// no-voice guard, and that the existing speech controls are still present.
// PACK: answer-speech
// 2026-10-27 opencode: created after the implementation [pack: answer-speech]
// 2026-10-27 opencode: answers are now lines with a language each, after the
// learner heard English read with the Polish voice. [pack: answer-speech]

import { readFileSync, writeFileSync } from "node:fs";
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

const { answerSpeech, CODE_ANSWER_LINE } = await loadModule(
  "v1/src/lib/client/answer-speech.ts",
  "answer-speech",
);
const { speechSupported } = await loadModule("v1/src/lib/client/speech.ts", "speech");

const teaching = [
  { type: "text", text: "The double star is exponentiation." },
  { type: "image", source: "web", src: "https://example.test/power.png", alt: "A power table" },
];

const codeChars = /[(){}*/[\]]/;

const results = [];

function check(name, condition, detail) {
  results.push({ name, pass: Boolean(condition), detail });
}

// Scenario 1: the card's own tags say which voice reads which words.
{
  const got = answerSpeech(
    [
      { type: "text", text: "Byłem w domu.", lang: "pl" },
      { type: "text", text: "I was at home.", role: "translation", lang: "en" },
    ],
    { lang: "es", sourceLang: "fr" },
  );
  check(
    "1. A tagged card reads Polish with Polish and English with English",
    got.length === 2 &&
      got[0].text === "Byłem w domu." &&
      got[0].lang === "pl" &&
      got[1].text === "I was at home." &&
      got[1].lang === "en",
    JSON.stringify(got),
  );
}

// Scenario 2: numbers are left to the pack voice.
{
  const got = answerSpeech([{ type: "text", text: "There are 3 apples and 12 pears." }], {
    lang: "en",
  });
  check(
    "2. English numbers stay in the English voice",
    got.length === 1 &&
      got[0].text === "There are 3 apples and 12 pears." &&
      got[0].lang === "en",
    JSON.stringify(got),
  );
}

// Scenario 3: code is replaced by the teaching text at the code's position.
{
  const before = answerSpeech(
    [
      { type: "text", text: "It prints 8." },
      { type: "code", text: "print(2 ** 3)" },
    ],
    { lang: "en", teaching },
  );
  const after = answerSpeech(
    [
      { type: "code", text: "print(2 ** 3)" },
      { type: "text", text: "It prints 8." },
    ],
    { lang: "en", teaching },
  );
  const beforeText = before.map((line) => line.text).join(" ");
  const afterText = after.map((line) => line.text).join(" ");
  check(
    "3. Code answer is explained by its teaching text, in place",
    beforeText === "It prints 8. The double star is exponentiation." &&
      afterText === "The double star is exponentiation. It prints 8." &&
      !codeChars.test(beforeText) &&
      !codeChars.test(afterText),
    `before=${JSON.stringify(beforeText)} after=${JSON.stringify(afterText)}`,
  );
}

// Scenario 4: code with no teaching still says something.
{
  const got = answerSpeech([{ type: "code", text: "print(2 ** 3)" }], { lang: "en" });
  const text = got.map((line) => line.text).join(" ");
  check(
    "4. Code without teaching gets one short line, never the symbols",
    got.length === 1 && text === CODE_ANSWER_LINE && !codeChars.test(text),
    JSON.stringify(text),
  );
}

// Scenario 5: outside a browser the guard is false, so the control is hidden.
{
  const supported = speechSupported();
  check(
    "5. No device voice: speechSupported() is false under plain Node",
    supported === false,
    `speechSupported()=${supported}`,
  );
}

// Scenario 6: an older card with no tags still plays through the pack pair.
{
  const got = answerSpeech(
    [
      { type: "text", text: "Byłem w domu." },
      { type: "text", text: "I was at home.", role: "translation" },
    ],
    { lang: "pl", sourceLang: "en" },
  );
  check(
    "6. An untagged older card falls back to the pack pair",
    got.length === 2 && got[0].lang === "pl" && got[1].lang === "en",
    JSON.stringify(got),
  );
}

// Scenario 7: the existing speech controls are still in the shipped source.
{
  const files = {
    "Hear it": "v1/src/app/study/CardSide.tsx",
    "Play the line": "v1/src/app/study/StudyCard.tsx",
    "Listen to the layer": "v1/src/app/study/TeachingLayer.tsx",
    "playCue": "v1/src/lib/client/sound.ts",
  };
  const missing = Object.entries(files).filter(
    ([needle, file]) => !readFileSync(path.join(root, file), "utf8").includes(needle),
  );
  check(
    "7. Hear it, Play the line, Listen to the layer and the feedback cues remain",
    missing.length === 0,
    missing.length === 0 ? "all present" : `missing: ${missing.map(([needle]) => needle).join(", ")}`,
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
