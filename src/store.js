import { deepClone, uid, MAX_HISTORY } from './model.js';

const DRAFT_KEY = 'pavouci_draft_v1';
const EDITOR_NAME_KEY = 'pavouci_editor_name';

function readSeedData() {
  const el = document.getElementById('seed-data');
  if (!el || !el.textContent.trim()) return null;
  try {
    return JSON.parse(el.textContent);
  } catch (e) {
    console.error('Nepodařilo se načíst vestavěná data appky', e);
    return null;
  }
}

export class Store {
  constructor(initialData) {
    this.data = initialData;
    this.listeners = new Set();
    this.selection = { view: 'dashboard', institutionUid: null, groupUid: null };
  }

  static bootstrap(emptyDataFactory) {
    const seed = readSeedData();
    const draftRaw = safeLocalStorageGet(DRAFT_KEY);
    let draft = null;
    if (draftRaw) {
      try {
        draft = JSON.parse(draftRaw);
      } catch (e) {
        draft = null;
      }
    }
    let data = seed || emptyDataFactory();
    let usedDraft = false;
    if (draft && draft.savedAt) {
      const seedTs = seed && seed.history && seed.history.length
        ? seed.history[seed.history.length - 1].ts
        : null;
      if (!seedTs || draft.savedAt > seedTs) {
        usedDraft = true;
      }
    }
    const store = new Store(data);
    store._pendingDraft = usedDraft ? draft : null;
    return store;
  }

  applyPendingDraftDecision(useDraft) {
    if (useDraft && this._pendingDraft) {
      this.data = this._pendingDraft.data;
    }
    this._pendingDraft = null;
    this.emit();
  }

  hasPendingDraft() {
    return !!this._pendingDraft;
  }

  pendingDraftInfo() {
    return this._pendingDraft ? { savedAt: this._pendingDraft.savedAt } : null;
  }

  subscribe(fn) {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  emit() {
    this.autosaveDraft();
    for (const fn of this.listeners) fn(this.data);
  }

  autosaveDraft() {
    safeLocalStorageSet(
      DRAFT_KEY,
      JSON.stringify({ savedAt: new Date().toISOString(), data: this.data })
    );
  }

  getEditorName() {
    return safeLocalStorageGet(EDITOR_NAME_KEY) || '';
  }

  setEditorName(name) {
    safeLocalStorageSet(EDITOR_NAME_KEY, name || '');
  }

  // Provede mutaci nad daty a zaznamená ji do historie verzí appky.
  commit(summary, mutateFn) {
    mutateFn(this.data);
    const snapshot = deepClone({ ...this.data, history: undefined });
    delete snapshot.history;
    this.data.history.push({
      uid: uid('ver'),
      ts: new Date().toISOString(),
      editor: this.getEditorName() || null,
      summary,
      snapshot,
    });
    if (this.data.history.length > MAX_HISTORY) {
      this.data.history.splice(0, this.data.history.length - MAX_HISTORY);
    }
    this.emit();
  }

  rollbackTo(versionUid) {
    const entry = this.data.history.find((h) => h.uid === versionUid);
    if (!entry) return;
    const restored = deepClone(entry.snapshot);
    const history = this.data.history;
    this.data = { ...restored, history };
    this.commit(`Obnovena verze z ${formatTs(entry.ts)}`, () => {});
  }

  exportHtmlString() {
    const styleText = document.getElementById('app-style').textContent;
    const libsText = document.getElementById('app-libs').textContent;
    const appText = document.getElementById('app-code').textContent;
    const dataText = JSON.stringify(this.data);
    const esc = (s) => s.replace(/<\/script/gi, '<\\/script');
    return `<!doctype html>
<html lang="cs">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Organizační pavouci – Správa železnic</title>
<style id="app-style">${styleText}</style>
</head>
<body>
<div id="app-root"></div>
<script type="application/json" id="seed-data">${esc(dataText)}</script>
<script id="app-libs">${esc(libsText)}</script>
<script id="app-code">${esc(appText)}</script>
</body>
</html>
`;
  }

  downloadExport(filename) {
    const html = this.exportHtmlString();
    const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename || `pavouci-${dateStamp()}.html`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 4000);
  }
}

function dateStamp() {
  const d = new Date();
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}`;
}

export function formatTs(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  const p = (n) => String(n).padStart(2, '0');
  return `${p(d.getDate())}.${p(d.getMonth() + 1)}.${d.getFullYear()} ${p(d.getHours())}:${p(d.getMinutes())}`;
}

function safeLocalStorageGet(key) {
  try {
    return window.localStorage.getItem(key);
  } catch (e) {
    return null;
  }
}

function safeLocalStorageSet(key, value) {
  try {
    window.localStorage.setItem(key, value);
  } catch (e) {
    /* soukromý režim / plné úložiště – appka funguje dál bez autosave draftu */
  }
}
