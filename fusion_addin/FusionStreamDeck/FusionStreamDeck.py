# Copyright (c) 2026 Autodesk, Inc.
# Licensed under the MIT License. See LICENSE in the project root.
"""Fusion 360 add-in entry point.

Starts a localhost-only HTTP server that a companion Elgato Stream Deck
plugin uses to run Fusion commands and fetch their real toolbar icons.
See lib/server.py for the HTTP surface and lib/dispatch.py for how requests
get safely marshalled onto Fusion's main thread.
"""
import adsk.core
import traceback

from .lib import dispatch, discovery
from .lib.server import ServerThread

app = None
ui = None
_server = None


def run(context):
    global app, ui, _server
    try:
        app = adsk.core.Application.get()
        ui = app.userInterface

        dispatch.start()

        _server = ServerThread()
        port = _server.start()
        discovery.publish(port)
    except Exception:
        if ui:
            ui.messageBox('Failed to start Fusion Stream Deck:\n{}'.format(traceback.format_exc()))


def stop(context):
    global _server
    try:
        discovery.clear()
        if _server:
            _server.stop()
            _server = None
        dispatch.stop()
    except Exception:
        if ui:
            ui.messageBox('Failed to stop Fusion Stream Deck cleanly:\n{}'.format(traceback.format_exc()))
