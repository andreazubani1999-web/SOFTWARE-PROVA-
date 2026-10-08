# AZ Flipping — Andrea Zubani Flipping Software

App web in un solo file (`index.html`) per gestire operazioni di flipping immobiliare: computo metrico delle lavorazioni, libreria prezzi, piano dell'operazione, business plan, archivio progetti e rubrica artigiani con preventivi.

Funziona offline: basta aprire `index.html` nel browser (anche da telefono, come web app). I dati restano nel `localStorage` del browser. Per spostarli da un dispositivo all'altro si usa il backup JSON, da esportare e reimportare.

## Sezioni dell'app
- **Home** — `home`
- **Piano** — `plan`
- **Computo** — `computo`: 128 voci di catalogo (`COMPUTO_WORKS`), prezzi bloccabili per progetto, voci nascoste per progetto o a livello di catalogo
- **Business** — `business`: Business Plan con imposte della società (S.r.l.), scenario IVA, IRES, IRAP e dividendi
- **Archivio** — `archive`
- **Artigiani** — `artisans`: rubrica, preventivi e copertura delle voci del computo
- **Impostazioni** — `settings`: backup e ripristino

## Test
I test sono script Playwright che aprono `index.html` in Chromium headless.

```bash
export NODE_PATH=$(npm root -g)   # se playwright è installato globalmente
for f in test/t*.js; do node "$f"; done
```

| File | Cosa verifica |
|---|---|
| `test/t0.js` | caricamento senza errori, 128 voci in catalogo |
| `test/t1.js` | blocco prezzi per progetto, voci nascoste (progetto e catalogo), persistenza, ripristino |
| `test/t1b.js` | backup/import con prezzi bloccati e voci nascoste |
| `test/t2.js` | voci 2.11, 4.12, 15.8, 15.9 (prezzi, info, affidabilità), libreria prezzi |
| `test/t3.js` | rubrica artigiani, preventivi usati nel progetto, doppia copertura, backup rubrica |
| `test/t4.js` | imposte della società: scenari IVA, IRES, IRAP, dividendi, caso in perdita, vecchio campo plusvalenza, import di vecchi backup |
| `test/t5.js` | preventivo o artigiano eliminato mentre è usato nei progetti: elenco dei progetti, scelta se togliere le copie, "usato in" |

Per provare un altro file: `APP=/percorso/file.html node test/t1.js`.
