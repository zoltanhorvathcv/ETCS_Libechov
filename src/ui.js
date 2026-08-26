import {
  ROLES,
  LINK_TYPES,
  ARROW_MODES,
  makeInstitution,
  makeGroup,
  makeFrame,
  makeTopic,
  makeLink,
  MAX_HISTORY,
  groupDisplayId,
  groupFullLabel,
  linkDisplayId,
  findGroup,
  allGroups,
  topicPath,
  topicChildren,
  removeGroupCascade,
  removeInstitutionCascade,
  removeTopicCascade,
  deepClone,
} from './model.js';
import { formatTs } from './store.js';
import { SpiderCanvas } from './canvas.js';
import * as R from './reports.js';
import {
  exportSvgFile,
  exportPngFile,
  exportPptxFile,
  exportAllInstitutionsPptx,
  exportReportXlsx,
  exportAllReportsXlsx,
  printReport,
} from './exports.js';

let store;
let spiderCanvas = null;
let lastView = null;
let lastInstitutionUid = null;

export function mountApp(theStore) {
  store = theStore;
  buildShell();
  store.subscribe(onStoreChange);
  onStoreChange(store.data);
  maybeAskAboutDraft();
}

function maybeAskAboutDraft() {
  if (!store.hasPendingDraft()) return;
  const info = store.pendingDraftInfo();
  const ok = window.confirm(
    `Byl nalezen neuložený koncept z tohoto prohlížeče (${formatTs(info.savedAt)}).\n` +
      'Načíst tento koncept místo dat uložených v souboru appky?\n\n' +
      'OK = načíst koncept   /   Storno = ponechat data ze souboru'
  );
  store.applyPendingDraftDecision(ok);
}

// ---------------------------------------------------------------- shell --

function buildShell() {
  document.getElementById('app-root').innerHTML = `
    <div class="app-shell">
      <header class="topbar">
        <div class="brand">Organizační pavouci<span class="brand-sub">Správa železnic</span></div>
        <div class="topbar-search">
          <input id="global-search" type="search" autocomplete="off" placeholder="Hledat skupinu, osobu, útvar, téma, ID vazby…">
          <div id="search-results" class="search-results hidden"></div>
        </div>
        <div class="topbar-actions">
          <input id="editor-name" type="text" placeholder="Vaše jméno (nepovinné)" title="Jméno editora se zaznamená u příští uložené verze">
          <button id="btn-save" class="btn btn-primary">Uložit / exportovat appku</button>
        </div>
      </header>
      <div class="app-body">
        <nav class="sidebar" id="sidebar"></nav>
        <main class="content" id="view-root"></main>
      </div>
    </div>
    <div id="print-area" class="print-only"></div>
  `;

  document.getElementById('editor-name').value = store.getEditorName();
  document.getElementById('editor-name').addEventListener('change', (e) => {
    store.setEditorName(e.target.value.trim());
  });
  document.getElementById('btn-save').addEventListener('click', () => {
    store.downloadExport();
  });

  const searchInput = document.getElementById('global-search');
  const resultsBox = document.getElementById('search-results');
  searchInput.addEventListener('input', () => {
    const q = searchInput.value;
    if (!q.trim()) {
      resultsBox.classList.add('hidden');
      resultsBox.innerHTML = '';
      return;
    }
    const results = R.searchAll(store.data, q).slice(0, 30);
    resultsBox.innerHTML = results.length
      ? results
          .map(
            (r, i) =>
              `<div class="search-result" data-idx="${i}"><span class="tag">${escapeHtml(r.kind)}</span>${escapeHtml(r.label)}</div>`
          )
          .join('')
      : '<div class="search-empty">Žádné výsledky</div>';
    resultsBox.classList.remove('hidden');
    resultsBox.querySelectorAll('.search-result').forEach((elm) => {
      elm.addEventListener('click', () => {
        const r = results[Number(elm.dataset.idx)];
        resultsBox.classList.add('hidden');
        searchInput.value = '';
        goToSearchResult(r);
      });
    });
  });
  document.addEventListener('click', (e) => {
    if (!e.target.closest('.topbar-search')) resultsBox.classList.add('hidden');
  });
}

function goToSearchResult(r) {
  if (r.institutionUid) {
    navigate({ view: 'editor', institutionUid: r.institutionUid, elementType: r.groupUid ? 'group' : null, elementUid: r.groupUid || null });
  } else if (r.topicUid) {
    navigate({ view: 'topics' });
  }
}

function renderSidebar() {
  const sel = store.selection;
  const sidebar = document.getElementById('sidebar');
  const instButtons = store.data.institutions
    .map(
      (inst) => `<button class="nav-btn inst-btn ${sel.view === 'editor' && sel.institutionUid === inst.uid ? 'active' : ''}" data-nav="editor" data-inst="${inst.uid}">${escapeHtml(inst.code)} <span class="nav-sub">${escapeHtml(inst.name)}</span></button>`
    )
    .join('');
  sidebar.innerHTML = `
    <button class="nav-btn ${sel.view === 'dashboard' ? 'active' : ''}" data-nav="dashboard">Přehled institucí</button>
    <div class="sidebar-section">Pavouci institucí</div>
    ${instButtons}
    <button class="nav-btn nav-btn-ghost" data-action="new-institution">+ Nová instituce</button>
    <div class="sidebar-section">Data appky</div>
    <button class="nav-btn ${sel.view === 'topics' ? 'active' : ''}" data-nav="topics">Registr témat</button>
    <button class="nav-btn ${sel.view === 'reports' ? 'active' : ''}" data-nav="reports">Přehledy</button>
    <button class="nav-btn ${sel.view === 'history' ? 'active' : ''}" data-nav="history">Historie verzí</button>
  `;
  sidebar.querySelectorAll('[data-nav]').forEach((btn) => {
    btn.addEventListener('click', () => {
      navigate({ view: btn.dataset.nav, institutionUid: btn.dataset.inst || null, elementType: null, elementUid: null });
    });
  });
  sidebar.querySelector('[data-action="new-institution"]').addEventListener('click', createInstitutionFlow);
}

function navigate(partial) {
  Object.assign(store.selection, { elementType: null, elementUid: null, editingLinkUid: null }, partial);
  fullRender();
}

// ------------------------------------------------------------ dispatch --

function onStoreChange() {
  const sel = store.selection;
  renderSidebar();
  if (sel.view === 'editor' && lastView === 'editor' && lastInstitutionUid === sel.institutionUid && spiderCanvas) {
    spiderCanvas.setData(store.data, sel.institutionUid, canvasSelection());
    renderEditorSidePanel();
    renderEditorToolbar();
    return;
  }
  fullRender();
}

function fullRender() {
  const sel = store.selection;
  renderSidebar();
  const root = document.getElementById('view-root');
  lastView = sel.view;
  lastInstitutionUid = sel.institutionUid;
  if (sel.view === 'editor') {
    renderEditorView(root);
  } else if (sel.view === 'topics') {
    renderTopicsView(root);
  } else if (sel.view === 'reports') {
    renderReportsView(root);
  } else if (sel.view === 'history') {
    renderHistoryView(root);
  } else {
    renderDashboardView(root);
  }
}

function canvasSelection() {
  const sel = store.selection;
  return sel.elementType ? { type: sel.elementType, uid: sel.elementUid } : null;
}

// --------------------------------------------------------------- utils --

function escapeHtml(str) {
  return String(str ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

function table(report) {
  if (!report.rows.length) {
    return `<p class="empty-note">Žádná data.</p>`;
  }
  return `<div class="table-wrap"><table class="data-table"><thead><tr>${report.columns
    .map((c) => `<th>${escapeHtml(c.label)}</th>`)
    .join('')}</tr></thead><tbody>${report.rows
    .map((row) => `<tr>${report.columns.map((c) => `<td>${escapeHtml(row[c.key])}</td>`).join('')}</tr>`)
    .join('')}</tbody></table></div>`;
}

// ----------------------------------------------------------- dashboard --

function renderDashboardView(root) {
  const rep = R.reportInstitutionOverview(store.data);
  const cards = store.data.institutions
    .map((inst) => {
      const links = store.data.links.filter(
        (l) => inst.groups.some((g) => g.uid === l.aUid) || inst.groups.some((g) => g.uid === l.bUid)
      );
      const missing = inst.groups.filter((g) => g.reps.length === 0).length;
      return `<div class="card inst-card" data-inst="${inst.uid}">
        <div class="card-title">${escapeHtml(inst.code)}</div>
        <div class="card-sub">${escapeHtml(inst.name)}</div>
        <div class="card-stats">
          <div><b>${inst.groups.length}</b> skupin</div>
          <div><b>${links.length}</b> vazeb</div>
          <div><b>${missing}</b> bez zástupce</div>
        </div>
      </div>`;
    })
    .join('');
  root.innerHTML = `
    <h1>Přehled institucí</h1>
    <p class="view-intro">Úvodní dashboard appky – souhrn všech mezinárodních institucí a pracovních skupin (CER, PRIME, SERAF, RFC, EUG, EULYNX, UIC, RISC, RNE a další).</p>
    <div class="reports-toolbar"><button class="btn btn-primary" id="btn-export-all-pptx">Export všech pavouků do jedné prezentace (PPTX)</button></div>
    <div class="card-grid">${cards || '<p class="empty-note">Zatím nejsou založené žádné instituce. Vytvořte první v levém panelu.</p>'}</div>
    <h2>Souhrnná tabulka</h2>
    ${table(rep)}
  `;
  root.querySelectorAll('.inst-card').forEach((c) => {
    c.addEventListener('click', () => navigate({ view: 'editor', institutionUid: c.dataset.inst }));
  });
  root.querySelector('#btn-export-all-pptx').addEventListener('click', () => {
    exportAllInstitutionsPptx(store.data, `pavouci-vsechny-${Date.now()}.pptx`);
  });
}

function createInstitutionFlow() {
  const code = window.prompt('Zkratka instituce (např. CER, PRIME, SERAF):');
  if (!code) return;
  const name = window.prompt('Celý název instituce:', code);
  if (name === null) return;
  let newUid;
  store.commit(`Vytvořena instituce ${code.toUpperCase()}`, (data) => {
    const inst = makeInstitution(code, name);
    newUid = inst.uid;
    data.institutions.push(inst);
  });
  navigate({ view: 'editor', institutionUid: newUid });
}

// -------------------------------------------------------------- editor --

function renderEditorView(root) {
  const inst = store.data.institutions.find((i) => i.uid === store.selection.institutionUid);
  if (!inst) {
    renderDashboardView(root);
    return;
  }
  root.innerHTML = `
    <div class="editor-layout">
      <div class="editor-toolbar" id="editor-toolbar"></div>
      <div class="editor-main">
        <div class="canvas-host" id="canvas-host"></div>
        <aside class="side-panel" id="side-panel"></aside>
      </div>
    </div>
  `;
  spiderCanvas = new SpiderCanvas(document.getElementById('canvas-host'), {
    onSelect: (sel) => {
      store.selection.elementType = sel ? sel.type : null;
      store.selection.elementUid = sel ? sel.uid : null;
      store.selection.editingLinkUid = null;
      renderEditorSidePanel();
    },
    onChangeGeometry: (kind, uid) => {
      const label = kind === 'group' ? 'skupiny' : 'rámečku';
      store.commit(`Upravena pozice/velikost ${label} (${uid})`, () => {});
    },
    onChangeLinkOffset: (linkUid) => {
      store.commit(`Upravena trasa vazby (${linkUid})`, () => {});
      renderEditorSidePanel();
    },
    onJumpToGroup: (groupUid) => {
      const found = allGroups(store.data).find((x) => x.group.uid === groupUid);
      if (found) navigate({ view: 'editor', institutionUid: found.institution.uid, elementType: 'group', elementUid: groupUid });
    },
    onJumpToInstitution: (institutionUid) => {
      navigate({ view: 'editor', institutionUid });
    },
    onAddGroupAt: (x, y) => {
      addGroup(inst, x, y);
    },
  });
  spiderCanvas.centerViewport();
  spiderCanvas.setData(store.data, inst.uid, canvasSelection());
  renderEditorToolbar();
  renderEditorSidePanel();
}

function renderEditorToolbar() {
  const bar = document.getElementById('editor-toolbar');
  if (!bar) return;
  const inst = store.data.institutions.find((i) => i.uid === store.selection.institutionUid);
  if (!inst) return;
  bar.innerHTML = `
    <h2 class="canvas-title">${escapeHtml(inst.name)} <span class="canvas-title-code">(${escapeHtml(inst.code)})</span></h2>
    <div class="editor-toolbar-row">
    <select id="inst-switcher">${store.data.institutions
      .map((i) => `<option value="${i.uid}" ${i.uid === inst.uid ? 'selected' : ''}>${escapeHtml(i.code)} – ${escapeHtml(i.name)}</option>`)
      .join('')}</select>
    <button class="btn" data-action="add-group">+ Skupina</button>
    <button class="btn" data-action="add-frame">+ Rámeček oblasti</button>
    <button class="btn" data-action="rename-inst">Přejmenovat</button>
    <button class="btn" data-action="duplicate-inst">Duplikovat</button>
    <button class="btn btn-danger" data-action="delete-inst">Smazat instituci</button>
    <span class="spacer"></span>
    <button class="btn" data-action="export-svg">Export SVG</button>
    <button class="btn" data-action="export-png">Export PNG</button>
    <button class="btn" data-action="export-pptx">Export PPTX</button>
    </div>
  `;
  bar.querySelector('#inst-switcher').addEventListener('change', (e) => {
    navigate({ view: 'editor', institutionUid: e.target.value });
  });
  bar.querySelector('[data-action="add-group"]').addEventListener('click', () => addGroup(inst));
  bar.querySelector('[data-action="add-frame"]').addEventListener('click', () => addFrame(inst));
  bar.querySelector('[data-action="rename-inst"]').addEventListener('click', () => renameInstitution(inst));
  bar.querySelector('[data-action="duplicate-inst"]').addEventListener('click', () => duplicateInstitution(inst));
  bar.querySelector('[data-action="delete-inst"]').addEventListener('click', () => deleteInstitution(inst));
  bar.querySelector('[data-action="export-svg"]').addEventListener('click', () => {
    exportSvgFile(spiderCanvas.exportSvgElement(), `${inst.code}-pavouk.svg`);
  });
  bar.querySelector('[data-action="export-png"]').addEventListener('click', () => {
    exportPngFile(spiderCanvas.exportSvgElement(), `${inst.code}-pavouk.png`);
  });
  bar.querySelector('[data-action="export-pptx"]').addEventListener('click', () => {
    exportPptxFile(spiderCanvas.exportSvgElement(), `${inst.code}-pavouk.pptx`, `${inst.name} (${inst.code})`);
  });
}

function addGroup(inst, x, y) {
  const n = inst.groups.length;
  const px = x ?? 40 + (n % 4) * 230;
  const py = y ?? 40 + Math.floor(n / 4) * 140;
  let newUid;
  store.commit(`Přidána skupina do ${inst.code}`, (data) => {
    const i = data.institutions.find((ii) => ii.uid === inst.uid);
    const g = makeGroup(i, { x: px, y: py });
    newUid = g.uid;
    i.groups.push(g);
  });
  store.selection.elementType = 'group';
  store.selection.elementUid = newUid;
  renderEditorSidePanel();
  spiderCanvas.render();
}

function addFrame(inst) {
  let newUid;
  store.commit(`Přidán rámeček oblasti do ${inst.code}`, (data) => {
    const i = data.institutions.find((ii) => ii.uid === inst.uid);
    const f = makeFrame({ x: 20, y: 20 });
    newUid = f.uid;
    i.frames.push(f);
  });
  store.selection.elementType = 'frame';
  store.selection.elementUid = newUid;
  renderEditorSidePanel();
  spiderCanvas.render();
}

function renameInstitution(inst) {
  const code = window.prompt('Zkratka instituce:', inst.code);
  if (!code) return;
  const name = window.prompt('Celý název instituce:', inst.name);
  if (name === null) return;
  store.commit(`Přejmenována instituce ${inst.code} → ${code.toUpperCase()}`, (data) => {
    const i = data.institutions.find((ii) => ii.uid === inst.uid);
    i.code = code.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 12) || i.code;
    i.name = name;
  });
}

function duplicateInstitution(inst) {
  const code = window.prompt('Zkratka nové instituce (kopie):', `${inst.code}-KOPIE`);
  if (!code) return;
  let newUid;
  store.commit(`Duplikována instituce ${inst.code} → ${code.toUpperCase()}`, (data) => {
    const clone = deepClone(inst);
    clone.uid = `inst_${Math.random().toString(36).slice(2, 10)}`;
    clone.code = code.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 12) || 'KOPIE';
    clone.name = `${inst.name} (kopie)`;
    const uidMap = new Map();
    for (const g of clone.groups) {
      const oldUid = g.uid;
      g.uid = `grp_${Math.random().toString(36).slice(2, 10)}`;
      uidMap.set(oldUid, g.uid);
    }
    for (const f of clone.frames) {
      const oldUid = f.uid;
      f.uid = `frm_${Math.random().toString(36).slice(2, 10)}`;
      for (const g of clone.groups) if (g.frameUid === oldUid) g.frameUid = f.uid;
    }
    newUid = clone.uid;
    data.institutions.push(clone);
    // interní vazby (oba konce uvnitř duplikované instituce) zkopírujeme také
    const originalLinks = data.links.filter((l) => uidMap.has(l.aUid) && uidMap.has(l.bUid));
    for (const l of originalLinks) {
      data.links.push(makeLink(l.type, uidMap.get(l.aUid), uidMap.get(l.bUid), { arrow: l.arrow, note: l.note }));
    }
  });
  navigate({ view: 'editor', institutionUid: newUid });
}

function deleteInstitution(inst) {
  if (!window.confirm(`Opravdu smazat instituci ${inst.code} včetně všech jejích skupin a vazeb?`)) return;
  store.commit(`Smazána instituce ${inst.code}`, (data) => removeInstitutionCascade(data, inst.uid));
  navigate({ view: 'dashboard' });
}

// -------------------------------------------------------- side panel ----

function renderEditorSidePanel() {
  const panel = document.getElementById('side-panel');
  if (!panel) return;
  const sel = store.selection;
  const inst = store.data.institutions.find((i) => i.uid === sel.institutionUid);
  if (!inst) return;
  if (sel.elementType === 'group') {
    const group = inst.groups.find((g) => g.uid === sel.elementUid);
    if (group) return renderGroupPanel(panel, inst, group);
  }
  if (sel.elementType === 'frame') {
    const frame = inst.frames.find((f) => f.uid === sel.elementUid);
    if (frame) return renderFramePanel(panel, inst, frame);
  }
  renderInstitutionPanel(panel, inst);
}

function renderInstitutionPanel(panel, inst) {
  const linkReport = R.reportLinkList(store.data, inst.uid);
  const editingUid = store.selection.editingLinkUid;
  const editingLink = editingUid ? store.data.links.find((l) => l.uid === editingUid) : null;
  const allGroupOptions = allGroups(store.data)
    .map(({ institution, group }) => `<option value="${group.uid}">${escapeHtml(groupFullLabel(store.data, group.uid))}</option>`)
    .join('');
  const localGroupOptions = inst.groups
    .map((g) => `<option value="${g.uid}">${escapeHtml(groupDisplayId(inst, g))} – ${escapeHtml(g.name)}</option>`)
    .join('');
  // v editačním režimu nabízíme jako "A" všechny skupiny appky (vazba mohla
  // vzniknout i jako mimo-institucionální a chceme ji jít umožnit přepojit)
  const aOptionsSource = editingLink ? allGroups(store.data).map(({ group }) => group) : inst.groups;
  const aOptions = aOptionsSource
    .map((g) => `<option value="${g.uid}" ${editingLink && editingLink.aUid === g.uid ? 'selected' : ''}>${escapeHtml(groupFullLabel(store.data, g.uid))}</option>`)
    .join('');
  panel.innerHTML = `
    <h3>${escapeHtml(inst.code)} – vazby pavouka</h3>
    <p class="hint">Klikněte na skupinu na plátně pro úpravu detailu, nebo dvojklikem na volnou plochu přidejte novou skupinu.</p>
    ${linkReport.rows.length ? `<table class="mini-table">
      <thead><tr><th>ID</th><th>Typ</th><th>A</th><th>B</th><th></th></tr></thead>
      <tbody>${linkReport.rows
        .map(
          (r) => `<tr><td>${escapeHtml(r.id)}</td><td>${escapeHtml(r.typ)}</td><td>${escapeHtml(r.a)}</td><td>${escapeHtml(r.b)}</td><td>
            <button class="btn-icon" data-edit-link="${r.uid}" title="Upravit / přepojit vazbu">✎</button>
            <button class="btn-icon" data-del-link="${r.uid}" title="Smazat vazbu">✕</button>
          </td></tr>`
        )
        .join('')}</tbody>
    </table>` : '<p class="empty-note">Zatím žádné vazby.</p>'}

    <h4>${editingLink ? 'Upravit / přepojit vazbu' : 'Přidat vazbu'}</h4>
    <form id="add-link-form" class="stacked-form">
      <label>Typ vazby
        <select name="type">${Object.values(LINK_TYPES).map((t) => `<option value="${t.key}" ${editingLink && editingLink.type === t.key ? 'selected' : ''}>${t.label}</option>`).join('')}</select>
      </label>
      <label>Skupina A${editingLink ? '' : ' (v tomto pavoukovi)'}
        <select name="aUid">${editingLink ? aOptions : localGroupOptions}</select>
      </label>
      <label>Skupina B (kdekoli v appce)
        <select name="bUid">${(editingLink ? allGroups(store.data).map(({ group }) => `<option value="${group.uid}" ${editingLink.bUid === group.uid ? 'selected' : ''}>${escapeHtml(groupFullLabel(store.data, group.uid))}</option>`).join('') : allGroupOptions)}</select>
      </label>
      <label>Šipka
        <select name="arrow">${Object.entries(ARROW_MODES).map(([k, v]) => `<option value="${k}" ${editingLink && editingLink.arrow === k ? 'selected' : ''}>${v}</option>`).join('')}</select>
      </label>
      <label>Styl čáry
        <select name="lineStyle">
          <option value="straight" ${!editingLink || editingLink.lineStyle !== 'elbow' ? 'selected' : ''}>Rovná</option>
          <option value="elbow" ${editingLink && editingLink.lineStyle === 'elbow' ? 'selected' : ''}>Lomená (pravoúhlá)</option>
        </select>
      </label>
      <label>Poznámka
        <input name="note" type="text" placeholder="volitelné" value="${escapeHtml(editingLink ? editingLink.note : '')}">
      </label>
      ${editingLink && editingLink.bEndOffset ? `<p class="hint">Konec vazby na skupině B je ručně posunutý. <button class="btn" type="button" id="btn-reset-link-offset">Vrátit na automatickou trasu</button></p>` : ''}
      <div style="display:flex; gap:8px;">
        <button class="btn btn-primary" type="submit">${editingLink ? 'Uložit změny' : 'Přidat vazbu'}</button>
        ${editingLink ? '<button class="btn" type="button" id="btn-cancel-edit-link">Zrušit</button>' : ''}
      </div>
    </form>
  `;
  panel.querySelectorAll('[data-del-link]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const linkUid = btn.dataset.delLink;
      store.commit('Smazána vazba', (data) => {
        data.links = data.links.filter((l) => l.uid !== linkUid);
      });
    });
  });
  panel.querySelectorAll('[data-edit-link]').forEach((btn) => {
    btn.addEventListener('click', () => {
      store.selection.editingLinkUid = btn.dataset.editLink;
      renderEditorSidePanel();
    });
  });
  const cancelBtn = panel.querySelector('#btn-cancel-edit-link');
  if (cancelBtn) {
    cancelBtn.addEventListener('click', () => {
      store.selection.editingLinkUid = null;
      renderEditorSidePanel();
    });
  }
  const resetOffsetBtn = panel.querySelector('#btn-reset-link-offset');
  if (resetOffsetBtn) {
    resetOffsetBtn.addEventListener('click', () => {
      store.commit('Vrácena automatická trasa vazby', (data) => {
        const l = data.links.find((ll) => ll.uid === editingLink.uid);
        if (l) l.bEndOffset = 0;
      });
    });
  }
  panel.querySelector('#add-link-form').addEventListener('submit', (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    const type = fd.get('type');
    const aUid = fd.get('aUid');
    const bUid = fd.get('bUid');
    if (!aUid || !bUid || aUid === bUid) return;
    if (editingLink) {
      store.commit(`Upravena vazba v ${inst.code}`, (data) => {
        const l = data.links.find((ll) => ll.uid === editingLink.uid);
        if (!l) return;
        l.type = type;
        l.aUid = aUid;
        l.bUid = bUid;
        l.arrow = fd.get('arrow');
        l.lineStyle = fd.get('lineStyle') === 'elbow' ? 'elbow' : 'straight';
        l.note = fd.get('note');
      });
      store.selection.editingLinkUid = null;
    } else {
      store.commit(`Přidána vazba ${type} v ${inst.code}`, (data) => {
        data.links.push(makeLink(type, aUid, bUid, { arrow: fd.get('arrow'), lineStyle: fd.get('lineStyle'), note: fd.get('note') }));
      });
    }
  });
}

function renderFramePanel(panel, inst, frame) {
  const isRef = !!frame.institutionRefUid;
  const otherInstitutions = store.data.institutions.filter((i) => i.uid !== inst.uid);
  panel.innerHTML = `
    <h3>Rámeček oblasti</h3>
    <form id="frame-form" class="stacked-form">
      <label class="checkbox-row"><input type="checkbox" name="isRef" ${isRef ? 'checked' : ''}> Odkaz na jinou instituci appky (místo obyčejného rámečku)</label>
      <div id="frame-name-field" style="${isRef ? 'display:none' : ''}">
        <label>Název oblasti
          <input name="name" type="text" value="${escapeHtml(frame.name)}">
        </label>
      </div>
      <div id="frame-ref-field" style="${isRef ? '' : 'display:none'}">
        <label>Instituce
          <select name="institutionRefUid">
            ${otherInstitutions.length ? otherInstitutions.map((i) => `<option value="${i.uid}" ${frame.institutionRefUid === i.uid ? 'selected' : ''}>${escapeHtml(i.code)} – ${escapeHtml(i.name)}</option>`).join('') : '<option value="">— žádná další instituce v appce —</option>'}
          </select>
        </label>
        <p class="hint">Rámeček je čistě navigační – kliknutím na plátně přeskočíte na pavouka vybrané instituce. Nejde o vazbu.</p>
      </div>
    </form>
    <button class="btn btn-danger" id="btn-del-frame">Smazat rámeček</button>
  `;
  const form = panel.querySelector('#frame-form');
  const isRefCheckbox = form.querySelector('[name="isRef"]');
  form.querySelector('input[name="name"]').addEventListener('change', (e) => {
    store.commit(`Přejmenován rámeček v ${inst.code}`, (data) => {
      const i = data.institutions.find((ii) => ii.uid === inst.uid);
      const f = i.frames.find((ff) => ff.uid === frame.uid);
      if (f) f.name = e.target.value;
    });
  });
  form.querySelector('select[name="institutionRefUid"]').addEventListener('change', (e) => {
    store.commit(`Nastaven odkaz rámečku na instituci v ${inst.code}`, (data) => {
      const i = data.institutions.find((ii) => ii.uid === inst.uid);
      const f = i.frames.find((ff) => ff.uid === frame.uid);
      if (f) f.institutionRefUid = e.target.value || null;
    });
  });
  isRefCheckbox.addEventListener('change', () => {
    store.commit(`Upraven typ rámečku v ${inst.code}`, (data) => {
      const i = data.institutions.find((ii) => ii.uid === inst.uid);
      const f = i.frames.find((ff) => ff.uid === frame.uid);
      if (!f) return;
      if (isRefCheckbox.checked) {
        f.institutionRefUid = otherInstitutions[0] ? otherInstitutions[0].uid : null;
      } else {
        f.institutionRefUid = null;
      }
    });
  });
  panel.querySelector('#btn-del-frame').addEventListener('click', () => {
    if (!window.confirm('Smazat tento rámeček oblasti? (skupiny uvnitř zůstanou zachovány)')) return;
    store.commit(`Smazán rámeček v ${inst.code}`, (data) => {
      const i = data.institutions.find((ii) => ii.uid === inst.uid);
      i.frames = i.frames.filter((f) => f.uid !== frame.uid);
      for (const g of i.groups) if (g.frameUid === frame.uid) g.frameUid = null;
    });
    store.selection.elementType = null;
    store.selection.elementUid = null;
    renderEditorSidePanel();
  });
}

function renderGroupPanel(panel, inst, group) {
  const displayId = groupDisplayId(inst, group);
  const frameOptions = `<option value="">— bez rámečku —</option>${inst.frames
    .map((f) => `<option value="${f.uid}" ${group.frameUid === f.uid ? 'selected' : ''}>${escapeHtml(f.name)}</option>`)
    .join('')}`;
  const topicCheckboxes = store.data.topics
    .map(
      (t) =>
        `<label class="checkbox-row"><input type="checkbox" data-topic="${t.uid}" ${group.topicUids.includes(t.uid) ? 'checked' : ''}> ${escapeHtml(topicPath(store.data, t.uid))}</label>`
    )
    .join('') || '<p class="empty-note">Registr témat je prázdný.</p>';
  const repsRows = group.reps
    .map(
      (rep, idx) => `<div class="rep-row" data-idx="${idx}">
        <input type="text" data-field="name" value="${escapeHtml(rep.name)}" placeholder="Jméno">
        <input type="text" data-field="unit" value="${escapeHtml(rep.unit)}" placeholder="Útvar / OJ">
        <select data-field="role">${ROLES.map((r) => `<option value="${r}" ${rep.role === r ? 'selected' : ''}>${r}</option>`).join('')}</select>
        <button class="btn-icon" data-del-rep title="Smazat zástupce">✕</button>
      </div>`
    )
    .join('');

  const touchingLinks = store.data.links.filter((l) => l.aUid === group.uid || l.bUid === group.uid);
  const linksRows = touchingLinks
    .map((l) => {
      const otherUid = l.aUid === group.uid ? l.bUid : l.aUid;
      const otherFound = findGroup(store.data, otherUid);
      const sameInst = otherFound && otherFound.institution.uid === inst.uid;
      return `<div class="link-nav-row" data-link-jump="${otherUid}" data-same-inst="${sameInst ? '1' : ''}">
        <span class="tag">${escapeHtml(LINK_TYPES[l.type].label)}</span>
        <span>${escapeHtml(linkDisplayId(store.data, l))} → ${escapeHtml(groupFullLabel(store.data, otherUid))}</span>
      </div>`;
    })
    .join('');

  panel.innerHTML = `
    <h3>${escapeHtml(displayId)}</h3>
    <form id="group-form" class="stacked-form">
      <label>Název skupiny
        <input name="name" type="text" value="${escapeHtml(group.name)}">
      </label>
      <label>Rámeček oblasti
        <select name="frameUid">${frameOptions}</select>
      </label>
      <label class="checkbox-row"><input type="checkbox" name="expectsMirror" ${group.expectsMirror ? 'checked' : ''}> Očekává se mirror vazba (pro kontrolu úplnosti)</label>
    </form>

    <h4>Vazby</h4>
    <div id="group-links-list">${linksRows || '<p class="empty-note">Skupina zatím nemá žádnou vazbu.</p>'}</div>

    <h4>Zástupci SŽ</h4>
    <div id="reps-list">${repsRows || '<p class="empty-note">Zatím žádní zástupci.</p>'}</div>
    <button class="btn" id="btn-add-rep">+ Přidat zástupce</button>

    <h4>Přiřazená témata</h4>
    <div class="topic-checklist">${topicCheckboxes}</div>

    <hr>
    <button class="btn btn-danger" id="btn-del-group">Smazat skupinu</button>
  `;

  panel.querySelectorAll('[data-link-jump]').forEach((row) => {
    row.addEventListener('click', () => {
      const otherUid = row.dataset.linkJump;
      const sameInst = row.dataset.sameInst === '1';
      if (sameInst) {
        store.selection.elementType = 'group';
        store.selection.elementUid = otherUid;
        store.selection.editingLinkUid = null;
        if (spiderCanvas) {
          spiderCanvas.setData(store.data, inst.uid, canvasSelection());
          spiderCanvas.focusOnGroupUid(otherUid);
        }
        renderEditorSidePanel();
      } else {
        const found = allGroups(store.data).find((x) => x.group.uid === otherUid);
        if (found) navigate({ view: 'editor', institutionUid: found.institution.uid, elementType: 'group', elementUid: otherUid });
      }
    });
  });

  const form = panel.querySelector('#group-form');
  form.querySelectorAll('input, select').forEach((field) => {
    field.addEventListener('change', () => {
      const fd = new FormData(form);
      store.commit(`Upravena skupina ${displayId}`, (data) => {
        const g = findGroupMut(data, group.uid);
        if (!g) return;
        g.name = fd.get('name');
        g.frameUid = fd.get('frameUid') || null;
        g.expectsMirror = form.querySelector('[name="expectsMirror"]').checked;
      });
    });
  });

  panel.querySelector('#btn-add-rep').addEventListener('click', () => {
    store.commit(`Přidán zástupce do ${displayId}`, (data) => {
      const g = findGroupMut(data, group.uid);
      if (g) g.reps.push({ name: '', unit: '', role: ROLES[1] });
    });
  });
  panel.querySelectorAll('.rep-row').forEach((row) => {
    const idx = Number(row.dataset.idx);
    row.querySelectorAll('[data-field]').forEach((f) => {
      f.addEventListener('change', () => {
        store.commit(`Upraven zástupce v ${displayId}`, (data) => {
          const g = findGroupMut(data, group.uid);
          if (!g || !g.reps[idx]) return;
          g.reps[idx][f.dataset.field] = f.value;
        });
      });
    });
    row.querySelector('[data-del-rep]').addEventListener('click', () => {
      store.commit(`Odebrán zástupce z ${displayId}`, (data) => {
        const g = findGroupMut(data, group.uid);
        if (g) g.reps.splice(idx, 1);
      });
    });
  });

  panel.querySelectorAll('.topic-checklist input[type="checkbox"]').forEach((cb) => {
    cb.addEventListener('change', () => {
      const topicUid = cb.dataset.topic;
      store.commit(`Upravena témata skupiny ${displayId}`, (data) => {
        const g = findGroupMut(data, group.uid);
        if (!g) return;
        if (cb.checked) {
          if (!g.topicUids.includes(topicUid)) g.topicUids.push(topicUid);
        } else {
          g.topicUids = g.topicUids.filter((id) => id !== topicUid);
        }
      });
    });
  });

  panel.querySelector('#btn-del-group').addEventListener('click', () => {
    if (!window.confirm(`Opravdu smazat skupinu ${displayId}? Smažou se i všechny její vazby.`)) return;
    store.commit(`Smazána skupina ${displayId}`, (data) => removeGroupCascade(data, group.uid));
    store.selection.elementType = null;
    store.selection.elementUid = null;
    renderEditorSidePanel();
    if (spiderCanvas) spiderCanvas.render();
  });
}

function findGroupMut(data, groupUid) {
  for (const inst of data.institutions) {
    const g = inst.groups.find((gg) => gg.uid === groupUid);
    if (g) return g;
  }
  return null;
}

// -------------------------------------------------------------- topics --

function renderTopicsView(root) {
  const parents = store.data.topics.filter((t) => !t.parentUid);
  root.innerHTML = `
    <h1>Registr témat</h1>
    <p class="view-intro">Centrální seznam všech témat – jediný zdroj pravdy pro přiřazování témat pracovním skupinám. Volitelná dvouúrovňová hierarchie (nadřazené téma / kategorie).</p>
    <form id="add-topic-form" class="inline-form">
      <input name="name" type="text" placeholder="Název nového tématu" required>
      <select name="parentUid">
        <option value="">— bez nadřazeného tématu —</option>
        ${parents.map((p) => `<option value="${p.uid}">${escapeHtml(p.name)}</option>`).join('')}
      </select>
      <button class="btn btn-primary" type="submit">+ Přidat téma</button>
    </form>
    <div id="topics-list" class="topics-tree"></div>
  `;
  root.querySelector('#add-topic-form').addEventListener('submit', (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    const name = fd.get('name').trim();
    if (!name) return;
    store.commit(`Přidáno téma ${name}`, (data) => {
      data.topics.push(makeTopic(name, fd.get('parentUid') || null));
    });
    e.target.reset();
  });
  renderTopicsList(root.querySelector('#topics-list'), parents);
}

function renderTopicsList(container, parents) {
  container.innerHTML = parents
    .map((p) => {
      const children = topicChildren(store.data, p.uid);
      return `<div class="topic-block">
        <div class="topic-row topic-row-parent">
          <span class="topic-name" data-edit-topic="${p.uid}">${escapeHtml(p.name)}</span>
          <button class="btn-icon" data-del-topic="${p.uid}" title="Smazat téma">✕</button>
        </div>
        ${children
          .map(
            (c) => `<div class="topic-row topic-row-child">
              <span class="topic-name" data-edit-topic="${c.uid}">${escapeHtml(c.name)}</span>
              <button class="btn-icon" data-del-topic="${c.uid}" title="Smazat téma">✕</button>
            </div>`
          )
          .join('')}
      </div>`;
    })
    .join('') || '<p class="empty-note">Registr témat je zatím prázdný.</p>';

  container.querySelectorAll('[data-del-topic]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const topicUid = btn.dataset.delTopic;
      if (!window.confirm('Smazat toto téma? Odebere se i ze všech skupin, které ho mají přiřazené.')) return;
      store.commit('Smazáno téma', (data) => removeTopicCascade(data, topicUid));
    });
  });
  container.querySelectorAll('[data-edit-topic]').forEach((spanEl) => {
    spanEl.addEventListener('click', () => {
      const topicUid = spanEl.dataset.editTopic;
      const topic = store.data.topics.find((t) => t.uid === topicUid);
      const name = window.prompt('Nový název tématu:', topic.name);
      if (!name) return;
      store.commit(`Přejmenováno téma na ${name}`, (data) => {
        const t = data.topics.find((tt) => tt.uid === topicUid);
        if (t) t.name = name;
      });
    });
  });
}

// ------------------------------------------------------------- reports --

function renderReportsView(root) {
  const reports = R.ALL_REPORTS(store.data);
  root.innerHTML = `
    <h1>Přehledy</h1>
    <p class="view-intro">Souhrnné pohledy napříč všemi institucemi appky. Libovolný přehled lze exportovat do formátovaného XLSX nebo do PDF.</p>
    <div class="reports-toolbar">
      <button class="btn btn-primary" id="btn-export-all">Export všech přehledů do XLSX</button>
    </div>
    <div id="reports-body"></div>
    <h2>Skupiny a zástupci podle tématu</h2>
    <div class="inline-form">
      <select id="topic-picker">
        <option value="">— vyberte téma —</option>
        ${store.data.topics.map((t) => `<option value="${t.uid}">${escapeHtml(topicPath(store.data, t.uid))}</option>`).join('')}
      </select>
      <select id="topic-level">
        <option value="all">Napříč všemi úrovněmi</option>
        <option value="exact">Jen dané téma / podtéma</option>
        <option value="category">Jen nadřazené (agregovaně za podtémata)</option>
      </select>
    </div>
    <div id="topic-report-body"></div>
  `;
  root.querySelector('#btn-export-all').addEventListener('click', () => {
    exportAllReportsXlsx(reports, `pavouci-prehledy-${Date.now()}.xlsx`);
  });

  const body = root.querySelector('#reports-body');
  body.innerHTML = reports
    .map(
      (r) => `<section class="report-section">
        <div class="report-head">
          <h2>${escapeHtml(r.title)}</h2>
          <div class="report-actions">
            <button class="btn" data-xlsx="${r.id}">XLSX</button>
            <button class="btn" data-pdf="${r.id}">PDF</button>
          </div>
        </div>
        ${r.id === 'crossMatrix' ? renderMatrix(r.matrix) : table(r)}
      </section>`
    )
    .join('');
  body.querySelectorAll('[data-xlsx]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const r = reports.find((rr) => rr.id === btn.dataset.xlsx);
      exportReportXlsx(r, `${slug(r.title)}.xlsx`);
    });
  });
  body.querySelectorAll('[data-pdf]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const r = reports.find((rr) => rr.id === btn.dataset.pdf);
      printReport(r);
    });
  });

  const topicPicker = root.querySelector('#topic-picker');
  const topicLevel = root.querySelector('#topic-level');
  const topicReportBody = root.querySelector('#topic-report-body');
  const renderTopicReport = () => {
    if (!topicPicker.value) {
      topicReportBody.innerHTML = '';
      return;
    }
    const r = R.reportGroupsByTopic(store.data, topicPicker.value, topicLevel.value);
    topicReportBody.innerHTML = `<div class="report-head"><h3>${escapeHtml(r.title)}</h3>
      <div class="report-actions"><button class="btn" id="btn-topic-xlsx">XLSX</button><button class="btn" id="btn-topic-pdf">PDF</button></div>
    </div>${table(r)}`;
    topicReportBody.querySelector('#btn-topic-xlsx').addEventListener('click', () => exportReportXlsx(r, `${slug(r.title)}.xlsx`));
    topicReportBody.querySelector('#btn-topic-pdf').addEventListener('click', () => printReport(r));
  };
  topicPicker.addEventListener('change', renderTopicReport);
  topicLevel.addEventListener('change', renderTopicReport);
}

function renderMatrix(matrix) {
  if (!matrix.institutions.length) return '<p class="empty-note">Žádné instituce.</p>';
  return `<div class="table-wrap"><table class="data-table matrix-table"><thead><tr><th></th>${matrix.institutions
    .map((c) => `<th>${escapeHtml(c)}</th>`)
    .join('')}</tr></thead><tbody>${matrix.institutions
    .map(
      (rowCode, i) =>
        `<tr><th>${escapeHtml(rowCode)}</th>${matrix.counts[i].map((v, j) => `<td class="${i === j ? 'diag' : v ? 'has-val' : ''}">${i === j ? '—' : v}</td>`).join('')}</tr>`
    )
    .join('')}</tbody></table></div>`;
}

function slug(str) {
  return str
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}

// ------------------------------------------------------------- history --

function renderHistoryView(root) {
  const entries = [...store.data.history].reverse();
  root.innerHTML = `
    <h1>Historie verzí</h1>
    <p class="view-intro">Appka si interně ukládá historii změn (log verzí) přímo v datové struktuře, nezávisle na verzování SharePoint knihovny. Uchovává se posledních ${MAX_HISTORY} verzí. Kdykoli se lze vrátit k předchozí verzi.</p>
    <div class="table-wrap"><table class="data-table">
      <thead><tr><th>Čas</th><th>Editor</th><th>Popis změny</th><th></th></tr></thead>
      <tbody>${entries
        .map(
          (h) => `<tr><td>${escapeHtml(formatTs(h.ts))}</td><td>${escapeHtml(h.editor || '(nevyplněno)')}</td><td>${escapeHtml(h.summary)}</td>
          <td><button class="btn" data-rollback="${h.uid}">Obnovit tuto verzi</button></td></tr>`
        )
        .join('')}</tbody>
    </table></div>
  `;
  root.querySelectorAll('[data-rollback]').forEach((btn) => {
    btn.addEventListener('click', () => {
      if (!window.confirm('Obnovit appku do stavu této verze? Aktuální stav zůstane také zachován v historii.')) return;
      store.rollbackTo(btn.dataset.rollback);
      navigate({ view: 'dashboard' });
    });
  });
}
