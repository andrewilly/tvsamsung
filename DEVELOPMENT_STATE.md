# Development State — DTV Stream (`TVSamsung`)

> **File di stato per l'agente**: LEGGERE QUESTO FILE ALL'INIZIO DI OGNI SESSIONE
> (anche con resume) PRIMA di analizzare il progetto. Aggiornare dopo ogni lavoro rilevante.

Ultimo aggiornamento: 2026-11-01 (progetto completo e funzionante sul televisore; EPG valutato e scartato su decisione dell'utente)

---

## 1. Identità del progetto

- **DTV Stream** (cartella `TVSamsung`): webapp statica che raccoglie i canali TV italiani
  in **ordine LCN** e li riproduce via internet su **Samsung UE49NU8000** (2018, Tizen 4.0),
  per sopperire a un problema dell'antenna terrestre.
- **Non è un'app Tizen**: nulla viene installato sul televisore. Si usa dal browser
  "Internet" del TV. Questa è una scelta, non una limitazione tecnica: evita SDK,
  certificati Samsung, Developer Mode e `sdb`.
- Repo: `github.com/andrewilly/tvsamsung` (pubblico) — Sito: `https://andrewilly.github.io/tvsamsung/`
- Progetto nato il **2026-11-01**. Nessuna dipendenza, nessun build step, nessun framework.

## 2. Versione e commit correnti

- **HEAD**: `600e59f` — "Worker RAI deployato e collegato all'app"
- Branch `main` **allineato a `origin/main`**, working tree pulito, nessun file non tracciato.
- Cronologia dei commit di giornata:
  - `14d04cb` MVP: griglia DTV, player HLS, pubblicazione su GitHub Pages
  - `1ad7ddf` modalità `resolve` + Worker sul relinker RAI
  - `e43e19a` catena di proxy + server locale (`proxy/serve.py`)
  - `5395beb` scheda informativa RAI al posto del rinvio a RaiPlay
  - `600e59f` Worker Cloudflare deployato e collegato
- Identità git: `andrewilly <andrewilly@users.noreply.github.com>`.

## 3. Stato verificato sul televisore (2026-11-01)

**L'utente ha confermato che RAI parte sul TV.** Stato reale dei 17 canali in griglia:

| Gruppo | Canali | Come funziona | Verifica |
|---|---|---|---|
| Mediaset (9) | Rete 4, Canale 5, Italia 1, 20, Iris, La5, Cine34, Mediaset Extra, Italia 2 | HLS in chiaro riprodotto in-app | master + variante senza `EXT-X-KEY`, CORS ok |
| RAI (7) | Rai 1, 2, 3, 4, 5, News 24, Sport | URL firmato risolto a runtime via Worker | catena completa + conferma sul TV |
| Cairo (1) | La7 | apre il player ufficiale | flusso DRM FairPlay: non riproducibile |

## 4. Architettura e decisioni (con la motivazione)

Tre modalità per canale, dichiarate in `data/channels.js`:

- **`hls`** — flusso HLS in chiaro, riprodotto dentro l'app (`assets/app.js` → `attachHls`/`attachNative`).
- **`resolve`** — l'URL è firmato: l'app lo chiede a runtime a un proxy (`resolveStream`),
  lo estrae dal XML e lo riproduce. Usato per RAI.
- **`link`** — il canale è protetto da DRM: si apre il player ufficiale. Usato per La7.

### Perché RAI non può essere "diretta" come Mediaset

Il flusso RAI **non è DRM**: è cifrato **AES-128**, che hls.js decifra regolarmente con la
chiave servita dal CDN (16 byte, CORS aperto). Il problema è il **relinker** che firma l'URL:
`mediapolis.rai.it/relinker/relinkerServlet.htm?cont=<id>&output=64` risponde con header
`Access-Control-Allow-Origin` **solo** all'origine `https://www.raiplay.it`. Verificato:
con `Origin: https://www.raiplay.it` echo dell'header; con qualunque altra origine, nessun
header. Non è aggirabile dal browser: serve un passaggio lato server.

Il resto è libero: master, variante (1080 segmenti), chiave AES e segmenti mandano tutti
`Access-Control-Allow-Origin` corretto verso `andrewilly.github.io`.

### Perché La7 no

`d15umi5iaezxgx.cloudfront.net/LA7/DRM/HLS-B/Live.m3u8` usa `METHOD=SAMPLE-AES` con
`KEYFORMAT="com.apple.streamingkeydelivery"` (FairPlay). Non riproducibile e **non va aggirato**.

### Perché non si incorpora RaiPlay in un iframe

`raiplay.it/dirette/raiX` non blocca l'incorporamento (nessun `X-Frame-Options`), ma il sito
è una SPA del 2026 che **non gira su Chromium 63** (il motore del TV 2018): l'utente vede la
pagina ma il player non parte. Inoltre, con l'iframe i tasti del telecomando restano catturati
dal frame e non si tornerebbe più alla griglia.

### Catena dei proxy

`APP_CONFIG.raiProxies` è una lista ordinata; il primo che risponde vince:

1. `https://relinker-rai.andrewilly.workers.dev/?url=` — sempre attivo, indipendente dal Mac
2. `/__relinker?url=` — funziona solo quando l'app è servita da `proxy/serve.py`

Il badge `LIVE`/`WEB` delle tile RAI si basa su `hasRemoteProxy()` oppure sulla sonda
`/__ready` del server locale: **non promette ciò che non funziona**.

## 5. Infrastruttura

### Worker Cloudflare (produzione)

- Nome: **`relinker-rai`**, URL: `https://relinker-rai.andrewilly.workers.dev/?url=<relinker-url-encoded>`
- Account: `3fceb1c5689efadc237dd9d56633d2b6` · sottodominio creato in questa sessione: `andrewilly.workers.dev`
- Codice: `worker/index.mjs` (ES module). Accetta **solo** `https://mediapolis.rai.it/relinker/`
  (403 su tutto il resto): non è un proxy aperto. Preflight 204, CORS `*`, `no-store`.
- Deploy via API (senza `wrangler`): `PUT /accounts/{id}/workers/scripts/relinker-rai`
  con multipart `metadata={"main_module":"index.mjs"}` + file; poi
  `POST .../subdomain {"enabled":true}`. **La propagazione DNS/TLS richiede ~2 minuti**:
  fino ad allora la connessione fallisce con `sslv3 alert handshake failure`.
- Deploy alternativo documentato in `worker/README.md` (dashboard o `wrangler`).

### GitHub Pages (frontend)

- Pubblica `main` dalla root. **`Cache-Control: max-age=600`**: il browser del TV non ha
  ricarica forzata, quindi dopo una modifica agli asset va incrementato `?v=` nei tag
  `<script>`/`<link>` di `index.html` (attualmente `?v=2`) e riaperto il sito con un
  `?v=` nuovo per invalidare anche l'HTML.

### Server locale (riserva, opzionale)

- `proxy/serve.py` (Python 3, sola stdlib): serve l'app **ed** espone `/__relinker` e `/__ready`.
- `Avvia DTV Stream.command`: doppio clic per avviarlo.
- Vincoli reali: il Mac deve essere acceso; macOS ha il firewall attivo e **LuLu** in
  esecuzione, quindi al primo collegamento del TV va autorizzato `python3`.
- In questa modalità si apre l'app **dall'indirizzo del Mac** (es. `http://192.168.188.121:8080/`),
  non da GitHub Pages: una pagina HTTPS non può chiamare un proxy HTTP in LAN (mixed content).

## 6. Vincoli di compatibilità (Chromium 63)

Il browser del 2018 non conosce tutto ciò che è recente. **Non introdurre**:

- CSS: `flex gap`, `aspect-ratio`, `clamp()`, `backdrop-filter`, `:focus-visible`
- JS: optional chaining, nullish coalescing, `Array.prototype.at`, `replaceAll`, `Promise.allSettled`
- Preferire `XMLHttpRequest` a `fetch` (usato di proposito in `resolveStream`)
- hls.js: caricato `1.x`, con ripiego automatico su `0.14.x` (ES5) se il motore rifiuta la sintassi

## 7. Verifiche eseguite e come rifarle

Banco di prova usato in sviluppo (non è nel repo, va ricreato in `/tmp`):

- pagina di test che carica `index.html` in un iframe **same-origin**, invia `KeyboardEvent`
  sintetici e riporta gli esiti con una `Image()` verso un endpoint del server di test;
  un'immagine "lenta" tiene vivo il browser headless fino al termine del test.
- **Esiti registrati**: griglia 17 tile, focus, frecce, numpad, badge, apertura canale HLS,
  ritorno alla griglia (10/10); scheda proxy assente (2 pulsanti, testo corretto);
  badge RAI `LIVE` + hls.js agganciato (`src=blob:`) con Worker remoto e con proxy locale.
- **Worker**: 8/8 test eseguiti con Node (`worker/index.mjs` importato e invocato con `Request`).
- **Limite del banco di prova**: il Firefox headless di questa macchina **non decodifica H.264**
  via MSE — fallisce con `mediaError`/`bufferAppendError` **anche su Mediaset**. Non è un bug
  dell'app: la decodifica si valida solo sul televisore.

## 8. Limiti noti e cose NON fatte

- **La7**: DRM FairPlay. Resta un pulsante verso il player ufficiale; se il browser del TV non
  lo riproduce, le alternative sono l'app La7 dello store o un dispositivo esterno.
- **EPG (titolo del programma nei riquadri): valutato e SCARTATO su decisione dell'utente**
  (2026-11-01). Evidenze raccolte, da non ripetere:
  - RAI: `dirette/raiX.json` ha `program_title` **vuoto**; `guidatv.json` contiene solo
    l'elenco canali; `/guidatv` è una SPA senza titoli nell'HTML; `/palinsesto/app/...json`
    404 in tutte le forme provate; `guidatv.rai.it` reindirizza alla stessa SPA. **Nessuna fonte.**
  - Mediaset: l'API EPG reale (`allListingFeedEpg?byCallSign=`) risolve su **IP privati
    `10.68.x.x`** (endpoint VPC). I titoli però sono nel payload della pagina `/guidatv`
    (1,19 MB): estraibili 182 voci `startTime`+`title` raggruppate per `callSign`.
    Fattibile solo raschiando → fragile, e coprirebbe 9 canali su 17.
  - Terze parti: `staseraintv.com` copre tutti i canali ma solo la prima serata.
- **Tasti numerici e CH+/−**: nel browser del TV non arrivano alla pagina. Servirebbe un
  wrapper Tizen (app di ~30 righe con iframe + `postMessage`) per l'icona in Smart Hub e i tasti.
- **Flussi**: endpoint pubblici dei broadcaster, possono cambiare senza preavviso. Mediaset è
  geolimitato all'Italia.

## 9. Segreti e sicurezza

- **Nessun segreto nel repo né nella storia git** (verificato con `git log -S`).
- Il **token API Cloudflare è stato incollato in chat** dall'utente il 2026-11-01: non serve più,
  va revocato dal pannello (My Profile → API Tokens).
- Il Worker non è un proxy aperto: destinazione vincolata al relinker Rai.

## 10. Prossimi passi possibili (nessuno richiesto al momento)

1. **EPG** — solo se compare una fonte stabile e simmetrica (RAI + Mediaset).
2. **La7** — verificare se il player ufficiale funziona su quel TV; altrimenti dispositivo esterno.
3. **Wrapper Tizen** — solo se i tasti numerici diventano un requisito: richiede la catena
   certificati Samsung (una tantum) e un `sdb` da 1 MB per l'installazione.
   Il codice dell'app resta valido: il wrapper carica la stessa pagina.

## 11. Note operative per l'agente

- **Non introdurre build step, framework o dipendenze**: il progetto è file statici serviti
  così come sono.
- Prima di modificare: leggere questo file e i sorgenti coinvolti (`data/channels.js`,
  `assets/app.js`, `worker/index.mjs`).
- Dopo ogni modifica agli asset: **incrementare `?v=` in `index.html`**, altrimenti il TV
  continua a usare la copia in cache per 10 minuti.
- Verificare sul televisore, non solo in headless: la decodifica non è testabile qui.
- Commit e push su `main` con identità `andrewilly <andrewilly@users.noreply.github.com>`.
- Non aggirare mai il DRM di La7, né introdurre endpoint non ufficiali che ridistribuiscono
  i flussi: sono stati esclusi di proposito (i mirror trovati durante la ricerca).
