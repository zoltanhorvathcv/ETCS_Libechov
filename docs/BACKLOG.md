# Backlog — funkce k dokončení v budoucnu

## Přílohy k procesům a podprocesům

> **Aktualizace:** po zavedení entity Výstup (🡒 karta Výstupy, okno 📦 Výstupy) patří soubory přirozeně k **výstupu**, ne k procesu. Při realizaci se karta Přílohy a symbol 📎 přesunou z procesu na výstup (zafixované verze v mapě se vážou na mapový výstup se `srcId`).
- **Stav:** odloženo, nic není v aplikaci implementováno.
- **Cíl:** k procesu a podprocesu přidat libovolný soubor s popisem, verzováním a možností přidružit více příloh do sady (popis sady platí pro všechny soubory v ní, každý soubor se verzuje samostatně).
- **Podklady:**
  - návrh řešení včetně chování ve fázích mapy: [`docs/NAVRH_PRILOHY.md`](NAVRH_PRILOHY.md)
  - SQL pro založení soukromého úložiště `pm-attachments` v Supabase: [`supabase-attachments.sql`](../supabase-attachments.sql)
- **Před zahájením prací:**
  1. Ve Supabase spustit `supabase-attachments.sql` (SQL Editor) a ověřit kapacitu tarifu (Settings → Usage / Billing).
  2. Rozhodnout otevřené otázky z návrhu: kdo smí soubory číst (jen přihlášení / i nepřihlášení), zákaz spustitelných typů, limit na soubor (25 nebo 50 MB), mapa odkazuje na zafixované verze místo kopií, citlivost obsahu v cloudu.
- **Rozsah implementace:** karta Přílohy v pásu karet, symbol 📎 na boxu procesu, nahrání a nová verze, sady, historie verzí, otevření přes podepsaný odkaz, měkké smazání a úklid osiřelých souborů, zafixované verze v mapě a krok „Rozdíly“ ve zpevnění, počet příloh v PDF.

## Skupiny streamů — dořešit návaznosti

- **Hotovo:** z vybraných streamů lze vytvořit pojmenovanou skupinu (tlačítko ▦ Skupina streamů), členové se přeřadí vedle sebe a skupina se zobrazí jako pás v záhlaví svislé osy. Uloženo u varianty (`sgroups`), v mapě u projektu (`mapSGroups`). Klik na pás vybere členy, dvojklik přejmenuje, u streamu v pásu karet jde skupinu přejmenovat, stream vyjmout nebo skupinu zrušit.
- **K dořešení (zatím záměrně ne):**
  - návaznosti: vazby mezi skupinami a mezi skupinou a streamem / procesem, odvozování termínů skupiny z jejích streamů,
  - zobrazení skupin ve vodorovné ose a v přehledu stromem (nyní jen svislá osa),
  - zpevnění do mapy: kopírování skupin z varianty do mapy (nyní se neslučují),
  - úpravy skupin v kroku Zpět, tisk skupin v PDF po jednotlivých fázích,
  - skupina ve skupině (hierarchie skupin).

