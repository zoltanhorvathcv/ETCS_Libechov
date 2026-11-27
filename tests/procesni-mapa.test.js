// Automatický test stránky procesni-mapa.html (Playwright + Chromium).
// Spuštění z kořene repozitáře:  node tests/procesni-mapa.test.js
'use strict';
const http = require('http');
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');

const ROOT = path.resolve(__dirname, '..');
const results = [];
let current = '';
function ok(cond, msg) {
  results.push({ ok: !!cond, msg: `${current} › ${msg}` });
  if (!cond) console.log('  ✗ ' + msg);
}
const canon = v => Array.isArray(v) ? v.map(canon) : v && typeof v === 'object'
  ? Object.fromEntries(Object.keys(v).sort().map(k => [k, canon(v[k])])) : v;
function eq(a, b, msg) { ok(JSON.stringify(canon(a)) === JSON.stringify(canon(b)), `${msg} (čekáno ${JSON.stringify(b)}, je ${JSON.stringify(a)})`); }

function serve() {
  return new Promise(res => {
    const srv = http.createServer((req, resp) => {
      const f = path.join(ROOT, decodeURIComponent(req.url.split('?')[0]));
      if (!f.startsWith(ROOT) || !fs.existsSync(f)) { resp.writeHead(404); return resp.end(); }
      resp.writeHead(200, { 'Content-Type': f.endsWith('.html') ? 'text/html; charset=utf-8' : 'application/octet-stream' });
      fs.createReadStream(f).pipe(resp);
    }).listen(0, () => res(srv));
  });
}

(async () => {
  const srv = await serve();
  const URL = `http://localhost:${srv.address().port}/procesni-mapa.html`;
  const browser = await chromium.launch();
  const context = await browser.newContext({ viewport: { width: 1400, height: 900 }, acceptDownloads: true });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push('pageerror: ' + e.message));
  page.on('console', m => { if (m.type() === 'error') errors.push('console: ' + m.text()); });

  const D = () => page.evaluate(() => JSON.parse(JSON.stringify(window.procesniMapa.data)));
  const view = () => page.evaluate(() => ({ ...window.procesniMapa.view }));
  const byName = async n => (await D()).processes.find(p => p.name === n);
  const streamBy = async n => (await D()).streams.find(s => s.name === n);
  const toastText = () => page.textContent('#toast');
  const modalOpen = () => page.isVisible('#modal form');
  const menuItem = label => page.click(`#ctx button:has-text("${label}")`);
  const submit = () => page.click('#modal button[type=submit]');
  const errText = () => page.textContent('#modal .err');

  /** Klikne pravým tlačítkem do streamu (dráha, datum ISO). */
  async function rightClickStream(sid, lane, iso, button = 'right') {
    const pt = await page.evaluate(({ sid, lane, iso }) => {
      const pm = window.procesniMapa, sc = document.getElementById('scroller');
      const y = pm.dToY(pm.parseISO(iso));
      const col = document.querySelector(`.scol[data-sid="${sid}"]`);
      sc.scrollTop = Math.max(0, y - 200);
      const colLeft = col.offsetLeft + document.getElementById('axis').offsetWidth;
      sc.scrollLeft = Math.max(0, colLeft + lane * 190 - 300);
      const r = col.getBoundingClientRect();
      return { x: r.left + lane * 190 + 95, y: r.top + y + 3 };
    }, { sid, lane, iso });
    const lanes = await page.evaluate(sid => window.procesniMapa.data.streams.find(s => s.id === sid).lanes, sid);
    if (lane >= lanes) throw new Error(`test: stream ${sid} má jen ${lanes} drah`);
    await page.waitForTimeout(30);
    await page.mouse.click(pt.x, pt.y, { button });
  }
  /** Klikne pravým tlačítkem na proces podle názvu. */
  async function rightClickProc(name) {
    const p = await byName(name);
    const loc = page.locator(`.proc[data-pid="${p.id}"]`);
    await loc.scrollIntoViewIfNeeded();
    await loc.click({ button: 'right', position: { x: 30, y: 8 } });
  }
  async function addRolesInDialog(roles) {
    for (const r of roles) { await page.fill('#modal [data-chip-in]', r); await page.press('#modal [data-chip-in]', 'Enter'); }
  }

  // ------------------------------------------------------------------
  current = '1 Načtení a ukázková data';
  await page.goto(URL);
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  let d = await D();
  eq(d.streams.length, 3, 'tři ukázkové streamy');
  eq(d.processes.length, 6, 'šest ukázkových procesů');
  eq(await page.locator('.proc').count(), 6, 'šest boxů procesů v ploše');
  eq(await page.locator('.shead').count(), 3, 'tři záhlaví streamů');
  eq((await view()).scale, 'month', 'výchozí měřítko měsíce');

  current = '2 Měsíce – osa';
  let labels = await page.$$eval('#axis .ax.row span', els => els.map(e => e.textContent));
  eq(labels.length, 132, '132 měsíců (2020–2030)');
  eq(labels.slice(0, 12), ['led', 'úno', 'bře', 'dub', 'kvě', 'čvn', 'čvc', 'srp', 'zář', 'říj', 'lis', 'pro'], 'české třípísmenné zkratky měsíců');
  eq(labels[131], 'pro', 'poslední řádek je prosinec');
  let years = await page.$$eval('#axis .ax.yr span', els => els.map(e => e.textContent));
  eq(years, ['2020', '2021', '2022', '2023', '2024', '2025', '2026', '2027', '2028', '2029', '2030'], 'roky 2020 až 2030');
  // poloha procesu: Studie proveditelnosti 1. 1. 2025 – 30. 9. 2025 = řádky 60–68
  let p1 = await byName('Studie proveditelnosti');
  let box = await page.$eval(`.proc[data-pid="${p1.id}"]`, e => ({ top: e.offsetTop, h: e.offsetHeight }));
  eq(box.top, 60 * 46 + 1, 'začátek procesu sedí na lednu 2025');
  eq(box.h, 9 * 46 - 2, 'výška procesu = 9 měsíců');

  current = '3 Týdny a kvartály';
  await page.click('#scaleSeg button[data-scale=week]');
  eq((await view()).scale, 'week', 'přepnuto na týdny');
  labels = await page.$$eval('#axis .ax.row', els => els.map(e => e.textContent));
  ok(labels[0].startsWith('T01') && labels[0].includes('30. pro'), 'první týden T01 začíná 30. pro (2019) – ' + labels[0]);
  const weeks = await page.$$eval('#axis .ax.row', els => els.length);
  eq(weeks, 575, 'počet týdnů pokrývajících 2020–2030');
  const months = await page.$$eval('#axis .ax.mo span', els => els.map(e => e.textContent));
  eq(months.length, 132, 'v týdnech je i sloupec měsíců');
  eq(months.slice(0, 3), ['led', 'úno', 'bře'], 'měsíce v týdenní ose');
  ok(await page.locator('.oor').count() === 2, 'oblast mimo období (před 1. 1. 2020 a po 31. 12. 2030) je šrafovaná');
  box = await page.$eval(`.proc[data-pid="${p1.id}"]`, e => ({ top: e.offsetTop, h: e.offsetHeight }));
  let exp = await page.evaluate(() => window.procesniMapa.dToY(window.procesniMapa.parseISO('2025-01-01')));
  ok(Math.abs(box.top - exp - 1) < 0.6, 'v týdnech proces začíná na správném týdnu');
  // přilepené popisky roku a měsíce zůstávají vidět i uprostřed roku
  await page.selectOption('#yearSel', '2027');
  eq(await page.inputValue('#yearSel'), '2027', 'po skoku na rok ukazuje výběr roku 2027');
  const stick = await page.evaluate(() => {
    const pm = window.procesniMapa, sc = document.getElementById('scroller');
    sc.scrollTop = pm.dToY(pm.parseISO('2027-06-17'));
    const top = sc.getBoundingClientRect().top + 72;
    const vis = sel => [...document.querySelectorAll(sel)].filter(e => { const r = e.getBoundingClientRect(); return r.top >= top - 1 && r.top < top + 30; }).map(e => e.textContent);
    return { yr: vis('#axis .ax.yr span'), mo: vis('#axis .ax.mo span') };
  });
  await page.waitForTimeout(50);
  eq(stick, { yr: ['2027'], mo: ['čvn'] }, 'rok a měsíc jsou vidět nahoře u osy uprostřed roku');
  eq(await page.inputValue('#yearSel'), '2027', 'výběr roku sleduje posun');
  await page.click('#scaleSeg button[data-scale=quarter]');
  labels = await page.$$eval('#axis .ax.row span', els => els.map(e => e.textContent));
  eq(labels.length, 44, '44 kvartálů');
  eq(labels.slice(0, 4), ['Q1', 'Q2', 'Q3', 'Q4'], 'označení kvartálů');
  box = await page.$eval(`.proc[data-pid="${p1.id}"]`, e => ({ top: e.offsetTop, h: e.offsetHeight }));
  eq(box.top, 20 * 120 + 1, 'v kvartálech proces začíná Q1 2025');
  eq(box.h, 3 * 120 - 2, 'v kvartálech má proces 3 kvartály');
  await page.click('#scaleSeg button[data-scale=month]');

  current = '4 Přiblížení';
  await page.click('#bZoomIn');
  eq((await view()).zoom, 1.25, 'zoom +');
  box = await page.$eval(`.proc[data-pid="${p1.id}"]`, e => e.offsetTop);
  eq(box, 60 * Math.round(46 * 1.25) + 1, 'po zoomu se poloha přepočítá');
  for (let i = 0; i < 10; i++) if (!(await page.isDisabled('#bZoomOut'))) await page.click('#bZoomOut');
  eq((await view()).zoom, 0.5, 'nejmenší zoom 50 %');
  ok(await page.isDisabled('#bZoomOut'), 'tlačítko − je na minimu zakázané');
  await page.click('#bZoomIn'); await page.click('#bZoomIn');
  eq((await view()).zoom, 1, 'zpět na 100 %');

  current = '5 Nový stream tlačítkem';
  await page.click('#bStream');
  await submit();
  ok((await errText()).includes('název streamu'), 'prázdný název streamu je odmítnut');
  await page.fill('#modal input[name=name]', 'Testovací stream');
  await page.click('#modal .swatches label:nth-child(5) span');
  await submit();
  ok(!(await modalOpen()), 'dialog zavřen');
  let ts = await streamBy('Testovací stream');
  ok(ts && ts.lanes === 1 && ts.color === '#7a4fd6', 'stream vytvořen s barvou a 1 dráhou');
  eq(await page.locator('.shead').count(), 4, 'záhlaví má 4 streamy');

  current = '6 Nový proces tlačítkem + validace';
  await page.click('#bProc');
  ok(await modalOpen(), 'dialog procesu otevřen');
  await page.selectOption('#modal select[name=stream]', ts.id);
  await page.fill('#modal input[name=from]', '2026-03-01');
  await page.fill('#modal input[name=to]', '2026-05-31');
  await submit();
  ok((await errText()).includes('název'), 'bez názvu nelze uložit');
  await page.fill('#modal input[name=name]', 'Proces A');
  await page.fill('#modal input[name=to]', '2026-02-01');
  await submit();
  ok((await errText()).includes('dříve'), 'do < od je odmítnuto');
  await page.fill('#modal input[name=to]', '2031-01-15');
  await submit();
  ok((await errText()).includes('2030'), 'datum po roce 2030 je odmítnuto');
  await page.fill('#modal input[name=from]', '2019-12-31');
  await page.fill('#modal input[name=to]', '2026-05-31');
  await submit();
  ok((await errText()).includes('2020'), 'datum před rokem 2020 je odmítnuto');
  await page.fill('#modal input[name=from]', '');
  await submit();
  ok((await errText()).includes('od'), 'prázdné datum od je odmítnuto');
  await page.fill('#modal input[name=from]', '2026-03-01');
  await page.fill('#modal input[name=gesce]', 'Odbor testů');
  await addRolesInDialog(['Tester', 'Garant']);
  await page.fill('#modal [data-chip-in]', 'Tester');           // duplicitní role
  await page.press('#modal [data-chip-in]', 'Enter');
  await page.fill('#modal [data-chip-in]', 'Analytik');         // rozepsaná role bez Enteru se má uložit
  await submit();
  ok(!(await modalOpen()), 'proces uložen');
  let pa = await byName('Proces A');
  ok(pa, 'proces existuje');
  eq(pa && [pa.streamId, pa.lane, pa.from, pa.to, pa.gesce], [ts.id, 0, '2026-03-01', '2026-05-31', 'Odbor testů'], 'údaje procesu');
  eq(pa && pa.roles, ['Tester', 'Garant', 'Analytik'], 'role bez duplicit a s rozepsanou rolí');
  let txt = await page.textContent(`.proc[data-pid="${pa.id}"]`);
  ok(txt.includes('Proces A') && txt.includes('Odbor testů') && txt.includes('Garant') && txt.includes('1. 3. 2026 – 31. 5. 2026'), 'box zobrazuje název, gesci, role a termín');
  ok(await page.isEnabled('#bPar'), 'nově přidaný proces je vybraný (Paralelní proces je aktivní)');

  current = '7 Pravé tlačítko na stream → přidat proces';
  await rightClickStream(ts.id, 0, '2027-03-15');
  ok(await page.isVisible('#ctx'), 'kontextové menu streamu se otevřelo');
  let mtxt = await page.textContent('#ctx');
  ok(mtxt.includes('Přidat proces sem (bře 2027)'), 'menu nabízí proces do kliknutého měsíce – ' + mtxt.slice(0, 80));
  await menuItem('Přidat proces sem');
  eq(await page.inputValue('#modal input[name=from]'), '2027-03-01', 'předvyplněno od = 1. 3. 2027');
  eq(await page.inputValue('#modal input[name=to]'), '2027-03-31', 'předvyplněno do = 31. 3. 2027');
  eq(await page.inputValue('#modal select[name=stream]'), ts.id, 'předvyplněn kliknutý stream');
  eq(await page.inputValue('#modal select[name=lane]'), '0', 'předvyplněna kliknutá dráha');
  await page.fill('#modal input[name=name]', 'Proces B');
  await submit();
  let pb = await byName('Proces B');
  eq(pb && [pb.lane, pb.from, pb.to], [0, '2027-03-01', '2027-03-31'], 'proces B v dráze 1, březen 2027');

  current = '8 Paralelní proces pravým tlačítkem na obsazené místo';
  // klik mimo box procesu ve stejném měsíci (proces B má jen boxy v dráze 0; klikneme do dráhy 0 těsně pod box?)
  // Box zabírá celou šířku dráhy, proto klikneme do jiného dne, kde by default období kolidovalo:
  await page.click('#bLane');                 // vybraný je proces B → dráha do jeho streamu
  ts = await streamBy('Testovací stream');
  eq(ts.lanes, 2, 'tlačítko Paralelní dráha přidalo dráhu do streamu vybraného procesu');
  await rightClickStream(ts.id, 1, '2027-03-10');
  await menuItem('Přidat proces sem');
  eq(await page.inputValue('#modal select[name=lane]'), '1', 'předvyplněna dráha 2');
  await page.fill('#modal input[name=name]', 'Proces C');
  await page.selectOption('#modal select[name=lane]', '0');      // ruční volba obsazené dráhy
  await submit();
  ok((await errText()).includes('překrývá') && (await errText()).includes('Proces B'), 'obsazená dráha je odmítnuta se jménem kolidujícího procesu');
  await page.selectOption('#modal select[name=lane]', 'auto');
  await submit();
  let pc = await byName('Proces C');
  eq(pc && pc.lane, 1, 'automaticky do první volné dráhy (2)');

  current = '9 Tlačítko Paralelní proces';
  await page.locator(`.proc[data-pid="${pb.id}"]`).click();
  await page.click('#bPar');
  ok((await page.textContent('#mdlTitle')).includes('Paralelní proces k „Proces B“'), 'titulek dialogu paralelního procesu');
  eq([await page.inputValue('#modal input[name=from]'), await page.inputValue('#modal input[name=to]')], ['2027-03-01', '2027-03-31'], 'paralelní proces přebírá termín');
  await page.fill('#modal input[name=name]', 'Proces D');
  await submit();
  let pdd = await byName('Proces D');
  ts = await streamBy('Testovací stream');
  eq([pdd.lane, ts.lanes], [2, 3], 'obě dráhy obsazené → vznikla dráha 3');
  eq(await page.locator(`.shead[data-sid="${ts.id}"] .lane-h`).count(), 3, 'záhlaví ukazuje 3 dráhy');
  const xs = await page.$$eval(`.scol[data-sid="${ts.id}"] .proc`, els => els.map(e => e.offsetLeft));
  ok(new Set(xs).size >= 3, 'paralelní procesy jsou vedle sebe (různé x)');

  current = '10 Pravé tlačítko na proces → přidat roli';
  await rightClickProc('Proces B');
  mtxt = await page.textContent('#ctx');
  ok(mtxt.includes('Přidat roli') && mtxt.includes('Změnit od – do') && mtxt.includes('Změnit gesci'), 'menu procesu má roli, od–do a gesci');
  await menuItem('Přidat roli');
  ok(await page.evaluate(() => document.activeElement && document.activeElement.matches('[data-chip-in]')), 'kurzor je v poli role');
  await addRolesInDialog(['Koordinátor', 'Schvalovatel']);
  await submit();
  pb = await byName('Proces B');
  eq(pb.roles, ['Koordinátor', 'Schvalovatel'], 'role přidány');
  await rightClickProc('Proces B');
  await menuItem('Přidat roli');
  await page.click('#modal .chip:has-text("Koordinátor") button');
  await page.fill('#modal [data-chip-in]', 'Role X, Role Y');       // čárkou oddělené role
  await submit();
  pb = await byName('Proces B');
  eq(pb.roles, ['Schvalovatel', 'Role X', 'Role Y'], 'odebrání role × a více rolí oddělených čárkou');
  await rightClickProc('Proces B');
  await menuItem('Přidat roli');
  await page.keyboard.press('Escape');
  ok(!(await modalOpen()), 'Esc zavře dialog bez změny');
  eq((await byName('Proces B')).roles.length, 3, 'role beze změny po Esc');

  current = '11 Pravé tlačítko na proces → změnit od–do';
  await rightClickProc('Proces A');
  await menuItem('Změnit od – do');
  await page.fill('#modal input[name=to]', '2026-01-01');
  await submit();
  ok((await errText()).includes('dříve'), 'neplatné období odmítnuto');
  await page.fill('#modal input[name=from]', '2026-02-01');
  await page.fill('#modal input[name=to]', '2026-04-30');
  await submit();
  pa = await byName('Proces A');
  eq([pa.from, pa.to, pa.lane], ['2026-02-01', '2026-04-30', 0], 'termín změněn, dráha zůstala');
  box = await page.$eval(`.proc[data-pid="${pa.id}"]`, e => ({ top: e.offsetTop, h: e.offsetHeight }));
  eq(box, { top: (6 * 12 + 1) * 46 + 1, h: 3 * 46 - 2 }, 'box se přesunul na únor–duben 2026');
  // změna termínu do kolize → automatický přesun do volné dráhy
  await rightClickProc('Proces A');
  await menuItem('Změnit od – do');
  await page.fill('#modal input[name=from]', '2027-03-20');
  await page.fill('#modal input[name=to]', '2027-04-30');
  await submit();
  pa = await byName('Proces A');
  ts = await streamBy('Testovací stream');
  eq([pa.lane, ts.lanes], [3, 4], 'kolizní termín → proces přesunut do nové dráhy 4');
  ok((await toastText()).includes('přesunut do dráhy 4'), 'uživatel je o přesunu informován');
  await page.click('#bUndo');
  pa = await byName('Proces A');
  ts = await streamBy('Testovací stream');
  eq([pa.from, pa.lane, ts.lanes], ['2026-02-01', 0, 3], 'Zpět vrátí termín, dráhu i počet drah');

  current = '12 Pravé tlačítko na proces → změnit gesci';
  await rightClickProc('Proces A');
  await menuItem('Změnit gesci');
  eq(await page.inputValue('#modal input[name=gesce]'), 'Odbor testů', 'předvyplněná gesce');
  await page.fill('#modal input[name=gesce]', 'Ředitelství');
  await page.press('#modal input[name=gesce]', 'Enter');
  eq((await byName('Proces A')).gesce, 'Ředitelství', 'gesce změněna (Enter uloží)');
  ok((await page.textContent(`.proc[data-pid="${pa.id}"]`)).includes('Ředitelství'), 'box ukazuje novou gesci');
  await rightClickProc('Proces A');
  await menuItem('Změnit gesci');
  await page.fill('#modal input[name=gesce]', '   ');
  await submit();
  eq((await byName('Proces A')).gesce, '', 'prázdná gesce gesci odebere');
  ok(!(await page.textContent(`.proc[data-pid="${pa.id}"]`)).includes('Gesce:'), 'box bez řádku gesce');
  const opts = await page.$$eval('#dlGesce option', o => o.map(x => x.value));
  ok(opts.includes('Odbor přípravy staveb'), 'gesce se nabízí z existujících hodnot (datalist)');

  current = '13 Úprava všeho, přesun mezi streamy';
  await page.dblclick(`.proc[data-pid="${pc.id}"]`, { position: { x: 30, y: 8 } });
  ok((await page.textContent('#mdlTitle')) === 'Upravit proces', 'dvojklik otevře úpravu');
  eq(await page.inputValue('#modal input[name=name]'), 'Proces C', 'předvyplněný název');
  const s2 = await streamBy('Realizace');
  await page.selectOption('#modal select[name=stream]', s2.id);
  const laneOpts = await page.$$eval('#modal select[name=lane] option', o => o.map(x => x.value));
  eq(laneOpts, ['auto', '0', 'new'], 'po změně streamu se obnoví nabídka drah');
  await page.fill('#modal input[name=name]', 'Proces C2');
  await page.fill('#modal input[name=from]', '2027-01-01');
  await page.fill('#modal input[name=to]', '2027-06-30');      // koliduje se Stavbou od 1. 2. 2027
  await submit();
  pc = await byName('Proces C2');
  eq([pc.streamId, pc.lane], [s2.id, 1], 'přesun do jiného streamu, kolize → dráha 2');
  eq((await streamBy('Realizace')).lanes, 2, 'cílový stream dostal dráhu');
  ok(await page.$(`.scol[data-sid="${s2.id}"] .proc[data-pid="${pc.id}"]`), 'box je ve sloupci cílového streamu');

  current = '14 Dráhy – odebrání';
  ts = await streamBy('Testovací stream');
  eq(ts.lanes, 3, 'testovací stream má 3 dráhy');
  // dráha 2 (index 1) je nyní prázdná (Proces C odešel) → má × v záhlaví
  ok(await page.$(`.shead[data-sid="${ts.id}"] .lane-x[data-lane="1"]`), 'prázdná dráha má v záhlaví ×');
  ok(!(await page.$(`.shead[data-sid="${ts.id}"] .lane-x[data-lane="0"]`)), 'obsazená dráha × nemá');
  await page.click(`.shead[data-sid="${ts.id}"] .lane-x[data-lane="1"]`);
  ts = await streamBy('Testovací stream');
  pdd = await byName('Proces D');
  eq([ts.lanes, pdd.lane], [2, 1], 'dráha odebrána, procesy vpravo se posunuly');
  await rightClickStream(ts.id, 0, '2026-08-10');
  const rm = page.locator('#ctx button:has-text("Odebrat dráhu 1")');
  ok(await rm.isDisabled(), 'obsazenou dráhu nelze odebrat z menu');
  await page.keyboard.press('Escape');
  ok(await page.isHidden('#ctx'), 'Esc zavře menu');
  await rightClickStream(ts.id, 1, '2026-08-10');
  await menuItem('Přidat paralelní dráhu');
  eq((await streamBy('Testovací stream')).lanes, 3, 'menu streamu přidá dráhu');
  await rightClickStream(ts.id, 2, '2026-08-10');
  await menuItem('Odebrat dráhu 3');
  eq((await streamBy('Testovací stream')).lanes, 2, 'menu streamu odebere prázdnou dráhu');
  await page.click(`.shead[data-sid="${ts.id}"] [data-act=add-lane]`);
  eq((await streamBy('Testovací stream')).lanes, 3, 'tlačítko ⇉ v záhlaví přidá dráhu');
  await page.click('#bUndo');

  current = '15 Posun do dráhy vlevo/vpravo';
  await rightClickProc('Proces D');
  await menuItem('Posunout do dráhy vlevo');
  ok((await toastText()).includes('Proces B'), 'posun do obsazené dráhy odmítnut');
  eq((await byName('Proces D')).lane, 1, 'proces zůstal');
  await rightClickProc('Proces D');
  await menuItem('Posunout do dráhy vpravo');
  eq([(await byName('Proces D')).lane, (await streamBy('Testovací stream')).lanes], [2, 3], 'posun vpravo vytvoří dráhu');
  await page.click('#bUndo');

  current = '16 Mazání procesu, Zpět/Znovu';
  const before = (await D()).processes.length;
  await rightClickProc('Proces D');
  await menuItem('Smazat proces');
  eq((await D()).processes.length, before - 1, 'smazání z menu');
  await page.click('#bUndo');
  eq((await D()).processes.length, before, 'Zpět obnoví proces');
  await page.click('#bRedo');
  eq((await D()).processes.length, before - 1, 'Znovu ho opět smaže');
  await page.keyboard.press('Control+z');
  eq((await D()).processes.length, before, 'Ctrl+Z');
  await page.locator(`.proc[data-pid="${pdd.id}"]`).click();
  await page.keyboard.press('Delete');
  eq((await D()).processes.length, before - 1, 'klávesa Delete smaže vybraný proces');
  await page.keyboard.press('Control+y');
  eq((await D()).processes.length, before - 1, 'Ctrl+Y bez historie nic nezmění');
  await page.keyboard.press('Control+z');
  await page.locator(`.proc[data-pid="${pdd.id}"]`).click();
  await page.click('#bDel');
  eq((await D()).processes.length, before - 1, 'tlačítko Smazat');
  ok(await page.isDisabled('#bEdit'), 'po smazání není nic vybráno');
  await page.click('#bUndo');

  current = '17 Stream – přejmenování, posun, smazání';
  await rightClickStream(ts.id, 0, '2029-01-10');
  await menuItem('Přejmenovat');
  await page.fill('#modal input[name=name]', 'Stream <b>X</b> & "uvozovky"');
  await submit();
  ok(await page.$(`.shead[data-sid="${ts.id}"] .sh-name:text-is('Stream <b>X</b> & "uvozovky"')`), 'název se zobrazí doslova (HTML escapování)');
  await page.click(`.shead[data-sid="${ts.id}"] [data-act=stream-menu]`);
  await menuItem('Posunout stream vlevo');
  d = await D();
  eq(d.streams.findIndex(s => s.id === ts.id), 2, 'stream posunut vlevo');
  await page.click(`.shead[data-sid="${d.streams[0].id}"] [data-act=stream-menu]`);
  ok(await page.locator('#ctx button:has-text("Posunout stream vlevo")').isDisabled(), 'první stream nejde posunout vlevo');
  await page.keyboard.press('Escape');
  await page.click(`.shead[data-sid="${ts.id}"] [data-act=stream-menu]`);
  await menuItem('Smazat stream');
  ok((await page.textContent('#modal')).includes('obsahuje'), 'mazání streamu s procesy vyžaduje potvrzení');
  await page.click('#modal [data-close]');
  ok(await streamBy('Stream <b>X</b> & "uvozovky"'), 'Zrušit stream nesmaže');
  await page.click(`.shead[data-sid="${ts.id}"] [data-act=stream-menu]`);
  await menuItem('Smazat stream');
  await submit();
  d = await D();
  ok(!d.streams.some(s => s.id === ts.id) && !d.processes.some(p => p.streamId === ts.id), 'stream i jeho procesy smazány');
  await page.click('#bUndo');
  ok((await D()).streams.some(s => s.id === ts.id), 'Zpět obnoví smazaný stream');

  current = '18 Týdny – pravé tlačítko a hranice období';
  await page.click('#scaleSeg button[data-scale=week]');
  await rightClickStream(ts.id, 1, '2026-11-25');     // středa
  mtxt = await page.textContent('#ctx');
  ok(mtxt.includes('T48') && mtxt.includes('23. 11. 2026 – 29. 11. 2026'), 'týden pondělí–neděle – ' + mtxt.slice(0, 90));
  await menuItem('Přidat proces sem');
  eq([await page.inputValue('#modal input[name=from]'), await page.inputValue('#modal input[name=to]')], ['2026-11-23', '2026-11-29'], 'předvyplněný týden');
  await page.keyboard.press('Escape');
  await rightClickStream(ts.id, 1, '2020-01-01');
  await menuItem('Přidat proces sem');
  eq(await page.inputValue('#modal input[name=from]'), '2020-01-01', 'první týden oříznut na 1. 1. 2020');
  await page.fill('#modal input[name=name]', 'Začátek');
  await submit();
  await rightClickStream(ts.id, 1, '2030-12-31');
  await menuItem('Přidat proces sem');
  eq(await page.inputValue('#modal input[name=to]'), '2030-12-31', 'poslední týden oříznut na 31. 12. 2030');
  await page.fill('#modal input[name=name]', 'Konec');
  await submit();
  const zc = await byName('Začátek'), kc = await byName('Konec');
  eq([zc.streamId, zc.lane, zc.from, zc.to, kc.streamId, kc.lane, kc.from, kc.to], [ts.id, 1, '2020-01-01', '2020-01-05', ts.id, 1, '2030-12-30', '2030-12-31'], 'procesy na hranicích období uloženy v kliknutém streamu a dráze');

  current = '19 Kvartály – pravé tlačítko';
  await page.click('#scaleSeg button[data-scale=quarter]');
  await rightClickStream(ts.id, 1, '2028-08-15');
  ok((await page.textContent('#ctx')).includes('Q3 2028'), 'menu nabízí Q3 2028');
  await menuItem('Přidat proces sem');
  eq([await page.inputValue('#modal input[name=from]'), await page.inputValue('#modal input[name=to]')], ['2028-07-01', '2028-09-30'], 'předvyplněný kvartál');
  await page.fill('#modal input[name=name]', 'Kvartální proces');
  await submit();
  const kq = await byName('Kvartální proces');
  eq([kq.streamId, kq.lane], [ts.id, 1], 'kvartální proces v kliknutém streamu a dráze');
  box = await page.$eval(`.proc[data-pid="${kq.id}"]`, e => ({ top: e.offsetTop, h: e.offsetHeight }));
  eq(box, { top: 34 * 120 + 1, h: 118 }, 'box přesně na Q3 2028');
  await page.click('#scaleSeg button[data-scale=month]');

  current = '20 Celé období 2020–2030';
  await page.click('#bProc');
  await page.fill('#modal input[name=name]', 'Celé období');
  await page.fill('#modal input[name=from]', '2020-01-01');
  await page.fill('#modal input[name=to]', '2030-12-31');
  await submit();
  const co = await byName('Celé období');
  box = await page.$eval(`.proc[data-pid="${co.id}"]`, e => ({ top: e.offsetTop, h: e.offsetHeight }));
  eq(box, { top: 1, h: 132 * 46 - 2 }, 'proces přes celé období vyplní celou osu');

  current = '21 Uložení a obnovení po načtení';
  await page.click('#scaleSeg button[data-scale=week]');
  const snap = await D();
  await page.reload();
  eq(await D(), snap, 'data přežijí znovunačtení stránky');
  eq((await view()).scale, 'week', 'měřítko přežije znovunačtení');
  await page.click('#scaleSeg button[data-scale=month]');

  current = '22 Export a import';
  const [dl] = await Promise.all([page.waitForEvent('download'), page.click('#bExport')]);
  ok(/^procesni-mapa-\d{4}-\d{2}-\d{2}\.json$/.test(dl.suggestedFilename()), 'název souboru exportu');
  const exported = JSON.parse(fs.readFileSync(await dl.path(), 'utf8'));
  eq(exported, snap, 'export obsahuje celou mapu');
  const scratch = fs.mkdtempSync(path.join(require('os').tmpdir(), 'pm-'));
  const imp = { version: 1, streams: [{ id: 'a', name: 'Importovaný', color: '#123456', lanes: 1 }],
    processes: [
      { id: 'x', streamId: 'a', lane: 0, name: 'I1', from: '2024-01-01', to: '2024-06-30', gesce: 'G', roles: ['R'] },
      { id: 'y', streamId: 'a', lane: 0, name: 'I2', from: '2024-03-01', to: '2024-04-30', gesce: '', roles: [] },     // kolize ve stejné dráze
      { id: 'z', streamId: 'neexistuje', lane: 0, name: 'bez streamu', from: '2024-01-01', to: '2024-01-31' },
      { id: 'w', streamId: 'a', lane: 0, name: 'špatné datum', from: '2024-02-30', to: '2024-03-01' },
      { id: 'v', streamId: 'a', lane: 0, name: 'obrácené', from: '2025-05-31', to: '2025-05-01' },
    ] };
  const impFile = path.join(scratch, 'import.json');
  fs.writeFileSync(impFile, JSON.stringify(imp));
  await page.setInputFiles('#fileIn', impFile);
  await page.waitForSelector('#modal form');
  await submit();
  d = await D();
  eq(d.streams.map(s => [s.name, s.lanes]), [['Importovaný', 2]], 'import nahradil mapu; kolize vyřešena 2. dráhou');
  eq(d.processes.map(p => [p.name, p.lane]), [['I1', 0], ['I2', 1], ['obrácené', 0]], 'neplatné záznamy vynechány');
  eq(d.processes[2] && [d.processes[2].from, d.processes[2].to], ['2025-05-01', '2025-05-31'], 'obrácené datum opraveno');
  const bad = path.join(scratch, 'bad.json');
  fs.writeFileSync(bad, '{ nic');
  await page.setInputFiles('#fileIn', bad);
  await page.waitForTimeout(150);
  ok((await toastText()).includes('Import se nezdařil'), 'neplatný soubor ohlášen');
  fs.writeFileSync(bad, '{"a":1}');
  await page.setInputFiles('#fileIn', bad);
  await page.waitForTimeout(150);
  ok((await toastText()).includes('neobsahuje platnou'), 'JSON bez mapy ohlášen');
  eq((await D()).streams.length, 1, 'po chybném importu mapa beze změny');
  await page.click('#bUndo');
  eq(await D(), snap, 'Zpět vrátí stav před importem');

  current = '23 Nová mapa, prázdný stav, ukázková data';
  await page.click('#bNew');
  await submit();
  eq((await D()).streams.length, 0, 'mapa vymazána');
  ok(await page.isVisible('#empty'), 'zobrazen prázdný stav');
  await page.click('#bProc');
  ok((await page.textContent('#mdlTitle')) === 'Nový stream', '＋ Proces bez streamu nabídne vytvoření streamu');
  await page.fill('#modal input[name=name]', 'První');
  await submit();
  await page.waitForTimeout(50);
  ok((await page.textContent('#mdlTitle')) === 'Nový proces', 'po vytvoření streamu pokračuje dialog procesu');
  await page.fill('#modal input[name=name]', 'První proces');
  await submit();
  const fp = await byName('První proces');
  ok(fp && fp.streamId === (await streamBy('První')).id, 'proces vznikl v novém streamu');
  ok(await page.isHidden('#empty'), 'prázdný stav zmizí');
  await page.reload();
  eq((await D()).streams.length, 1, 'prázdná/nová mapa se po načtení nenahradí ukázkou');
  await page.click('#bNew'); await submit();
  await page.click('#eSample');
  eq((await D()).processes.length, 6, 'ukázková data načtena');
  await page.mouse.click(900, 500, { button: 'right' });
  ok(await page.isVisible('#ctx'), 'pravé tlačítko funguje i po načtení ukázky');
  await page.keyboard.press('Escape');

  current = '24 Kontextové menu u okraje obrazovky';
  const s1 = (await D()).streams[0];
  await page.evaluate(() => { document.getElementById('scroller').scrollTop = 99999; });
  const colBox = await page.locator(`.scol[data-sid="${s1.id}"]`).boundingBox();
  const mainBottom = await page.evaluate(() => document.querySelector('main').getBoundingClientRect().bottom);
  await page.mouse.click(colBox.x + 50, mainBottom - 20, { button: 'right' });
  const mb = await page.locator('#ctx').boundingBox();
  ok(mb && mb.y >= 0 && mb.y + mb.height <= 900 && mb.x + mb.width <= 1400, 'menu se vejde do okna');
  await page.keyboard.press('Escape');

  current = '25 Mobilní zobrazení a dotyk (⋯)';
  const mob = await browser.newContext({ viewport: { width: 390, height: 800 }, hasTouch: true, isMobile: true });
  const mp = await mob.newPage();
  mp.on('pageerror', e => errors.push('mobil pageerror: ' + e.message));
  await mp.goto(URL);
  const sw = await mp.evaluate(() => document.documentElement.scrollWidth);
  ok(sw <= 390, 'stránka se na telefonu nerozšiřuje vodorovně (' + sw + ')');
  const pid = await mp.evaluate(() => window.procesniMapa.data.processes[0].id);
  await mp.locator(`.proc[data-pid="${pid}"]`).scrollIntoViewIfNeeded();
  await mp.locator(`.proc[data-pid="${pid}"] .p-more`).tap();
  ok(await mp.isVisible('#ctx'), '⋯ na procesu otevře menu na dotykovém zařízení');
  const mm = await mp.locator('#ctx').boundingBox();
  ok(mm.x >= 0 && mm.x + mm.width <= 390, 'menu se vejde na šířku telefonu');
  await mp.locator('#ctx button:has-text("Změnit gesci")').tap();
  ok(await mp.isVisible('#modal form'), 'dialog gesce na telefonu');
  const fb = await mp.locator('#modal form').boundingBox();
  ok(fb.width <= 390 - 16, 'dialog se vejde na telefon');
  await mp.fill('#modal input[name=gesce]', 'Mobilní gesce');
  await mp.locator('#modal button[type=submit]').tap();
  eq(await mp.evaluate(id => window.procesniMapa.data.processes.find(p => p.id === id).gesce, pid), 'Mobilní gesce', 'gesce uložená z telefonu');
  await mp.screenshot({ path: path.join(scratch, 'mobil.png') });
  await mob.close();

  current = '26 Chyby v konzoli';
  eq(errors, [], 'žádné chyby JavaScriptu');

  await page.screenshot({ path: path.join(scratch, 'desktop.png') });
  console.log('Snímky obrazovky: ' + scratch);
  await browser.close();
  srv.close();

  const failed = results.filter(r => !r.ok);
  console.log(`\n${results.length - failed.length}/${results.length} kontrol prošlo.`);
  failed.forEach(f => console.log('  NEPROŠLO: ' + f.msg));
  process.exit(failed.length ? 1 : 0);
})().catch(e => { console.error(e); process.exit(2); });
