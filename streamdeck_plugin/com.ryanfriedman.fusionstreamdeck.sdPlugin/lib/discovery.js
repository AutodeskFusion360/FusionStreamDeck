// Mirrors fusion_addin/FusionStreamDeck/lib/discovery.py: finds the JSON file
// the Fusion add-in publishes its local HTTP server's port to.
import { readFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import path from 'node:path';

function discoveryPath() {
    if (process.platform === 'darwin') {
        return path.join(homedir(), 'Library', 'Application Support', 'FusionStreamDeck', 'endpoint.json');
    }
    if (process.platform === 'win32') {
        const base = process.env.LOCALAPPDATA || path.join(homedir(), 'AppData', 'Local');
        return path.join(base, 'FusionStreamDeck', 'endpoint.json');
    }
    const base = process.env.XDG_STATE_HOME || path.join(homedir(), '.local', 'state');
    return path.join(base, 'FusionStreamDeck', 'endpoint.json');
}

// Re-read on every call (not cached) so a Fusion add-in restart or a port
// change is picked up immediately without stale state.
export async function getFusionEndpoint() {
    try {
        const raw = await readFile(discoveryPath(), 'utf-8');
        const data = JSON.parse(raw);
        if (data.status === 'running' && typeof data.port === 'number') {
            return `http://127.0.0.1:${data.port}`;
        }
        return null;
    } catch {
        return null;
    }
}
