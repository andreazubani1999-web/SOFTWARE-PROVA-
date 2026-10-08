# Note per Claude

## Regole di lavoro (obbligatorie)
- **Niente accondiscendenza.** Non dare ragione ad Andrea solo per compiacerlo. Se un'idea ha un problema, dillo chiaramente e spiega perché.
- **Chiedi prima di modificare il codice.** Prima di toccare qualsiasi file, riassumi in poche righe cosa farai e chiedi "Posso procedere?". Inizia solo dopo il suo sì.
- **Lavora sempre su un ramo separato, mai su `main`.** `main` è il sito pubblicato. Non unire nulla a `main` (merge, push diretto o pull request da unire) senza il permesso esplicito di Andrea.
- **Non cambiare mai codici, unità di misura e prezzi di default delle voci** del catalogo (`COMPUTO_WORKS`). Si possono aggiungere voci nuove, ma solo dopo averlo chiesto.

## Struttura dell'app
- Tutta l'app sta in `index.html` (~20.000 righe: HTML, CSS e JS inline, nessuna build). L'interfaccia e i commenti sono in italiano.
- `APP_VERSION` è definita in `index.html`. Alla data dell'import era `1.4`.
- Chiavi `localStorage`: `STORAGE_KEY`, `GLOBAL_PRICES_KEY`, `PRICE_LIBRARIES_KEY`, `ACTIVE_PRICE_LIBRARY_KEY`, `PERMANENT_CUSTOM_WORKS_KEY`, `CATALOG_HIDDEN_KEY` (`az_flipping_catalog_hidden_v1`), `ARTISAN_KEY` (`az_flipping_artisans_v1`). Ogni nuovo dato persistente va aggiunto anche al backup e all'import.
- Funzioni chiave: `blankProject`, `getWorks(includeHidden)`, `findWork`, `getProjectPrice`, `calculateProjectTotals`, `lockProjectPrices`, `hideWorkInProject`, `importBackup`, `quoteUseInProject`.
- Fiscalità: Andrea opera tramite una società di capitali (S.r.l.), non come persona fisica. Le imposte sono calcolate in `calculateProjectTotals` con le impostazioni di `companyTaxSettings` (valori iniziali in `COMPANY_TAX_DEFAULTS`). Lo scenario IVA iniziale è "da definire", calcolato come vendita esente con IVA lavori non recuperabile al 10% (caso prudente). I prezzi del computo e dei preventivi sono IVA esclusa. Il vecchio campo `business.capitalGainsTax` non entra più nel calcolo ma va conservato nei dati.
- Salvataggi: usa sempre `safeSetItem` (mai `localStorage.setItem` diretto), così se la memoria è piena compare l'avviso. Limite indicativo circa 5 MB (`STORAGE_LIMIT_CHARS`); planimetria e foto sono base64 dentro il progetto e finiscono nel backup.
- Dopo ogni modifica lancia tutti i test in `test/` (vedi README). Devono passare tutti, compreso il controllo "nessun errore JS".
