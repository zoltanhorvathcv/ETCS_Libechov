// Datový model appky "Organizační pavouci" (SŽ).
// Zásada: zobrazovaná ID (skupin i vazeb) se NIKDY neukládají – vždy se
// odvozují za běhu z institution.code + group.seq, takže po jakékoli změně
// (přejmenování, přečíslování, smazání) jsou automaticky aktuální všude v appce.

export const BRAND = {
  blue: '#002b59',
  orange: '#ff5200',
  gray: '#737373',
  cyan: '#00a1e0',
  blueLight: '#eef2f6',
  grayLight: '#f4f4f4',
  white: '#ffffff',
};

export const LINK_TYPES = {
  N: { key: 'N', label: 'Běžná vazba', color: BRAND.gray, dash: '' },
  X: { key: 'X', label: 'Cross-institucionální', color: BRAND.orange, dash: '7,5' },
  M: { key: 'M', label: 'Mirror', color: BRAND.cyan, dash: '1,4' },
};

export const ARROW_MODES = {
  none: 'Bez šipky',
  forward: 'Jednosměrná',
  both: 'Obousměrná',
};

export const ROLES = ['vedoucí', 'člen', 'náhradník'];

export const SCHEMA_VERSION = 1;
export const MAX_HISTORY = 50;

let counter = 0;
export function uid(prefix) {
  counter += 1;
  return `${prefix}_${Date.now().toString(36)}${counter.toString(36)}${Math.random().toString(36).slice(2, 6)}`;
}

export function pad2(n) {
  return String(n).padStart(2, '0');
}

export function sanitizeCode(str) {
  return (str || '')
    .toUpperCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^A-Z0-9]/g, '')
    .slice(0, 12);
}

// ---- Odvozená ID -----------------------------------------------------

export function groupDisplayId(institution, group) {
  return `${institution.code}-${pad2(group.seq)}`;
}

export function findInstitutionOfGroup(data, groupUid) {
  return data.institutions.find((inst) => inst.groups.some((g) => g.uid === groupUid));
}

export function findGroup(data, groupUid) {
  for (const inst of data.institutions) {
    const g = inst.groups.find((gg) => gg.uid === groupUid);
    if (g) return { institution: inst, group: g };
  }
  return null;
}

export function groupLabel(data, groupUid) {
  const found = findGroup(data, groupUid);
  if (!found) return '(smazaná skupina)';
  return groupDisplayId(found.institution, found.group);
}

export function groupFullLabel(data, groupUid) {
  const found = findGroup(data, groupUid);
  if (!found) return '(smazaná skupina)';
  return `${groupDisplayId(found.institution, found.group)} – ${found.group.name} (${found.institution.code})`;
}

export function linkDisplayId(data, link) {
  return `${link.type}-${groupLabel(data, link.aUid)}_${groupLabel(data, link.bUid)}`;
}

export function nextGroupSeq(institution) {
  if (!institution.groups.length) return 1;
  return Math.max(...institution.groups.map((g) => g.seq)) + 1;
}

// ---- Tovární funkce ----------------------------------------------------

export function makeInstitution(code, name) {
  return {
    uid: uid('inst'),
    code: sanitizeCode(code) || 'INST',
    name: name || code || 'Nová instituce',
    groups: [],
    frames: [],
  };
}

export function makeGroup(institution, overrides = {}) {
  return {
    uid: uid('grp'),
    seq: nextGroupSeq(institution),
    name: overrides.name || 'Nová skupina',
    x: overrides.x ?? 40,
    y: overrides.y ?? 40,
    w: overrides.w ?? 190,
    h: overrides.h ?? 90,
    frameUid: overrides.frameUid || null,
    reps: overrides.reps || [],
    topicUids: overrides.topicUids || [],
    expectsMirror: overrides.expectsMirror || false,
  };
}

export function makeFrame(overrides = {}) {
  return {
    uid: uid('frm'),
    name: overrides.name || 'Oblast',
    x: overrides.x ?? 20,
    y: overrides.y ?? 20,
    w: overrides.w ?? 420,
    h: overrides.h ?? 260,
  };
}

export function makeTopic(name, parentUid = null) {
  return { uid: uid('top'), name: name || 'Nové téma', parentUid };
}

export function makeLink(type, aUid, bUid, extra = {}) {
  return {
    uid: uid('lnk'),
    type,
    aUid,
    bUid,
    arrow: extra.arrow || 'none',
    note: extra.note || '',
  };
}

export function makeEmptyData() {
  return {
    schemaVersion: SCHEMA_VERSION,
    institutions: [],
    topics: [],
    links: [],
    history: [],
  };
}

// ---- Odvozené kolekce / validace ---------------------------------------

export function allGroups(data) {
  const out = [];
  for (const inst of data.institutions) {
    for (const g of inst.groups) out.push({ institution: inst, group: g });
  }
  return out;
}

export function topicPath(data, topicUid) {
  const topic = data.topics.find((t) => t.uid === topicUid);
  if (!topic) return '(smazané téma)';
  if (topic.parentUid) {
    const parent = data.topics.find((t) => t.uid === topic.parentUid);
    if (parent) return `${parent.name} / ${topic.name}`;
  }
  return topic.name;
}

export function topicChildren(data, parentUid) {
  return data.topics.filter((t) => t.parentUid === parentUid);
}

export function linksForInstitution(data, institutionUid) {
  const inst = data.institutions.find((i) => i.uid === institutionUid);
  if (!inst) return [];
  const groupUids = new Set(inst.groups.map((g) => g.uid));
  return data.links.filter((l) => groupUids.has(l.aUid) || groupUids.has(l.bUid));
}

export function isCrossInstitution(data, link) {
  const a = findInstitutionOfGroup(data, link.aUid);
  const b = findInstitutionOfGroup(data, link.bUid);
  return !!(a && b && a.uid !== b.uid);
}

export function deepClone(obj) {
  return JSON.parse(JSON.stringify(obj));
}

// Smazání skupiny → smaže i vazby, které na ni ukazují, a odebere z frame/topiců.
export function removeGroupCascade(data, groupUid) {
  data.links = data.links.filter((l) => l.aUid !== groupUid && l.bUid !== groupUid);
  for (const inst of data.institutions) {
    inst.groups = inst.groups.filter((g) => g.uid !== groupUid);
  }
}

export function removeInstitutionCascade(data, institutionUid) {
  const inst = data.institutions.find((i) => i.uid === institutionUid);
  if (!inst) return;
  const groupUids = new Set(inst.groups.map((g) => g.uid));
  data.links = data.links.filter((l) => !groupUids.has(l.aUid) && !groupUids.has(l.bUid));
  data.institutions = data.institutions.filter((i) => i.uid !== institutionUid);
}

export function removeTopicCascade(data, topicUid) {
  // odpojit podtémata (posunout je na nejvyšší úroveň) a odebrat přiřazení ze skupin
  for (const t of data.topics) {
    if (t.parentUid === topicUid) t.parentUid = null;
  }
  data.topics = data.topics.filter((t) => t.uid !== topicUid);
  for (const { group } of allGroups(data)) {
    group.topicUids = group.topicUids.filter((id) => id !== topicUid);
  }
}
