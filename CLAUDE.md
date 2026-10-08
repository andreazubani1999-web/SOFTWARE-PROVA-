# Note per Claude

- Tutta l'app sta in `index.html` (~20.000 righe: HTML, CSS e JS inline, nessuna build). L'interfaccia e i commenti sono in italiano.
- `APP_VERSION` è definita in `index.html`. Alla data dell'import era `1.4`.
- Chiavi `localStorage`: `STORAGE_KEY`, `GLOBAL_PRICES_KEY`, `PRICE_LIBRARIES_KEY`, `ACTIVE_PRICE_LIBRARY_KEY`, `PERMANENT_CUSTOM_WORKS_KEY`, `CATALOG_HIDDEN_KEY` (`az_flipping_catalog_hidden_v1`), `ARTISAN_KEY` (`az_flipping_artisans_v1`). Ogni nuovo dato persistente va aggiunto anche al backup e all'import.
- Funzioni chiave: `blankProject`, `getWorks(includeHidden)`, `findWork`, `getProjectPrice`, `calculateProjectTotals`, `lockProjectPrices`, `hideWorkInProject`, `importBackup`, `quoteUseInProject`.
- Dopo ogni modifica lancia tutti i test in `test/` (vedi README). Devono passare tutti, compreso il controllo "nessun errore JS".
