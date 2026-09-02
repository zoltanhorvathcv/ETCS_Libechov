// Sestaví appku do JEDNOHO samostatného HTML souboru (index.html) se všemi
// daty a knihovnami vloženými přímo uvnitř – žádný server, žádné CDN.
// Použití: npm run build

const fs = require('fs');
const path = require('path');
const esbuild = require('esbuild');

const ROOT = __dirname;
const SRC = path.join(ROOT, 'src');
const OUT_DIR = path.join(ROOT, '.build');
const OUT_FILE = path.join(ROOT, 'index.html');

fs.mkdirSync(OUT_DIR, { recursive: true });

function escForInlineScript(text) {
  return text.replace(/<\/script/gi, '<\\/script');
}

async function main() {
  // 1) aplikační JS (model/store/canvas/reports/exports/ui/seed/main) → jeden IIFE
  const appBuild = await esbuild.build({
    entryPoints: [path.join(SRC, 'main.js')],
    bundle: true,
    format: 'iife',
    target: ['chrome100', 'edge100', 'firefox100', 'safari15'],
    minify: false,
    write: false,
  });
  const appJs = appBuild.outputFiles[0].text;

  // 2) seed data se počítá týmž zdrojovým kódem (model.js/seed.js nemají DOM závislosti)
  await esbuild.build({
    entryPoints: [path.join(SRC, 'seed.js')],
    bundle: true,
    format: 'cjs',
    platform: 'node',
    outfile: path.join(OUT_DIR, 'seed.cjs'),
  });
  delete require.cache[require.resolve(path.join(OUT_DIR, 'seed.cjs'))];
  const { makeSeedData } = require(path.join(OUT_DIR, 'seed.cjs'));
  const seedData = makeSeedData();

  // 3) vendorované knihovny pro export (XLSX se styly, PPTX) – čistě prohlížečové bundly
  const xlsxLib = fs.readFileSync(
    path.join(ROOT, 'node_modules/xlsx-js-style/dist/xlsx.bundle.js'),
    'utf8'
  );
  const pptxLib = fs.readFileSync(
    path.join(ROOT, 'node_modules/pptxgenjs/dist/pptxgen.bundle.js'),
    'utf8'
  );
  const libsJs = `${xlsxLib}\n${pptxLib}`;

  // 4) styly
  const css = fs.readFileSync(path.join(SRC, 'styles.css'), 'utf8');

  const html = `<!doctype html>
<html lang="cs">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Organizační pavouci – Správa železnic</title>
<style id="app-style">${css}</style>
</head>
<body>
<div id="app-root"></div>
<script type="application/json" id="seed-data">${escForInlineScript(JSON.stringify(seedData))}</script>
<script id="app-libs">${escForInlineScript(libsJs)}</script>
<script id="app-code">${escForInlineScript(appJs)}</script>
</body>
</html>
`;

  fs.writeFileSync(OUT_FILE, html, 'utf8');
  const sizeMb = (Buffer.byteLength(html, 'utf8') / (1024 * 1024)).toFixed(2);
  console.log(`Sestaveno: ${path.relative(ROOT, OUT_FILE)} (${sizeMb} MB)`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
