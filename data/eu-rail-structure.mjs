// Referenční organizační struktura Europe's Rail (EU-Rail / ERJU) a
// navazujících institucí (RNE, PRIME, RISC, SERAF, ENIM, EULYNX, EUG, ERA,
// DG MOVE), sestavená z podkladu hlubokého výzkumu k datu 2. 9. 2026
// (viz 154a2ed1-zpravahlubokyvyzkum.md).
//
// Tento soubor NEPATŘÍ do zdrojového kódu appky (src/) – je to jen vstup
// pro scripts/merge-eu-rail.mjs, který jej vloží do vygenerovaného
// samostatného HTML, stejně jako scripts/import-zastupci.mjs u zástupců.
// src/seed.js zůstává beze změny (bez organizačních dat).
//
// Vědomě VYNECHÁNO (report je označuje jako nedoložené/zavádějící, a proto
// se nemají zavádět jako rovnocenná fakta):
//   - vazba System Pillar → RISC (nahrazeno řetězcem System Pillar → ERA →
//     DG MOVE → RISC)
//   - vazba RNE Managing Board → System Pillar „přes CEF Technical
//     Assistance" (nahrazeno doloženým MoU RNE–EU-Rail z 30. 5. 2023)
//   - vazba RFC Network → System Pillar „přes CEF Technical Assistance"
//     (report ji také výslovně nedoporučuje zakládat)
//   - uzel „Programme Office" (jen historická role Head of Programme,
//     dnešní samostatný orgán nedoložen)
//   - uzel „Digital Backbone" (není v aktuální task/domain mapě System
//     Pillar 2026), a ze stejného důvodu ani „Rolling Stock" a „Energy"
//   - pevná šestice Flagship Projects FP1–FP6 (projektová struktura se
//     mění, report doporučuje jen node „Innovation Pillar")
//   - historické PRIME subgroups Financing / Implementing Acts / Safety
//     Culture (aktuální web PRIME uvádí jen tři: Digital Solutions,
//     Charges, KPIs & Benchmarking)
//   - vazba PRIME Plenary → RNE General Assembly jako hierarchie (nahrazeno
//     přesnější PRIME Plenary → RNE Network Coordinator Project, „navrhlo",
//     ne „jmenovalo")

// ---------------------------------------------------------------------
// Nové skupiny podle instituce (klíč = kód instituce, jak už existuje v
// appce po importu zástupců). `parent` je jen nápověda pro výchozí
// rozložení (hloubka stromu) – skutečné vazby jsou v RELATIONS níže a
// mohou mít i jiný směr, než sugeruje `parent`.
export const NEW_GROUPS = {
  ERJU: [
    // -- institucionální governance --------------------------------------
    { slug: 'gb', name: 'Governing Board' },
    { slug: 'ga', name: 'General Assembly', parent: 'gb' },
    { slug: 'srg', name: 'States Representatives Group' },
    { slug: 'ssg', name: 'Scientific Steering Group (max. 12 členů)', parent: 'gb' },
    { slug: 'ed', name: 'Executive Director' },
    { slug: 'sipb', name: 'ED – System Innovation Programme Board', parent: 'ed' },
    // -- System Pillar -----------------------------------------------------
    { slug: 'sp', name: 'System Pillar' },
    { slug: 'spsg', name: 'System Pillar Steering Group', parent: 'sp' },
    { slug: 'spu', name: 'System Pillar Unit', parent: 'ed' },
    { slug: 'cg', name: 'System Pillar Core Group', parent: 'spu' },
    { slug: 't1', name: 'Task 1 – Railway System', parent: 'cg' },
    { slug: 't2', name: 'Task 2 – CCS', parent: 'cg' },
    { slug: 'arc', name: 'Architecture and Release Coordination (ARC)', parent: 't2' },
    { slug: 'od', name: 'Operational Harmonisation (OD)', parent: 't2' },
    { slug: 'trafficcs', name: 'Traffic Control and Supervision (Traffic CS)', parent: 't2' },
    { slug: 'traincs', name: 'Train Control & Supervision (Train CS)', parent: 't2' },
    { slug: 'tacs', name: 'Trackside Assets Control & Supervision (TACS)', parent: 't2' },
    { slug: 'conemp', name: 'CONEMP', parent: 't2' },
    { slug: 't3', name: 'Task 3 – TMS & CMS', parent: 'cg' },
    { slug: 't4', name: 'Task 4 – DAC/FDFTO', parent: 'cg' },
    { slug: 't5', name: 'Task 5 – Harmonised Diagnostics', parent: 'cg' },
    { slug: 'ee', name: 'Engineering Environment Team', parent: 'cg' },
    { slug: 'prams', name: 'PRAMS', parent: 'cg' },
    { slug: 'security', name: 'Security', parent: 'cg' },
    { slug: 'tsimaint', name: 'CCS TSI Maintenance Activities', parent: 'cg' },
    // -- Innovation Pillar a Deployment -------------------------------------
    { slug: 'ip', name: 'Innovation Pillar' },
    { slug: 'dg', name: 'Deployment Group' },
    { slug: 'hldg', name: 'High-Level Deployment Group', parent: 'dg' },
    { slug: 'frmcsdg', name: 'FRMCS European Deployment Group', parent: 'dg' },
    { slug: 'dacdg', name: 'DAC Deployment Group', parent: 'dg' },
  ],
  RNE: [
    { slug: 'jointoffice', name: 'RNE Joint Office' },
    { slug: 'hlg_rfc', name: 'RFC High Level Group' },
    { slug: 'hlg_it', name: 'IT High Level Group' },
    { slug: 'hlg_capacity', name: 'Capacity Management High Level Group' },
    { slug: 'hlg_traffic', name: 'Traffic Management High Level Group' },
    { slug: 'nccp', name: 'RNE Network Coordinator Project' },
  ],
  PRIME: [
    { slug: 'plenary', name: 'PRIME Plenary' },
    { slug: 'digital', name: 'PRIME – Digital Solutions', parent: 'plenary' },
    { slug: 'charges', name: 'PRIME – Charges', parent: 'plenary' },
    { slug: 'kpis', name: 'PRIME – KPIs & Benchmarking', parent: 'plenary' },
    { slug: 'eg', name: 'PRIME Commission Expert Group E02983' },
  ],
  RFC: [{ slug: 'network', name: 'RFC Network' }],
  EUG: [{ slug: 'anchor', name: 'ERTMS Users Group (EUG)' }],
  EULYNX: [{ slug: 'anchor', name: 'EULYNX' }],
  RISC: [{ slug: 'committee', name: 'RISC Committee (registr Komise C08000)' }],
  ERA: [{ slug: 'authority', name: 'ERA – System Authority (ERTMS / telematické aplikace)' }],
  EC: [{ slug: 'dgmove', name: 'DG MOVE – Directorate-General for Mobility and Transport' }],
};

// Drobná oprava názvu instituce z původního importu (oficiální název dle
// výzkumu je „Railway…", ne „Rail…").
export const INSTITUTION_NAME_FIXES = {
  RISC: 'Railway Interoperability and Safety Committee',
};

// ---------------------------------------------------------------------
// Vazby. `a`/`b` je buď { code, slug } (nově přidaná skupina výše), nebo
// { code, existing: 'přesný název' } (skupina, která v appce už existuje –
// typicky z importu zástupců). Typ N/X přebírá klasifikaci z výzkumu:
// N = organizační/interní vztah, X = doložený vztah, který ale není
// hierarchií (členství, observer, MoU, spolupředsednictví…).
export const RELATIONS = [
  // ---- ERJU: institucionální governance --------------------------------
  {
    a: { code: 'ERJU', slug: 'gb' },
    b: { code: 'ERJU', slug: 'ga' },
    type: 'N',
    lineStyle: 'elbow',
    note: 'Governing Board se jednou ročně schází v rozšířeném formátu General Assembly (Single Basic Act 2021/2085) – nejde o podřízenou strukturu.',
  },
  {
    a: { code: 'ERJU', slug: 'gb' },
    b: { code: 'ERJU', slug: 'ssg' },
    type: 'N',
    lineStyle: 'elbow',
    note: 'Členy Scientific Steering Group (max. 12) jmenuje Governing Board.',
  },
  {
    a: { code: 'ERJU', slug: 'ed' },
    b: { code: 'ERJU', slug: 'sipb' },
    type: 'N',
    lineStyle: 'elbow',
    note: '',
  },
  {
    a: { code: 'ERJU', slug: 'ed' },
    b: { code: 'ERJU', slug: 'spu' },
    type: 'N',
    lineStyle: 'elbow',
    note: 'System Pillar Unit vede práci pod Executive Director.',
  },
  // ---- ERJU: System Pillar ----------------------------------------------
  {
    a: { code: 'ERJU', slug: 'sp' },
    b: { code: 'ERJU', slug: 'spsg' },
    type: 'N',
    lineStyle: 'straight',
    note: 'Steering Group funguje jako poradní governance mechanismus System Pillar.',
  },
  {
    a: { code: 'ERJU', slug: 'spu' },
    b: { code: 'ERJU', slug: 'cg' },
    type: 'N',
    lineStyle: 'straight',
    note: 'System Pillar Unit koordinuje technickou práci Core Group.',
  },
  { a: { code: 'ERJU', slug: 'cg' }, b: { code: 'ERJU', slug: 't1' }, type: 'N', lineStyle: 'elbow', note: '' },
  { a: { code: 'ERJU', slug: 'cg' }, b: { code: 'ERJU', slug: 't2' }, type: 'N', lineStyle: 'elbow', note: '' },
  { a: { code: 'ERJU', slug: 'cg' }, b: { code: 'ERJU', slug: 't3' }, type: 'N', lineStyle: 'elbow', note: '' },
  { a: { code: 'ERJU', slug: 'cg' }, b: { code: 'ERJU', slug: 't4' }, type: 'N', lineStyle: 'elbow', note: '' },
  { a: { code: 'ERJU', slug: 'cg' }, b: { code: 'ERJU', slug: 't5' }, type: 'N', lineStyle: 'elbow', note: '' },
  { a: { code: 'ERJU', slug: 'cg' }, b: { code: 'ERJU', slug: 'ee' }, type: 'N', lineStyle: 'elbow', note: '' },
  { a: { code: 'ERJU', slug: 'cg' }, b: { code: 'ERJU', slug: 'prams' }, type: 'N', lineStyle: 'elbow', note: '' },
  { a: { code: 'ERJU', slug: 'cg' }, b: { code: 'ERJU', slug: 'security' }, type: 'N', lineStyle: 'elbow', note: '' },
  {
    a: { code: 'ERJU', slug: 'cg' },
    b: { code: 'ERJU', slug: 'tsimaint' },
    type: 'N',
    lineStyle: 'elbow',
    note: 'Řeší chyby aktuální CCS TSI, převádí vylepšení do ERA Change Control Management a podporuje začlenění FRMCS specifikací do budoucích CCS TSI.',
  },
  { a: { code: 'ERJU', slug: 't2' }, b: { code: 'ERJU', slug: 'arc' }, type: 'N', lineStyle: 'elbow', note: '' },
  { a: { code: 'ERJU', slug: 't2' }, b: { code: 'ERJU', slug: 'od' }, type: 'N', lineStyle: 'elbow', note: '' },
  { a: { code: 'ERJU', slug: 't2' }, b: { code: 'ERJU', slug: 'trafficcs' }, type: 'N', lineStyle: 'elbow', note: '' },
  { a: { code: 'ERJU', slug: 't2' }, b: { code: 'ERJU', slug: 'traincs' }, type: 'N', lineStyle: 'elbow', note: '' },
  {
    a: { code: 'ERJU', slug: 't2' },
    b: { code: 'ERJU', slug: 'tacs' },
    type: 'N',
    lineStyle: 'elbow',
    note: 'Hlavní bod technické vazby s EULYNX (viz níže).',
  },
  { a: { code: 'ERJU', slug: 't2' }, b: { code: 'ERJU', slug: 'conemp' }, type: 'N', lineStyle: 'elbow', note: '' },
  {
    a: { code: 'ERJU', slug: 'sp' },
    b: { code: 'ERJU', slug: 'ip' },
    type: 'N',
    lineStyle: 'straight',
    note: 'Formální pracovní rozhraní mezi pilíři (architektura, systémoví experti, sladění specifikací) – nejde o hierarchii.',
  },
  // ---- ERJU: Deployment ---------------------------------------------------
  {
    a: { code: 'ERJU', slug: 'dg' },
    b: { code: 'ERJU', slug: 'gb' },
    type: 'N',
    lineStyle: 'straight',
    note: 'Deployment Group má poradní roli vůči Governing Board (market uptake, deployment).',
  },
  { a: { code: 'ERJU', slug: 'dg' }, b: { code: 'ERJU', slug: 'hldg' }, type: 'N', lineStyle: 'elbow', note: '' },
  { a: { code: 'ERJU', slug: 'dg' }, b: { code: 'ERJU', slug: 'frmcsdg' }, type: 'N', lineStyle: 'elbow', note: '' },
  { a: { code: 'ERJU', slug: 'dg' }, b: { code: 'ERJU', slug: 'dacdg' }, type: 'N', lineStyle: 'elbow', note: '' },
  {
    a: { code: 'ERJU', slug: 'frmcsdg' },
    b: { code: 'ERJU', existing: 'ERJU – Deployment Group FRMCS Subgroup' },
    type: 'N',
    lineStyle: 'straight',
    note: 'Existující SŽ-importovaná skupina; vztah k aktuální FRMCS European Deployment Group je třeba dále ověřit (viz výzkum) – ponecháno jako navazující uzel, ne automaticky sloučeno.',
  },

  // ---- ERA, Komise a RISC --------------------------------------------------
  {
    a: { code: 'EC', slug: 'dgmove' },
    b: { code: 'ERJU', slug: 'spsg' },
    type: 'X',
    lineStyle: 'straight',
    note: 'Komise (DG MOVE) System Pillar Steering Group předsedá.',
  },
  {
    a: { code: 'ERA', slug: 'authority' },
    b: { code: 'ERJU', slug: 'spsg' },
    type: 'X',
    lineStyle: 'straight',
    note: 'ERA je explicitní member/participant, systémová autorita pro ERTMS a telematické aplikace.',
  },
  {
    a: { code: 'EUG', slug: 'anchor' },
    b: { code: 'ERJU', slug: 'spsg' },
    type: 'X',
    lineStyle: 'straight',
    note: 'ERTMS Users Group je technický observer v System Pillar Steering Group.',
  },
  {
    a: { code: 'RNE', existing: 'RNE Managing Board' },
    b: { code: 'ERJU', slug: 'spsg' },
    type: 'X',
    lineStyle: 'straight',
    note: 'RNE je observer v System Pillar Steering Group.',
  },
  {
    a: { code: 'ERJU', slug: 'sp' },
    b: { code: 'ERA', slug: 'authority' },
    type: 'X',
    lineStyle: 'straight',
    note: 'ERA hodnotí výstupy System Pillar (interoperabilita, bezpečnost, security) a předává závěry/doporučení Komisi.',
  },
  {
    a: { code: 'ERA', slug: 'authority' },
    b: { code: 'EC', slug: 'dgmove' },
    type: 'X',
    lineStyle: 'straight',
    note: 'Technický vstup/doporučení pro specification management a proces TSI (System Pillar → ERA → DG MOVE → RISC).',
  },
  {
    a: { code: 'EC', slug: 'dgmove' },
    b: { code: 'RISC', slug: 'committee' },
    type: 'X',
    lineStyle: 'straight',
    note: 'Komise vede komitologický proces – RISC hlasuje o návrzích TSI/CSM/CSI/CST, které předkládá Komise.',
  },

  // ---- EULYNX ---------------------------------------------------------------
  {
    a: { code: 'EULYNX', slug: 'anchor' },
    b: { code: 'ERJU', slug: 'tacs' },
    type: 'X',
    lineStyle: 'straight',
    note: 'Společné specifikace TACS/EULYNX (Trackside Assets); práce integrována pod technickou koordinaci System Pillar.',
  },

  // ---- RNE interní ------------------------------------------------------
  {
    a: { code: 'RNE', existing: 'RNE General Assembly' },
    b: { code: 'RNE', existing: 'RNE Managing Board' },
    type: 'N',
    lineStyle: 'straight',
    note: 'Managing Board připravuje rozhodnutí General Assembly a dohlíží na standing/ad-hoc groups.',
  },
  {
    a: { code: 'RNE', existing: 'RNE Managing Board' },
    b: { code: 'RNE', slug: 'jointoffice' },
    type: 'N',
    lineStyle: 'elbow',
    note: 'Joint Office (Vídeň) řídí každodenní agendu, working groups, boards, HLG a IT systémy pod dohledem Managing Board.',
  },
  {
    a: { code: 'RNE', slug: 'hlg_rfc' },
    b: { code: 'RNE', existing: 'RNE Managing Board' },
    type: 'N',
    lineStyle: 'elbow',
    note: 'RFC HLG posiluje zapojení corridor organisations do RNE governance.',
  },
  {
    a: { code: 'RNE', slug: 'hlg_it' },
    b: { code: 'RNE', existing: 'RNE Managing Board' },
    type: 'N',
    lineStyle: 'elbow',
    note: '',
  },
  {
    a: { code: 'RNE', slug: 'hlg_capacity' },
    b: { code: 'RNE', existing: 'RNE Managing Board' },
    type: 'N',
    lineStyle: 'elbow',
    note: 'Vytváří strategický rámec, posuzuje a endorsuje výstupy operační úrovně, připravuje podklady pro Managing Board a General Assembly.',
  },
  {
    a: { code: 'RNE', slug: 'hlg_traffic' },
    b: { code: 'RNE', existing: 'RNE Managing Board' },
    type: 'N',
    lineStyle: 'elbow',
    note: '',
  },
  // ---- RNE ↔ EU-Rail (MoU 30. 5. 2023) ------------------------------------
  {
    a: { code: 'RNE', existing: 'RNE Managing Board' },
    b: { code: 'ERJU', slug: 'sp' },
    type: 'X',
    lineStyle: 'straight',
    note: 'MoU RNE–EU-Rail z 30. 5. 2023: System Pillar, Flagship Areas, capacity allocation, traffic management, data, IT architektura, digitalizace.',
  },
  {
    a: { code: 'RNE', existing: 'RNE Managing Board' },
    b: { code: 'ERJU', slug: 'ip' },
    type: 'X',
    lineStyle: 'straight',
    note: 'MoU 30. 5. 2023 výslovně jmenuje Flagship Area 1 a Flagship Area 5.',
  },
  // ---- RFC Network -----------------------------------------------------
  {
    a: { code: 'RFC', existing: 'RFC 5' },
    b: { code: 'RFC', slug: 'network' },
    type: 'N',
    lineStyle: 'elbow',
    note: 'RFC Network tvoří Managing Directors a Chairpersons všech RFC spolu s C-OSS Community speakerem, zástupcem RNE Corridor Management a RFC Network Assistant.',
  },
  {
    a: { code: 'RFC', existing: 'RFC 9' },
    b: { code: 'RFC', slug: 'network' },
    type: 'N',
    lineStyle: 'elbow',
    note: '',
  },
  {
    a: { code: 'RFC', slug: 'network' },
    b: { code: 'RNE', slug: 'hlg_rfc' },
    type: 'N',
    lineStyle: 'straight',
    note: 'Koordinační/governance rozhraní RNE Corridor Management.',
  },

  // ---- PRIME interní ------------------------------------------------------
  { a: { code: 'PRIME', slug: 'plenary' }, b: { code: 'PRIME', slug: 'digital' }, type: 'N', lineStyle: 'elbow', note: '' },
  { a: { code: 'PRIME', slug: 'plenary' }, b: { code: 'PRIME', slug: 'charges' }, type: 'N', lineStyle: 'elbow', note: '' },
  { a: { code: 'PRIME', slug: 'plenary' }, b: { code: 'PRIME', slug: 'kpis' }, type: 'N', lineStyle: 'elbow', note: '' },
  {
    a: { code: 'PRIME', slug: 'eg' },
    b: { code: 'EC', slug: 'dgmove' },
    type: 'N',
    lineStyle: 'straight',
    note: 'Formální Commission Expert Group; plní úkoly pro Komisi při přípravě delegated acts a legislativních návrhů.',
  },
  {
    a: { code: 'PRIME', slug: 'eg' },
    b: { code: 'PRIME', slug: 'plenary' },
    type: 'X',
    lineStyle: 'straight',
    note: 'Koordinuje/debriefuje PRIME, ale institucionálně a právně na něm není závislá (E02983 je samostatná Commission Expert Group).',
  },
  // ---- RNE ↔ PRIME --------------------------------------------------------
  {
    a: { code: 'RNE', existing: 'RNE Managing Board' },
    b: { code: 'PRIME', slug: 'plenary' },
    type: 'X',
    lineStyle: 'straight',
    note: 'RNE je observer v PRIME.',
  },
  {
    a: { code: 'RNE', existing: 'RNE Managing Board' },
    b: { code: 'PRIME', slug: 'digital' },
    type: 'X',
    lineStyle: 'straight',
    note: 'RNE spolupředsedá PRIME Digital Solutions.',
  },
  {
    a: { code: 'EC', slug: 'dgmove' },
    b: { code: 'PRIME', slug: 'digital' },
    type: 'X',
    lineStyle: 'straight',
    note: 'DG MOVE spolupředsedá PRIME Digital Solutions spolu s RNE.',
  },

  // ---- SERAF ---------------------------------------------------------------
  {
    a: { code: 'SERAF', existing: 'SERAF' },
    b: { code: 'EC', slug: 'dgmove' },
    type: 'N',
    lineStyle: 'straight',
    note: 'Expert group založená DG MOVE; v září 2022 přejmenována z „Commission Expert Group on Rail Market Access“ na SERAF.',
  },

  // ---- ENIM a Network Coordinator ------------------------------------------
  {
    a: { code: 'PRIME', slug: 'plenary' },
    b: { code: 'RNE', slug: 'nccp' },
    type: 'X',
    lineStyle: 'straight',
    note: 'PRIME Plenary 28. 11. 2024 navrhlo RNE jako budoucí Network Coordinator; nejde o formální jmenování.',
  },
  {
    a: { code: 'RNE', existing: 'RNE General Assembly' },
    b: { code: 'RNE', slug: 'nccp' },
    type: 'N',
    lineStyle: 'straight',
    note: 'Interní příprava RNE na roli Network Coordinator (od General Assembly 12/2023).',
  },
  {
    a: { code: 'ENIM', existing: 'ENIM' },
    b: { code: 'RNE', slug: 'nccp' },
    type: 'X',
    lineStyle: 'straight',
    note: 'Právní governance role dle nařízení (EU) 2026/1184; finální designace RNE z dostupných zdrojů k 2. 9. 2026 nezjištěna.',
  },
];
