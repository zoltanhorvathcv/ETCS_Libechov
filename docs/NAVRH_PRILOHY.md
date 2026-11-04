# Přílohy k procesům a podprocesům — koncept řešení

Stav: návrh k odsouhlasení (nic z toho není v aplikaci implementováno).

## 1. Principy
- Soubor se **nikdy nepřepisuje**. Každá nová verze je nový soubor v úložišti; starší verze zůstávají dostupné.
- Soubory leží v **Supabase Storage** (soukromý bucket `pm-attachments`), v databázi (`pi_entities`) je jen popis (metadata). Nejde o kopii souboru.
- Příloha patří k **procesu** (podle id), ne k číslu ani ke streamu. Přesun streamu, přečíslování i přeřazení pod jiný proces přílohy neovlivní.
- Cesta souboru: `{project_id}/{attachment_id}/v{n}/{název souboru}`.

## 2. Datový model (metadata v `pi_entities`)
**Příloha** (entita `attachment`)
- `id` (A-001), `owner` (id procesu), `title`, `desc` — popis předmětné přílohy (platí jen pro ni, pokud není ve sadě),
- `group` — id sady nebo prázdné,
- `versions[]`: `{n, path, name, size, mime, sha256, note, by, at}` — `note` = co se v této verzi změnilo,
- `current` — číslo aktuální verze, `deleted` — příznak odstranění (měkké smazání).

**Sada** (entita `attgroup`) — „přidružené přílohy"
- `id` (S-001), `owner` (id procesu), `name`, `desc` — **popis platí pro celou sadu**,
- `members[]` — id příloh. Každá příloha má **vlastní** verzování nezávisle na ostatních.
- Volitelně `snapshots[]`: `{n, at, by, note, pins:{attachment_id: verze}}` — „zafixování sady" = záznam, které verze souborů k sobě patřily (např. „sada předaná NoBo 14. 3.").

Pravidlo popisu: příloha ve sadě zobrazuje popis sady (a případně svou verzovou poznámku); samostatná příloha má popis vlastní.

## 3. Uživatelské rozhraní
- Nová karta **Přílohy** v pásu karet procesu (vedle Milníků). Na boxu procesu symbol 📎 s počtem.
- Karta: seznam samostatných příloh a sad. Sada je rozbalitelný blok se svým popisem a členy.
- Akce: **Přidat soubor** (výběr nebo přetažení; více souborů naráz → nabídka „vytvořit sadu"), **Nová verze** (u přílohy), **Přidružit** (označit víc příloh → sada), **Vyjmout ze sady**, **Historie verzí** (kdo, kdy, poznámka, velikost), **Otevřít / stáhnout** (podepsaný odkaz s platností pár minut), **Odstranit**.
- Při nahrání se ukáže velikost a zbývající kapacita; soubory nad limit se odmítnou před nahráním.
- Nahrávat a mazat smí jen přihlášený správce (jako úpravy procesů).

## 4. Přílohy ve fázích návrhu procesní mapy
Aplikace má tyto fáze; u každé je navrženo chování příloh.

1. **Koncept (varianta)** — volná pracovní plocha. Přílohy jsou pracovní podklady, libovolně se verzují, přidružují i odstraňují. Nic se nehlídá.
2. **Založení ze šablony / Doplnit ze šablony** — šablona příloh neobsahuje. Doplnění procesů ze šablony stávající přílohy nemění.
3. **Úpravy konceptu (přesun, přečíslování, přesun streamu, změna nadřazeného procesu, paralelní proces)** — přílohy se drží id procesu, takže se nic neděje. Při smazání procesu nebo streamu se přílohy jen **označí jako odstraněné** (soubory zůstávají, aby fungovalo Zpět); fyzicky je uklidí až správce akcí „Uklidit osiřelé soubory".
4. **Rozdělení procesu (✂)** — přílohy zůstanou u první části; druhá část je bez příloh a lze ji přidružit odkazem.
5. **Zpevnění do mapy (průvodce)** — mapový proces vznikne s odkazem na koncept (`srcId`). Navrhuji, aby mapa **neodkazovala na „nejnovější", ale zafixovala konkrétní verze příloh** k datu zpevnění (pin). Soubor se tím nekopíruje, jen se zaznamená verze. V kroku **Rozdíly** se objeví: přibyla příloha, je novější verze (v3 → v4), příloha byla odstraněna.
6. **Mapa: odvozený** — přílohy jsou připnuté na verzích ze zpevnění; novější verze v konceptu se nabídnou k převzetí, ale samy se nepřebírají.
7. **Mapa: potvrzený** — připnuté verze jsou **uzamčené**. Nahrát novou verzi lze, ale mapa ji převezme až po vědomém novém potvrzení; v historii zůstane, kdo a kdy verzi potvrdil.
8. **Opakované zpevnění** — stejná logika jako u termínů a názvů: změněné přílohy se ukážou jako rozdíl a u procesů, které se v mapě ručně upravily (`mapEdited`), jako konflikt. Odstraněný proces v konceptu = „v konceptu už neexistuje" i s přílohami.
9. **Tisk / PDF** — přehled může uvést počet příloh a u mapy seznam připnutých verzí.

## 5. Kapacita a limity
- Verzování násobí spotřebu: 5 verzí souboru o 10 MB = 50 MB. Proto: limit na soubor (navrhuji 25–50 MB), zobrazení využití a volitelně úklid starých verzí u nepotvrzených příloh.
- Celková kapacita je dána tarifem projektu Supabase (ověřte v Settings → Usage). Běžně: zdarma ~1 GB a 50 MB na soubor, Pro ~100 GB.
- Součet velikostí lze dopočítat z metadat, bez dotazu na úložiště.

## 6. Rizika a otevřené otázky
- Soukromý bucket = nepřihlášení soubory neotevřou. Chcete jim umožnit čtení?
- Nahrávání „jakéhokoli souboru": zvažte zákaz spustitelných typů (.exe, .bat…). Antivirová kontrola v návrhu není.
- Citlivost obsahu: soubory leží v cloudu Supabase; pro důvěrné dokumenty ověřte pravidla organizace.
- Mají se přílohy konceptu kopírovat do mapy, nebo stačí odkaz (návrh: odkaz s připnutou verzí)?
