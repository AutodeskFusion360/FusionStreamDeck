// Copyright (c) 2026 Autodesk, Inc.
// Licensed under the MIT License. See LICENSE in the project root.
// Minimal client for Stream Deck's plugin WebSocket protocol - no SDK
// dependency, just the global WebSocket that Stream Deck's built-in Node.js
// runtime provides (Node 22+). Protocol reference:
// https://docs.elgato.com/streamdeck/sdk/references/events-received
export class StreamDeckConnection {
    constructor({ port, pluginUUID, registerEvent }) {
        this.pluginUUID = pluginUUID;
        this.registerEvent = registerEvent;
        this.ws = new WebSocket(`ws://127.0.0.1:${port}`);
        this._handlers = new Map();

        this.ws.addEventListener('open', () => {
            this._raw({ event: this.registerEvent, uuid: this.pluginUUID });
        });
        this.ws.addEventListener('message', (ev) => {
            let msg;
            try {
                msg = JSON.parse(ev.data);
            } catch {
                return;
            }
            const handler = this._handlers.get(msg.event);
            if (handler) handler(msg);
        });
    }

    on(event, handler) {
        this._handlers.set(event, handler);
    }

    _raw(obj) {
        this.ws.send(JSON.stringify(obj));
    }

    setImage(context, dataUri, target = 0) {
        this._raw({ event: 'setImage', context, payload: { image: dataUri, target } });
    }

    showAlert(context) {
        this._raw({ event: 'showAlert', context });
    }

    showOk(context) {
        this._raw({ event: 'showOk', context });
    }

    sendToPropertyInspector(context, payload) {
        this._raw({ event: 'sendToPropertyInspector', context, payload });
    }

    setSettings(context, settings) {
        this._raw({ event: 'setSettings', context, payload: settings });
    }

    logMessage(message) {
        this._raw({ event: 'logMessage', payload: { message: String(message) } });
    }
}
