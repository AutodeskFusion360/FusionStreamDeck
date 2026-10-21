// ==============================================================================
// Fusion Stream Deck: streamdeck_plugin/com.autodesk.fusionstreamdeck.sdPlugin/bin/plugin.js
// ==============================================================================
// Copyright (c) 2026 Autodesk, Inc.
// Licensed under the MIT License. See LICENSE in the project root.
// ==============================================================================
import { StreamDeckConnection } from '../lib/streamdeck.js';
import { runCommand, fetchIconDataUri, getDisabledIconDataUri, searchCommands } from '../lib/fusionClient.js';

const RUN_COMMAND_UUID = 'com.autodesk.fusionstreamdeck.runcommand';
const ICON_SIZE = 32;
const DISABLED_RETRY_MS = 5000;

function parseArgs(argv) {
    const args = {};
    for (let i = 0; i < argv.length; i += 2) {
        args[argv[i].replace(/^-+/, '')] = argv[i + 1];
    }
    return args;
}

const { port, pluginUUID, registerEvent } = parseArgs(process.argv.slice(2));
const sd = new StreamDeckConnection({ port: Number(port), pluginUUID, registerEvent });

// context -> { action, settings }
const contexts = new Map();

async function refreshIcon(context) {
    const entry = contexts.get(context);
    if (!entry || entry.action !== RUN_COMMAND_UUID) return;
    const commandId = entry.settings?.commandId;
    if (!commandId) return;
    try {
        const dataUri = await fetchIconDataUri(commandId, ICON_SIZE);
        sd.setImage(context, dataUri);
        entry.disabled = false;
    } catch (err) {
        sd.logMessage(`icon fetch failed for ${commandId}: ${err.message}`);
        sd.setImage(context, getDisabledIconDataUri(commandId));
        entry.disabled = true;
    }
}

// Fusion coming back online won't otherwise be noticed until the key's
// willAppear/didReceiveSettings fires again (e.g. switching profiles), so
// periodically retry keys currently showing the disabled look.
setInterval(() => {
    for (const [context, entry] of contexts) {
        if (entry.disabled) refreshIcon(context);
    }
}, DISABLED_RETRY_MS);

sd.on('willAppear', (msg) => {
    contexts.set(msg.context, { action: msg.action, settings: msg.payload?.settings || {} });
    refreshIcon(msg.context);
});

sd.on('willDisappear', (msg) => {
    contexts.delete(msg.context);
});

sd.on('didReceiveSettings', (msg) => {
    const entry = contexts.get(msg.context) || { action: msg.action, settings: {} };
    entry.settings = msg.payload?.settings || {};
    contexts.set(msg.context, entry);
    refreshIcon(msg.context);
});

sd.on('keyDown', async (msg) => {
    const entry = contexts.get(msg.context);
    const action = entry?.action || msg.action;
    const settings = entry?.settings || msg.payload?.settings || {};

    try {
        if (action === RUN_COMMAND_UUID) {
            if (!settings.commandId) throw new Error('No command configured');
            await runCommand(settings.commandId);
        }
        sd.showOk(msg.context);
    } catch (err) {
        sd.logMessage(`keyDown failed: ${err.message}`);
        sd.showAlert(msg.context);
    }
});

sd.on('sendToPlugin', async (msg) => {
    const payload = msg.payload || {};
    if (payload.type === 'search') {
        try {
            const items = await searchCommands(payload.query || '');
            sd.sendToPropertyInspector(msg.context, { type: 'searchResults', items });
        } catch (err) {
            sd.sendToPropertyInspector(msg.context, { type: 'searchError', error: err.message });
        }
        return;
    }
    if (payload.type === 'getIcon') {
        try {
            const dataUri = await fetchIconDataUri(payload.commandId, ICON_SIZE);
            sd.sendToPropertyInspector(msg.context, { type: 'iconPreview', commandId: payload.commandId, dataUri });
        } catch (err) {
            sd.sendToPropertyInspector(msg.context, { type: 'iconError', commandId: payload.commandId, error: err.message });
        }
    }
});
