# Organizační pavouci – Správa železnic

Webová appka pro tvorbu a dynamickou editaci organizačních pavouků
mezinárodních institucí a pracovních skupin (CER, PRIME, SERAF, RFC, EUG,
EULYNX, UIC, RISC, RNE a další), evidenci zastoupení SŽ a témat, přehledy a
export výstupů pro prezentace vedení.

## Jak appku používat

**Appka je jeden samostatný soubor `index.html` – bez serveru, bez
přihlašování, bez připojení k internetu.** Stačí ho otevřít v prohlížeči
(dvojklikem, nebo z interní SharePoint knihovny). Všechna data appky jsou
uložená přímo uvnitř tohoto souboru.

- **Editor pavouka** – v levém panelu vyberte instituci. Skupiny (boxy)
  přidáte tlačítkem „+ Skupina" nebo dvojklikem na volnou plochu plátna,
  přesouvají se tažením, velikost se mění za pravý dolní roh. Detail skupiny
  (název, zástupci SŽ, přiřazená témata) i vazby se upravují v pravém
  postranním panelu.
- **Vazby** mezi skupinami se přidávají v pravém panelu (po kliknutí na
  volnou plochu plátna) – typ *běžná / cross-institucionální / mirror*, obě
  strany vazby, volitelně šipka, poznámka a styl čáry (rovná / lomená
  pravoúhlá). ID vazeb i skupin se všude v appce přepočítává automaticky.
- **Doladění vzhledu vazeb** – tažením lze posunout konec vazby po hraně
  cílového boxu, ID štítek podél čáry a u cross-institucionálních vazeb
  i celý štítek s odkazem. Každý posun jde vrátit na automatickou polohu
  tlačítkem ve formuláři vazby.
- **Rámeček oblasti** může být i odkazem na jinou instituci appky – klik
  na něj přepne na její pavouk.
- **Režim celé obrazovky** – ikonka v pravém horním rohu plátna. Lišta
  nástrojů a postranní panel se v něm zobrazí jako plovoucí panely nad
  plátnem, obojí jde sbalit (šipka u panelu, ☰ u lišty) i v běžném
  režimu. Vlevo dole je ovládání přiblížení a „Přizpůsobit oknu“.
- **Registr témat** – samostatná sekce s volitelnou dvouúrovňovou hierarchií.
- **Přehledy** – dashboard institucí, chybějící zástupci, mirror páry bez
  protějšku, matice cross-institucionálních vazeb, statistika a hierarchie
  témat, adresář zástupců, izolované skupiny, skupiny bez tématu, skupiny a
  zástupci podle tématu, historie verzí. Export do XLSX (v barvách SŽ) nebo
  do PDF (přes tiskový dialog prohlížeče).
- **Export pavouka** – PNG, SVG nebo přímo PPTX (tlačítka v editoru), nebo
  export všech pavouků najednou do jedné prezentace (dashboard).
- **Uložit / exportovat appku** (tlačítko vpravo nahoře) vygeneruje
  aktualizovaný soubor appky se všemi daty ke stažení – ten je pak potřeba
  ručně nahrát zpět do sdílené SharePoint knihovny (appka nemá žádné napojení
  na server, sdílení je čistě manuální).
- Appka si mezitím průběžně ukládá pracovní koncept do prohlížeče
  (localStorage) jako pojistku proti nechtěnému zavření karty – při příštím
  otevření souboru appka nabídne konceptu obnovit, pokud je novější než
  naposledy uložený soubor.
- **Historie verzí** appka uchovává interně (posledních 50 verzí), u každé
  volitelně jméno editora (pole nahoře). Kdykoli lze verzi obnovit.

## Dokumentace pro vývoj

- [`DOKUMENTACE.md`](DOKUMENTACE.md) – kompletní popis aplikace:
  architektura, datový model, jednotlivé moduly, geometrie vazeb,
  exporty, testování, známá omezení a náměty na další vývoj.
- [`AGENTS.md`](AGENTS.md) – pracovní instrukce pro AI agenta
  (build, ověřování změn, pravidla, častá úskalí).

## Vývoj / sestavení appky ze zdrojových souborů

Appka se generuje jako jeden HTML soubor ze zdrojových modulů v `src/`,
včetně knihoven pro export (`xlsx-js-style`, `pptxgenjs`), aby výsledný
soubor fungoval zcela offline.

```bash
npm install
npm run build     # vygeneruje/aktualizuje index.html v kořeni repozitáře
```

`index.html` je commitovaný přímo v repozitáři – to je finální dodávaný
soubor appky, není potřeba žádný build krok pro koncového uživatele.

### Struktura zdrojových souborů

- `src/model.js` – datový model (instituce, skupiny, vazby, témata),
  odvozování ID.
- `src/store.js` – načtení/uložení dat (vestavěná v HTML + localStorage
  koncept), historie verzí a rollback, generování exportního HTML.
- `src/canvas.js` – SVG editor plátna (pan/zoom, drag&drop, rámečky oblastí,
  vazby).
- `src/reports.js` – výpočet všech přehledů a fulltextového vyhledávání.
- `src/exports.js` – export do SVG/PNG/PPTX/XLSX a tisk do PDF.
- `src/ui.js` – aplikační shell, navigace, formuláře.
- `src/seed.js` – počáteční sada institucí (názvy dle zadání).
- `build.js` – sestavení výsledného `index.html`.

## Rozhodnutí k otevřeným bodům ze zadání

- **Export do PPTX**: appka podporuje jak export jednotlivého pavouka do
  vlastní PPTX, tak export všech (neprázdných) pavouků do jedné souhrnné
  prezentace (jeden slide na instituci).
- **Knihovna předdefinovaných rozložení**: není v této verzi implementována
  (ponecháno jako bod pro další fázi, jak zadání předpokládá).
- **Formátovaný XLSX pro vedení**: hlavičky a pruhované řádky v barvách
  grafického manuálu SŽ, samostatný list pro každý přehled; matice
  cross-institucionálních vazeb má navíc vlastní maticový list.
- **Počet uchovávaných verzí historie**: 50 (konstanta `MAX_HISTORY` v
  `src/model.js`, lze upravit).
- **„Mirror páry bez protějšku"**: appka doplňuje k modelu skupiny
  volitelný příznak „Očekává se mirror vazba" – přehled pak zobrazuje
  skupiny s tímto příznakem, které zatím nemají žádnou vazbu typu mirror.
