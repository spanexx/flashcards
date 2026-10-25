#!/usr/bin/env node
// WHY: The drift log only keeps code honest if a machine checks it. This script
// is the gate: header counts, required fields, real line references, and the
// rule that a quoted doc line must actually say the words quoted.
// ETHICS: docs/ethics/drift.md
// 2026-10-25 qoder: added the drift checker for docs/drift.md. [ethics: drift]
// 2026-10-25 qoder: added the staged and release modes, so a live entry blocks
//   the files it is about instead of only being recorded. [ethics: drift]

import { execFileSync } from 'node:child_process';
import { readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// WHY: The checker must work from any working folder, so the repo root comes
// from this file's own location: <repo>/scripts/check-drift.mjs -> <repo>.
const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(SCRIPT_DIR, '..');
const DEFAULT_DRIFT_FILE = path.join(REPO_ROOT, 'docs', 'drift.md');

// WHY: Section headings are the only place an entry's state is written, so the
// heading text is the state. Any other heading leaves the state unknown.
const SECTION_STATES = new Map([
  ['open', 'open'],
  ['awaiting decision', 'awaiting'],
  ['resolved', 'resolved'],
]);

// WHY: These are the parts every live entry must carry. A resolved entry also
// says how it was checked, so history can be trusted without re-reading code.
const REQUIRED_FIELDS = ['Doc claim', 'Code reality', 'Why matters', 'Owner', 'To fix', 'Related'];
const RESOLVED_EXTRA_FIELD = 'Verified by';
const KNOWN_FIELDS = [...REQUIRED_FIELDS, RESOLVED_EXTRA_FIELD];

// WHY: A quote shorter than this is a word, not evidence. The window is how far
// a quoted phrase may sit from the cited line and still count as from it.
const QUOTE_MIN_LENGTH = 12;
const QUOTE_WINDOW = 3;

// WHY: Three questions get three modes. Checking the log, checking a commit,
// and checking a release are different gates, and one mode must not pretend to
// answer another's question.
const MODES = new Set(['log', 'staged', 'release']);

const USAGE = [
  'Usage: node scripts/check-drift.mjs [--mode=log|staged|release] [--file <path>] [--verbose]',
  '',
  'Checks a drift log. The default is <repo>/docs/drift.md.',
  '  --mode=log      check the log itself (default)',
  '  --mode=staged   fail when a staged file belongs to an Open or Awaiting entry',
  '  --mode=release  fail while any Open or Awaiting entry remains',
  "  --file <path>   check another checkout's log",
  '  --verbose       show what was parsed',
].join('\n');

/**
 * WHY: Options arrive on the command line; a bad one must fail loudly rather
 * than silently check the wrong file or run the wrong gate.
 */
function parseArgs(argv) {
  const options = { file: null, mode: 'log', verbose: false, help: false };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--verbose') {
      options.verbose = true;
    } else if (arg === '--help' || arg === '-h') {
      options.help = true;
    } else if (arg === '--file') {
      const value = argv[index + 1];
      if (!value || value.startsWith('--')) throw new Error('--file needs a path after it.');
      options.file = value;
      index += 1;
    } else if (arg.startsWith('--file=')) {
      const value = arg.slice('--file='.length);
      if (!value) throw new Error('--file needs a path after it.');
      options.file = value;
    } else if (arg === '--mode') {
      const value = argv[index + 1];
      if (!value || value.startsWith('--')) throw new Error('--mode needs one of: log, staged, release.');
      if (!MODES.has(value)) throw new Error(`unknown mode "${value}". Use one of: log, staged, release.`);
      options.mode = value;
      index += 1;
    } else if (arg.startsWith('--mode=')) {
      const value = arg.slice('--mode='.length);
      if (!MODES.has(value)) throw new Error(`unknown mode "${value}". Use one of: log, staged, release.`);
      options.mode = value;
    } else {
      throw new Error(`unknown option "${arg}".\n\n${USAGE}`);
    }
  }
  return options;
}

/**
 * WHY: Line numbers are the whole point of a citation, so every reader of the
 * file must agree on what a line is: LF endings, no phantom line at the end.
 */
function splitLines(text) {
  const lines = text.replace(/\r\n?/g, '\n').split('\n');
  if (lines.length > 0 && lines[lines.length - 1] === '') lines.pop();
  return lines;
}

/**
 * WHY: This reads a file once per path. The same doc line is often cited by
 * several entries, and a checker should be cheap enough to run every time.
 */
function readLinesOnce(cache, absolutePath) {
  if (!cache.has(absolutePath)) {
    cache.set(absolutePath, splitLines(readFileSync(absolutePath, 'utf8')));
  }
  return cache.get(absolutePath);
}

/**
 * WHY: The header is a claim about the log. If the claim and the sections
 * disagree, one of them is stale and the log cannot be trusted.
 */
function parseHeader(lines) {
  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    if (!line.includes('Last updated:') || !line.includes('**Open:**')) continue;
    const open = readCount(line, 'Open');
    const resolved = readCount(line, 'Resolved');
    const awaiting = readCount(line, 'Awaiting');
    if (open === null || resolved === null) {
      return { error: `the header line on line ${index + 1} has no readable Open and Resolved counts.` };
    }
    return { open, resolved, awaiting, line: index + 1 };
  }
  return { error: 'the header line with the counts (`**Last updated:** ... **Open:** N ... **Resolved:** M`) was not found.' };
}

/**
 * WHY: A count is only a claim if it is a number; anything else means the
 * header was edited by hand and the checker should say so.
 */
function readCount(line, label) {
  const match = new RegExp(`\\*\\*${label}:\\*\\*\\s*(\\d+)`).exec(line);
  return match ? Number(match[1]) : null;
}

/**
 * WHY: An entry belongs to the section it sits under. That section is its
 * state, so an entry needs no status word of its own and cannot hide one.
 */
function parseEntries(lines) {
  const entries = [];
  let state = null;
  let heading = null;
  let current = null;
  const close = () => {
    if (current) {
      entries.push(current);
      current = null;
    }
  };
  lines.forEach((line, index) => {
    const section = /^##\s+(.+?)\s*$/.exec(line);
    if (section) {
      close();
      heading = section[1].trim();
      state = SECTION_STATES.get(heading.toLowerCase()) ?? null;
      return;
    }
    if (/^---+\s*$/.test(line)) {
      close();
      return;
    }
    const entry = /^-\s+\*\*D-(\d+)\*\*/.exec(line);
    if (entry) {
      close();
      current = { id: `D-${entry[1]}`, state, heading, line: index + 1, body: [line] };
      return;
    }
    if (current) current.body.push(line);
  });
  close();
  return entries;
}

/**
 * WHY: Fields are how an entry explains itself. Reading them by label keeps the
 * checker independent of wording order and of how many lines each field wraps.
 */
function splitFields(body) {
  const fields = new Map();
  let openField = null;
  for (const line of body.slice(1)) {
    const match = /^\s*(?:[-*]\s+)?(Doc claim|Code reality|Why matters|Owner|To fix|Verified by|Related):\s*(.*)$/i.exec(line);
    if (match) {
      openField = canonicalField(match[1]);
      fields.set(openField, match[2]);
    } else if (openField !== null) {
      fields.set(openField, `${fields.get(openField)}\n${line}`);
    }
  }
  return fields;
}

/**
 * WHY: The log uses one spelling per field. Mapping the label back to it means
 * a lower-case "doc claim:" still counts, instead of looking missing.
 */
function canonicalField(label) {
  const wanted = label.toLowerCase();
  const known = KNOWN_FIELDS.find((name) => name.toLowerCase() === wanted);
  return known ?? label;
}

/**
 * WHY: A citation is a path and a line in backticks, with an optional end line
 * for a range. Reading them from text is how the script checks what a human
 * actually wrote, not what the human meant.
 */
function findReferences(text) {
  const references = [];
  const pattern = /`([^`\s]+?):(\d+)(?:-(\d+))?`/g;
  let match = pattern.exec(text);
  while (match !== null) {
    const start = Number(match[2]);
    const target = match[1];
    // WHY: `http://host:3001` is a web address, not a doc line. Treating its
    // port as a line number would report a false missing file on every URL.
    const isWebAddress = /^[a-z][a-z0-9+.-]*:\/\//i.test(target);
    if (!isWebAddress) {
      references.push({
        raw: match[0],
        target,
        start,
        end: match[3] === undefined ? start : Number(match[3]),
      });
    }
    match = pattern.exec(text);
  }
  return references;
}

/**
 * WHY: A quote is proof only if it is long enough to be a sentence fragment,
 * and straight or curly quotes must count the same, because both get typed.
 */
function findQuotes(text) {
  const quotes = [];
  const pattern = /"([^"\n]+)"|“([^”\n]+)”/g;
  let match = pattern.exec(text);
  while (match !== null) {
    const phrase = (match[1] ?? match[2]).trim();
    if (phrase.length >= QUOTE_MIN_LENGTH) quotes.push(phrase);
    match = pattern.exec(text);
  }
  return quotes;
}

/**
 * WHY: A doc quote will rarely match byte for byte, because the log wraps lines
 * and the doc may double a space. Collapsing runs of whitespace compares words.
 */
function normalise(text) {
  return text.replace(/\s+/g, ' ').trim();
}

/**
 * WHY: A reference is only useful if it lands in a real file on a real line.
 * This returns the doc's lines when it does, and a plain reason when it does
 * not, so the entry can be corrected without guesswork.
 */
function inspectReference(reference, baseDir, cache) {
  const absolutePath = path.isAbsolute(reference.target)
    ? reference.target
    : path.resolve(baseDir, reference.target);
  let isFile = false;
  try {
    isFile = statSync(absolutePath).isFile();
  } catch {
    isFile = false;
  }
  if (!isFile) return { ok: false, reason: `the file "${reference.target}" does not exist` };
  const lines = readLinesOnce(cache, absolutePath);
  if (reference.start < 1 || reference.start > lines.length) {
    return { ok: false, reason: `line ${reference.start} is past the end of "${reference.target}" (${lines.length} lines)` };
  }
  if (reference.end < reference.start) {
    return { ok: false, reason: `the range ${reference.start}-${reference.end} in "${reference.target}" runs backwards` };
  }
  if (reference.end > lines.length) {
    return { ok: false, reason: `line ${reference.end} is past the end of "${reference.target}" (${lines.length} lines)` };
  }
  return { ok: true, lines };
}

/**
 * WHY: The quote rule is the one that catches a citation from memory: the words
 * in the log must sit in the doc near the line the log points at.
 */
function quoteAppearsNear(reference, docLines, phrase) {
  const from = Math.max(1, reference.start - QUOTE_WINDOW);
  const to = Math.min(docLines.length, reference.end + QUOTE_WINDOW);
  const window = normalise(docLines.slice(from - 1, to).join(' '));
  return window.includes(normalise(phrase));
}

/**
 * WHY: An entry can be wrong in several ways at once. Collecting them per entry
 * lets the failure report name the entry and every thing to fix in one pass.
 */
function checkEntry(entry, baseDir, cache) {
  const problems = [];
  const warnings = [];
  const fields = splitFields(entry.body);
  const isResolved = entry.state === 'resolved';
  const isLive = entry.state === 'open' || entry.state === 'awaiting';

  if (entry.state === null) {
    problems.push(`it sits under "${entry.heading ?? 'no heading'}", which has no state. Move it under Open, Awaiting decision or Resolved.`);
  }

  // WHY: Awaiting decision is a question for the learner. An entry with no
  // question cannot be answered, so it would sit there forever.
  if (entry.state === 'awaiting' && !entry.body.join(' ').includes('?')) {
    problems.push('it is Awaiting decision but asks no question. Write the exact question the learner must answer.');
  }

  const required = isResolved ? [...REQUIRED_FIELDS, RESOLVED_EXTRA_FIELD] : REQUIRED_FIELDS;
  const missing = required.filter((name) => {
    const value = fields.get(name);
    return value === undefined || normalise(value) === '';
  });
  if (missing.length > 0) {
    problems.push(`it is missing ${missing.map((name) => `"${name}:"`).join(', ')}.`);
  }

  const docClaim = fields.get('Doc claim') ?? '';
  const docReferences = findReferences(docClaim);
  const quotes = findQuotes(docClaim);
  const quotedWordsFound = new Set();
  let readableDocReferences = 0;

  for (const [fieldName, text] of fields) {
    for (const reference of findReferences(text)) {
      const result = inspectReference(reference, baseDir, cache);
      if (!result.ok) {
        const message = `${fieldName} cites ${reference.raw}, but ${result.reason}.`;
        if (isResolved) warnings.push(message);
        else problems.push(message);
        continue;
      }
      if (fieldName !== 'Doc claim' || !isLive) continue;
      readableDocReferences += 1;
      for (const phrase of quotes) {
        if (quoteAppearsNear(reference, result.lines, phrase)) quotedWordsFound.add(phrase);
      }
    }
  }

  if (isLive) {
    if (docReferences.length === 0) {
      problems.push('its Doc claim cites no doc line. Add `path:line` for the words it relies on.');
    }
    if (quotes.length === 0) {
      problems.push(docReferences.length > 0
        ? 'its Doc claim cites a doc line but quotes nothing from it. Copy the words you rely on into double quotes.'
        : 'its Doc claim quotes no words from the doc.');
    } else if (readableDocReferences > 0) {
      for (const phrase of quotes) {
        if (quotedWordsFound.has(phrase)) continue;
        problems.push(`the quoted words "${phrase}" do not appear within ${QUOTE_WINDOW} lines of any doc line cited in its Doc claim.`);
      }
    }
  }

  return { problems, warnings };
}

/**
 * WHY: Counts, entries and quoting are separate questions. Checking them in one
 * place keeps the final report ordered: counts first, then each entry by name.
 */
function runCheck(entries, header, baseDir, cache) {
  const problems = [];
  const warnings = [];

  if (header.error) {
    problems.push({ id: null, text: header.error });
  } else {
    const counts = countStates(entries);
    if (header.open !== counts.open) {
      problems.push({ id: null, text: `the header says Open: ${header.open} but ${counts.open} entries sit under "## Open".` });
    }
    if (header.resolved !== counts.resolved) {
      problems.push({ id: null, text: `the header says Resolved: ${header.resolved} but ${counts.resolved} entries sit under "## Resolved".` });
    }
    if (header.awaiting !== null && header.awaiting !== counts.awaiting) {
      problems.push({ id: null, text: `the header says Awaiting: ${header.awaiting} but ${counts.awaiting} entries sit under "## Awaiting decision".` });
    }
  }

  for (const entry of entries) {
    const result = checkEntry(entry, baseDir, cache);
    for (const text of result.problems) problems.push({ id: entry.id, text });
    for (const text of result.warnings) warnings.push({ id: entry.id, text });
  }

  return { problems, warnings };
}

/**
 * WHY: The success line states what was counted, so a passing run still tells a
 * human that the log is empty rather than merely unexamined.
 */
function countStates(entries) {
  return {
    open: entries.filter((entry) => entry.state === 'open').length,
    awaiting: entries.filter((entry) => entry.state === 'awaiting').length,
    resolved: entries.filter((entry) => entry.state === 'resolved').length,
  };
}

/**
 * WHY: Verbose output is for the human fixing the log. It shows what the script
 * understood, so a stubborn failure is explained rather than argued with.
 */
function describe(entries, header, baseDir, driftFile) {
  const lines = [
    `file: ${driftFile}`,
    `line base: ${baseDir}`,
    header.error ? `header: ${header.error}` : `header: Open ${header.open}, Resolved ${header.resolved}${header.awaiting === null ? '' : `, Awaiting ${header.awaiting}`} (line ${header.line})`,
    `entries: ${entries.length}`,
  ];
  for (const entry of entries) {
    const fields = splitFields(entry.body);
    const names = [...fields.keys()].join(', ') || 'none';
    lines.push(`  ${entry.id} at line ${entry.line}: ${entry.state ?? 'no state'} (${entry.heading ?? 'no heading'}); fields: ${names}`);
  }
  return lines.join('\n');
}

/**
 * WHY: Policing needs the files an entry is about, and the entry already names
 * them in its code and fix fields. Reading them from there means the log is the
 * single place that decides what a commit must not carry.
 */
function findTouchedPaths(entry) {
  const fields = splitFields(entry.body);
  const texts = [fields.get('Code reality') ?? '', fields.get('To fix') ?? ''];
  const paths = new Set();
  // WHY: A repo path is at least two name segments joined by a slash. A longer
  // run wins, so a folder and its file are read as one path, not two.
  const pattern = /(?:^|[^A-Za-z0-9_.\-/])((?:[A-Za-z0-9_.-]+\/)+[A-Za-z0-9_.-]+)/g;
  for (const text of texts) {
    let match = pattern.exec(text);
    while (match !== null) {
      paths.add(match[1].replace(/^\.\//, ''));
      match = pattern.exec(text);
    }
  }
  return [...paths];
}

/**
 * WHY: A staged path and a cited path must be compared in one spelling, and a
 * cited folder should cover every file beneath it.
 */
function pathMatches(stagedFile, citedPath) {
  const file = stagedFile.replace(/\\/g, '/').replace(/^\.\//, '');
  const cited = citedPath.replace(/\\/g, '/').replace(/^\.\//, '');
  return file === cited || file.startsWith(`${cited}/`);
}

/**
 * WHY: The staging area is what the next commit will contain, so it is the
 * honest question for a pre-commit gate. Asking git avoids trusting a file list
 * the committer typed by hand.
 */
function stagedFiles(repoRoot) {
  let output;
  try {
    output = execFileSync('git', ['-C', repoRoot, 'diff', '--cached', '--name-only', '--diff-filter=ACMR'], { encoding: 'utf8' });
  } catch (error) {
    throw new Error(`cannot read the staged files from git: ${error.message.trim()}`);
  }
  return splitLines(output).map((line) => line.trim()).filter((line) => line.length > 0);
}

/**
 * WHY: A failure report is useful only if it says what the entry is about, and
 * the entry heading already says it after the dash.
 */
function entryTitle(entry) {
  const heading = entry.body[0] ?? '';
  const dash = heading.indexOf('—');
  return normalise(dash === -1 ? heading : heading.slice(dash + 1));
}

/**
 * WHY: A live entry is a known disagreement. While it is Open its files may not
 * be committed, because committing them would ship the gap as if it were done.
 * While it is Awaiting decision the learner has not chosen, so its files may not
 * land at all; that is the difference between "fix it now" and "wait".
 */
function policeStaged(entries, driftFile) {
  const staged = stagedFiles(REPO_ROOT);
  if (staged.length === 0) {
    console.log('drift staged ok: nothing is staged, so no live entry can be committed.');
    return 0;
  }
  const live = entries.filter((entry) => entry.state === 'open' || entry.state === 'awaiting');
  const collisions = [];
  for (const entry of live) {
    const touched = findTouchedPaths(entry);
    const hits = staged.filter((file) => touched.some((cited) => pathMatches(file, cited)));
    if (hits.length > 0) collisions.push({ entry, hits });
  }
  if (collisions.length === 0) {
    const verb = staged.length === 1 ? 'touches' : 'touch';
    console.log(`drift staged ok: ${staged.length} staged file${staged.length === 1 ? '' : 's'} ${verb} no Open or Awaiting entry.`);
    return 0;
  }
  console.error(`drift staged failed: ${collisions.length} live drift entr${collisions.length === 1 ? 'y touches' : 'ies touch'} staged files.`);
  console.error('');
  for (const { entry, hits } of collisions) {
    const files = hits.map((file) => `\`${file}\``).join(', ');
    const at = `${driftFile}:${entry.line}`;
    if (entry.state === 'open') {
      console.error(`- ${entry.id} (Open, ${at}) is about ${files}. Resolve ${entry.id} in the log with a "Verified by:" line in this same commit, or unstage the file.`);
    } else {
      console.error(`- ${entry.id} (Awaiting decision, ${at}) is about ${files}. The learner has not decided; do not commit these files until the decision is written down.`);
    }
  }
  return 1;
}

/**
 * WHY: A release is a promise that the documented intent and the code agree.
 * Every live entry is a known disagreement, so none may survive a release.
 */
function policeRelease(entries, driftFile) {
  const live = entries.filter((entry) => entry.state === 'open' || entry.state === 'awaiting');
  if (live.length === 0) {
    console.log('drift release ok: no Open or Awaiting entries remain.');
    return 0;
  }
  const counts = countStates(entries);
  console.error(`drift release failed: ${counts.open} open and ${counts.awaiting} awaiting entr${live.length === 1 ? 'y' : 'ies'} remain in ${driftFile}.`);
  console.error('');
  for (const entry of live) {
    const state = entry.state === 'open' ? 'Open' : 'Awaiting decision';
    console.error(`- ${entry.id} (${state}, ${driftFile}:${entry.line}) — ${entryTitle(entry)}`);
  }
  console.error('');
  console.error("A release needs both sections empty: fix the gap, or record the learner's decision and the doc that now carries it.");
  return 1;
}

/**
 * WHY: The script reports and returns a code; it never edits the log. A gate
 * that can fix its own input is not a gate.
 */
function main(argv) {
  const options = parseArgs(argv);
  if (options.help) {
    console.log(USAGE);
    return 0;
  }

  const driftFile = options.file ? path.resolve(process.cwd(), options.file) : DEFAULT_DRIFT_FILE;
  // WHY: References in the log are written from the checkout root, so the base
  // is the folder above docs/. A log passed from elsewhere uses its own folder.
  const baseDir = path.basename(path.dirname(driftFile)).toLowerCase() === 'docs'
    ? path.dirname(path.dirname(driftFile))
    : path.dirname(driftFile);

  let text;
  try {
    text = readFileSync(driftFile, 'utf8');
  } catch {
    console.error(`drift failed: cannot read ${driftFile}`);
    return 1;
  }

  const lines = splitLines(text);
  const header = parseHeader(lines);
  const entries = parseEntries(lines);
  const cache = new Map();
  const { problems, warnings } = runCheck(entries, header, baseDir, cache);

  if (options.verbose) console.log(describe(entries, header, baseDir, driftFile));

  const shownFile = path.relative(REPO_ROOT, driftFile) || driftFile;

  // WHY: These problems are about the log itself, so the message says "drift"
  // and never borrows the mode's name. A malformed log is the same failure in
  // every mode, and the mode's own gate reports separately below.
  if (problems.length > 0) {
    console.error(`drift failed: ${problems.length} problem${problems.length === 1 ? '' : 's'} in ${shownFile}`);
    console.error('');
    for (const problem of problems) {
      console.error(problem.id === null ? `- ${problem.text}` : `- ${problem.id}: ${problem.text}`);
    }
    if (warnings.length > 0) printWarnings(warnings);
    return 1;
  }

  const counts = countStates(entries);
  console.log(`drift ok: ${counts.open} open, ${counts.awaiting} awaiting, ${counts.resolved} resolved — ${shownFile}`);
  if (warnings.length > 0) printWarnings(warnings);
  if (options.mode === 'staged') return policeStaged(entries, shownFile);
  if (options.mode === 'release') return policeRelease(entries, shownFile);
  return 0;
}

/**
 * WHY: History must not block today's gate, but hiding a broken reference in
 * history would let the log rot quietly. Warnings keep it visible and harmless.
 */
function printWarnings(warnings) {
  console.error('');
  console.error('warnings (resolved history only, not blocking):');
  for (const warning of warnings) {
    console.error(warning.id === null ? `- ${warning.text}` : `- ${warning.id}: ${warning.text}`);
  }
}

try {
  process.exitCode = main(process.argv.slice(2));
} catch (error) {
  console.error(`drift failed: ${error.message}`);
  process.exitCode = 1;
}
