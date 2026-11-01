# DTV Stream

Interfaccia web a tutto schermo per smart TV Samsung, che raccoglie i canali
italiani in **ordine digitale terrestre** e li apre via internet, senza dipendere
dall'antenna.

Nessuna app da installare sul televisore: si apre con il browser del TV.

## Come funziona

L'app presenta una griglia numerata secondo l'LCN italiano (1, 2, 3, 4, 5, 6, 7, 20, 21...).
Ogni riquadro mostra numero, nome del canale e rete. Selezionando un canale si apre
in uno dei due modi previsti:

- **LIVE** - il flusso HLS e' in chiaro e viene riprodotto dentro l'app.
- **WEB** - il canale e' protetto da DRM, quindi si apre il player ufficiale del
  broadcaster. Nessuna protezione viene aggirata.

Ogni canale e' configurato in `data/channels.js` con il campo `mode`:

```js
{ lcn: 5, name: "Canale 5", network: "mediaset", mode: "hls",  url: "https://..." }
{ lcn: 1, name: "Rai 1",    network: "rai",      mode: "link", url: "https://www.raiplay.it/dirette/rai1" }
```

## Stato verificato il 2026-11-01 (rete italiana)

| Canale | LCN | Modalita' | Verifica |
|---|---|---|---|
| Rai 1 / 2 / 3 | 1-3 | WEB (RaiPlay) | pagine dirette raggiungibili, player ufficiale |
| Rete 4, Canale 5, Italia 1 | 4-6 | LIVE | HLS in chiaro, nessuna chiave DRM, CORS ok |
| La7 | 7 | WEB (La7play) | flusso ufficiale protetto da DRM FairPlay |
| 20, Iris, La5, Cine34, Mediaset Extra, Italia 2 | 20-66 | LIVE | HLS in chiaro, CORS ok |
| Rai 4, Rai 5, Rai News 24, Rai Sport | 21-58 | WEB (RaiPlay) | pagine dirette raggiungibili |

Dettagli tecnici dietro le due modalita':

- **Mediaset**: `live02-seg.msf.cdn.mediaset.net` serve manifest HLS senza `EXT-X-KEY`
  e con `Access-Control-Allow-Origin`, quindi hls.js riesce a leggerli dal browser.
  I flussi sono geolimitati: funzionano dalla rete italiana.
- **Rai**: il relinker ufficiale restituisce URL firmati con scadenza di 150 secondi
  e non espone header CORS; una pagina statica non puo' leggerli. Le pagine
  `raiplay.it/dirette/*` non bloccano l'incorporamento, ma conviene aprire il player
  ufficiale a pagina intera: dentro un iframe i tasti del telecomando restano
  catturati e non si tornerebbe piu' alla griglia.
- **La7**: il flusso ufficiale usa `SAMPLE-AES` con keyformat FairPlay. Non e'
  riproducibile e non va aggirato.

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

- I canali con DRM (Rai, La7) non vengono riprodotti dentro l'app: si apre il player
  ufficiale. Non e' una scelta di comodo, e' l'unica via legittima.
- I flussi LIVE sono endpoint pubblici dei broadcaster e possono cambiare senza
  preavviso. Se un canale smette di funzionare, aggiorna l'URL in `data/channels.js`.
- La qualita' dipende dalla connessione e dalla CDN del broadcaster.
- Il browser del TV mostra la propria barra degli indirizzi: non esiste una modalita'
  kiosk sul firmware consumer.
