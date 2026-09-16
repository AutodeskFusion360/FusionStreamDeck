// Talks to the Fusion add-in's local HTTP server (see fusion_addin/.../lib/server.py).
import { getFusionEndpoint } from './discovery.js';

const TIMEOUT_MS = 4000;

async function request(pathAndQuery, options = {}) {
    const base = await getFusionEndpoint();
    if (!base) {
        throw new Error('Fusion Stream Deck add-in is not running');
    }
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
    try {
        const res = await fetch(base + pathAndQuery, { ...options, signal: controller.signal });
        return res;
    } finally {
        clearTimeout(timer);
    }
}

export async function searchCommands(query) {
    const q = query ? `?q=${encodeURIComponent(query)}` : '';
    const res = await request(`/commands${q}`);
    if (!res.ok) throw new Error(`Fusion returned ${res.status}`);
    const data = await res.json();
    return data.commands;
}

export async function runCommand(commandId) {
    const res = await request('/command', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ commandId }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data.ok) {
        throw new Error(data.error || `Fusion returned ${res.status}`);
    }
    return data;
}

export async function fetchIconDataUri(commandId, size = 32) {
    const res = await request(`/icon?commandId=${encodeURIComponent(commandId)}&size=${size}`);
    if (!res.ok) throw new Error(`No icon for ${commandId} (${res.status})`);
    const mime = res.headers.get('content-type') || 'image/png';
    const buf = Buffer.from(await res.arrayBuffer());
    return `data:${mime};base64,${buf.toString('base64')}`;
}
