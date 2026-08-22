#!/usr/bin/env python3
# serve.py — the harness's static server: docs/ as docroot, no-store caching so
# the working tree is always what you test. Port via SERVE_PORT, else PORT, else 8642.
import http.server
import os
import socketserver

# SERVE_PORT is the harness's own knob and wins when set. PORT is what a launcher
# (.claude/launch.json) assigns. Falling back to 8642 for both meant the launched
# PLAY server and the test runner wanted the same socket — so a gate run and someone
# actually playing could collide. They are separate ports now; this just makes the
# launcher's choice reach the server.
PORT = int(os.environ.get('SERVE_PORT') or os.environ.get('PORT') or '8642')
DOCROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..', '..'))


class Handler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *a, **kw):
        super().__init__(*a, directory=DOCROOT, **kw)

    def end_headers(self):
        self.send_header('Cache-Control', 'no-store')
        super().end_headers()

    def log_message(self, *a):
        pass


if __name__ == '__main__':
    socketserver.TCPServer.allow_reuse_address = True
    with socketserver.TCPServer(('127.0.0.1', PORT), Handler) as srv:
        print(f'serving {DOCROOT} on http://127.0.0.1:{PORT}', flush=True)
        srv.serve_forever()
