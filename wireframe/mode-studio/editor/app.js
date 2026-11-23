// WHY: Prototype state and interactions for the polished two-mode editor.
// Nothing is stored; edits mutate one in-memory object.
// PACK: mode-studio-ui

const state = {
  id: "grammar-roles-copy",
  name: "Grammar roles copy",
  description: "Study grammar as the jobs words do in a sentence.",
  version: "1.0.0",
  defaultCardMix: ["cloze", "picks", "type"],
  usesWordStages: false,
  skillInstructions: "# Grammar roles\n\nName each deck with the job in plain English and the term in parentheses, for example `Doer (subject)`.\n\n- State the role in the prompt before asking for its name.\n- Explain the intuition in the teaching layer; never drill basic -s or -ed endings.\n- Vary cloze, picks and type cards so the same role is recognised in new sentences.",
  canonicalExample: {
    schema: "flashcards.pack/v1",
    pack: { name: "mode-demo-grammar-roles", version: "1.0.0", language: "en", sourceLanguage: "en" },
    decks: [{ id: "doer", name: "Doer (subject)", level: "beginner" }],
    cards: [
      {
        deckId: "doer",
        summary: "The doer",
        prompt: [
          { type: "text", text: "In 'Anna reads a book', the noun doing the action is the" },
          { type: "blank", id: "b1" },
          { type: "text", text: "." },
        ],
        answer: [{ type: "text", text: "In 'Anna reads a book', the noun doing the action is the subject." }],
        answerDef: { mode: "cloze", blanks: [{ id: "b1", expected: ["subject"] }] },
        teaching: [{ type: "text", text: "It answers who or what performs the verb." }],
      },
    ],
    words: [],
    pages: [],
  },
  isBuiltIn: false,
  sourceModeId: "grammar-roles",
  createdAt: "2026-11-23T00:00:00.000Z",
};

const tree = document.getElementById("tree");
const raw = document.getElementById("raw");
const pathLabel = document.getElementById("path");
const skillSource = document.getElementById("skill-source");
const skillPreview = document.getElementById("skill-preview");
const skillCount = document.getElementById("skill-count");
const toast = document.getElementById("toast");
let lastJson = "";
let toastTimer = null;

function setAt(path, value) {
  const parent = path.slice(0, -1).reduce((node, key) => node[key], state);
  parent[path[path.length - 1]] = value;
}
function deleteAt(path) {
  const parent = path.slice(0, -1).reduce((node, key) => node[key], state);
  if (Array.isArray(parent)) parent.splice(Number(path[path.length - 1]), 1);
  else delete parent[path[path.length - 1]];
}
function label(path) { return path.length === 0 ? "mode" : String(path[path.length - 1]); }
function escapeHtml(text) {
  return String(text).replace(/[&<>"']/g, (char) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  })[char]);
}
function showPath(path) {
  pathLabel.textContent = path.length ? `mode / ${path.map(String).join(" / ")}` : "mode";
}
function highlight(json) {
  return escapeHtml(json).replace(
    /("(?:\\.|[^"\\])*")(\s*:)?|(\b(?:true|false|null)\b)|(-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?)/g,
    (match, str, colon, bool, num) => {
      let cls = "text-violet-300";
      if (str) cls = colon ? "text-teal-300" : "text-amber-200";
      if (bool) cls = bool === "null" ? "text-slate-500" : "text-rose-300";
      if (num) cls = "text-violet-300";
      return `<span class="${cls}">${match}</span>`;
    },
  );
}

function refreshDerived() {
  lastJson = JSON.stringify(state, null, 2);
  // WHY: syntax colours make the raw side readable without a second editor.
  raw.innerHTML = highlight(lastJson);
  skillPreview.innerHTML = renderMarkdown(state.skillInstructions);
  skillCount.textContent = `${state.skillInstructions.length} characters`;
}

function renderMarkdown(src) {
  const lines = escapeHtml(src).split("\n");
  let html = "";
  let inList = false;
  for (const line of lines) {
    const text = line
      .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
      .replace(/`(.+?)`/g, '<code>$1</code>');
    const heading = text.match(/^(#{1,3})\s+(.*)$/);
    const bullet = text.match(/^-\s+(.*)$/);
    if (heading) {
      if (inList) { html += "</ul>"; inList = false; }
      const size = heading[1].length === 1 ? "h1" : heading[1].length === 2 ? "h2" : "h3";
      html += `<${size}>${heading[2]}</${size}>`;
    } else if (bullet) {
      if (!inList) { html += "<ul>"; inList = true; }
      html += `<li>${bullet[1]}</li>`;
    } else if (text.trim() === "") {
      if (inList) { html += "</ul>"; inList = false; }
    } else {
      if (inList) { html += "</ul>"; inList = false; }
      html += `<p>${text}</p>`;
    }
  }
  if (inList) html += "</ul>";
  return html;
}

function icon(name) { return `<i data-lucide="${name}" class="h-3.5 w-3.5"></i>`; }

function renderNode(value, path, depth, host) {
  const isBranch = value !== null && typeof value === "object";
  const row = document.createElement("div");
  row.className = "tree-row flex items-center gap-1 px-1 py-1";
  row.style.paddingLeft = `${4 + depth * 14}px`;
  const name = label(path);

  if (isBranch) {
    const toggle = document.createElement("button");
    toggle.className = "branch-btn rounded p-1";
    toggle.innerHTML = icon("chevron-right");
    const children = document.createElement("div");
    children.className = "branch";
    toggle.addEventListener("click", () => {
      const closed = !children.classList.toggle("open");
      toggle.classList.toggle("open", !closed);
      toggle.innerHTML = icon(closed ? "chevron-right" : "chevron-down");
      if (window.lucide) window.lucide.createIcons();
    });
    const key = document.createElement("span");
    key.className = "flex-1 truncate text-slate-300";
    key.textContent = name;
    const badge = document.createElement("span");
    badge.className = "rounded px-1.5 text-[10px]";
    badge.style.background = "#1a2940";
    badge.style.color = "#8fa3bd";
    badge.textContent = Array.isArray(value) ? `[${value.length}]` : `{${Object.keys(value).length}}`;
    const add = document.createElement("button");
    add.className = "row-action rounded p-1 hover:bg-slate-700";
    add.title = "Add entry";
    add.innerHTML = icon("plus");
    add.addEventListener("click", () => {
      if (Array.isArray(value)) value.push(value.length ? structuredClone(value[0]) : "");
      else {
        const wanted = prompt("Key name", "newKey");
        if (!wanted) return;
        value[wanted] = "";
      }
      renderTree(); refreshDerived();
    });
    row.append(toggle, key, badge, add);
    if (path.length) {
      const del = document.createElement("button");
      del.className = "row-action rounded p-1 hover:bg-red-500/15 hover:text-red-300";
      del.title = "Remove";
      del.innerHTML = icon("trash-2");
      del.addEventListener("click", () => { if (confirm(`Remove ${name}?`)) { deleteAt(path); renderTree(); refreshDerived(); } });
      row.append(del);
    }
    host.append(row, children);
    const entries = Array.isArray(value) ? value.map((item, index) => [index, item]) : Object.entries(value);
    for (const [childKey, childValue] of entries) renderNode(childValue, [...path, childKey], depth + 1, children);
    if (path.length === 0 || name === "canonicalExample") {
      children.classList.add("open");
      toggle.classList.add("open");
      toggle.innerHTML = icon("chevron-down");
    }
    return;
  }

  const key = document.createElement("input");
  key.className = "tree-key mono w-40 shrink-0";
  key.value = name;
  key.addEventListener("focus", () => showPath(path));
  if (path.length) {
    key.addEventListener("change", () => {
      const wanted = key.value.trim();
      if (!wanted || wanted === name) { key.value = name; return; }
      const parent = path.slice(0, -1).reduce((node, k) => node[k], state);
      const rebuilt = {};
      for (const [k, v] of Object.entries(parent)) rebuilt[k === name ? wanted : k] = v;
      for (const k of Object.keys(parent)) delete parent[k];
      Object.assign(parent, rebuilt);
      renderTree(); refreshDerived(); showPath([...path.slice(0, -1), wanted]);
    });
  } else key.readOnly = true;

  // WHY: the skill text is edited in its own full-page tab, not here.
  if (path.length === 1 && path[0] === "skillInstructions") {
    const link = document.createElement("button");
    link.className = "tree-link mono min-w-0 flex-1";
    link.textContent = "Open skill editor ↗";
    link.title = String(value).slice(0, 160);
    link.addEventListener("click", () => {
      activateTab("skill");
      skillSource.focus();
    });
    row.append(key, link);
    host.append(row);
    return;
  }

  let input;
  if (typeof value === "boolean") {
    input = document.createElement("input");
    input.type = "checkbox";
    input.checked = value;
    input.className = "ml-auto h-4 w-4 accent-emerald-400";
    input.addEventListener("focus", () => showPath(path));
    input.addEventListener("change", () => { setAt(path, input.checked); refreshDerived(); });
  } else {
    input = document.createElement("input");
    input.className = "tree-value mono min-w-0 flex-1";
    input.value = typeof value === "string" ? value : JSON.stringify(value);
    input.title = input.value;
    input.addEventListener("focus", () => showPath(path));
    input.addEventListener("change", () => {
      let next = input.value;
      if (typeof value === "number") next = Number(next);
      setAt(path, next);
      input.value = typeof next === "string" ? next : JSON.stringify(next);
      refreshDerived();
    });
  }
  row.append(key, input);
  host.append(row);
}

function renderTree() {
  tree.innerHTML = "";
  renderNode(state, [], 0, tree);
  if (window.lucide) window.lucide.createIcons();
}

skillSource.value = state.skillInstructions;
skillSource.addEventListener("input", () => {
  state.skillInstructions = skillSource.value;
  refreshDerived();
});

function activateTab(name) {
  document.querySelectorAll(".tab").forEach((node) => node.classList.toggle("active", node.dataset.tab === name));
  document.querySelectorAll(".tab-panel").forEach((node) => node.classList.toggle("hidden", node.dataset.panel !== name));
}
document.querySelectorAll(".tab").forEach((tab) => {
  tab.addEventListener("click", () => activateTab(tab.dataset.tab));
});

function flash(message) {
  toast.textContent = message;
  toast.classList.remove("hidden");
  if (toastTimer) clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.add("hidden"), 2600);
}
document.getElementById("save").addEventListener("click", () => flash("Saved (simulation only)."));
document.getElementById("cancel").addEventListener("click", () => flash("Discarded (simulation only)."));
document.getElementById("copy-json").addEventListener("click", async () => {
  try { await navigator.clipboard.writeText(lastJson); flash("Copied JSON."); }
  catch { flash("Select the JSON text to copy it."); }
});
document.addEventListener("keydown", (event) => {
  if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "s") {
    event.preventDefault();
    flash("Saved (simulation only).");
  }
});

// WHY: a deep link makes either half of the prototype reviewable on its own.
activateTab(new URLSearchParams(location.search).get("tab") === "json" ? "json" : "skill");
renderTree();
refreshDerived();
if (window.lucide) window.lucide.createIcons();
