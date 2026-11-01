# DTV Stream

Interfaccia web a tutto schermo per smart TV Samsung, che raccoglie i canali
italiani in **ordine digitale terrestre** e li apre via internet, senza dipendere
dall'antenna.

Nessuna app da installare sul televisore: si apre con il browser del TV.

## Come funziona

L'app presenta una griglia numerata secondo l'LCN italiano (1, 2, 3, 4, 5, 6, 7, 20, 21...).
Ogni riquadro mostra numero, nome del canale e rete. Il canale si apre in uno di tre modi:

- **LIVE** (`mode: "hls"`) - il flusso HLS e' in chiaro e viene riprodotto dentro l'app.
- **LIVE** (`mode: "resolve"`) - il flusso e' protetto da token: l'app lo risolve a
  runtime tramite un piccolo proxy dichiarato in `APP_CONFIG.raiProxy`, poi lo riproduce.
  Senza proxy configurato questi canali mostrano **WEB** e il pulsante "Apri RaiPlay".
- **WEB** (`mode: "link"`) - il canale e' protetto da DRM: si apre il player ufficiale
  del broadcaster. Nessuna protezione viene aggirata.

```js
window.APP_CONFIG = { raiProxies: ["/__relinker?url="] };

{ lcn: 5, name: "Canale 5", network: "mediaset", mode: "hls", url: "https://...m3u8" }
{ lcn: 1, name: "Rai 1",    network: "rai",      mode: "resolve",
  url: "https://www.raiplay.it/dirette/rai1",
  streamUrl: "https://mediapolis.rai.it/relinker/relinkerServlet.htm?cont=2606803&output=64" }
```

## Stato verificato il 2026-11-01 (rete italiana)

| Canale | LCN | Modalita' | Verifica |
|---|---|---|---|
| Rete 4, Canale 5, Italia 1, 20, Iris, La5, Cine34, Mediaset Extra, Italia 2 | 4-66 | LIVE | HLS in chiaro, nessuna chiave DRM, CORS aperto |
| Rai 1, Rai 2, Rai 3, Rai 4, Rai 5, Rai News 24, Rai Sport | 1-58 | LIVE con proxy / WEB senza | HLS con AES-128, master e chiave con CORS aperto, URL da risolvere via relinker |
| La7 | 7 | WEB (La7play) | flusso ufficiale protetto da DRM FairPlay |

Dettagli tecnici dietro le modalita':

- **Mediaset**: `live02-seg.msf.cdn.mediaset.net` serve manifest HLS senza `EXT-X-KEY`
  e con `Access-Control-Allow-Origin`, quindi hls.js riesce a leggerli dal browser.
  I flussi sono geolimitati: funzionano dalla rete italiana.
- **Rai**: il flusso e' cifrato **AES-128**, non DRM: hls.js lo decifra con la chiave
  servita dal CDN (16 byte, CORS aperto). L'unico ostacolo e' il *relinker* che firma
  l'URL: risponde con header CORS solo a `https://www.raiplay.it`, quindi da un altro
  dominio il browser non puo' leggere la risposta. Serve un passaggio lato server:
  vedi **`worker/README.md`**.
- **La7**: il flusso ufficiale usa `SAMPLE-AES` con keyformat FairPlay. Non e'
  riproducibile e non va aggirato.

Verifica della catena di risoluzione RAI eseguita il 2026-11-01: proxy -> XML
`<Mediapolis>` -> estrazione URL -> master HTTP 200 -> 4 varianti -> 1080 segmenti
caricati. Il Worker e' coperto da 8 test automatici (`PASS` su destinazione
consentita, rifiuto delle altre, preflight, CORS, XML, estrazione URL).

## Attivare i canali RAI

I canali RAI hanno bisogno di un proxy che legga il relinker: senza, restano su
`WEB` e mostrano il pulsante "Apri RaiPlay". Due modi.

### Subito, senza account (richiede il Mac acceso)

```bash
python3 proxy/serve.py
```

Il server serve l'app **e** espone `/__relinker`. All'avvio stampa l'indirizzo da
aprire sul televisore, del tipo `http://192.168.1.20:8080/`.

Nota: in questa modalita' devi aprire l'app da quell'indirizzo, non da GitHub Pages.
Una pagina HTTPS non puo' chiamare un proxy HTTP in rete locale: il browser
bloccherebbe la richiesta per mixed content.

Il badge delle tile RAI passa a `LIVE` solo quando la sonda `/__ready` conferma che
il proxy locale risponde, quindi non promette nulla che non funzioni.

### Permanente, indipendente dal Mac (Cloudflare, gratis)

Il Worker e' **gia' deployato** su `relinker-rai.andrewilly.workers.dev` ed e' quello
che l'app usa per primo. Per averne uno tuo, vedi [`worker/README.md`](worker/README.md),
poi mettilo in testa alla lista in `data/channels.js`:

   ```js
   window.APP_CONFIG = {
     raiProxies: [
       "https://relinker-rai.tuonome.workers.dev/?url=",
       "/__relinker?url="
     ]
   };
   ```

   Nota: dopo ogni modifica ad `assets/` conviene incrementare `?v=` nei tag
   `<script>` di `index.html`, perche' GitHub Pages mette in cache i file per
   10 minuti e il browser del televisore non ha un "ricarica forzata".

L'app prova i proxy in ordine: il primo che risponde vince. Cosi' GitHub Pages usa
il Worker e l'eventuale server locale continua a funzionare.

## Uso sul televisore

1. Apri l'app **Internet** del Samsung.
2. Vai all'indirizzo pubblicato su GitHub Pages.
3. Aggiungi la pagina ai preferiti per ritrovarla in due passaggi.

Comandi con il telecomando:

- frecce direzionali: muoviti nella griglia
- OK: guarda il canale selezionato
- cifre 0-9: vai direttamente al numero di canale (es. `4` poi OK)
- RETURN / ESC: torna ai canali
- nella schermata di visione: frecce sinistra/destra cambiano canale

## Compatibilita'

Il browser dei Samsung 2018 (Tizen 4.0) e' basato su Chromium 63. Il codice evita
proposito tutto cio' che non esiste in quel motore:

- niente `flex gap`, `aspect-ratio`, `clamp()`, `backdrop-filter`, `:focus-visible`
- JavaScript senza optional chaining e senza nullish coalescing
- XHR invece di `fetch` per la risoluzione, cosi' funziona anche sui motori datati
- hls.js caricato come `1.x` e, se il motore lo rifiuta, ripiego automatico su
  `0.14.x` che e' ES5

Se il browser non supporta ne' HLS nativo ne' Media Source Extensions, l'app lo dice
e propone l'apertura del sito ufficiale invece di lasciare uno schermo nero.

## Sviluppo in locale

```bash
python3 -m http.server 8000
# poi apri http://localhost:8000
```

Non serve alcun build: sono file statici.

## Aggiornare i canali

Modifica `data/channels.js` e fai commit. Nessuna ricompilazione, nessun deploy
manuale: GitHub Pages serve la versione aggiornata dopo pochi istanti.

## Pubblicazione

Lo script `scripts/publish.sh` crea il repository e attiva GitHub Pages.
Serve un token GitHub con permesso di creare repository.

```bash
GITHUB_TOKEN=... ./scripts/publish.sh
```

## Limiti dichiarati

- I canali con DRM (La7) non vengono riprodotti dentro l'app: si apre il player
  ufficiale. Non e' una scelta di comodo, e' l'unica via legittima.
- I canali RAI richiedono il proxy: senza, restano sul player ufficiale.
- I flussi LIVE sono endpoint pubblici dei broadcaster e possono cambiare senza
  preavviso. Se un canale smette di funzionare, aggiorna l'URL in `data/channels.js`.
- La qualita' dipende dalla connessione e dalla CDN del broadcaster.
- Il browser del TV mostra la propria barra degli indirizzi: non esiste una modalita'
  kiosk sul firmware consumer.
