// ==============================================================================
// Fusion Stream Deck: streamdeck_plugin/com.ryanfriedman.fusionstreamdeck.sdPlugin/ui/run-command.js
// ==============================================================================
// Copyright (c) 2026 Autodesk, Inc.
// Licensed under the MIT License. See LICENSE in the project root.
// ==============================================================================
// Property inspector for the "Run Command" action. Stream Deck loads this
// page and calls window.connectElgatoStreamDeckSocket() once it's ready.
let websocket = null;
let piUUID = null;
let actionInfo = {};
let settings = {};

const searchEl = document.getElementById('search');
const resultsEl = document.getElementById('results');
const errorEl = document.getElementById('error');
const iconEl = document.getElementById('icon');
const selectedSection = document.getElementById('selectedSection');
const selectedNameEl = document.getElementById('selectedName');
const selectedIdEl = document.getElementById('selectedId');

let searchDebounce = null;

// eslint-disable-next-line no-unused-vars -- called by the Stream Deck host
function connectElgatoStreamDeckSocket(inPort, inUUID, inRegisterEvent, inInfo, inActionInfo) {
    piUUID = inUUID;
    actionInfo = JSON.parse(inActionInfo);
    settings = actionInfo.payload?.settings || {};

    websocket = new WebSocket(`ws://127.0.0.1:${inPort}`);
    websocket.onopen = () => {
        websocket.send(JSON.stringify({ event: inRegisterEvent, uuid: inUUID }));
        renderSelection();
        if (settings.commandId) sendToPlugin({ type: 'getIcon', commandId: settings.commandId });
    };
    websocket.onmessage = (evt) => {
        const msg = JSON.parse(evt.data);
        if (msg.event === 'sendToPropertyInspector') handlePluginMessage(msg.payload);
    };
}

function sendToPlugin(payload) {
    websocket.send(JSON.stringify({ event: 'sendToPlugin', context: piUUID, action: actionInfo.action, payload }));
}

function persistSettings(next) {
    settings = { ...settings, ...next };
    websocket.send(JSON.stringify({ event: 'setSettings', context: piUUID, payload: settings }));
}

function renderSelection() {
    if (settings.commandId) {
        selectedSection.style.display = '';
        selectedNameEl.textContent = settings.name || settings.commandId;
        selectedIdEl.textContent = settings.commandId;
    } else {
        selectedSection.style.display = 'none';
    }
}

function handlePluginMessage(payload) {
    if (payload.type === 'searchResults') {
        errorEl.style.display = 'none';
        renderResults(payload.items);
    } else if (payload.type === 'searchError') {
        resultsEl.innerHTML = '';
        errorEl.textContent = payload.error;
        errorEl.style.display = '';
    } else if (payload.type === 'iconPreview' && payload.commandId === settings.commandId) {
        iconEl.src = payload.dataUri;
    }
}

function renderResults(items) {
    resultsEl.innerHTML = '';
    for (const item of items.slice(0, 50)) {
        const row = document.createElement('div');
        row.className = 'result-row' + (item.id === settings.commandId ? ' selected' : '');
        row.innerHTML = `<div><div class="result-name"></div><div class="result-id"></div></div>`;
        row.querySelector('.result-name').textContent = item.name;
        row.querySelector('.result-id').textContent = item.id;
        row.addEventListener('click', () => {
            persistSettings({ commandId: item.id, name: item.name });
            renderSelection();
            iconEl.removeAttribute('src');
            sendToPlugin({ type: 'getIcon', commandId: item.id });
            renderResults(items); // refresh "selected" highlight
        });
        resultsEl.appendChild(row);
    }
}

searchEl.addEventListener('input', () => {
    clearTimeout(searchDebounce);
    const query = searchEl.value;
    searchDebounce = setTimeout(() => sendToPlugin({ type: 'search', query }), 250);
});
