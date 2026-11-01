/*
 * Proxy per il relinker RAI.
 *
 * Perche' esiste: mediapolis.rai.it restituisce l'URL firmato del flusso solo
 * all'origine https://www.raiplay.it. Da qualunque altro dominio il browser
 * blocca la lettura per CORS, quindi una pagina statica non puo' risolvere
 * l'URL. Questo Worker fa una cosa sola: legge quell'XML lato server e lo
 * restituisce con CORS aperto. Non tocca il DRM, non redistribuisce il video:
 * il flusso continua ad arrivare dal CDN Rai direttamente al televisore.
 *
 * Deploy: vedi worker/README.md
 */

const TARGET_PREFIX = 'https://mediapolis.rai.it/relinker/';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': '*',
  'Cache-Control': 'no-store'
};

export default {
  async fetch(request) {
    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: CORS });
    }

    if (request.method !== 'GET') {
      return json({ error: 'metodo non consentito' }, 405);
    }

    const params = new URL(request.url).searchParams;
    const target = params.get('url');

    if (!target) {
      return json({
        error: 'manca il parametro url',
        esempio: 'https://<worker>.workers.dev/?url=https%3A%2F%2Fmediapolis.rai.it%2Frelinker%2FrelinkerServlet.htm%3Fcont%3D2606803%26output%3D64'
      }, 400);
    }

    // Solo il relinker Rai: il Worker non deve diventare un proxy aperto.
    if (!target.startsWith(TARGET_PREFIX)) {
      return json({ error: 'destinazione non consentita' }, 403);
    }

    let upstream;
    try {
      upstream = await fetch(target, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (SMART-TV; Linux; Tizen 4.0) AppleWebKit/537.36 TV Safari/537.36',
          'Accept': '*/*'
        }
      });
    } catch (err) {
      return json({ error: 'relinker non raggiungibile', dettaglio: String(err) }, 502);
    }

    const body = await upstream.text();

    return new Response(body, {
      status: upstream.status,
      headers: Object.assign({}, CORS, {
        'Content-Type': 'text/xml; charset=utf-8'
      })
    });
  }
};

function json(payload, status) {
  return new Response(JSON.stringify(payload), {
    status: status,
    headers: Object.assign({}, CORS, { 'Content-Type': 'application/json; charset=utf-8' })
  });
}
