#!/usr/bin/env python3
"""
Server locale per DTV Stream.

Fa due cose:
  1. serve l'app (index.html, assets, data)
  2. espone /__relinker?url=... che legge il relinker Rai lato server

Serve perche' mediapolis.rai.it restituisce l'URL firmato del flusso solo
all'origine www.raiplay.it: dal browser il CORS blocca la lettura. Con questo
server il televisore parla solo con il Mac, che a sua volta parla con la Rai.

Uso:
    python3 proxy/serve.py            # porta 8080
    PORT=9000 python3 proxy/serve.py

Poi sul televisore apri l'indirizzo mostrato all'avvio.
Nessuna dipendenza esterna: solo la libreria standard di Python 3.
"""

import http.server
import os
import socket
import socketserver
import urllib.parse
import urllib.request

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PORT = int(os.environ.get("PORT", "8080"))
ALLOWED_PREFIX = "https://mediapolis.rai.it/relinker/"
UPSTREAM_UA = (
    "Mozilla/5.0 (SMART-TV; Linux; Tizen 4.0) "
    "AppleWebKit/537.36 TV Safari/537.36"
)
TIMEOUT = 15


class Handler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=ROOT, **kwargs)

    def do_GET(self):
        if self.path.startswith("/__relinker"):
            self._relinker()
            return
        if self.path.startswith("/__ready"):
            self._send(200, "application/json", b'{"relinker":"ok"}')
            return
        super().do_GET()

    def _relinker(self):
        query = urllib.parse.parse_qs(urllib.parse.urlparse(self.path).query)
        target = query.get("url", [""])[0]

        if not target:
            self._send(400, "application/json", b'{"error":"manca il parametro url"}')
            return

        # Vincolo sulla destinazione: non e' un proxy aperto.
        if not target.startswith(ALLOWED_PREFIX):
            self._send(403, "application/json", b'{"error":"destinazione non consentita"}')
            return

        try:
            request = urllib.request.Request(
                target, headers={"User-Agent": UPSTREAM_UA, "Accept": "*/*"}
            )
            body = urllib.request.urlopen(request, timeout=TIMEOUT).read()
        except Exception as exc:  # rete assente, Rai irraggiungibile, timeout
            payload = ('{"error":"relinker non raggiungibile","detail":%r}' % str(exc)).encode()
            self._send(502, "application/json", payload)
            return

        self._send(200, "text/xml; charset=utf-8", body)

    def _send(self, status, content_type, body):
        self.send_response(status)
        self.send_header("Content-Type", content_type)
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Cache-Control", "no-store")
        self.end_headers()
        self.wfile.write(body)

    def end_headers(self):
        self.send_header("Access-Control-Allow-Origin", "*")
        super().end_headers()

    def log_message(self, fmt, *args):
        # Log essenziale: una riga per richiesta, senza rumore.
        print("  %s %s" % (self.command, self.path.split("?")[0]))


def lan_address():
    sock = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
    try:
        sock.connect(("8.8.8.8", 80))
        return sock.getsockname()[0]
    except Exception:
        return "127.0.0.1"
    finally:
        sock.close()


class Server(socketserver.ThreadingTCPServer):
    allow_reuse_address = True
    daemon_threads = True


if __name__ == "__main__":
    address = lan_address()
    print("")
    print("  DTV Stream - server locale")
    print("  --------------------------")
    print("  Sul televisore apri:  http://%s:%d/" % (address, PORT))
    print("  Su questo computer:   http://127.0.0.1:%d/" % PORT)
    print("")
    print("  Il proxy RAI e' attivo su /__relinker")
    print("  Ferma con CTRL+C")
    print("")
    try:
        Server(("0.0.0.0", PORT), Handler).serve_forever()
    except KeyboardInterrupt:
        print("\n  Fermato.")
