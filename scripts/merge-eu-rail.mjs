// Vloží referenční organizační strukturu EU-Rail/ERJU a navazujících
// institucí (data/eu-rail-structure.mjs) do už sestaveného AppData objektu
// (typicky výstupu scripts/import-zastupci.mjs). NEDOTÝKÁ se existujících
// skupin ani zástupců – jen přidává nové skupiny a vazby.
//
// Očekává, že instituce s příslušnými kódy (ERJU, RNE, PRIME, RFC, EUG,
// EULYNX, RISC, ERA, EC, SERAF, ENIM) v appce už existují (i prázdné) –
// to zajišťuje import-zastupci.mjs, který je zakládá vždy, bez ohledu na
// to, jestli pro ně excel obsahuje list se zástupci.

import { makeGroup, makeLink } from '../src/model.js';
import { NEW_GROUPS, INSTITUTION_NAME_FIXES, RELATIONS } from '../data/eu-rail-structure.mjs';

export function mergeEuRailStructure(app) {
  const summary = [];

  for (const [code, name] of Object.entries(INSTITUTION_NAME_FIXES)) {
    const inst = app.institutions.find((i) => i.code === code);
    if (inst && inst.name !== name) {
      summary.push(`Opraven název instituce ${code}: "${inst.name}" → "${name}"`);
      inst.name = name;
    }
  }

  // slug → uid, zvlášť pro každou instituci
  const nodeUidMaps = {};

  for (const [code, groups] of Object.entries(NEW_GROUPS)) {
    const inst = app.institutions.find((i) => i.code === code);
    if (!inst) {
      throw new Error(
        `Instituce s kódem "${code}" v appce neexistuje – EU-Rail merge očekává, že už byla založena importem zástupců.`
      );
    }
    nodeUidMaps[code] = {};

    // Nové skupiny se umístí pod stávající obsah instituce (aby se
    // nepřekrývaly s tím, co tam už je ze zástupců), rozložené do sloupců
    // podle hloubky v hierarchii (jen orientační výchozí pozice – uživatel
    // si je stejně může v appce posunout).
    const existingBottom = inst.groups.reduce((m, g) => Math.max(m, g.y + g.h), 0);
    const startY = existingBottom ? existingBottom + 60 : 60;

    const bySlug = new Map(groups.map((g) => [g.slug, g]));
    const depthOf = (slug, seen = new Set()) => {
      if (seen.has(slug)) return 0;
      seen.add(slug);
      const g = bySlug.get(slug);
      if (!g || !g.parent) return 0;
      return 1 + depthOf(g.parent, seen);
    };

    const rowsUsed = new Map(); // hloubka → počet už umístěných v tom sloupci
    for (const g of groups) {
      const depth = depthOf(g.slug);
      const row = rowsUsed.get(depth) || 0;
      rowsUsed.set(depth, row + 1);
      const grp = makeGroup(inst, {
        name: g.name,
        x: 60 + depth * 260,
        y: startY + row * 130,
      });
      inst.groups.push(grp);
      nodeUidMaps[code][g.slug] = grp.uid;
    }
    summary.push(`${code}: přidáno ${groups.length} nových skupin`);
  }

  const resolve = (ref) => {
    const inst = app.institutions.find((i) => i.code === ref.code);
    if (!inst) throw new Error(`Neznámá instituce "${ref.code}" ve vazbě EU-Rail struktury.`);
    if (ref.existing) {
      const g = inst.groups.find((x) => x.name === ref.existing);
      if (!g) {
        throw new Error(
          `Ve skupinách instituce ${ref.code} nenalezena existující skupina "${ref.existing}" (zkontroluj, že import zástupců proběhl a název odpovídá).`
        );
      }
      return g.uid;
    }
    const uidVal = nodeUidMaps[ref.code]?.[ref.slug];
    if (!uidVal) throw new Error(`Neznámý uzel ${ref.code}/${ref.slug} ve vazbě EU-Rail struktury.`);
    return uidVal;
  };

  for (const rel of RELATIONS) {
    const aUid = resolve(rel.a);
    const bUid = resolve(rel.b);
    app.links.push(
      makeLink(rel.type, aUid, bUid, {
        arrow: 'forward',
        note: rel.note || '',
        lineStyle: rel.lineStyle || 'straight',
      })
    );
  }
  summary.push(`Přidáno ${RELATIONS.length} vazeb (interních i cross-institucionálních).`);

  return summary;
}
