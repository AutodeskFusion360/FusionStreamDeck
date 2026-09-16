"""Local-only HTTP server the Stream Deck plugin talks to.

Endpoints (all on 127.0.0.1, JSON unless noted):
  GET  /health                     -> {ok, fusionVersion, activeDocument}
  GET  /commands[?q=text&refresh=1]-> {commands: [{id, name, tooltip}]}
  GET  /icon?commandId=ID[&size=32]-> raw image bytes (svg or png)
  POST /command  {"commandId": ID} -> {ok: true, executed: ID}

Runs in a background thread (ThreadingHTTPServer) started from run(context);
every Fusion API call it makes is marshalled onto the main thread via
dispatch.run_on_main_thread so the API is never touched off-thread.
"""
import json
import time
import threading
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import urlparse, parse_qs

from . import dispatch, fusion_actions, icons

DEFAULT_PORT = 59237
_COMMANDS_TTL_SECONDS = 10

_commands_cache = {'at': 0.0, 'items': []}
_resource_folder_cache = {}
_cache_lock = threading.Lock()


def _get_commands(force_refresh=False):
    with _cache_lock:
        fresh = (time.time() - _commands_cache['at']) < _COMMANDS_TTL_SECONDS
        if fresh and not force_refresh and _commands_cache['items']:
            return _commands_cache['items']
    items = dispatch.run_on_main_thread(fusion_actions.list_commands)
    with _cache_lock:
        _commands_cache['items'] = items
        _commands_cache['at'] = time.time()
    return items


def _get_resource_folder(command_id):
    with _cache_lock:
        cached = _resource_folder_cache.get(command_id)
    if cached:
        return cached
    folder = dispatch.run_on_main_thread(lambda: fusion_actions.get_resource_folder(command_id))
    with _cache_lock:
        _resource_folder_cache[command_id] = folder
    return folder


class Handler(BaseHTTPRequestHandler):
    protocol_version = 'HTTP/1.1'
    server_version = 'FusionStreamDeck/1.0'

    def log_message(self, fmt, *args):
        pass  # keep Fusion's console/output quiet

    def _send_json(self, status, payload):
        body = json.dumps(payload).encode('utf-8')
        self.send_response(status)
        self.send_header('Content-Type', 'application/json')
        self.send_header('Content-Length', str(len(body)))
        self.send_header('Access-Control-Allow-Origin', '*')
        self.end_headers()
        self.wfile.write(body)

    def _send_error_json(self, status, message):
        self._send_json(status, {'ok': False, 'error': message})

    def do_OPTIONS(self):
        self.send_response(204)
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type')
        self.send_header('Content-Length', '0')
        self.end_headers()

    def do_GET(self):
        parsed = urlparse(self.path)
        qs = parse_qs(parsed.query)

        try:
            if parsed.path == '/health':
                status = dispatch.run_on_main_thread(fusion_actions.get_status)
                self._send_json(200, {'ok': True, **status})
                return

            if parsed.path == '/commands':
                query = (qs.get('q') or [''])[0].strip().lower()
                refresh = (qs.get('refresh') or ['0'])[0] == '1'
                items = _get_commands(force_refresh=refresh)
                if query:
                    items = [
                        c for c in items
                        if query in c['id'].lower() or query in c['name'].lower()
                    ]
                self._send_json(200, {'ok': True, 'commands': items})
                return

            if parsed.path == '/icon':
                command_id = (qs.get('commandId') or [''])[0]
                if not command_id:
                    self._send_error_json(400, 'commandId query param is required')
                    return
                size = int((qs.get('size') or ['32'])[0])
                folder = _get_resource_folder(command_id)
                path, mime = icons.find_icon(folder, size)
                if not path:
                    self._send_error_json(404, 'No icon found for {}'.format(command_id))
                    return
                with open(path, 'rb') as f:
                    data = f.read()
                self.send_response(200)
                self.send_header('Content-Type', mime)
                self.send_header('Content-Length', str(len(data)))
                self.send_header('Access-Control-Allow-Origin', '*')
                self.send_header('Cache-Control', 'max-age=3600')
                self.end_headers()
                self.wfile.write(data)
                return

            self._send_error_json(404, 'Unknown route: {}'.format(parsed.path))
        except TimeoutError as e:
            self._send_error_json(504, str(e))
        except Exception as e:
            self._send_error_json(500, str(e))

    def do_POST(self):
        parsed = urlparse(self.path)
        try:
            length = int(self.headers.get('Content-Length', 0))
            raw = self.rfile.read(length) if length else b'{}'
            body = json.loads(raw or b'{}')

            if parsed.path == '/command':
                command_id = body.get('commandId')
                if not command_id:
                    self._send_error_json(400, 'commandId is required')
                    return
                result = dispatch.run_on_main_thread(lambda: fusion_actions.execute_command(command_id))
                self._send_json(200, {'ok': True, **result})
                return

            self._send_error_json(404, 'Unknown route: {}'.format(parsed.path))
        except TimeoutError as e:
            self._send_error_json(504, str(e))
        except Exception as e:
            self._send_error_json(500, str(e))


class ServerThread:
    def __init__(self, preferred_port=DEFAULT_PORT):
        self._preferred_port = preferred_port
        self._httpd = None
        self._thread = None

    def start(self):
        try:
            self._httpd = ThreadingHTTPServer(('127.0.0.1', self._preferred_port), Handler)
        except OSError:
            self._httpd = ThreadingHTTPServer(('127.0.0.1', 0), Handler)
        self._thread = threading.Thread(target=self._httpd.serve_forever, daemon=True)
        self._thread.start()
        return self._httpd.server_address[1]

    def stop(self):
        if self._httpd:
            self._httpd.shutdown()
            self._httpd.server_close()
            self._httpd = None
        self._thread = None
