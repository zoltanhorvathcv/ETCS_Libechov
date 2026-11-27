# MERIDIAN — Projektová inteligence

Interaktivní dashboard pro analytické a strategické projekty: úvodní roadmapa
na vlně, milníková nástěnka, log rozhodnutí a otázek, AI extrakce z přepisů
a **editace všech detailů přímo ve webu** s ukládáním do Supabase.

Nasazeno na Netlify z tohoto repozitáře — každý `git push` do `main` spustí
automatický deploy.

---

## Samostatná procesní mapa (`procesni-mapa.html`)

Jednoduchý editor procesní mapy na jedné stránce, bez přihlášení a bez Supabase
(ukládá se v prohlížeči, záloha přes **Export / Import** JSON).

- **Svislá osa = čas** od ledna 2020 do prosince 2030 s roky, českými zkratkami
  měsíců (led, úno, bře, …) a zkratkami týdnů (T01–T53).
- **Zoom času** (− / +, kolečko myši nad časovou osou, Ctrl + kolečko): plynule
  přibližuje a oddaluje; rozlišení se samo mění od **týdnů** (nejblíž) přes
  **měsíce** po **kvartály** (nejdál). ⤢ = celé období na výšku.
- **Zoom streamů** (− / +, kolečko nad záhlavím streamů, Ctrl + Shift + kolečko):
  zúží / rozšíří streamy, takže je jich na obrazovce vidět víc nebo méně.
  ⤢ = všechny streamy na šířku.
- **Přetahování myší:** proces chyťte a táhněte v čase (délka se zachová) nebo
  do jiného streamu či dráhy; tažením horní / dolní hrany měníte začátek / konec.
  Přichytává se podle měřítka (týden / měsíc / kvartál, volba „Krok“), s Alt po
  dnech, Esc tažení zruší. Na obsazeném místě se proces uloží do volné dráhy.
- **Vodorovná osa = streamy**; každý stream může mít více **paralelních drah**,
  takže procesy mohou běžet souběžně vedle sebe.
- Proces má **název, role, od–do a gesci**.
- **Pravé tlačítko na stream**: přidat proces do kliknutého období a dráhy,
  přidat / odebrat dráhu, přejmenovat, posunout nebo smazat stream.
- **Pravé tlačítko na proces**: přidat roli, změnit od–do, změnit gesci,
  upravit vše, přidat paralelní proces, smazat. Na dotykových zařízeních
  stejné menu otevře tlačítko ⋯.
- Zpět / Znovu (Ctrl+Z / Ctrl+Y), Delete smaže vybraný proces.

Automatický test všech funkcí: `node tests/procesni-mapa.test.js`
(potřebuje Node.js a balíček `playwright` s Chromiem).

---

## Úpravy projektu přímo ve webu

1. Otevřete aplikaci (tlačítko **„Otevřít aplikaci"** na úvodní stránce).
2. V horní liště klikněte na **✎ Úpravy** — zapne se editační režim.
3. Teď můžete:
   - **Parametry projektu** (název, kód, vlastník, fáze, postup, rozsah dat) —
     tlačítko **⚙ Spravovat projekt** na úvodní stránce, nebo ✎ u záhlaví.
   - **Milníky** — ✎ na kartě/uzlu nebo v detailu milníku; nový přes
     **＋ Nový milník** na nástěnce. Po změně data se milník sám přemístí na
     roadmapě i na časové ose.
   - **Schůzky** — ✎ na kartě schůzky nebo **+ Přidat schůzku**. Zaškrtnutí
     „Plánovaná" ji zobrazí jako **kosočtverec na roadmapě** na úvodní stránce.
   - **Otázky, rozhodnutí, úkoly, rizika, důkazy** — ✎ na každé kartě, nebo
     **＋** v hlavičce sloupce na nástěnce.
4. Hotovo potvrdíte opětovným kliknutím na **✓ Hotovo**.

Bez připojené Supabase běží aplikace v **DEMO režimu** — vše funguje, ale změny
se po znovunačtení stránky ztratí (v horní liště svítí „DEMO režim").

---

## Připojení Supabase (trvalé ukládání, sdílení v týmu)

### 1. Vytvořte tabulku
V Supabase → **SQL Editor** → **New query** vložte a spusťte celý obsah
souboru [`supabase-schema.sql`](supabase-schema.sql). Vytvoří jednu tabulku
`pi_entities` a přístupová pravidla.

### 2. Zkopírujte klíče
Supabase → **Project Settings → API**:
- **Project URL** (např. `https://xxxx.supabase.co`)
- **anon public** klíč

### 3. Vložte je do aplikace
V [`index.html`](index.html) najděte blok na začátku `<script>`:

```js
const SUPA = {
  url: '',        // sem Project URL
  anonKey: '',    // sem anon public klíč
  projectId: 'PRJ-2026-014'
};
```

Vyplňte `url` a `anonKey`, uložte, `git push`. Po nasazení se aplikace při
prvním načtení sama naplní výchozím obsahem a od té chvíle ukládá každou úpravu
do Supabase — sdílenou napříč zařízeními i členy týmu.

### Bezpečnost a přihlášení (aktivní)
Nasazená je **Varianta B**: kdokoli s odkazem vidí celou aplikaci **jen ke
čtení**, upravovat data může pouze **přihlášený správce**.

- V horní liště je tlačítko **Přihlásit** → e-mail + heslo (Supabase Auth).
- Po přihlášení se objeví **✎ Úpravy**; odhlášením se vrátíte do režimu čtení.
- Veřejná registrace je **vypnutá** — nový účet nelze založit z aplikace.
- Nový správcovský účet přidáte v Supabase → **Authentication → Users → Add
  user**. Heslo si lze kdykoli změnit tamtéž.

Zápis je vynucen na úrovni databáze (RLS): anonymní klíč smí `select`, ale
`insert/update/delete` jen role `authenticated`.

---

## Datový model

Vše je jeden objekt na řádek v tabulce `pi_entities` (sloupec `data` typu
JSONB), rozlišený polem `entity`: `project`, `people`, `milestone`, `meeting`,
`question`, `decision`, `task`, `risk`, `evidence`. Struktura přesně odpovídá
datovým objektům v `index.html`, takže je pružná vůči přidávání polí.

---

*Prototyp v0.9 · fiktivní demonstrační data (projekt C-ITS na železničních přejezdech).*
