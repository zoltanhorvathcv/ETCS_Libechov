// Kouřový test sestavené appky (index.html) v headless prohlížeči.
// Spuštění: npm run smoke
//
// Ověřuje průchod hlavními funkcemi a hlídá chyby v konzoli – většina
// regresí se projeví jako výjimka, ne jako viditelná chyba. Nenahrazuje
// vizuální kontrolu plátna (geometrie vazeb má tichá selhání), ale zachytí
// rozbitý build, rozbitý datový tok i rozbitý export.

import { chromium } from 'playwright';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, join } from 'node:path';
import { mkdtempSync, rmSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const APP = join(ROOT, 'index.html');

if (!existsSync(APP)) {
  console.error('index.html neexistuje – spusť nejdřív `npm run build`.');
  process.exit(1);
}

const downloadDir = mkdtempSync(join(tmpdir(), 'pavouci-smoke-'));
const steps = [];
let failed = 0;

function check(name, ok, detail = '') {
  steps.push({ name, ok, detail });
  if (!ok) failed += 1;
  console.log(`${ok ? '  ok  ' : ' FAIL '} ${name}${detail ? ` – ${detail}` : ''}`);
}

// PW_EXECUTABLE je únikový východ pro prostředí, kde je Chromium jinde, než
// kam ho Playwright standardně instaluje (kontejnery s předinstalovaným
// prohlížečem). V běžném prostředí po `npx playwright install chromium`
// se nenastavuje.
const browser = await chromium.launch({
  args: ['--no-sandbox'],
  ...(process.env.PW_EXECUTABLE ? { executablePath: process.env.PW_EXECUTABLE } : {}),
});
const context = await browser.newContext({ viewport: { width: 1400, height: 900 }, acceptDownloads: true });
const page = await context.newPage();

const errors = [];
page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
page.on('console', (m) => {
  if (m.type() === 'error') errors.push(`console.error: ${m.text()}`);
});

// window.prompt/confirm se v appce používá pro názvy institucí a potvrzení mazání
const answers = ['SMOKE', 'Smoke Test Institution'];
page.on('dialog', async (d) => {
  if (d.type() === 'prompt') await d.accept(answers.shift() ?? '');
  else await d.accept();
});

try {
  await page.goto(pathToFileURL(APP).href);
  await page.waitForSelector('#app-root .app-shell', { timeout: 10000 });
  check('appka se načte', true);

  // --- instituce a skupiny ------------------------------------------------
  await page.click('[data-action="new-institution"]');
  await page.waitForSelector('#canvas-host', { timeout: 5000 });
  check('založení instituce otevře editor', true);

  await page.click('[data-action="add-group"]');
  await page.click('[data-action="add-group"]');
  await page.waitForTimeout(200);
  const groupCount = (await page.$$('.group-node')).length;
  check('přidání dvou skupin', groupCount === 2, `nalezeno ${groupCount}`);

  // --- přesun boxu tažením ------------------------------------------------
  const groups = await page.$$('.group-node');
  const before = await groups[1].boundingBox();
  await page.mouse.move(before.x + 12, before.y + 12);
  await page.mouse.down();
  await page.mouse.move(before.x + 360, before.y + 240, { steps: 10 });
  await page.mouse.up();
  await page.waitForTimeout(200);
  const after = await (await page.$$('.group-node'))[1].boundingBox();
  check('přesun skupiny tažením', Math.abs(after.x - before.x) > 100);

  // --- vazba --------------------------------------------------------------
  const host = await (await page.$('.canvas-host')).boundingBox();
  await page.mouse.click(host.x + host.width - 24, host.y + host.height - 24); // odznačit → panel instituce
  await page.waitForSelector('#add-link-form', { timeout: 5000 });

  const aSel = await page.$('#add-link-form select[name="aUid"]');
  const bSel = await page.$('#add-link-form select[name="bUid"]');
  const aVals = await aSel.$$eval('option', (o) => o.map((x) => x.value));
  const bVals = await bSel.$$eval('option', (o) => o.map((x) => x.value));
  await aSel.selectOption(aVals[0]);
  await bSel.selectOption(bVals.find((v) => v !== aVals[0]));
  await page.selectOption('#add-link-form select[name="lineStyle"]', 'elbow');
  await page.click('#add-link-form button[type="submit"]');
  await page.waitForTimeout(300);
  check('přidání lomené vazby', (await page.$$('.link-line')).length === 1);
  check('vazba má úchyt konce', (await page.$('.link-end-handle')) !== null);
  check('vazba má ID štítek', (await page.$('.link-id-chip')) !== null);

  // --- ruční posun konce vazby + reset ------------------------------------
  const handle = await (await page.$('.link-end-handle')).boundingBox();
  await page.mouse.move(handle.x + handle.width / 2, handle.y + handle.height / 2);
  await page.mouse.down();
  await page.mouse.move(handle.x + handle.width / 2, handle.y + handle.height / 2 + 50, { steps: 8 });
  await page.mouse.up();
  await page.waitForTimeout(200);
  const draft = await page.evaluate(() => JSON.parse(localStorage.getItem('pavouci_draft_v1')));
  check('ruční posun konce vazby se uloží', draft?.data?.links?.[0]?.bEndOffset !== 0);

  // --- exporty ------------------------------------------------------------
  for (const [action, label] of [
    ['export-svg', 'SVG'],
    ['export-png', 'PNG'],
    ['export-pptx', 'PPTX'],
  ]) {
    const [dl] = await Promise.all([
      page.waitForEvent('download', { timeout: 20000 }),
      page.click(`[data-action="${action}"]`),
    ]);
    check(`export ${label}`, !!(await dl.suggestedFilename()));
  }

  // --- přehledy -----------------------------------------------------------
  await page.click('[data-nav="reports"]');
  await page.waitForSelector('.report-section', { timeout: 5000 });
  const sections = (await page.$$('.report-section')).length;
  check('přehledy se vykreslí', sections > 5, `${sections} sekcí`);

  const [xlsx] = await Promise.all([
    page.waitForEvent('download', { timeout: 20000 }),
    page.click('text=Export všech přehledů do XLSX'),
  ]);
  check('export všech přehledů do XLSX', !!(await xlsx.suggestedFilename()));

  // --- roundtrip: uložit appku a znovu otevřít ----------------------------
  await page.click('[data-nav="dashboard"]');
  await page.waitForTimeout(200);
  const [appFile] = await Promise.all([
    page.waitForEvent('download', { timeout: 20000 }),
    page.click('text=Uložit / exportovat appku'),
  ]);
  const savedPath = join(downloadDir, 'saved-app.html');
  await appFile.saveAs(savedPath);

  const page2 = await context.newPage();
  const errors2 = [];
  page2.on('pageerror', (e) => errors2.push(`pageerror: ${e.message}`));
  page2.on('console', (m) => {
    if (m.type() === 'error') errors2.push(`console.error: ${m.text()}`);
  });
  await page2.goto(pathToFileURL(savedPath).href);
  await page2.waitForSelector('#app-root .app-shell', { timeout: 10000 });
  const seeded = await page2.evaluate(() => {
    const raw = document.getElementById('seed-data')?.textContent;
    if (!raw) return null;
    const d = JSON.parse(raw);
    const inst = d.institutions.find((i) => i.code === 'SMOKE');
    return inst ? { groups: inst.groups.length, links: d.links.length } : null;
  });
  check(
    'uložená appka obsahuje data (roundtrip)',
    seeded?.groups === 2 && seeded?.links === 1,
    JSON.stringify(seeded)
  );
  check('uložená appka se načte bez chyb', errors2.length === 0, errors2.join(' | '));

  // --- konzole ------------------------------------------------------------
  check('žádné chyby v konzoli', errors.length === 0, errors.join(' | '));
} catch (err) {
  check('průchod testem bez výjimky', false, String(err?.message || err));
} finally {
  await browser.close();
  rmSync(downloadDir, { recursive: true, force: true });
}

console.log(`\n${steps.length - failed}/${steps.length} kontrol prošlo.`);
process.exit(failed === 0 ? 0 : 1);
