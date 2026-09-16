"""Publishes where the local HTTP server is listening so the Stream Deck
plugin (a separate process, possibly started before or after Fusion) can find
it without a fixed, potentially-already-in-use port.
"""
import json
import os
import sys
import tempfile

_DIR_NAME = 'FusionStreamDeck'
_FILE_NAME = 'endpoint.json'


def _discovery_dir():
    if sys.platform == 'darwin':
        base = os.path.expanduser('~/Library/Application Support')
    elif sys.platform == 'win32':
        base = os.environ.get('LOCALAPPDATA') or tempfile.gettempdir()
    else:
        base = os.environ.get('XDG_STATE_HOME') or os.path.expanduser('~/.local/state')
    return os.path.join(base, _DIR_NAME)


def discovery_path():
    return os.path.join(_discovery_dir(), _FILE_NAME)


def publish(port):
    path = discovery_path()
    os.makedirs(os.path.dirname(path), exist_ok=True)
    tmp_path = path + '.tmp'
    with open(tmp_path, 'w', encoding='utf-8') as f:
        json.dump({'port': port, 'pid': os.getpid(), 'status': 'running'}, f)
    os.replace(tmp_path, path)


def clear():
    path = discovery_path()
    try:
        with open(path, 'w', encoding='utf-8') as f:
            json.dump({'status': 'stopped'}, f)
    except OSError:
        pass
