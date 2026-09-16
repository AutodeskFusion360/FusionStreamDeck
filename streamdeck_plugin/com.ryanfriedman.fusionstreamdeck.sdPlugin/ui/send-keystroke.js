let websocket = null;
let piUUID = null;
let settings = {};

const comboEl = document.getElementById('combo');

// eslint-disable-next-line no-unused-vars -- called by the Stream Deck host
function connectElgatoStreamDeckSocket(inPort, inUUID, inRegisterEvent, inInfo, inActionInfo) {
    piUUID = inUUID;
    const actionInfo = JSON.parse(inActionInfo);
    settings = actionInfo.payload?.settings || {};
    comboEl.value = settings.combo || '';

    websocket = new WebSocket(`ws://127.0.0.1:${inPort}`);
    websocket.onopen = () => {
        websocket.send(JSON.stringify({ event: inRegisterEvent, uuid: inUUID }));
    };
}

function persist() {
    settings = { ...settings, combo: comboEl.value.trim() };
    websocket.send(JSON.stringify({ event: 'setSettings', context: piUUID, payload: settings }));
}

comboEl.addEventListener('change', persist);
comboEl.addEventListener('blur', persist);
