#!/usr/bin/env bash
# Setup skript pro prostředí Codexu (vložit do nastavení prostředí jako
# "setup script"). Běží ve fázi, kdy je ještě dostupný internet – proto se
# tady stahují všechny závislosti včetně prohlížeče pro testy.
#
# Lokálně stačí totéž spustit ručně: bash scripts/codex-setup.sh

set -euo pipefail

echo "==> Instalace npm závislostí"
npm ci || npm install

echo "==> Instalace prohlížeče pro kouřový test"
# --with-deps doinstaluje i systémové knihovny, které Chromium potřebuje.
# Když selže (chybí práva k apt), zkusíme aspoň samotný prohlížeč.
npx playwright install --with-deps chromium || npx playwright install chromium

echo "==> Kontrolní sestavení a test"
npm run build
npm run smoke

echo "==> Hotovo. Prostředí je připravené."
