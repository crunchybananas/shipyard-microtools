#!/usr/bin/env python3
"""Loopback static server for Realm's verification gates and local preview.

The request handling is the standard library's SimpleHTTPRequestHandler,
unchanged: same MIME types, Last-Modified/304 revalidation, index.html
directories and HTTP/1.0 responses as `python3 -m http.server`.

What differs is the listen backlog. http.server listens with a queue of five,
and a browser loading Realm's ES-module graph (well over a hundred module and
asset requests, one connection each under HTTP/1.0) opens connections faster
than the accept loop drains them. The overflow arrives in the browser as
ERR_CONNECTION_RESET on arbitrary modules, the module graph never evaluates,
and every browser gate times out waiting for the game to boot.
"""
import argparse
import functools
import http.server


class RealmServer(http.server.ThreadingHTTPServer):
    request_queue_size = 256  # the kernel caps this at somaxconn (128 on macOS)
    daemon_threads = True


class Handler(http.server.SimpleHTTPRequestHandler):
    def log_request(self, code='-', size='-'):
        # A gate makes thousands of successful requests; errors still log.
        pass


def main():
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument('--port', type=int, required=True)
    parser.add_argument('--bind', default='127.0.0.1')
    parser.add_argument('--directory', required=True)
    args = parser.parse_args()
    handler = functools.partial(Handler, directory=args.directory)
    with RealmServer((args.bind, args.port), handler) as server:
        try:
            server.serve_forever()
        except KeyboardInterrupt:
            pass


if __name__ == '__main__':
    main()
