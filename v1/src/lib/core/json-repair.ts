// WHY: A hand-typed import fails on typography, not on content. This scanner
// removes only the mistakes a person makes by hand and reports every kind it
// changed, so an import can say what it fixed instead of refusing text it
// understands. It never adds, removes or renames content, and valid JSON is
// returned untouched, so nothing is rewritten behind the learner's back.
// PACK: study-resilience
// 2026-10-26 opencode: created for the study resilience pack [pack: study-resilience]
// 2026-10-26 qoder: a refusal now quotes the words around the failure, because
//   an offset in a fifteen-thousand-character line tells the learner nothing. [D-26]

/** The syntax mistakes the scanner is allowed to fix. */
export type RepairKind =
  | "bom"
  | "code-fence"
  | "smart-quotes"
  | "comments"
  | "trailing-comma"
  | "unquoted-key"
  | "single-quoted-string";

/** What the scanner produced: the rewritten text and the kinds it applied. */
export interface RepairResult {
  text: string;
  repairs: RepairKind[];
}

/** What a loose parse produced: the value and the kinds that made it readable. */
export interface LooseJson {
  value: unknown;
  repairs: RepairKind[];
}

/** Curly quotation marks that stand in for a straight double quote. */
const SMART_DOUBLE = new Set(["\u201C", "\u201D", "\u201E", "\u201F"]);
/** Curly quotation marks that stand in for a straight single quote. */
const SMART_SINGLE = new Set(["\u2018", "\u2019", "\u201A", "\u201B"]);

type StringMode = "plain" | "double" | "curly" | "single";

function isValidJson(text: string): boolean {
  try {
    JSON.parse(text);
    return true;
  } catch {
    return false;
  }
}

/** Drop one surrounding markdown fence, with or without a language word. */
function unwrapFence(text: string): string {
  if (!text.startsWith("```") || !text.endsWith("```") || text.length < 7) return text;
  const inner = text.slice(3, -3);
  const firstLine = /^[A-Za-z0-9_-]*[ \t]*\r?\n/.exec(inner);
  if (firstLine) return inner.slice(firstLine[0].length).trim();
  const inline = /^[A-Za-z0-9_-]+(?=[ \t]*[{["])/.exec(inner);
  return (inline ? inner.slice(inline[0].length) : inner).trim();
}

function isKeyStart(char: string): boolean {
  return /[A-Za-z_$]/.test(char);
}

function isKeyPart(char: string): boolean {
  return /[\w$]/.test(char);
}

/** A bare word is a key only where an object expects one and a colon follows. */
function looksLikeKey(containers: Array<"{" | "[">, previous: string): boolean {
  if (containers[containers.length - 1] !== "{") return false;
  return previous === "{" || previous === ",";
}

/**
 * One pass that removes comments, converts quote typography and quotes bare
 * keys. The only edit allowed inside a string is quote typography: a string
 * opened by a straight quote keeps every curly mark and escape as written.
 */
function scan(text: string): { text: string; repairs: RepairKind[] } {
  let out = "";
  const repairs = new Set<RepairKind>();
  const containers: Array<"{" | "["> = [];
  let mode: StringMode = "plain";
  let previous = "";
  let index = 0;

  while (index < text.length) {
    const char = text[index];

    if (mode !== "plain") {
      const next = text[index + 1];
      if (char === "\\") {
        if (mode === "single" && next === "'") out += "'";
        else {
          out += char;
          if (next !== undefined) out += next;
        }
        index += 2;
        continue;
      }
      if (mode === "double") {
        out += char;
        if (char === '"') {
          mode = "plain";
          previous = '"';
        }
        index += 1;
        continue;
      }
      if (mode === "curly") {
        if (SMART_DOUBLE.has(char)) {
          mode = "plain";
          out += '"';
          previous = '"';
        } else if (char === '"') {
          // A straight quote inside a smart-quoted string is content, so it is
          // escaped rather than allowed to end the JSON string.
          out += '\\"';
        } else out += char;
        index += 1;
        continue;
      }
      // A single-quoted string becomes double-quoted, and a curly single quote
      // closes it, so the closing rune is normalised too.
      if (char === "'" || SMART_SINGLE.has(char)) {
        if (SMART_SINGLE.has(char)) repairs.add("smart-quotes");
        mode = "plain";
        out += '"';
        previous = '"';
      } else if (char === '"') out += '\\"';
      else out += char;
      index += 1;
      continue;
    }

    if (char === "/" && text[index + 1] === "/") {
      repairs.add("comments");
      index += 2;
      while (index < text.length && text[index] !== "\n") index += 1;
      continue;
    }
    if (char === "/" && text[index + 1] === "*") {
      repairs.add("comments");
      index += 2;
      while (index < text.length && !(text[index] === "*" && text[index + 1] === "/")) index += 1;
      index += 2;
      continue;
    }
    if (char === '"') {
      mode = "double";
      out += char;
      previous = char;
      index += 1;
      continue;
    }
    if (SMART_DOUBLE.has(char)) {
      repairs.add("smart-quotes");
      mode = "curly";
      out += '"';
      previous = '"';
      index += 1;
      continue;
    }
    if (char === "'" || SMART_SINGLE.has(char)) {
      if (SMART_SINGLE.has(char)) repairs.add("smart-quotes");
      repairs.add("single-quoted-string");
      mode = "single";
      out += '"';
      previous = '"';
      index += 1;
      continue;
    }
    if (isKeyStart(char) && looksLikeKey(containers, previous)) {
      let end = index + 1;
      while (end < text.length && isKeyPart(text[end])) end += 1;
      let after = end;
      while (after < text.length && /\s/.test(text[after])) after += 1;
      if (text[after] === ":") {
        repairs.add("unquoted-key");
        out += `"${text.slice(index, end)}"`;
      } else out += text.slice(index, end);
      previous = text[end - 1];
      index = end;
      continue;
    }
    if (char === "{" || char === "[") {
      containers.push(char);
      out += char;
      previous = char;
      index += 1;
      continue;
    }
    if (char === "}" || char === "]") {
      containers.pop();
      out += char;
      previous = char;
      index += 1;
      continue;
    }
    out += char;
    if (!/\s/.test(char)) previous = char;
    index += 1;
  }

  return { text: out, repairs: [...repairs] };
}

/** Remove a comma whose next real character closes an object or an array. */
function stripTrailingCommas(text: string): string {
  let out = "";
  let inString = false;
  let index = 0;
  while (index < text.length) {
    const char = text[index];
    if (inString) {
      out += char;
      if (char === "\\" && index + 1 < text.length) {
        out += text[index + 1];
        index += 2;
        continue;
      }
      if (char === '"') inString = false;
      index += 1;
      continue;
    }
    if (char === '"') {
      inString = true;
      out += char;
      index += 1;
      continue;
    }
    if (char === ",") {
      let next = index + 1;
      while (next < text.length && /\s/.test(text[next])) next += 1;
      if (text[next] === "}" || text[next] === "]") {
        index += 1;
        continue;
      }
    }
    out += char;
    index += 1;
  }
  return out;
}

/**
 * Rewrite syntax only, and only when the text is not already valid JSON, so a
 * valid document always comes back identical with no repairs reported.
 */
export function repairJson(text: string): RepairResult {
  if (isValidJson(text)) return { text, repairs: [] };

  const repairs: RepairKind[] = [];
  let body = text;
  if (body.charCodeAt(0) === 0xfeff) {
    body = body.slice(1);
    repairs.push("bom");
  }
  body = body.trim();

  const fenced = unwrapFence(body);
  if (fenced !== body) {
    body = fenced;
    repairs.push("code-fence");
  }
  if (body.charCodeAt(0) === 0xfeff) {
    body = body.slice(1).trim();
    if (!repairs.includes("bom")) repairs.push("bom");
  }

  const scanned = scan(body);
  body = scanned.text;
  for (const kind of scanned.repairs) if (!repairs.includes(kind)) repairs.push(kind);

  const stripped = stripTrailingCommas(body);
  if (stripped !== body) {
    body = stripped;
    repairs.push("trailing-comma");
  }

  return { text: body, repairs };
}

/** How much text either side of the failure the refusal quotes. */
const SNIPPET_ARMS = 40;

/**
 * WHY: A parser reports an offset, and a pasted pack is one line of fifteen
 * thousand characters, so the offset alone gives the learner nothing to look
 * at. The words around the failure are what can be searched for by eye.
 * PACK: D-26
 */
function failureSnippet(text: string, offset: number): string | null {
  const point = Math.max(0, Math.min(offset, text.length));
  const start = Math.max(0, point - SNIPPET_ARMS);
  const end = Math.min(text.length, point + SNIPPET_ARMS);
  const body = text.slice(start, end).replace(/\s+/g, " ").trim();
  if (body === "") return null;
  return `${start > 0 ? "…" : ""}${body}${end < text.length ? "…" : ""}`;
}

/**
 * Parse text that may carry hand-typed syntax mistakes. A text that is still
 * broken after every repair throws instead of guessing a value.
 */
export function parseJsonLoose(text: string): LooseJson {
  const repaired = repairJson(text);
  try {
    return { value: JSON.parse(repaired.text) as unknown, repairs: repaired.repairs };
  } catch (error) {
    const reason = error instanceof Error ? error.message : "unknown parse error";
    const tried = repaired.repairs.length > 0 ? " (syntax repair was tried first)" : "";
    // WHY: V8 states the offset, other engines may not, and a text that simply
    // stops fails at its end — which is then the only useful place to quote.
    const stated = /position (\d+)/.exec(reason);
    const snippet = failureSnippet(repaired.text, stated ? Number(stated[1]) : repaired.text.length);
    const near = snippet ? `. The broken part is: ${snippet}` : "";
    throw new Error(`the text is not valid JSON: ${reason}${near}${tried}`);
  }
}

/** The words the learner sees for one kind of repair. */
const REPAIR_LABELS: Record<RepairKind, string> = {
  bom: "a byte-order mark",
  "code-fence": "a markdown fence",
  "smart-quotes": "smart quotes",
  comments: "comments",
  "trailing-comma": "a trailing comma",
  "unquoted-key": "an unquoted key",
  "single-quoted-string": "single quotes",
};

/**
 * The opening words of a repair notice, or null when nothing was repaired.
 * One shared wording keeps the job dock and the pack panel in step.
 */
export function repairClause(repairs: RepairKind[] | undefined): string | null {
  if (!repairs || repairs.length === 0) return null;
  const labels = repairs.map((kind) => REPAIR_LABELS[kind]);
  const listed =
    labels.length === 1
      ? labels[0]
      : `${labels.slice(0, -1).join(", ")} and ${labels[labels.length - 1]}`;
  return `Repaired ${listed}`;
}
