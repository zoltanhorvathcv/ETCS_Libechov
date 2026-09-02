# Nastavení Codexu pro tento projekt

Návod, co nastavit, než se v Codexu pustíte do úprav aplikace. Popis
aplikace samotné je v [`DOKUMENTACE.md`](DOKUMENTACE.md), pravidla pro
agenta v [`AGENTS.md`](AGENTS.md) (Codex si je načte sám).

> Ovládání Codexu se průběžně mění. Názvy položek v nastavení nemusí
> sedět doslova – řiďte se významem (připojení repozitáře, setup skript,
> přístup k internetu).

---

## 1. Než začnete: sloučit PR #1

V `main` je zatím **stará aplikace MERIDIAN**. Celá tato appka žije na
větvi `claude/web-application-g1q2ke` v otevřeném
[PR #1](https://github.com/zoltanhorvathcv/ETCS_Libechov/pull/1).

Než pustíte Codex, PR sloučte – jinak bude Codex pracovat nad kódem,
který s aplikací nemá nic společného. Případně mu v zadání výslovně
řekněte, ať vychází z té větve.

## 2. Připojit repozitář

V Codexu připojte GitHub účet a vyberte repozitář
`zoltanhorvathcv/ETCS_Libechov`. Jako výchozí větev nastavte tu, na které
je aplikace (po sloučení `main`).

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

Musí projít **16/16 kontrol**. Když ne, prostředí není správně
nastavené a nemá smysl pokračovat v úpravách.

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

> [co má vzniknout a proč]. Drž se pravidel v `AGENTS.md`. Po úpravě
> spusť `npm run check` a commitni zdroje i `index.html`.

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

Seřazené zhruba podle poměru přínos/námaha:

1. **Hromadný import zástupců a skupin z XLSX** – nejvíc ušetří ruční
   práci při plnění dat.
2. **Automatické rozmístění boxů podle vzoru** (hierarchie, seznam
   napojený na uzel) – dnes se vše rovná ručně.
3. **Knihovna předdefinovaných rozložení pavouka** – bod ze zadání, zatím
   neimplementovaný.
4. **Uložení do stejného souboru přes File System Access API** – odpadlo
   by ruční nahrávání zpět do SharePointu. Pozor: funguje jen
   v Chrome/Edge a **ne** pro soubory otevřené přes `file://`.
5. **Rozšíření kouřového testu** o vazby napříč institucemi a o kontrolu,
   že se ID po přejmenování instituce přepočítala.

Podrobnější rozbor omezení a jejich příčin je v kapitole 11
`DOKUMENTACE.md`.
