import {
  allGroups,
  groupDisplayId,
  groupFullLabel,
  linkDisplayId,
  isCrossInstitution,
  topicPath,
  topicChildren,
  findInstitutionOfGroup,
  LINK_TYPES,
} from './model.js';
import { formatTs } from './store.js';

// Každý report vrací { id, title, columns:[{key,label}], rows:[{...}] }
// aby ho šlo jednotně vykreslit v UI i exportovat do XLSX.

export function reportMissingReps(data) {
  const rows = [];
  for (const { institution, group } of allGroups(data)) {
    if (group.reps.length === 0) {
      rows.push({
        instituce: institution.code,
        id: groupDisplayId(institution, group),
        nazev: group.name,
      });
    }
  }
  return {
    id: 'missingReps',
    title: 'Chybějící zástupce',
    columns: [
      { key: 'instituce', label: 'Instituce' },
      { key: 'id', label: 'ID skupiny' },
      { key: 'nazev', label: 'Název skupiny' },
    ],
    rows,
  };
}

export function reportMirrorGaps(data) {
  const mirrorTouched = new Set();
  for (const l of data.links) {
    if (l.type === 'M') {
      mirrorTouched.add(l.aUid);
      mirrorTouched.add(l.bUid);
    }
  }
  const rows = [];
  for (const { institution, group } of allGroups(data)) {
    if (group.expectsMirror && !mirrorTouched.has(group.uid)) {
      rows.push({
        instituce: institution.code,
        id: groupDisplayId(institution, group),
        nazev: group.name,
      });
    }
  }
  return {
    id: 'mirrorGaps',
    title: 'Mirror páry bez protějšku',
    columns: [
      { key: 'instituce', label: 'Instituce' },
      { key: 'id', label: 'ID skupiny' },
      { key: 'nazev', label: 'Název skupiny' },
    ],
    rows,
  };
}

export function reportCrossMatrix(data) {
  const institutions = data.institutions;
  const n = institutions.length;
  const indexByUid = new Map(institutions.map((i, idx) => [i.uid, idx]));
  // counts = celkový počet cross-institucionálních vazeb (všechny typy
  // dohromady) mezi dvěma institucemi; typeCounts = rozpad podle typu vazby
  // (N/X/M) – vazba nemusí být jen typu X, i "běžná" nebo "mirror" vazba
  // může reálně vést mimo institucionální hranici.
  const counts = Array.from({ length: n }, () => Array(n).fill(0));
  const typeCounts = Array.from({ length: n }, () => Array.from({ length: n }, () => ({})));
  const pairTypeTotals = new Map();

  for (const l of data.links) {
    if (!isCrossInstitution(data, l)) continue;
    const a = findInstitutionOfGroup(data, l.aUid);
    const b = findInstitutionOfGroup(data, l.bUid);
    if (!a || !b) continue;
    const ia = indexByUid.get(a.uid);
    const ib = indexByUid.get(b.uid);
    counts[ia][ib] += 1;
    counts[ib][ia] += 1;
    typeCounts[ia][ib][l.type] = (typeCounts[ia][ib][l.type] || 0) + 1;
    typeCounts[ib][ia][l.type] = (typeCounts[ib][ia][l.type] || 0) + 1;
    const [codeA, codeB] = [a.code, b.code].sort();
    const key = `${codeA}__${codeB}__${l.type}`;
    pairTypeTotals.set(key, (pairTypeTotals.get(key) || 0) + 1);
  }

  const rows = [...pairTypeTotals.entries()]
    .map(([key, pocet]) => {
      const [a, b, typ] = key.split('__');
      return { a, b, typ: LINK_TYPES[typ].label, pocet };
    })
    .sort((r1, r2) => r1.a.localeCompare(r2.a) || r1.b.localeCompare(r2.b) || r1.typ.localeCompare(r2.typ));

  // do matice se dávají jen instituce, které mají alespoň jednu
  // cross-institucionální vazbu – jinak by matice byla plná zbytečných nul
  const activeIdx = [];
  for (let i = 0; i < n; i += 1) {
    if (counts[i].some((v) => v > 0)) activeIdx.push(i);
  }

  return {
    id: 'crossMatrix',
    title: 'Matice cross-institucionálních vazeb',
    columns: [
      { key: 'a', label: 'Instituce A' },
      { key: 'b', label: 'Instituce B' },
      { key: 'typ', label: 'Typ vazby' },
      { key: 'pocet', label: 'Počet vazeb' },
    ],
    rows,
    matrix: {
      institutions: activeIdx.map((i) => institutions[i].code),
      counts: activeIdx.map((i) => activeIdx.map((j) => counts[i][j])),
      typeCounts: activeIdx.map((i) => activeIdx.map((j) => typeCounts[i][j])),
    },
  };
}

export function reportTopicStats(data) {
  const rows = data.topics.map((t) => {
    let count = 0;
    for (const { group } of allGroups(data)) {
      if (group.topicUids.includes(t.uid)) count += 1;
    }
    return { tema: topicPath(data, t.uid), pocet: count };
  });
  rows.sort((a, b) => b.pocet - a.pocet);
  return {
    id: 'topicStats',
    title: 'Statistika témat',
    columns: [
      { key: 'tema', label: 'Téma' },
      { key: 'pocet', label: 'Počet pracovních skupin' },
    ],
    rows,
  };
}

export function reportInstitutionOverview(data) {
  const rows = data.institutions.map((inst) => {
    const links = data.links.filter(
      (l) => inst.groups.some((g) => g.uid === l.aUid) || inst.groups.some((g) => g.uid === l.bUid)
    );
    const repsMissing = inst.groups.filter((g) => g.reps.length === 0).length;
    return {
      instituce: `${inst.code} – ${inst.name}`,
      skupin: inst.groups.length,
      vazeb: links.length,
      obsazeno: inst.groups.length - repsMissing,
      neobsazeno: repsMissing,
    };
  });
  return {
    id: 'institutionOverview',
    title: 'Přehled podle instituce',
    columns: [
      { key: 'instituce', label: 'Instituce' },
      { key: 'skupin', label: 'Počet skupin' },
      { key: 'vazeb', label: 'Počet vazeb' },
      { key: 'obsazeno', label: 'Obsazené zastoupení' },
      { key: 'neobsazeno', label: 'Neobsazené zastoupení' },
    ],
    rows,
  };
}

export function reportHistory(data) {
  const rows = [...data.history]
    .reverse()
    .map((h) => ({ cas: formatTs(h.ts), editor: h.editor || '(nevyplněno)', popis: h.summary }));
  return {
    id: 'history',
    title: 'Historie / log verzí',
    columns: [
      { key: 'cas', label: 'Čas' },
      { key: 'editor', label: 'Editor' },
      { key: 'popis', label: 'Popis změny' },
    ],
    rows,
  };
}

export function reportRepDirectory(data) {
  const rows = [];
  for (const { institution, group } of allGroups(data)) {
    for (const rep of group.reps) {
      rows.push({
        jmeno: rep.name,
        utvar: rep.unit,
        role: rep.role,
        email: rep.email || '',
        telefon: rep.phone || '',
        skupina: groupDisplayId(institution, group),
        nazev: group.name,
        instituce: institution.code,
      });
    }
  }
  rows.sort((a, b) => a.jmeno.localeCompare(b.jmeno, 'cs'));
  return {
    id: 'repDirectory',
    title: 'Adresář zástupců',
    columns: [
      { key: 'jmeno', label: 'Jméno' },
      { key: 'utvar', label: 'Útvar / organizační jednotka' },
      { key: 'role', label: 'Role' },
      { key: 'email', label: 'E-mail' },
      { key: 'telefon', label: 'Telefon' },
      { key: 'skupina', label: 'Skupina' },
      { key: 'nazev', label: 'Název skupiny' },
      { key: 'instituce', label: 'Instituce' },
    ],
    rows,
  };
}

// Kontaktní list pro rozesílku – jedna osoba jednou, se seznamem skupin.
// Nahrazuje sloupce "ADD TO THE MAILING LIST" z původního excelu.
export function reportMailingList(data) {
  const byPerson = new Map();
  for (const { institution, group } of allGroups(data)) {
    for (const rep of group.reps) {
      if (!rep.name) continue;
      const key = rep.name.trim().toLowerCase();
      if (!byPerson.has(key)) {
        byPerson.set(key, {
          jmeno: rep.name,
          email: rep.email || '',
          telefon: rep.phone || '',
          utvar: rep.unit || '',
          skupiny: [],
        });
      }
      const p = byPerson.get(key);
      // kontakt může být vyplněný jen u některého výskytu osoby
      if (!p.email && rep.email) p.email = rep.email;
      if (!p.telefon && rep.phone) p.telefon = rep.phone;
      if (!p.utvar && rep.unit) p.utvar = rep.unit;
      p.skupiny.push(groupDisplayId(institution, group));
    }
  }
  const rows = [...byPerson.values()]
    .map((p) => ({ ...p, pocet: p.skupiny.length, skupiny: p.skupiny.join(', ') }))
    .sort((a, b) => a.jmeno.localeCompare(b.jmeno, 'cs'));
  return {
    id: 'mailingList',
    title: 'Kontaktní list pro rozesílku',
    columns: [
      { key: 'jmeno', label: 'Jméno' },
      { key: 'email', label: 'E-mail' },
      { key: 'telefon', label: 'Telefon' },
      { key: 'utvar', label: 'Útvar / organizační jednotka' },
      { key: 'pocet', label: 'Počet skupin' },
      { key: 'skupiny', label: 'Skupiny' },
    ],
    rows,
  };
}

export function reportByRole(data) {
  const map = new Map();
  for (const { institution, group } of allGroups(data)) {
    for (const rep of group.reps) {
      const key = `${rep.role}|${institution.code}`;
      map.set(key, (map.get(key) || 0) + 1);
    }
  }
  const rows = [...map.entries()].map(([key, pocet]) => {
    const [role, instituce] = key.split('|');
    return { role, instituce, pocet };
  });
  rows.sort((a, b) => a.role.localeCompare(b.role, 'cs') || a.instituce.localeCompare(b.instituce, 'cs'));
  return {
    id: 'byRole',
    title: 'Přehled podle role',
    columns: [
      { key: 'role', label: 'Role' },
      { key: 'instituce', label: 'Instituce' },
      { key: 'pocet', label: 'Počet zástupců' },
    ],
    rows,
  };
}

export function reportTopicHierarchy(data) {
  const roots = data.topics.filter((t) => !t.parentUid);
  const rows = [];
  const countFor = (topicUid) => {
    let n = 0;
    for (const { group } of allGroups(data)) if (group.topicUids.includes(topicUid)) n += 1;
    return n;
  };
  for (const root of roots) {
    const children = topicChildren(data, root.uid);
    if (children.length === 0) {
      rows.push({ nadrazene: root.name, podtema: '—', pocet: countFor(root.uid) });
    } else {
      for (const c of children) {
        rows.push({ nadrazene: root.name, podtema: c.name, pocet: countFor(c.uid) });
      }
    }
  }
  return {
    id: 'topicHierarchy',
    title: 'Hierarchie témat',
    columns: [
      { key: 'nadrazene', label: 'Nadřazené téma / kategorie' },
      { key: 'podtema', label: 'Podtéma' },
      { key: 'pocet', label: 'Počet skupin' },
    ],
    rows,
  };
}

export function reportIsolatedGroups(data) {
  const touched = new Set();
  for (const l of data.links) {
    touched.add(l.aUid);
    touched.add(l.bUid);
  }
  const rows = [];
  for (const { institution, group } of allGroups(data)) {
    if (!touched.has(group.uid)) {
      rows.push({ instituce: institution.code, id: groupDisplayId(institution, group), nazev: group.name });
    }
  }
  return {
    id: 'isolatedGroups',
    title: 'Izolované skupiny',
    columns: [
      { key: 'instituce', label: 'Instituce' },
      { key: 'id', label: 'ID skupiny' },
      { key: 'nazev', label: 'Název skupiny' },
    ],
    rows,
  };
}

export function reportGroupsWithoutTopic(data) {
  const rows = [];
  for (const { institution, group } of allGroups(data)) {
    if (group.topicUids.length === 0) {
      rows.push({ instituce: institution.code, id: groupDisplayId(institution, group), nazev: group.name });
    }
  }
  return {
    id: 'groupsWithoutTopic',
    title: 'Skupiny bez tématu',
    columns: [
      { key: 'instituce', label: 'Instituce' },
      { key: 'id', label: 'ID skupiny' },
      { key: 'nazev', label: 'Název skupiny' },
    ],
    rows,
  };
}

// levelMode: 'exact' (jen dané téma) | 'category' (téma je kategorie – agregovaně za podtémata)
// | 'all' (napříč všemi úrovněmi – dané téma + případné podtéma/nadřazené)
export function reportGroupsByTopic(data, topicUid, levelMode = 'all') {
  const topic = data.topics.find((t) => t.uid === topicUid);
  if (!topic) return { id: 'groupsByTopic', title: 'Skupiny a zástupci podle tématu', columns: [], rows: [] };
  let relevantTopicUids;
  if (levelMode === 'exact') {
    relevantTopicUids = new Set([topicUid]);
  } else if (levelMode === 'category') {
    const children = topicChildren(data, topicUid);
    relevantTopicUids = new Set(children.length ? children.map((c) => c.uid) : [topicUid]);
  } else {
    const children = topicChildren(data, topicUid).map((c) => c.uid);
    relevantTopicUids = new Set([topicUid, ...children, ...(topic.parentUid ? [topic.parentUid] : [])]);
  }
  const rows = [];
  for (const { institution, group } of allGroups(data)) {
    if (group.topicUids.some((id) => relevantTopicUids.has(id))) {
      const repsText = group.reps.length
        ? group.reps.map((r) => `${r.name} (${r.role})`).join(', ')
        : '(chybí zástupce)';
      rows.push({
        instituce: institution.code,
        id: groupDisplayId(institution, group),
        nazev: group.name,
        zastupci: repsText,
      });
    }
  }
  return {
    id: 'groupsByTopic',
    title: `Skupiny a zástupci podle tématu: ${topicPath(data, topicUid)}`,
    columns: [
      { key: 'instituce', label: 'Instituce' },
      { key: 'id', label: 'ID skupiny' },
      { key: 'nazev', label: 'Název skupiny' },
      { key: 'zastupci', label: 'Zástupci SŽ' },
    ],
    rows,
  };
}

export function reportLinkList(data, institutionUid) {
  const inst = data.institutions.find((i) => i.uid === institutionUid);
  if (!inst) return { id: 'links', title: 'Vazby', columns: [], rows: [] };
  const groupUids = new Set(inst.groups.map((g) => g.uid));
  const links = data.links.filter((l) => groupUids.has(l.aUid) || groupUids.has(l.bUid));
  const rows = links.map((l) => ({
    id: linkDisplayId(data, l),
    typ: LINK_TYPES[l.type].label,
    a: groupFullLabel(data, l.aUid),
    b: groupFullLabel(data, l.bUid),
    cross: isCrossInstitution(data, l) ? 'ano' : 'ne',
    poznamka: l.note || '',
    uid: l.uid,
  }));
  return {
    id: 'links',
    title: `Vazby – ${inst.code}`,
    columns: [
      { key: 'id', label: 'ID vazby' },
      { key: 'typ', label: 'Typ' },
      { key: 'a', label: 'Skupina A' },
      { key: 'b', label: 'Skupina B' },
      { key: 'cross', label: 'Cross-institucionální' },
      { key: 'poznamka', label: 'Poznámka' },
    ],
    rows,
  };
}

export function ALL_REPORTS(data) {
  return [
    reportInstitutionOverview(data),
    reportMissingReps(data),
    reportMirrorGaps(data),
    reportCrossMatrix(data),
    reportTopicStats(data),
    reportTopicHierarchy(data),
    reportIsolatedGroups(data),
    reportGroupsWithoutTopic(data),
    reportRepDirectory(data),
    reportMailingList(data),
    reportByRole(data),
    reportHistory(data),
  ];
}

// ---- Fulltextové vyhledávání --------------------------------------------

export function searchAll(data, queryRaw) {
  const query = (queryRaw || '').trim().toLowerCase();
  if (!query) return [];
  const results = [];
  for (const { institution, group } of allGroups(data)) {
    const id = groupDisplayId(institution, group);
    if (id.toLowerCase().includes(query) || group.name.toLowerCase().includes(query)) {
      results.push({ kind: 'Skupina', label: `${id} – ${group.name}`, institutionUid: institution.uid, groupUid: group.uid });
    }
    for (const rep of group.reps) {
      if (
        rep.name.toLowerCase().includes(query) ||
        (rep.unit || '').toLowerCase().includes(query) ||
        (rep.email || '').toLowerCase().includes(query) ||
        (rep.phone || '').toLowerCase().includes(query)
      ) {
        results.push({
          kind: 'Zástupce',
          label: `${rep.name} (${rep.unit || '—'}, ${rep.role}) – ${id}`,
          institutionUid: institution.uid,
          groupUid: group.uid,
        });
      }
    }
  }
  for (const t of data.topics) {
    if (t.name.toLowerCase().includes(query)) {
      results.push({ kind: 'Téma', label: topicPath(data, t.uid), topicUid: t.uid });
    }
  }
  for (const l of data.links) {
    const id = linkDisplayId(data, l);
    if (id.toLowerCase().includes(query)) {
      const a = findInstitutionOfGroup(data, l.aUid);
      results.push({ kind: 'Vazba', label: id, institutionUid: a ? a.uid : null, linkUid: l.uid });
    }
  }
  for (const inst of data.institutions) {
    if (inst.name.toLowerCase().includes(query) || inst.code.toLowerCase().includes(query)) {
      results.push({ kind: 'Instituce', label: `${inst.code} – ${inst.name}`, institutionUid: inst.uid });
    }
  }
  return results;
}
