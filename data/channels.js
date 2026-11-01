/*
 * Configurazione dell'app.
 *
 * raiProxy: indirizzo del servizio che legge il relinker RAI.
 * Il relinker ufficiale (mediapolis.rai.it) espone gli URL firmati solo
 * all'origine www.raiplay.it: un browser su un altro dominio non puo' leggerli.
 * Con questo proxy i canali RAI vengono riprodotti dentro l'app invece di
 * rimandare al sito ufficiale. Vedi worker/README.md per attivarlo.
 *
 * Va lasciato vuoto per disattivare la risoluzione: in quel caso i canali RAI
 * mostrano il pulsante "Apri RaiPlay".
 */
window.APP_CONFIG = {
  raiProxy: ""
};

/*
 * Elenco canali in ordine DTV (LCN italiano).
 *
 * mode: "hls"     -> flusso HLS in chiaro, riprodotto dentro l'app.
 *       "resolve" -> URL firmato da ottenere a runtime tramite raiProxy.
 *       "link"    -> si apre il player ufficiale del broadcaster (DRM rispettato).
 *
 * Verificato il 2026-11-01 dalla rete italiana:
 *   - Mediaset (live02-seg.msf.cdn.mediaset.net): HLS in chiaro, nessuna chiave DRM,
 *     Access-Control-Allow-Origin presente -> riproducibile in-app.
 *   - RAI: flusso HLS con cifratura AES-128 (non DRM: hls.js la decifra),
 *     ma il relinker che firma l'URL risponde solo all'origine www.raiplay.it.
 *     Chiave e segmenti hanno CORS libero: basta leggere l'XML tramite proxy.
 *   - La7: flusso ufficiale protetto da DRM (SAMPLE-AES / FairPlay).
 *     Unica via legittima: aprire il player ufficiale La7play.
 */
window.CHANNELS = [
  { lcn: 1,  name: "Rai 1",         network: "rai",      mode: "resolve",
    url: "https://www.raiplay.it/dirette/rai1",
    streamUrl: "https://mediapolis.rai.it/relinker/relinkerServlet.htm?cont=2606803&output=64" },
  { lcn: 2,  name: "Rai 2",         network: "rai",      mode: "resolve",
    url: "https://www.raiplay.it/dirette/rai2",
    streamUrl: "https://mediapolis.rai.it/relinker/relinkerServlet.htm?cont=308718&output=64" },
  { lcn: 3,  name: "Rai 3",         network: "rai",      mode: "resolve",
    url: "https://www.raiplay.it/dirette/rai3",
    streamUrl: "https://mediapolis.rai.it/relinker/relinkerServlet.htm?cont=308709&output=64" },
  { lcn: 4,  name: "Rete 4",        network: "mediaset", mode: "hls",
    url: "https://live02-seg.msf.cdn.mediaset.net/live/ch-r4/r4-clr.isml/index.m3u8" },
  { lcn: 5,  name: "Canale 5",      network: "mediaset", mode: "hls",
    url: "https://live02-seg.msf.cdn.mediaset.net/live/ch-c5/c5-clr.isml/index.m3u8" },
  { lcn: 6,  name: "Italia 1",      network: "mediaset", mode: "hls",
    url: "https://live02-seg.msf.cdn.mediaset.net/live/ch-i1/i1-clr.isml/index.m3u8" },
  { lcn: 7,  name: "La7",           network: "cairo",    mode: "link",
    url: "https://www.la7play.it/dirette/la7" },
  { lcn: 20, name: "20",            network: "mediaset", mode: "hls",
    url: "https://live02-seg.msf.cdn.mediaset.net/live/ch-lb/lb-clr.isml/index.m3u8" },
  { lcn: 21, name: "Rai 4",         network: "rai",      mode: "resolve",
    url: "https://www.raiplay.it/dirette/rai4",
    streamUrl: "https://mediapolis.rai.it/relinker/relinkerServlet.htm?cont=746966&output=64" },
  { lcn: 22, name: "Iris",          network: "mediaset", mode: "hls",
    url: "https://live02-seg.msf.cdn.mediaset.net/live/ch-ki/ki-clr.isml/index.m3u8" },
  { lcn: 23, name: "Rai 5",         network: "rai",      mode: "resolve",
    url: "https://www.raiplay.it/dirette/rai5",
    streamUrl: "https://mediapolis.rai.it/relinker/relinkerServlet.htm?cont=395276&output=64" },
  { lcn: 30, name: "La5",           network: "mediaset", mode: "hls",
    url: "https://live02-seg.msf.cdn.mediaset.net/live/ch-ka/ka-clr.isml/index.m3u8" },
  { lcn: 34, name: "Cine34",        network: "mediaset", mode: "hls",
    url: "https://live02-seg.msf.cdn.mediaset.net/live/ch-b6/b6-clr.isml/index.m3u8" },
  { lcn: 48, name: "Rai News 24",   network: "rai",      mode: "resolve",
    url: "https://www.raiplay.it/dirette/rainews24",
    streamUrl: "https://mediapolis.rai.it/relinker/relinkerServlet.htm?cont=1&output=64" },
  { lcn: 55, name: "Mediaset Extra",network: "mediaset", mode: "hls",
    url: "https://live02-seg.msf.cdn.mediaset.net/live/ch-kq/kq-clr.isml/index.m3u8" },
  { lcn: 58, name: "Rai Sport",     network: "rai",      mode: "resolve",
    url: "https://www.raiplay.it/dirette/raisport",
    streamUrl: "https://mediapolis.rai.it/relinker/relinkerServlet.htm?cont=358025&output=64" },
  { lcn: 66, name: "Italia 2",      network: "mediaset", mode: "hls",
    url: "https://live02-seg.msf.cdn.mediaset.net/live/ch-i2/i2-clr.isml/index.m3u8" }
];

window.NETWORK_LABELS = {
  rai: "Rai",
  mediaset: "Mediaset",
  cairo: "Cairo"
};
