# Proxy per il relinker RAI

## Perché serve

`mediapolis.rai.it` restituisce l'URL firmato del flusso RAI **solo** all'origine
`https://www.raiplay.it`. Da qualsiasi altro dominio il browser blocca la lettura
per CORS, quindi una pagina statica come questa non puo' risolvere l'URL.

Il resto e' libero: il master, la chiave AES-128 (16 byte) e i segmenti arrivano
dal CDN Rai con `Access-Control-Allow-Origin` aperto. Serve solo qualcuno che
legga quel singolo XML da un server.

Questo Worker fa esattamente questo, e nient'altro:

- accetta una sola destinazione ammessa (`https://mediapolis.rai.it/relinker/`),
  quindi non e' un proxy aperto;
- restituisce l'XML con CORS aperto;
- non tocca il video: i segmenti arrivano direttamente dal CDN Rai al televisore;
- non aggira nessun DRM: il flusso RAI e' cifrato in AES-128, che hls.js decifra
  regolarmente con la chiave pubblica servita dal CDN.

Consumo: qualche centinaio di byte per cambio canale. Il piano gratuito Cloudflare
(100.000 richieste al giorno) e' ampiamente sufficiente.

## Deploy senza installare nulla (5 minuti)

1. Crea un account gratuito su <https://dash.cloudflare.com/sign-up>.
2. Nel pannello: **Workers & Pages** -> **Create** -> **Worker** -> **Create Worker**.
3. Dai un nome, per esempio `relinker-rai`, poi **Deploy**.
4. **Edit code**, cancella il contenuto di esempio e incolla tutto il contenuto di
   `worker/index.mjs`. Poi **Deploy**.
5. Copia l'indirizzo del Worker: assomiglia a
   `https://relinker-rai.tuonome.workers.dev`.

## Verifica che funzioni

Apri nel browser, sostituendo il tuo indirizzo:

```
https://relinker-rai.tuonome.workers.dev/?url=https%3A%2F%2Fmediapolis.rai.it%2Frelinker%2FrelinkerServlet.htm%3Fcont%3D2606803%26output%3D64
```

Devi vedere un XML che inizia con `<Mediapolis>` e contiene un indirizzo
`https://raiuno1-live.akamaized.net/....m3u8?...`.

Se vedi un JSON con `"error"`, il parametro `url` non e' codificato correttamente
oppure la destinazione non e' il relinker Rai.

## Attivare il proxy nell'app

In `data/channels.js`, imposta `raiProxy` con l'indirizzo del Worker **seguito da
`?url=`**:

```js
window.APP_CONFIG = {
  raiProxy: "https://relinker-rai.tuonome.workers.dev/?url="
};
```

L'app aggiunge da sola l'URL del relinker codificato. Fatto: i canali RAI passano
da `WEB` a `LIVE` e vengono riprodotti dentro l'app.

## Deploy da riga di comando (alternativa)

```bash
npm install -g wrangler
cd worker
wrangler login
wrangler deploy
```

`wrangler.toml` e' gia' configurato con `main = "index.mjs"`.
