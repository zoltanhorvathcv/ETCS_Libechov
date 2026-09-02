# Organizační pavouci (SŽ) – kompletní dokumentace

Vývojářská a uživatelská dokumentace aplikace pro tvorbu a editaci
organizačních pavouků mezinárodních institucí a pracovních skupin Správy
železnic.

Tento dokument je psaný tak, aby stačil jako jediný vstup pro pokračování
vývoje – včetně toho, proč jsou věci udělané tak, jak jsou, a kde jsou
zrádná místa. Uživatelský rychlý start je v [`README.md`](README.md),
pracovní instrukce pro AI agenta v [`AGENTS.md`](AGENTS.md).

---

## 1. Co to je a jaká omezení z toho plynou

Aplikace je **jeden samostatný soubor `index.html`**. Uvnitř něj jsou
vložené styly, celý aplikační kód, exportní knihovny i **veškerá data**.

- **Bez serveru, bez backendu, bez databáze, bez přihlašování.**
- **Funguje offline** – otevře se dvojklikem nebo ze SharePoint knihovny.
- **Sdílení je manuální**: uživatel klikne „Uložit / exportovat appku“,
  stáhne si nový `index.html` s aktuálními daty a ten nahraje zpět do
  sdílené knihovny. Aplikace nemá žádné napojení na server, takže
  souběžnou editaci více lidí neřeší a řešit v tomto modelu nemůže.

Z toho plyne několik důsledků, se kterými je nutné počítat při každé další
funkci:

| Důsledek | Co to znamená pro vývoj |
|---|---|
| Data jsou v HTML | Každý „uložit“ = vygenerování celého nového souboru. |
| Žádný build u uživatele | Vše musí být v jednom souboru, žádné CDN ani `fetch`. |
| Žádná autorizace | Historie verzí eviduje jméno editora jen jako text, nic se neověřuje. |
| localStorage je jen pojistka | Je vázaný na origin (`file://` cestu), nepřenáší se mezi počítači. |

### Velikost

Výsledný `index.html` má ~1 MB. Naprostou většinu tvoří vendorované
knihovny `xlsx-js-style` a `pptxgenjs`. Vlastní aplikační kód je ~3 600
řádků zdroje.

---

## 2. Sestavení a struktura repozitáře

```bash
npm install
npm run build      # = node build.js → vygeneruje index.html v kořeni
```

```
build.js              sestavení jednosouborové appky
index.html            SESTAVENÝ VÝSTUP – commitovaný, je to dodávaný artefakt
package.json          jen devDependencies (esbuild, xlsx-js-style, pptxgenjs)
src/
  main.js             vstupní bod (bootstrap store + mount UI)
  model.js            datový model, továrny, odvozování ID, kaskádní mazání
  store.js            načtení/uložení dat, historie verzí, export HTML appky
  canvas.js           SVG editor plátna (třída SpiderCanvas + geometrie)
  ui.js               aplikační shell, navigace, všechny formuláře a pohledy
  reports.js          výpočet přehledů a fulltextové vyhledávání
  exports.js          export SVG/PNG/PPTX/XLSX a tisk do PDF
  seed.js             výchozí sada institucí
  styles.css          veškeré styly (i pro SVG popisky)
scripts/
  codex-setup.sh      příprava prostředí (závislosti + prohlížeč pro testy)
  import-zastupci.mjs převod podkladu se zástupci SŽ do datového souboru appky
  merge-eu-rail.mjs   vloží referenční strukturu EU-Rail (data/eu-rail-structure.mjs)
                      do AppData sestaveného importem zástupců – volá ho
                      import-zastupci.mjs automaticky
data/
  eu-rail-structure.mjs  referenční organizační data EU-Rail/ERJU, RNE, PRIME,
                          RISC, SERAF, ENIM, EULYNX, EUG, ERA, DG MOVE (ne
                          osobní údaje – jen názvy skupin a vazby, se zdrojem
                          v poznámce u každé vazby)
test/smoke.mjs        kouřový test sestavené appky (npm run smoke)
DOKUMENTACE.md        tento dokument
AGENTS.md             instrukce pro AI agenta (Codex)
README.md             uživatelský rychlý start
```

> **`index.html` je commitovaný záměrně.** Je to finální produkt, který se
> kopíruje do SharePointu. Po každé změně v `src/` je nutné spustit
> `npm run build` a commitnout i `index.html`, jinak se změna k uživateli
> nedostane.

### Jak build funguje (`build.js`)

1. `esbuild` sbalí `src/main.js` do jednoho IIFE (bez minifikace – kvůli
   čitelnosti při ladění přímo v prohlížeči).
2. `src/seed.js` se **zvlášť** sbalí do CommonJS a spustí v Node, aby se
   výchozí data spočítala týmž kódem, jakým je počítá aplikace. (Proto
   `model.js` ani `seed.js` nesmí sáhnout na `document`/`window`.)
3. Načtou se hotové prohlížečové bundly knihoven z `node_modules`.
4. Vše se vloží do HTML šablony do prvků s pevnými ID:
   `<style id="app-style">`, `<script id="seed-data">` (JSON),
   `<script id="app-libs">`, `<script id="app-code">`.

> ⚠️ **Zrádné místo:** minifikované knihovny obsahují řetězce, které
> vypadají jako `</script`. Proto všechno prochází `escForInlineScript()`.
> Kdyby se to vynechalo, soubor se rozpadne uprostřed knihovny a
> v konzoli se objeví `Unexpected end of input`. Stejný escape musí
> používat i `store.js` při generování exportu.

---

## 3. Datový model (`src/model.js`)

```js
AppData = {
  schemaVersion: 1,
  institutions: [Institution],
  topics: [Topic],
  links: [Link],          // POZOR: vazby jsou globální, ne uvnitř institucí
  history: [Version],
}

Institution = { uid, code, name, groups: [Group], frames: [Frame] }

Group = {
  uid, seq,               // seq = pořadové číslo pro odvození ID
  name, x, y, w, h,
  frameUid,               // volitelné zařazení do rámečku
  reps: [{ name, unit, role, email, phone }],  // role: vedoucí | člen | náhradník
  topicUids: [uid],
  expectsMirror: bool,    // podklad pro přehled „mirror páry bez protějšku“
}

Frame = {
  uid, name, x, y, w, h,
  institutionRefUid,      // != null → rámeček je navigační odkaz na jinou instituci
}

Topic = { uid, name, parentUid }   // max. dvě úrovně

Link = {
  uid, type,              // 'N' běžná | 'X' cross-institucionální | 'M' mirror
  aUid, bUid,             // VŽDY uid skupin, nikdy institucí
  arrow,                  // 'none' | 'forward' | 'both'
  note,
  lineStyle,              // 'straight' | 'elbow'
  bEndOffset,             // ruční posun konce vazby na boxu B (px podél hrany)
  stubOffsetA/stubOffsetB,// ruční posun štítku cross-inst. pahýlu {dx,dy}
  labelOffset,            // ruční poloha ID štítku podél čáry (0..1), null = auto
}
```

### Zásada: zobrazovaná ID se NIKDY neukládají

`CER-04` ani `N-CER-04_CER-10` nejsou v datech. Odvozují se za běhu:

```js
groupDisplayId(inst, group)  // `${inst.code}-${pad2(group.seq)}`
linkDisplayId(data, link)    // `${link.type}-${idA}_${idB}`
```

Díky tomu jsou ID po přejmenování instituce, přečíslování nebo smazání
skupiny automaticky aktuální všude – na plátně, v přehledech i v
exportech. **Tuto zásadu neporušujte** – jakékoli uložené ID by se
rozešlo s realitou.

### Kaskády

`removeGroupCascade`, `removeInstitutionCascade`, `removeTopicCascade`
uklízejí odkazy (vazby na smazanou skupinu, `institutionRefUid` na
smazanou instituci, `topicUids` na smazané téma). Při přidání nového typu
odkazu mezi entitami je nutné kaskádu rozšířit.

---

## 4. Ukládání a historie (`src/store.js`)

### Tři vrstvy dat

1. **Seed v souboru** – `<script id="seed-data">` v `index.html`. To je
   „pravda“, kterou uživatel dostal.
2. **localStorage koncept** (`pavouci_draft_v1`) – autosave po každé
   změně, jen jako pojistka proti zavření karty. Při startu se nabídne
   obnovení, pokud je koncept novější než poslední verze v historii seedu.
3. **Historie verzí** – posledních `MAX_HISTORY` (50) snapshotů uvnitř
   dat, s časem, volitelným jménem editora a popisem změny. Rollback
   obnoví snapshot a zaznamená to jako novou verzi (historie se nemaže).

### `store.commit(summary, mutateFn)`

**Každá změna dat musí jít přes `commit`.** Ten provede mutaci, uloží
snapshot do historie, ořízne historii na 50 položek a notifikuje UI.
Přímá mutace `store.data` mimo `commit` se neuloží do historie ani
nespustí překreslení.

Výjimka: `canvas.js` během tažení myší mutuje geometrii přímo (kvůli
plynulosti) a `commit` zavolá až přes callback na `mouseup`.

### Export appky (`exportHtmlString`)

Přečte **z živého DOMu** obsah `#app-style`, `#app-libs` a `#app-code` a
složí nový HTML soubor s čerstvým JSON seedem. Nic se nestahuje a nic se
needuplikuje – appka doslova přepisuje sama sebe.

---

## 5. Plátno (`src/canvas.js`)

Třída `SpiderCanvas` – SVG editor s pan/zoom, drag & drop a vlastní
geometrií vazeb. Komunikuje s UI výhradně přes callbacky předané v
konstruktoru:

```
onSelect, onChangeGeometry, onChangeLinkOffset, onChangeStubOffset,
onChangeLabelOffset, onJumpToGroup, onJumpToInstitution, onAddGroupAt,
onZoomChange
```

### Vrstvy (pořadí = pořadí vykreslení)

```
viewport
 ├─ layer-frames    rámečky oblastí (i odkazy na instituce)
 ├─ layer-links     čáry vazeb
 ├─ layer-groups    boxy skupin
 └─ layer-handles   úchyty a ID štítky vazeb
```

> ⚠️ **Proč je `layer-handles` nejvýš:** úchyt konce vazby leží přesně na
> hraně boxu. Kdyby byl ve vrstvě vazeb, box (kreslený později) by ho
> v hit-testingu myši překryl a nešel by chytit. Stejně tak ID štítek
> vazby. Nová interaktivní grafika u boxů patří sem.

### Geometrie vazeb

| Funkce | K čemu |
|---|---|
| `linkGeometry(link, a, b)` | vrátí lomenou čáru jako pole bodů – `[p1,p2]` u rovné, `[p1,nub,bend,p2]` u lomené |
| `rectBorderPoint(rect, toward)` | průsečík paprsku ze středu s hranou boxu (rovné čáry, pahýly) |
| `elbowEdgePoint(rect, toward)` | **vždy** střed levé/pravé hrany + `dir` (lomené čáry) |
| `applyEndOffset(rect, point, px)` | posun konce podél hrany + ořez, vrací i `axis` pro úchyt |
| `pointAtT` / `closestTOnPolyline` | poloha ID štítku podél čáry a zpětná projekce myši |
| `fitToView(insets)` | přizpůsobení oknu s ohledem na okraje zakryté plovoucími lištami |

> ⚠️ **Proč `elbowEdgePoint` a ne `rectBorderPoint` pro lomené čáry:**
> u cíle hodně nad/pod zdrojem by paprsek vyšel horní/dolní hranou a
> svislá páteř by pak vedla středem sloupce a křížila sousední boxy.
>
> ⚠️ **Proč „nub“ (`ELBOW_STUB_GAP = 22`):** bez krátkého vodorovného
> výstupku sedí páteř přesně na hraně boxu a splývá s okrajem sousedních
> boxů ve stejném sloupci – nejde poznat, ze kterého boxu vazby vychází.

### Ruční úpravy vs. automatika

Uživatel může ručně posunout **jen** to, co nemůže rozbít čitelnost
vzoru:

- konec vazby na boxu B (`bEndOffset`) – zdrojový konec a trasa zůstávají
  automatické, takže společnou páteř nejde „utrhnout“;
- štítek cross-institucionálního pahýlu (`stubOffsetA`/`B`) – zvlášť pro
  pohled z každé instituce, protože rozložení boxů je jinde jiné;
- polohu ID štítku podél čáry (`labelOffset`).

Každý z nich má ve formuláři vazby tlačítko pro návrat na automatiku.
`null`/`0` vždy znamená „automaticky“.

### Cross-institucionální vazby

Vazba mířící mimo aktuálně zobrazený pavouk se kreslí jako **pahýl** –
krátká čára z boxu do štítku s cílem, klik = přeskočení do druhé
instituce. Více pahýlů z jedné skupiny se automaticky rozprostře do
vějíře (`stubIndexByGroup`, úhel −20° − *i*·50°), aby se štítky
nepřekrývaly.

---

## 6. Uživatelské rozhraní (`src/ui.js`)

Jeden modul, žádný framework – přímá manipulace s DOM, překreslování
celých sekcí přes `innerHTML` + navěšení posluchačů.

### Tok překreslení

```
store.commit → store.emit → onStoreChange
   ├─ rychlá cesta: stejný editor → jen setData + panel + toolbar
   └─ fullRender:   přestavba view-root podle store.selection.view
```

`renderEditorView` má navíc **recyklaci plátna**: pokud `#editor-shell`
už v DOMu je, jen se do plátna načtou data jiné instituce.

> ⚠️ **Proč recyklace:** fullscreen prohlížeče je vázaný na konkrétní
> element. Přestavba DOMu ho shodí, takže by přepnutí instituce vyhodilo
> uživatele z režimu celé obrazovky. Jakákoli nová cesta, která přestavuje
> `#editor-shell`, musí tuto výjimku respektovat.

### Pohledy

`dashboard` (přehled institucí) · `editor` (plátno) · `topics` (registr
témat) · `reports` (přehledy) · `history` (verze). Přepíná se přes
`store.selection.view`, navigace přes `navigate({...})`.

### Režim celé obrazovky a sbalitelné lišty

- Fullscreen API prohlížeče na `#editor-shell`, se záložní CSS variantou
  (`.is-fullscreen-fallback`, `position: fixed`) tam, kde je API zakázané
  (např. vnořený iframe).
- V režimu se lišta nástrojů a postranní panel stanou překryvnými panely
  nad plátnem (`.is-fullscreen` v `styles.css`).
- Sbalení panelu (`panel-collapsed`) a lišty (`toolbar-collapsed`) funguje
  i v běžném režimu; stav se pamatuje v localStorage pod
  `pavouci_view_prefs` – je to nastavení pohledu, **ne obsahu**, takže do
  dat pavouka nepatří.

---

## 7. Přehledy (`src/reports.js`)

Každý report vrací jednotný tvar, aby ho šlo stejně vykreslit i
exportovat:

```js
{ id, title, columns: [{ key, label }], rows: [{...}], matrix? }
```

Dostupné: chybějící zástupci, mirror páry bez protějšku, matice
cross-institucionálních vazeb, statistika a hierarchie témat, přehled
podle institucí, adresář zástupců, kontaktní list pro rozesílku, podle
rolí, izolované skupiny, skupiny bez tématu, skupiny podle tématu, seznam
vazeb, historie verzí. Plus `searchAll` pro fulltext v horní liště (hledá
i podle e-mailu a telefonu).

**Kontaktní list pro rozesílku** (`reportMailingList`) uvádí každou osobu
jednou, s kontaktem a výčtem skupin, ve kterých je – nahrazuje ruční
mailing listy vedené dřív v excelu. Kontakt se doplní z libovolného
výskytu osoby, protože v podkladech bývá vyplněný jen u některého.

**Matice cross-institucionálních vazeb** počítá všechny vazby, které
reálně překračují hranici institucí (`isCrossInstitution`), ne jen typ
`X`, rozlišuje v buňkách typ vazby a zobrazuje jen instituce, které
alespoň jednu takovou vazbu mají.

---

## 8. Exporty (`src/exports.js`)

| Formát | Jak |
|---|---|
| SVG | klon plátna, `applyInlineStyles()` vepíše styly do elementů (bez `<style>` by export přišel o typografii), úchyty se odstraní |
| PNG | rasterizace SVG přes `canvas`, výchozí 2× |
| PPTX | `pptxgenjs`, obrázek pavouka na slide; jednotlivě i všechny pavouky do jedné prezentace |
| XLSX | `xlsx-js-style`, hlavičky a pruhy v barvách SŽ, list na report |
| PDF | tiskový dialog prohlížeče nad `#print-area` |

> ⚠️ **Názvy listů v XLSX:** Excel je omezuje na 31 znaků a nesmí se
> opakovat. Dlouhé názvy se po oříznutí srazily na stejný a export padal.
> `safeSheetName(name, wb)` proto řeší kolizi číselnou příponou.

---

## 9. Barvy a typografie

Grafický manuál SŽ – definováno v `styles.css` (proměnné) i v
`model.js` (`BRAND`, pro SVG a exporty):

| | |
|---|---|
| modrá | `#002b59` |
| oranžová | `#ff5200` |
| šedá | `#737373` |
| azurová | `#00a1e0` |
| písmo | Verdana |

Typy vazeb mají pevné barvy a čárkování (`LINK_TYPES` v `model.js`):
běžná = šedá plná, cross-institucionální = oranžová čárkovaná,
mirror = azurová tečkovaná.

Logo SŽ **není** součástí appky – čeká se na schválení útvarem
komunikace.

---

## 10. Testování

```bash
npx playwright install chromium   # jednorázově
npm run check                     # build + kouřový test
```

`test/smoke.mjs` projede sestavený `index.html` v headless prohlížeči a
ověří 16 kontrol:

1. načtení appky bez chyb v konzoli,
2. založení instituce a dvou skupin,
3. přesun boxu tažením,
4. přidání lomené vazby včetně úchytu a ID štítku,
5. ruční posun konce vazby a jeho uložení do dat,
6. exporty SVG / PNG / PPTX,
7. vykreslení přehledů a export všech přehledů do XLSX,
8. „Uložit / exportovat appku“ + znovuotevření staženého souboru
   (roundtrip dat) bez chyb.

Test končí nenulovým exit kódem, takže se dá zapojit do CI. Při přidání
funkce, kterou nepokrývá, ho rozšiřte – jinak se na ni při dalších
změnách zapomene.

**Co test nezachytí:** jestli schéma *vypadá* dobře. Geometrie vazeb má
tichá selhání (čára vedená pod boxem, splývající štítky, páteř lepící se
na okraj sloupce), která projdou testem i konzolí. U změn na plátně je
proto vždy nutná vizuální kontrola screenshotem.

`PW_EXECUTABLE=/cesta/k/chrome` přepíše cestu k prohlížeči pro prostředí,
kde je Chromium předinstalovaný jinde, než kam ho Playwright ukládá.

---

## 11. Známá omezení a náměty na další vývoj

**Omezení daná architekturou** (nelze vyřešit bez změny modelu):

- Souběžná editace více uživateli. Sdílení je manuální přes soubor.
- localStorage koncept se neváže na uživatele ani nepřenáší mezi stroji.
- Neexistuje kontrola, kdo změnu udělal – jméno editora je jen text.

**Kandidáti na další práci:**

- Knihovna předdefinovaných rozložení pavouka (ze zadání, zatím
  neimplementováno).
- Přímé uložení do stejného souboru přes File System Access API –
  odpadlo by ruční nahrávání zpět do SharePointu (funguje jen v Chrome/Edge
  a jen mimo `file://`).
- Hromadný import zástupců/skupin (XLSX → data).
- Automatické rozmístění boxů podle vzoru (hierarchie, seznam u uzlu).
- Zvětšení `MAX_HISTORY` nebo prořezávání historie – snapshoty rostou
  lineárně s velikostí dat a zvětšují výsledný soubor.

---

## 12. Slovníček

| Pojem | Význam |
|---|---|
| **Pavouk** | schéma jedné instituce – boxy skupin a vazby mezi nimi |
| **Skupina** | pracovní skupina / orgán instituce (box na plátně) |
| **Rámeček oblasti** | vizuální kontejner; s `institutionRefUid` odkaz na jiný pavouk |
| **Vazba** | spojení dvou skupin, typ N / X / M |
| **Pahýl (stub)** | zkrácené vykreslení vazby mířící mimo zobrazený pavouk |
| **Zástupce** | osoba SŽ ve skupině (jméno, útvar, role) |
| **Mirror vazba** | zrcadlová dvojice skupin napříč institucemi |
