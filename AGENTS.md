# Instrukce pro AI agenta

Projekt: **Organizační pavouci (Správa železnic)** – editor organizačních
schémat mezinárodních institucí jako jeden samostatný HTML soubor.

Kompletní popis architektury je v [`DOKUMENTACE.md`](DOKUMENTACE.md).
Přečti si ji, než začneš měnit `src/canvas.js` nebo datový model –
obsahuje odůvodnění netriviálních rozhodnutí a seznam zrádných míst.
Nastavení prostředí popisuje [`CODEX.md`](CODEX.md).

---

## Build a ověření

```bash
npm install                        # jednorázově
npx playwright install chromium    # jednorázově, kvůli testu
npm run check                      # build + kouřový test – SPOUŠTĚJ PO KAŽDÉ ZMĚNĚ
```

`npm run check` = `npm run build` (sestaví `index.html`) +
`npm run smoke` (`test/smoke.mjs` projede appku v headless prohlížeči).
Musí projít **16/16 kontrol**.

**`index.html` je commitovaný artefakt, ne generovaný odpad.** Je to
soubor, který se kopíruje uživatelům do SharePointu. Po jakékoli změně
v `src/` spusť build a commitni `index.html` spolu se zdroji. Bez toho se
změna k uživateli nedostane.

Když přidáváš funkci, na kterou test nesahá, **rozšiř `test/smoke.mjs`**
o odpovídající kontrolu.

U vizuálních změn plátna navíc udělej screenshot a **podívej se na něj** –
geometrie vazeb má tichá selhání (čára pod boxem, splývající štítky,
páteř lepící se na okraj sloupce), která testem ani konzolí neprojdou.

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
- **`index.html` se tváří jako změněný, i když jsem nic neupravil** →
  to je normální. `uid()` odvozuje ID z času a náhody, takže výchozí
  instituce dostanou při každém buildu jiná `uid` a build není
  reprodukovatelný. Podle diffu `index.html` se tedy **nedá** poznat, jestli
  změna měla efekt – posuzuj podle diffu v `src/` a podle výsledku
  `npm run check`.

## Git

Vyvíjej na větvi `claude/web-application-g1q2ke` (nebo dle zadání),
nikdy nepushuj do `main` bez vyžádání. Commit message česky, v prvním
řádku co se změnilo, v těle proč.
