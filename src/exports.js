import { BRAND } from './model.js';
import { SpiderCanvas } from './canvas.js';

function download(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}

function serializeSvg(svgEl) {
  svgEl.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
  const src = new XMLSerializer().serializeToString(svgEl);
  return `<?xml version="1.0" standalone="no"?>\r\n${src}`;
}

export function exportSvgFile(svgEl, filename) {
  const src = serializeSvg(svgEl);
  download(new Blob([src], { type: 'image/svg+xml;charset=utf-8' }), filename);
}

export function rasterizeSvg(svgEl, scale = 2) {
  return new Promise((resolve, reject) => {
    const width = Number(svgEl.getAttribute('width')) || 800;
    const height = Number(svgEl.getAttribute('height')) || 500;
    const src = serializeSvg(svgEl);
    const svgBlob = new Blob([src], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(svgBlob);
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = width * scale;
      canvas.height = height * scale;
      const ctx = canvas.getContext('2d');
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      URL.revokeObjectURL(url);
      resolve(canvas);
    };
    img.onerror = (e) => {
      URL.revokeObjectURL(url);
      reject(e);
    };
    img.src = url;
  });
}

export async function exportPngFile(svgEl, filename) {
  const canvas = await rasterizeSvg(svgEl, 2);
  canvas.toBlob((blob) => download(blob, filename), 'image/png');
}

export async function exportPptxFile(svgEl, filename, title) {
  const canvas = await rasterizeSvg(svgEl, 2);
  const dataUrl = canvas.toDataURL('image/png');
  const pptx = new window.PptxGenJS();
  pptx.defineLayout({ name: 'SZ_WIDE', width: 13.33, height: 7.5 });
  pptx.layout = 'SZ_WIDE';
  const slide = pptx.addSlide();
  slide.background = { color: 'FFFFFF' };
  slide.addText(title, {
    x: 0.4,
    y: 0.2,
    w: 12.5,
    h: 0.6,
    fontFace: 'Verdana',
    fontSize: 20,
    bold: true,
    color: '002B59',
  });
  const ratio = canvas.width / canvas.height;
  let w = 12.5;
  let h = w / ratio;
  if (h > 6.4) {
    h = 6.4;
    w = h * ratio;
  }
  slide.addImage({ data: dataUrl, x: (13.33 - w) / 2, y: 0.9, w, h });
  await pptx.writeFile({ fileName: filename });
}

// Export všech (neprázdných) pavouků appky do jedné souhrnné prezentace –
// jedna appka = jedna prezentace, jeden slide na institituci.
export async function exportAllInstitutionsPptx(data, filename) {
  const nonEmpty = data.institutions.filter((i) => i.groups.length || i.frames.length);
  if (!nonEmpty.length) {
    window.alert('Žádná instituce zatím neobsahuje žádné skupiny – není co exportovat.');
    return;
  }
  const hidden = document.createElement('div');
  hidden.style.cssText = 'position:fixed;left:-9999px;top:-9999px;width:1200px;height:800px;';
  document.body.appendChild(hidden);
  const canvas = new SpiderCanvas(hidden, {
    onSelect() {},
    onChangeGeometry() {},
    onJumpToGroup() {},
    onAddGroupAt() {},
  });
  const pptx = new window.PptxGenJS();
  pptx.defineLayout({ name: 'SZ_WIDE', width: 13.33, height: 7.5 });
  pptx.layout = 'SZ_WIDE';
  for (const inst of nonEmpty) {
    canvas.setData(data, inst.uid, null);
    const svgEl = canvas.exportSvgElement();
    const rasterCanvas = await rasterizeSvg(svgEl, 2);
    const dataUrl = rasterCanvas.toDataURL('image/png');
    const slide = pptx.addSlide();
    slide.background = { color: 'FFFFFF' };
    slide.addText(`${inst.name} (${inst.code})`, {
      x: 0.4,
      y: 0.2,
      w: 12.5,
      h: 0.6,
      fontFace: 'Verdana',
      fontSize: 20,
      bold: true,
      color: '002B59',
    });
    const ratio = rasterCanvas.width / rasterCanvas.height;
    let w = 12.5;
    let h = w / ratio;
    if (h > 6.4) {
      h = 6.4;
      w = h * ratio;
    }
    slide.addImage({ data: dataUrl, x: (13.33 - w) / 2, y: 0.9, w, h });
  }
  document.body.removeChild(hidden);
  await pptx.writeFile({ fileName: filename });
}

const HEADER_FILL = { fgColor: { rgb: '002B59' } };
const HEADER_FONT = { color: { rgb: 'FFFFFF' }, bold: true, name: 'Verdana', sz: 11 };
const CELL_FONT = { name: 'Verdana', sz: 10, color: { rgb: '333333' } };
const STRIPE_FILL = { fgColor: { rgb: 'F4F4F4' } };
const THIN_BORDER = { style: 'thin', color: { rgb: 'D9D9D9' } };

export function exportReportXlsx(report, filename) {
  const XLSX = window.XLSX;
  const wb = XLSX.utils.book_new();
  addReportSheet(XLSX, wb, report);
  if (report.matrix) addMatrixSheet(XLSX, wb, report.matrix, `${report.title} – matice`);
  XLSX.writeFile(wb, filename);
}

export function exportAllReportsXlsx(reports, filename) {
  const XLSX = window.XLSX;
  const wb = XLSX.utils.book_new();
  for (const report of reports) {
    addReportSheet(XLSX, wb, report);
  }
  XLSX.writeFile(wb, filename);
}

function addReportSheet(XLSX, wb, report) {
  const headerRow = report.columns.map((c) => c.label);
  const dataRows = report.rows.map((row) => report.columns.map((c) => row[c.key]));
  const aoa = [headerRow, ...dataRows];
  const ws = XLSX.utils.aoa_to_sheet(aoa.length ? aoa : [headerRow.length ? headerRow : ['(bez dat)']]);
  styleSheet(ws, report.columns.length || 1, dataRows.length);
  const name = safeSheetName(report.title, wb);
  XLSX.utils.book_append_sheet(wb, ws, name);
}

function addMatrixSheet(XLSX, wb, matrix, title) {
  const header = ['', ...matrix.institutions];
  const rows = matrix.institutions.map((code, i) => [code, ...matrix.counts[i]]);
  const ws = XLSX.utils.aoa_to_sheet([header, ...rows]);
  styleSheet(ws, header.length, rows.length);
  XLSX.utils.book_append_sheet(wb, ws, safeSheetName(title, wb));
}

function styleSheet(ws, colCount, rowCount) {
  const range = { s: { r: 0, c: 0 }, e: { r: rowCount, c: colCount - 1 } };
  for (let c = 0; c < colCount; c += 1) {
    const cellRef = cellAddress(0, c);
    if (ws[cellRef]) {
      ws[cellRef].s = { fill: HEADER_FILL, font: HEADER_FONT, alignment: { vertical: 'center' } };
    }
  }
  for (let r = 1; r <= rowCount; r += 1) {
    for (let c = 0; c < colCount; c += 1) {
      const cellRef = cellAddress(r, c);
      if (ws[cellRef]) {
        ws[cellRef].s = {
          font: CELL_FONT,
          fill: r % 2 === 0 ? STRIPE_FILL : undefined,
          border: { top: THIN_BORDER, bottom: THIN_BORDER, left: THIN_BORDER, right: THIN_BORDER },
        };
      }
    }
  }
  ws['!cols'] = new Array(colCount).fill(0).map(() => ({ wch: 24 }));
  ws['!ref'] = window.XLSX.utils.encode_range(range);
}

function cellAddress(r, c) {
  return window.XLSX.utils.encode_cell({ r, c });
}

// Excel omezuje název listu na 31 znaků a nedovolí duplicitu v rámci
// sešitu – u dlouhých názvů (např. report + jeho "– matice" příloha) se tak
// mohly po oříznutí srazit na stejný název. `wb` (pokud je předán) se použije
// k tomu, aby se kolize vyřešila číselnou příponou místo pádu exportu.
function safeSheetName(name, wb) {
  const base = (name || 'List').replace(/[\\/?*[\]:]/g, ' ').trim().slice(0, 31) || 'List';
  if (!wb) return base;
  const used = new Set(wb.SheetNames);
  if (!used.has(base)) return base;
  let candidate = base;
  let i = 2;
  while (used.has(candidate)) {
    const suffix = ` (${i})`;
    candidate = base.slice(0, 31 - suffix.length) + suffix;
    i += 1;
  }
  return candidate;
}

// ---- PDF export přehledů (přes tiskový dialog prohlížeče) ---------------

export function printReport(report) {
  const area = document.getElementById('print-area');
  area.innerHTML = '';
  const h1 = document.createElement('h1');
  h1.textContent = report.title;
  const meta = document.createElement('p');
  meta.textContent = `Vygenerováno: ${new Date().toLocaleString('cs-CZ')}`;
  const table = document.createElement('table');
  const thead = document.createElement('thead');
  const trh = document.createElement('tr');
  for (const col of report.columns) {
    const th = document.createElement('th');
    th.textContent = col.label;
    trh.appendChild(th);
  }
  thead.appendChild(trh);
  const tbody = document.createElement('tbody');
  for (const row of report.rows) {
    const tr = document.createElement('tr');
    for (const col of report.columns) {
      const td = document.createElement('td');
      td.textContent = row[col.key] ?? '';
      tr.appendChild(td);
    }
    tbody.appendChild(tr);
  }
  table.appendChild(thead);
  table.appendChild(tbody);
  area.appendChild(h1);
  area.appendChild(meta);
  area.appendChild(table);
  document.body.classList.add('printing');
  window.print();
  setTimeout(() => document.body.classList.remove('printing'), 500);
}

export { BRAND };
