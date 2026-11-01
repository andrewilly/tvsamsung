/*
 * Elenco canali in ordine DTV (LCN italiano).
 *
 * mode: "hls"  -> flusso HLS in chiaro, riprodotto dentro l'app.
 *        "link" -> si apre il player ufficiale del broadcaster (nessun DRM aggirato).
 *
 * Verificato il 2026-11-01 dalla rete italiana:
 *   - Mediaset (live02-seg.msf.cdn.mediaset.net): HLS in chiaro, nessuna chiave DRM,
 *     Access-Control-Allow-Origin presente -> riproducibile in-app.
 *   - RAI: il relinker ufficiale restituisce URL firmati con scadenza di 150 secondi
 *     e non espone header CORS, quindi un'app web statica non puo' leggerli.
 *     Unica via legittima: aprire il player ufficiale RaiPlay.
 *   - La7: flusso ufficiale protetto da DRM (SAMPLE-AES / FairPlay).
 *     Unica via legittima: aprire il player ufficiale La7play.
 *
 * Per aggiornare un canale basta modificare questo file: nessun build, nessun deploy
 * oltre al commit.
 */
window.CHANNELS = [
  { lcn: 1,  name: "Rai 1",         network: "rai",      mode: "link", url: "https://www.raiplay.it/dirette/rai1" },
  { lcn: 2,  name: "Rai 2",         network: "rai",      mode: "link", url: "https://www.raiplay.it/dirette/rai2" },
  { lcn: 3,  name: "Rai 3",         network: "rai",      mode: "link", url: "https://www.raiplay.it/dirette/rai3" },
  { lcn: 4,  name: "Rete 4",        network: "mediaset", mode: "hls",  url: "https://live02-seg.msf.cdn.mediaset.net/live/ch-r4/r4-clr.isml/index.m3u8" },
  { lcn: 5,  name: "Canale 5",      network: "mediaset", mode: "hls",  url: "https://live02-seg.msf.cdn.mediaset.net/live/ch-c5/c5-clr.isml/index.m3u8" },
  { lcn: 6,  name: "Italia 1",      network: "mediaset", mode: "hls",  url: "https://live02-seg.msf.cdn.mediaset.net/live/ch-i1/i1-clr.isml/index.m3u8" },
  { lcn: 7,  name: "La7",           network: "cairo",    mode: "link", url: "https://www.la7play.it/dirette/la7" },
  { lcn: 20, name: "20",            network: "mediaset", mode: "hls",  url: "https://live02-seg.msf.cdn.mediaset.net/live/ch-lb/lb-clr.isml/index.m3u8" },
  { lcn: 21, name: "Rai 4",         network: "rai",      mode: "link", url: "https://www.raiplay.it/dirette/rai4" },
  { lcn: 22, name: "Iris",          network: "mediaset", mode: "hls",  url: "https://live02-seg.msf.cdn.mediaset.net/live/ch-ki/ki-clr.isml/index.m3u8" },
  { lcn: 23, name: "Rai 5",         network: "rai",      mode: "link", url: "https://www.raiplay.it/dirette/rai5" },
  { lcn: 30, name: "La5",           network: "mediaset", mode: "hls",  url: "https://live02-seg.msf.cdn.mediaset.net/live/ch-ka/ka-clr.isml/index.m3u8" },
  { lcn: 34, name: "Cine34",        network: "mediaset", mode: "hls",  url: "https://live02-seg.msf.cdn.mediaset.net/live/ch-b6/b6-clr.isml/index.m3u8" },
  { lcn: 48, name: "Rai News 24",   network: "rai",      mode: "link", url: "https://www.raiplay.it/dirette/rainews24" },
  { lcn: 55, name: "Mediaset Extra",network: "mediaset", mode: "hls",  url: "https://live02-seg.msf.cdn.mediaset.net/live/ch-kq/kq-clr.isml/index.m3u8" },
  { lcn: 58, name: "Rai Sport",     network: "rai",      mode: "link", url: "https://www.raiplay.it/dirette/raisport" },
  { lcn: 66, name: "Italia 2",      network: "mediaset", mode: "hls",  url: "https://live02-seg.msf.cdn.mediaset.net/live/ch-i2/i2-clr.isml/index.m3u8" }
];

window.NETWORK_LABELS = {
  rai: "Rai",
  mediaset: "Mediaset",
  cairo: "Cairo"
};
