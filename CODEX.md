# Nastavení Codexu pro tento projekt

Návod, co nastavit, než se v Codexu pustíte do úprav aplikace. Popis
aplikace samotné je v [`DOKUMENTACE.md`](DOKUMENTACE.md), pravidla pro
agenta v [`AGENTS.md`](AGENTS.md) (Codex si je načte sám).

> Ovládání Codexu se průběžně mění. Názvy položek v nastavení nemusí
> sedět doslova – řiďte se významem (připojení repozitáře, setup skript,
> přístup k internetu).

---

## 1. Než začnete: PR #1 je pořád otevřený

V `main` je zatím **stará aplikace MERIDIAN**. Celá tato appka žije na
větvi `claude/web-application-g1q2ke` v otevřeném
[PR #1](https://github.com/zoltanhorvathcv/ETCS_Libechov/pull/1) – k dnešnímu
dni (18. 9. 2026) pořád nesloučeném.

Dokud PR nesloučíte, má to důsledek pro každé zadání v Codexu: **musíte mu
vždy výslovně říct, ať pracuje na větvi `claude/web-application-g1q2ke`**
(ne na výchozí `main`), jinak bude upravovat starou appku, která s touto
appkou nemá nic společného. Nejjistější je nastavit tuto větev jako
výchozí přímo při připojení repozitáře (viz bod 2) – pak to nemusíte psát
do každého zadání zvlášť.

Až budete s PR #1 spokojení, sloučením do `main` se to zjednoduší (Codex
pak může vycházet rovnou z výchozí větve). Do té doby ale PR neslučujte
uprostřed rozdělané práce v Codexu – nová appka právě nabíhá do používání
a sloučení je vhodné dělat jako vědomý krok, ne vedlejší efekt.

## 2. Připojit repozitář přes GitHub connector

Codex s GitHub connectorem funguje na principu **úloh (tasks)**: zadáte
popis toho, co se má udělat, Codex si v izolovaném kontejneru naklonuje
repozitář, provede úpravy, spustí ověření a výsledek vám vrátí jako diff
nebo rovnou jako otevřený pull request. Mezi jednotlivými úlohami se nic
nepamatuje (žádný běžící proces, žádná paměť) – kontext dostává pokaždé
znovu jen z repozitáře (`AGENTS.md`, `DOKUMENTACE.md`) a z vašeho zadání.

Postup připojení:

1. V nastavení Codexu (GitHub connector) vyberte účet a repozitář
   `zoltanhorvathcv/ETCS_Libechov`.
2. Jako výchozí větev nastavte **`claude/web-application-g1q2ke`** (dokud
   nebude PR #1 sloučený do `main` – viz bod 1).
3. Codex si `AGENTS.md` z kořene repozitáře **načte automaticky** na
   začátku každé úlohy – je to stejná konvence jako `CLAUDE.md` u Claude
   Code. Nemusíte tedy pravidla z něj do zadání kopírovat, stačí se na ně
   v zadání odkázat, pokud chcete něco zdůraznit.

### Co Codex s connectorem udělá s výsledkem

Podle nastavení buď:
- **otevře nový pull request** proti větvi, kterou jste zvolili jako
  výchozí (typicky `claude/web-application-g1q2ke`), nebo
- **pushne přímo do větve**, pokud jste to tak nastavili.

Pro tento projekt doporučuji **vždy nechat Codex otevírat PR**, i když
budete PR sám/sama rovnou slučovat – dá vám to šanci mrknout na diff dřív,
než se něco dostane do větve, ze které appku reálně berete (viz bod 6 –
kontrola po Codexu, hlavně kvůli riziku commitnutí dat).

## 3. Setup skript prostředí

V nastavení prostředí vložte jako setup skript:

```bash
bash scripts/codex-setup.sh
```

Skript je v repozitáři a dělá tři věci: nainstaluje npm závislosti,
stáhne Chromium pro testy a na závěr provede kontrolní build + test, aby
bylo hned vidět, že je prostředí funkční.

> ⚠️ **Proč to nejde nechat na později:** Codex během plnění úlohy běžně
> nemá přístup k internetu. Co se nestáhne v setupu, to už nebude
> k dispozici – agent by pak nemohl spustit testy a musel by změny
> odevzdávat neověřené.

## 4. Přístup k internetu

- **Setup**: internet potřebný (npm + stažení prohlížeče).
- **Během úlohy**: může zůstat **vypnutý**. Aplikace je offline a žádné
  závislosti se za běhu nestahují.

## 5. Ověřit, že prostředí funguje

Nechte Codex spustit:

```bash
npm run check      # = build + kouřový test
```

Musí projít **17/17 kontrol**. Když ne, prostředí není správně
nastavené a nemá smysl pokračovat v úpravách.

## 6. Po každé úloze zkontrolujte diff sami – hlavně kvůli datům

Connector vám umožní úlohu zadat a nechat běžet bez dohledu, ale **diff
před sloučením PR pokaždé aspoň proletěte očima** – ne kvůli nedůvěře
v Codex jako takový, ale kvůli jedné konkrétní věci, kterou agent (jakýkoli,
včetně mě) může snadno přehlédnout: `git add -A`/`git add .` je zvyk,
který se snadno spustí automaticky, a tenhle repozitář má vedle sebe
skripty (`scripts/import-zastupci.mjs`, `scripts/merge-eu-rail.mjs`), které
při spuštění **umí vygenerovat samostatný HTML soubor s reálnými jmény,
e-maily a telefony zástupců SŽ** (viz `AGENTS.md`, oddíl „Osobní a
organizační data“). Takový soubor nesmí skončit v gitu ani v PR.

Konkrétně hlídejte:
- že se ve stage/diffu neobjevil soubor `pavouci-*.html` (mimo
  `index.html`) – `.gitignore` ho sice vylučuje, ale to Codex nezastaví,
  pokud by ho commitnul explicitně (`git add -f`);
- že se nezměnil `src/seed.js` směrem k přidání reálných skupin/vazeb/
  zástupců – tam smí zůstat jen holý seznam institucí (viz `AGENTS.md`);
- že nová organizační data (pokud nějaká přibydou) jdou do `data/` bez
  osobních údajů, ne do `src/`.

Když se to objeví, nejde o „bug appky“, ale o to, že zadání nebylo
dostatečně konkrétní – přidejte do promptu explicitní připomínku (viz
šablona zadání níže).

---

## Příkazy, které budete používat

| Příkaz | Co dělá |
|---|---|
| `npm run build` | sestaví `index.html` ze zdrojů v `src/` |
| `npm run smoke` | kouřový test sestavené appky v headless prohlížeči |
| `npm run check` | obojí za sebou – **tohle spouštějte po každé změně** |

Kouřový test projde hlavní funkce (založení instituce, skupiny, vazba,
tažení boxu i úchytu vazby, exporty SVG/PNG/PPTX/XLSX, uložení appky a
její znovuotevření) a hlídá chyby v konzoli.

---

## První zadání pro Codex

Doporučuji začít něčím malým, ať si ověříte celý cyklus (změna → build →
test → commit). Například:

> Přečti si `AGENTS.md` a `DOKUMENTACE.md`. Pak v editoru pavouka přidej
> do lišty nástrojů tlačítko „Duplikovat skupinu", které vytvoří kopii
> právě vybrané skupiny posunutou o 20 px, včetně zástupců a témat, ale
> s vlastním novým `uid` a `seq`. Změnu proveď ve `src/`, spusť
> `npm run check` a commitni i přegenerovaný `index.html`.

Šablona pro další zadání:

> [co má vzniknout a proč]. Pracuj na větvi `claude/web-application-g1q2ke`.
> Drž se pravidel v `AGENTS.md` – hlavně oddílu „Osobní a organizační
> data“: necommituj žádný vygenerovaný soubor s reálnými jmény/e-maily/
> telefony a nepřidávej organizační data do `src/seed.js`. Po úpravě spusť
> `npm run check` a commitni zdroje i `index.html`. Otevři pull request,
> neslučuj ho sám.

**Vždy Codexu připomeňte přegenerování `index.html`.** Je to jediná věc,
na kterou se dá snadno zapomenout a která způsobí, že se změna
k uživatelům vůbec nedostane – aplikace se totiž distribuuje jako ten
jeden sestavený soubor.

> ℹ️ **`index.html` se změní při každém buildu**, i když v `src/` nic
> neupravíte. Výchozí instituce dostávají `uid` odvozené z času, takže
> build není reprodukovatelný. Podle diffu `index.html` proto nepoznáte,
> jestli měla změna efekt – dívejte se na diff v `src/`.
>
> Dá se to odstranit (přidělit výchozím institucím pevná `uid` v
> `src/seed.js`); zatím to tak není, ať se nemění chování bez vyžádání.

---

## Co Codex neověří sám

Kouřový test zachytí rozbitý build, rozbitý datový tok i rozbitý export.
**Nezachytí, jestli schéma vypadá dobře** – geometrie vazeb má tichá
selhání: čára vedená pod boxem, splývající štítky, páteř lepící se na
okraj sloupce. To všechno projde testem i konzolí.

U změn na plátně proto po Codexu chtějte screenshot a podívejte se na
něj, nebo si stáhněte sestavený `index.html` a otevřete ho.

---

## Nápady na další vývoj

Hromadný import zástupců z XLSX (`scripts/import-zastupci.mjs`) a
referenční struktura EU-Rail/RNE/PRIME/RISC/SERAF/… (`scripts/merge-eu-rail.mjs`
+ `data/eu-rail-structure.mjs`) už existují. Zbývá zhruba podle poměru
přínos/námaha:

1. **Automatické rozmístění boxů podle vzoru** (hierarchie, seznam
   napojený na uzel) – dnes se vše rovná ručně (merge skript má jen
   jednoduché sloupcové rozložení podle hloubky stromu).
2. **Knihovna předdefinovaných rozložení pavouka** – bod ze zadání, zatím
   neimplementovaný.
3. **Uložení do stejného souboru přes File System Access API** – odpadlo
   by ruční nahrávání zpět do SharePointu. Pozor: funguje jen
   v Chrome/Edge a **ne** pro soubory otevřené přes `file://`.
4. **Rozšíření kouřového testu** o vazby napříč institucemi a o kontrolu,
   že se ID po přejmenování instituce přepočítala.

Podrobnější rozbor omezení a jejich příčin je v kapitole 11
`DOKUMENTACE.md`.
