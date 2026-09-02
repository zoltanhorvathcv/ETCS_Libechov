// Jednorázový převod podkladu "SZCZ Representatives in international
// organisations" do datového souboru aplikace.
//
//   node scripts/import-zastupci.mjs <cesta k .xlsx> [výstup.html]
//
// Skript NEZAPISUJE data do zdrojového kódu appky (src/seed.js zůstává
// prázdný) – vezme sestavený index.html, vymění v něm vestavěná data a
// uloží nový samostatný soubor. Vypíše i seznam provedených oprav dat,
// aby bylo dohledatelné, kde se výsledek liší od původního excelu.

import XLSX from 'xlsx-js-style';
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const XLSX_PATH = process.argv[2];
const OUT = process.argv[3] || join(ROOT, 'pavouci-zastupci-2026.html');
if (!XLSX_PATH) {
  console.error('Použití: node scripts/import-zastupci.mjs <soubor.xlsx> [výstup.html]');
  process.exit(1);
}

// ---------------------------------------------------------------- pomocné --
let n = 0;
const uid = (p) => `${p}_imp${(n += 1).toString(36)}`;
const opravy = [];
const vyrazeni = []; // osoby uvedené v excelu k vyřazení z mailing listu
const sheet = (wb, name) =>
  XLSX.utils
    .sheet_to_json(wb.Sheets[name], { header: 1, defval: '', blankrows: false })
    .map((r) => r.map((c) => String(c).replace(/\r?\n/g, ' ').trim()));

// Hodnoty, které v excelu nejsou jménem osoby.
const NENI_JMENO = /^(no changes|contact cancelled|bude upřesněno|ostatní|asi |contact)/i;

// Sjednocení jmen psaných v excelu různě (viz opravy na konci výpisu).
const SJEDNOCENI = new Map([
  ['ing.tomáš tóth', 'Ing. Tomáš Tóth'],
  ['ing. tomáš toth', 'Ing. Tomáš Tóth'],
  ['ing, jiří velebil', 'Ing. Jiří Velebil'],
  ['mgr., ing. radek čech, ph.d.', 'Mgr. Ing. Radek Čech, Ph.D.'],
  ['ing. markéta klesal', 'Markéta Klesal, MA'],
]);
// Zjevné překlepy v e-mailech (doména spravazeleznic.cz).
const OPRAVA_MAILU = new Map([['nekola@sprvazeleznic.cz', 'Nekola@spravazeleznic.cz']]);

function cistéJmeno(raw) {
  const t = (raw || '').trim();
  if (!t || NENI_JMENO.test(t)) return null;
  const bezRole = t.replace(/\s*\((main|sherpa|to be informed)\)\s*/gi, '').trim();
  const opraveno = SJEDNOCENI.get(bezRole.toLowerCase());
  if (opraveno && opraveno !== bezRole) {
    opravy.push(`jméno: "${bezRole}" → "${opraveno}"`);
    return opraveno;
  }
  return bezRole;
}
function cistýMail(raw) {
  const t = (raw || '').trim();
  if (!t || !t.includes('@')) return '';
  const op = OPRAVA_MAILU.get(t.toLowerCase());
  if (op) {
    opravy.push(`e-mail: "${t}" → "${op}"`);
    return op;
  }
  return t;
}
// (main) → vedoucí, (sherpa) → člen, (to be informed) → náhradník
function role(raw) {
  const t = (raw || '').toLowerCase();
  if (t.includes('(main)')) return 'vedoucí';
  if (t.includes('(to be informed)')) return 'náhradník';
  return 'člen';
}
const klic = (jmeno) =>
  jmeno
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/\b(ing|mgr|bc|doc|dr|ph\s*d|phd|mba|ma|arch|csc)\b\.?/gi, ' ')
    .replace(/[^A-Za-z ]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();

// ------------------------------------------------------------ čtení excelu --
const wb = XLSX.readFile(XLSX_PATH);
const kontakty = new Map(); // klíč osoby → { email, phone }
const zapisKontakt = (jmeno, phone, email) => {
  const j = cistéJmeno(jmeno);
  if (!j) return;
  const k = klic(j);
  const zaznam = kontakty.get(k) || { email: '', phone: '' };
  const m = cistýMail(email);
  if (m && !zaznam.email) zaznam.email = m;
  const p = (phone || '').trim();
  if (p && /\d/.test(p) && !zaznam.phone) zaznam.phone = p;
  kontakty.set(k, zaznam);
};

const CROSS = 'CER průřezové skupiny';
const TECH = 'CER technická část pod SU';

// Kontakty na průřezovém listu: telefon je v col9, e-mail v col10 a patří
// osobě, která je na témž řádku buď ve sloupci „ADD TO THE MAILING LIST“
// (col8), nebo v „REMOVE FROM THE MAILING LIST“ (col7) – excel je vede
// jednou tak a jednou tak. Když není ani jedno, patří kontakt aktuálnímu
// zástupci ze sloupce platného stavu (col4).
for (const r of sheet(wb, CROSS).slice(2)) {
  if (!r[9] && !r[10]) continue;
  zapisKontakt(r[8] || r[7] || r[4], r[9], r[10]);
}
// kontakty: technický list (col5 telefon, col6 e-mail k osobě z col2/col1)
for (const r of sheet(wb, TECH).slice(1)) if (r[5] || r[6]) zapisKontakt(r[2] || r[1], r[5], r[6]);
// kontakty: UIC (col1 jméno, col2 telefon, col3 e-mail)
for (const r of sheet(wb, 'UIC').slice(2)) if (r[1]) zapisKontakt(r[1], r[2], r[3]);

const zastupce = (raw) => {
  const jmeno = cistéJmeno(raw);
  if (!jmeno) return null;
  const k = kontakty.get(klic(jmeno)) || {};
  return { jmeno, role: role(raw), email: k.email || '', phone: k.phone || '' };
};

// instituce → skupiny
const data = new Map();
const pridej = (kod, nazevSkupiny, clenove, sekce = '') => {
  if (!data.has(kod)) data.set(kod, []);
  data.get(kod).push({ name: nazevSkupiny.replace(/\s+/g, ' ').trim(), clenove, sekce });
};

// CER průřezové – platný je sloupec 4 (REQUESTED SITUATION FROM 1.2.2026)
let akt = null;
for (const r of sheet(wb, CROSS).slice(2)) {
  const [c0, c1] = [r[0] || '', r[1] || ''];
  if (/^AREAS - CER/i.test(c0)) continue;
  if (c0 || (c1 && akt && c1 !== akt.abbr)) {
    akt = { abbr: c1, clenove: [] };
    pridej('CER', c1 || c0, akt.clenove, 'průřezové skupiny');
  }
  if (akt && r[4]) akt.clenove.push(r[4]);
}

// CER technické – platný je sloupec 2 (REQUESTED SITUATION FROM 1.12.2024)
let sekce = '';
let g = null;
for (const r of sheet(wb, TECH).slice(1)) {
  const c0 = r[0] || '';
  if (/^TWG UNDER|^TWG ACCORDING|^Support Technical/i.test(c0)) {
    sekce = /Support Technical/i.test(c0) ? 'support TWG' : /ACCORDING/i.test(c0) ? 'TSI' : 'ERA Steering Unit';
    g = null;
    continue;
  }
  if (c0) {
    g = { clenove: [], nazev: c0.replace(/\s+/g, ' ').trim() };
    pridej(/ERJU/i.test(c0) ? 'ERJU' : 'CER', c0, g.clenove, sekce);
  }
  if (g) {
    // col1 = THE CURRENT SITUATION, col2 = REQUESTED SITUATION, col3 = REMOVE
    // FROM THE MAILING LIST. Platí požadovaný stav; když je prázdný, drží se
    // stav současný – ale JEN pokud táž osoba není zároveň uvedená k vyřazení.
    // Bez té podmínky by se do appky dostali lidé, kteří ze skupiny odcházejí.
    const req = r[2] || '';
    const cur = r[1] || '';
    const rem = r[3] || '';
    const m = req || (cur && klic(cur) !== klic(rem) ? cur : '');
    if (m) g.clenove.push(m);
    else if (cur && rem) vyrazeni.push(`${g.nazev}: ${cur}`);
  }
}

// jednoduché listy
for (const list of ['RNE', 'ENIM', 'RFC', 'PRIME', 'SERAF']) {
  let gg = null;
  for (const r of sheet(wb, list)) {
    if (r[0]) {
      gg = { clenove: [] };
      // "ENIM External relations" je uvedená na listech PRIME a SERAF, ale patří k ENIM
      const cizi = /^ENIM/i.test(r[0]) && list !== 'ENIM';
      pridej(cizi ? 'ENIM' : list, r[0], gg.clenove, cizi ? `uvedeno na listu ${list}` : '');
    }
    if (gg && r[1]) gg.clenove.push(r[1]);
  }
}
let gu = null;
for (const r of sheet(wb, 'UIC').slice(2)) {
  const c0 = r[0] || '';
  if (/^Ostatní/i.test(c0)) continue;
  if (c0) {
    gu = { clenove: [] };
    pridej('UIC', c0, gu.clenove, '');
  }
  if (gu && r[1]) gu.clenove.push(r[1]);
}

// ------------------------------------------------------- sestavení AppData --
const NAZVY = {
  CER: 'Community of European Railway and Infrastructure Companies',
  PRIME: 'Platform of Rail Infrastructure Managers in Europe',
  SERAF: 'Single European Railway Area Forum',
  RFC: 'Rail Freight Corridors',
  EUG: 'European Users Group',
  EULYNX: 'EULYNX',
  UIC: 'International Union of Railways',
  RISC: 'Rail Interoperability and Safety Committee',
  RNE: 'RailNetEurope',
  ERA: 'European Union Agency for Railways',
  GRB: 'Group of Representative Bodies',
  EC: 'European Commission',
  ENIM: 'European Network of Infrastructure Managers',
  ERJU: "Europe's Rail Joint Undertaking",
};
const PORADI = ['CER', 'PRIME', 'SERAF', 'RFC', 'EUG', 'EULYNX', 'UIC', 'RISC', 'RNE', 'ERA', 'GRB', 'EC', 'ENIM', 'ERJU'];

const app = { schemaVersion: 1, institutions: [], topics: [], links: [], history: [] };
const skupinaPodleNazvu = new Map(); // "KOD|název" → uid

for (const kod of PORADI) {
  const inst = { uid: uid('inst'), code: kod, name: NAZVY[kod], groups: [], frames: [] };
  const skupiny = data.get(kod) || [];
  // Rozmístění: skupiny pod ERA Steering Unit se srovnají do svislého
  // seznamu vpravo od ní (vzor „seznam napojený na jeden uzel“), zbytek do
  // mřížky po sekcích. Uživatel si je stejně posune, tohle je jen rozumný
  // výchozí stav, ve kterém se vazby nekříží.
  const jeSupport = (s) => s.sekce === 'support TWG';
  const ostatni = skupiny.filter((s) => !jeSupport(s));
  const support = skupiny.filter(jeSupport);
  const poziceOstatnich = new Map();
  ostatni.forEach((s, i) => poziceOstatnich.set(s, { x: 60 + (i % 4) * 250, y: 60 + Math.floor(i / 4) * 150 }));
  const yZaklad = 60 + Math.ceil(ostatni.length / 4) * 150 + 60;
  const poziceSupportu = new Map();
  support.forEach((s, i) => poziceSupportu.set(s, { x: 660, y: yZaklad + i * 130 }));
  const stredSupportu = yZaklad + ((support.length - 1) * 130) / 2;

  skupiny.forEach((s, i) => {
    const pos =
      poziceSupportu.get(s) ||
      (s.name === 'CER ERA Steering Unit' && support.length
        ? { x: 200, y: stredSupportu }
        : poziceOstatnich.get(s)) || { x: 60, y: 60 };
    const grp = {
      uid: uid('grp'),
      seq: i + 1,
      name: s.name,
      x: pos.x,
      y: pos.y,
      w: 210,
      h: 100,
      frameUid: null,
      reps: s.clenove.map(zastupce).filter(Boolean).map((z) => ({
        name: z.jmeno,
        unit: '',
        role: z.role,
        email: z.email,
        phone: z.phone,
      })),
      topicUids: [],
      expectsMirror: false,
    };
    inst.groups.push(grp);
    skupinaPodleNazvu.set(`${kod}|${s.name}`, { uid: grp.uid, sekce: s.sekce });
  });
  app.institutions.push(inst);
}

// Vazby: excel uvádí support TWG výslovně jako skupiny POD CER ERA Steering
// Unit ("TWG UNDER CER ERA STEERING UNIT"), tak je takto propojíme.
const su = skupinaPodleNazvu.get('CER|CER ERA Steering Unit');
if (su) {
  for (const [kl, v] of skupinaPodleNazvu) {
    if (kl.startsWith('CER|') && v.sekce === 'support TWG') {
      app.links.push({
        uid: uid('lnk'),
        type: 'N',
        aUid: su.uid,
        bUid: v.uid,
        arrow: 'forward',
        note: 'Dle listu „TWG UNDER CER ERA STEERING UNIT“',
        lineStyle: 'elbow',
        bEndOffset: 0,
        stubOffsetA: null,
        stubOffsetB: null,
        labelOffset: null,
      });
    }
  }
}

app.history.push({
  uid: uid('ver'),
  ts: new Date().toISOString(),
  editor: null,
  summary: `Import z podkladu ${XLSX_PATH.split('/').pop()}`,
  snapshot: JSON.parse(JSON.stringify({ ...app, history: undefined })),
});

// -------------------------------------------------- vložení do souboru appky --
const html = readFileSync(join(ROOT, 'index.html'), 'utf8');
// pozor: knihovny obsahují řetězce jako "</script", proto se hledá konkrétní tag
const vytahni = (id) => {
  const m = html.match(new RegExp(`<script id="${id}"[^>]*>([\\s\\S]*?)</script>`));
  if (!m) throw new Error(`V index.html chybí <script id="${id}">`);
  return m[1];
};
const styl = html.match(/<style id="app-style">([\s\S]*?)<\/style>/)[1];
const esc = (s) => s.replace(/<\/script/gi, '<\\/script');

writeFileSync(
  OUT,
  `<!doctype html>
<html lang="cs">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Organizační pavouci – Správa železnic</title>
<style id="app-style">${styl}</style>
</head>
<body>
<div id="app-root"></div>
<script type="application/json" id="seed-data">${esc(JSON.stringify(app))}</script>
<script id="app-libs">${esc(vytahni('app-libs'))}</script>
<script id="app-code">${esc(vytahni('app-code'))}</script>
</body>
</html>
`,
  'utf8'
);

// ------------------------------------------------------------------ výpis --
const skupin = app.institutions.reduce((a, i) => a + i.groups.length, 0);
const prirazeni = app.institutions.reduce((a, i) => a + i.groups.reduce((b, g) => b + g.reps.length, 0), 0);
const osoby = new Set();
const sMailem = new Set();
for (const i of app.institutions)
  for (const g of i.groups)
    for (const r of g.reps) {
      osoby.add(klic(r.name));
      if (r.email) sMailem.add(klic(r.name));
    }

console.log(`\nVytvořeno: ${OUT}`);
console.log(`  institucí:   ${app.institutions.length} (${app.institutions.filter((i) => i.groups.length).length} s obsahem)`);
console.log(`  skupin:      ${skupin}`);
console.log(`  přiřazení:   ${prirazeni}`);
console.log(`  osob:        ${osoby.size} (z toho ${sMailem.size} s e-mailem)`);
console.log(`  vazeb:       ${app.links.length}`);
for (const i of app.institutions.filter((x) => x.groups.length)) console.log(`    ${i.code}: ${i.groups.length} skupin`);

const unik = [...new Set(opravy)];
console.log(`\nProvedené opravy dat (${unik.length}):`);
unik.forEach((o) => console.log(`  • ${o}`));

if (vyrazeni.length) {
  console.log(`\nNenaimportováni – excel je uvádí k vyřazení z mailing listu (${vyrazeni.length}):`);
  [...new Set(vyrazeni)].forEach((v) => console.log(`  • ${v}`));
}
