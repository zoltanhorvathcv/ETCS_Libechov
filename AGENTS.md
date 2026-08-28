# Instrukce pro AI agenta

Projekt: **Organizační pavouci (Správa železnic)** – editor organizačních
schémat mezinárodních institucí jako jeden samostatný HTML soubor.

Kompletní popis architektury je v [`DOKUMENTACE.md`](DOKUMENTACE.md).
Přečti si ji, než začneš měnit `src/canvas.js` nebo datový model –
obsahuje odůvodnění netriviálních rozhodnutí a seznam zrádných míst.

---

## Build

```bash
npm install
npm run build     # node build.js → přepíše index.html v kořeni
```

**`index.html` je commitovaný artefakt, ne generovaný odpad.** Je to
soubor, který se kopíruje uživatelům do SharePointu. Po jakékoli změně
v `src/` spusť `npm run build` a commitni `index.html` spolu se zdroji.
Bez toho se změna k uživateli nedostane.

## Ověření změn

V repozitáři není test runner. Ověřuj přes Playwright nad sestaveným
`index.html` (headless Chromium, `--no-sandbox`, `file://` URL) a vždy
sleduj `pageerror` + `console.error` – většina regresí se projeví jako
výjimka v konzoli, ne jako viditelná chyba.

Po netriviální změně projdi: načtení bez chyb → přidání instituce /
skupiny / vazby → tažení boxu a úchytů vazby → exporty SVG/PNG/PPTX →
„Uložit / exportovat appku“ a znovuotevření staženého souboru →
přehledy včetně XLSX.

U vizuálních změn plátna udělej screenshot a **podívej se na něj** –
geometrie vazeb má víc tichých selhání (čára pod boxem, splývající
štítky), než kolik jich odhalí kontrola konzole.

## Jazyk

- Komentáře v kódu, commit messages, UI texty a dokumentace: **česky**.
- Názvy proměnných a funkcí: anglicky (běžná konvence kódu).
- Komentáře piš tam, kde vysvětlují **proč**, ne co – v `canvas.js` je
  spousta geometrie, kde není zřejmé, proč není řešená jednodušeji.

## Pravidla, která neporušuj

1. **Zobrazovaná ID se neukládají.** `CER-04` i `N-CER-04_CER-10` se vždy
   odvozují z `institution.code` + `group.seq`. Uložené ID by se rozešlo
   s realitou po přejmenování nebo přečíslování.
2. **Data se mění jen přes `store.commit(summary, mutateFn)`.** Jinak se
   změna nezapíše do historie verzí a UI se nepřekreslí. (Výjimka:
   `canvas.js` mutuje geometrii během tažení a commituje na `mouseup`.)
3. **Žádné externí zdroje.** Ani CDN, ani `fetch`, ani odkaz na soubor
   vedle. Appka musí fungovat offline z jednoho souboru.
4. **Nastavení pohledu nepatří do dat pavouka.** Sbalené lišty, zoom a
   podobné jdou do localStorage (`pavouci_view_prefs`), ne do `AppData`.
5. **Interaktivní grafika u boxů patří do `layer-handles`.** Vrstva
   skupin by ji v hit-testingu myši překryla.
6. **Nové odkazy mezi entitami doplň do kaskád** v `model.js`
   (`removeGroupCascade`, `removeInstitutionCascade`,
   `removeTopicCascade`), jinak zůstanou viset odkazy na smazané entity.
7. **Nepřestavuj `#editor-shell`, když stačí překreslit obsah.**
   Fullscreen prohlížeče je vázaný na konkrétní element a přestavba DOMu
   ho shodí.

## Časté chyby, na které se dá narazit

- **`Unexpected end of input` po buildu** → někde se vkládá text
  obsahující `</script` bez `escForInlineScript()`.
- **Úchyt na plátně nejde chytit myší** → je ve špatné vrstvě, patří do
  `layer-handles`.
- **Export XLSX padá na duplicitní název listu** → Excel omezuje názvy na
  31 znaků; použij `safeSheetName(name, wb)`.
- **Lomená čára vede přes sousední boxy** → použil se
  `rectBorderPoint` místo `elbowEdgePoint`.
- **Popisky zmizely v exportovaném SVG** → chybí pravidlo
  v `applyInlineStyles()`; SVG export nemá `<style>` a styly musí být
  vepsané v elementech.

## Git

Vyvíjej na větvi `claude/web-application-g1q2ke` (nebo dle zadání),
nikdy nepushuj do `main` bez vyžádání. Commit message česky, v prvním
řádku co se změnilo, v těle proč.
