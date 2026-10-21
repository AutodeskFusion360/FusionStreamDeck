# ==============================================================================
# Fusion Stream Deck: fusion_addin/FusionStreamDeck/lib/dispatch.py
# ==============================================================================
# Copyright (c) 2026 Autodesk, Inc.
# Licensed under the MIT License. See LICENSE in the project root.
# ==============================================================================
"""Marshals calls from background HTTP-server threads onto Fusion's main thread.

The Fusion API is not thread-safe: it may only be called from the thread that
owns the event loop. adsk.core.Application.fireCustomEvent() is the documented
way to wake that thread from a worker thread, so every request the HTTP server
receives is queued here and executed by CustomEventHandler.notify(), which
Fusion always calls on the main thread.
"""
import threading
import queue
import traceback

import adsk.core

CUSTOM_EVENT_ID = 'FusionStreamDeck_Dispatch'

_job_queue = queue.Queue()
_handler = None
_event = None


class _DispatchHandler(adsk.core.CustomEventHandler):
    def notify(self, args):
        while True:
            try:
                job = _job_queue.get_nowait()
            except queue.Empty:
                return
            try:
                job['result']['value'] = job['fn']()
            except Exception:
                job['result']['error'] = traceback.format_exc()
            finally:
                job['done'].set()


def start():
    """Register the custom event + handler. Call once from run(context)."""
    global _handler, _event
    app = adsk.core.Application.get()
    _event = app.registerCustomEvent(CUSTOM_EVENT_ID)
    _handler = _DispatchHandler()
    _event.add(_handler)


def stop():
    """Unregister the custom event. Call once from stop(context)."""
    global _handler, _event
    app = adsk.core.Application.get()
    if _event is not None and _handler is not None:
        _event.remove(_handler)
    app.unregisterCustomEvent(CUSTOM_EVENT_ID)
    _handler = None
    _event = None


def run_on_main_thread(fn, timeout=8.0):
    """Run fn() on Fusion's main thread and return its result (blocking).

    Raises TimeoutError if Fusion doesn't service the event in time, or
    re-raises any exception fn() raised, with its original traceback text.
    """
    app = adsk.core.Application.get()
    done = threading.Event()
    result = {}
    _job_queue.put({'fn': fn, 'done': done, 'result': result})
    app.fireCustomEvent(CUSTOM_EVENT_ID)
    if not done.wait(timeout):
        raise TimeoutError('Fusion did not respond within {}s'.format(timeout))
    if 'error' in result:
        raise RuntimeError(result['error'])
    return result.get('value')
