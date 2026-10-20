// Copyright (c) 2026 Autodesk, Inc.
// Licensed under the MIT License. See LICENSE in the project root.
// Sends an OS-level keystroke to whatever application is frontmost. Doesn't
// touch the Fusion add-in at all, so this works even if Fusion or the add-in
// isn't running - it's a plain macro-pad button.
//
// Windows: shells out to PowerShell's System.Windows.Forms.SendKeys (no npm
// dependency needed). The Windows key has no SendKeys equivalent, so "win"/
// "cmd" modifiers are rejected on Windows.
// macOS: shells out to osascript / System Events. Best-effort - this repo
// was built and tested on Windows, so treat the mac path as unverified.
import { execFile } from 'node:child_process';

const MODIFIER_ALIASES = {
    ctrl: 'ctrl', control: 'ctrl',
    alt: 'alt', option: 'alt',
    shift: 'shift',
    win: 'win', cmd: 'win', command: 'win', super: 'win', meta: 'win',
};

const NAMED_KEYS = new Set([
    'enter', 'return', 'tab', 'esc', 'escape', 'space', 'backspace', 'delete', 'del',
    'up', 'down', 'left', 'right', 'home', 'end', 'pageup', 'pagedown', 'pgup', 'pgdn', 'insert', 'ins',
    'f1', 'f2', 'f3', 'f4', 'f5', 'f6', 'f7', 'f8', 'f9', 'f10', 'f11', 'f12',
]);

export function parseCombo(combo) {
    const parts = String(combo).trim().toLowerCase().split(/[\s+]+/).filter(Boolean);
    if (parts.length === 0) throw new Error('Empty key combo');
    const modifiers = new Set();
    let key = null;
    for (const part of parts) {
        if (part in MODIFIER_ALIASES) {
            modifiers.add(MODIFIER_ALIASES[part]);
        } else if (key === null) {
            key = part;
        } else {
            throw new Error(`Combo has more than one non-modifier key: "${combo}"`);
        }
    }
    if (key === null) throw new Error(`Combo has no key to press: "${combo}"`);
    if (key.length > 1 && !NAMED_KEYS.has(key)) {
        throw new Error(`Unrecognized key "${key}". Use a single character or one of: ${[...NAMED_KEYS].join(', ')}`);
    }
    return { modifiers, key };
}

const SENDKEYS_NAMED = {
    enter: '{ENTER}', return: '{ENTER}', tab: '{TAB}', esc: '{ESC}', escape: '{ESC}',
    space: ' ', backspace: '{BACKSPACE}', delete: '{DELETE}', del: '{DELETE}',
    up: '{UP}', down: '{DOWN}', left: '{LEFT}', right: '{RIGHT}',
    home: '{HOME}', end: '{END}', pageup: '{PGUP}', pagedown: '{PGDN}', pgup: '{PGUP}', pgdn: '{PGDN}',
    insert: '{INSERT}', ins: '{INSERT}',
    f1: '{F1}', f2: '{F2}', f3: '{F3}', f4: '{F4}', f5: '{F5}', f6: '{F6}',
    f7: '{F7}', f8: '{F8}', f9: '{F9}', f10: '{F10}', f11: '{F11}', f12: '{F12}',
};
const SENDKEYS_ESCAPE = new Set(['+', '^', '%', '~', '(', ')', '{', '}', '[', ']']);

function toSendKeysToken(key) {
    if (key in SENDKEYS_NAMED) return SENDKEYS_NAMED[key];
    return SENDKEYS_ESCAPE.has(key) ? `{${key}}` : key;
}

function buildSendKeysSequence({ modifiers, key }) {
    if (modifiers.has('win')) {
        throw new Error('The Windows key cannot be simulated via SendKeys on Windows');
    }
    let prefix = '';
    if (modifiers.has('ctrl')) prefix += '^';
    if (modifiers.has('alt')) prefix += '%';
    if (modifiers.has('shift')) prefix += '+';
    return prefix + toSendKeysToken(key);
}

function sendWindows(combo) {
    const sequence = buildSendKeysSequence(parseCombo(combo));
    // Single-quoted PowerShell string; escape any embedded single quotes.
    const psLiteral = sequence.replace(/'/g, "''");
    const script = `Add-Type -AssemblyName System.Windows.Forms; [System.Windows.Forms.SendKeys]::SendWait('${psLiteral}')`;
    return new Promise((resolve, reject) => {
        execFile('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', script], (err, _stdout, stderr) => {
            if (err) reject(new Error(stderr || err.message));
            else resolve();
        });
    });
}

const MAC_KEY_CODES = {
    enter: 36, return: 36, tab: 48, esc: 53, escape: 53, space: 49,
    backspace: 51, delete: 117, del: 117,
    left: 123, right: 124, down: 125, up: 126,
    home: 115, end: 119, pageup: 116, pagedown: 121, pgup: 116, pgdn: 121,
    f1: 122, f2: 120, f3: 99, f4: 118, f5: 96, f6: 97,
    f7: 98, f8: 100, f9: 101, f10: 109, f11: 103, f12: 111,
};
const MAC_MODIFIER_NAMES = { ctrl: 'control down', alt: 'option down', shift: 'shift down', win: 'command down' };

function macModifierList(modifiers) {
    return [...modifiers].map((m) => MAC_MODIFIER_NAMES[m]).join(', ');
}

function sendMac(combo) {
    const { modifiers, key } = parseCombo(combo);
    const usingClause = modifiers.size ? ` using {${macModifierList(modifiers)}}` : '';
    let script;
    if (key in MAC_KEY_CODES) {
        script = `tell application "System Events" to key code ${MAC_KEY_CODES[key]}${usingClause}`;
    } else {
        const escaped = key.replace(/"/g, '\\"');
        script = `tell application "System Events" to keystroke "${escaped}"${usingClause}`;
    }
    return new Promise((resolve, reject) => {
        execFile('osascript', ['-e', script], (err, _stdout, stderr) => {
            if (err) reject(new Error(stderr || err.message));
            else resolve();
        });
    });
}

export function sendKeystroke(combo) {
    if (process.platform === 'darwin') return sendMac(combo);
    if (process.platform === 'win32') return sendWindows(combo);
    throw new Error(`Unsupported platform: ${process.platform}`);
}
