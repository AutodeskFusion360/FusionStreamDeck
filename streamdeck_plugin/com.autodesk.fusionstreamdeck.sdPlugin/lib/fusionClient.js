// ==============================================================================
// Fusion Stream Deck: streamdeck_plugin/com.autodesk.fusionstreamdeck.sdPlugin/lib/fusionClient.js
// ==============================================================================
// Copyright (c) 2026 Autodesk, Inc.
// Licensed under the MIT License. See LICENSE in the project root.
// ==============================================================================
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

// Stream Deck keys are slightly domed, so full-bleed icon art appears to
// warp ("lensing") near the edges at any viewing angle but straight-on.
// Insetting the icon into a padded canvas - what most Stream Deck plugins
// do - keeps the glyph within the flatter center of the key.
const ICON_MARGIN_FRACTION = 0.16;
const CANVAS = 100;
const DISABLED_OPACITY = 0.35;

// Grayscale + dimmed treatment applied to whatever's inside a <g>/<image>
// when Fusion can't be reached, so a stale-but-recognizable icon reads as
// visibly "off" rather than looking identical to a working key.
const DISABLED_FILTER_DEFS = '<filter id="disabled"><feColorMatrix type="saturate" values="0"/></filter>';
const DISABLED_ATTRS = ` filter="url(#disabled)" opacity="${DISABLED_OPACITY}"`;

// For SVG sources, splice the original markup directly into a scaled/
// translated <g> rather than nesting it inside an <image href="data:...">.
// Nested raster-in-vector embedding isn't reliably supported by every SVG
// renderer (some only rasterize <image> for actual bitmap formats), so
// inlining plain SVG elements is the more compatible route.
function padSvg(svgText, { disabled = false } = {}) {
    const openTagMatch = svgText.match(/<svg\b[^>]*>/i);
    const openTag = openTagMatch ? openTagMatch[0] : '<svg>';
    const viewBoxMatch = openTag.match(/viewBox\s*=\s*"([^"]+)"/i);
    let minX = 0, minY = 0, width, height;
    if (viewBoxMatch) {
        [minX, minY, width, height] = viewBoxMatch[1].trim().split(/[\s,]+/).map(Number);
    } else {
        const widthMatch = openTag.match(/\bwidth\s*=\s*"([\d.]+)/i);
        const heightMatch = openTag.match(/\bheight\s*=\s*"([\d.]+)/i);
        width = widthMatch ? Number(widthMatch[1]) : 32;
        height = heightMatch ? Number(heightMatch[1]) : 32;
    }
    const inner = svgText
        .replace(/^[\s\S]*?<svg\b[^>]*>/i, '')
        .replace(/<\/svg>\s*$/i, '');

    const inset = CANVAS * ICON_MARGIN_FRACTION;
    const contentSize = CANVAS - inset * 2;
    const scale = contentSize / Math.max(width || 32, height || 32);
    const tx = inset - minX * scale;
    const ty = inset - minY * scale;

    const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${CANVAS} ${CANVAS}">` +
        (disabled ? DISABLED_FILTER_DEFS : '') +
        `<g transform="translate(${tx} ${ty}) scale(${scale})"${disabled ? DISABLED_ATTRS : ''}>${inner}</g>` +
        `</svg>`;
    return `data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}`;
}

// For raster sources (PNG fallback), embedding via <image> is ordinary
// bitmap-in-vector compositing, which every SVG renderer supports. Both
// href and the legacy xlink:href are set for older renderers that only
// recognize the namespaced attribute.
function padRaster(mime, buf, { disabled = false } = {}) {
    const inset = CANVAS * ICON_MARGIN_FRACTION;
    const contentSize = CANVAS - inset * 2;
    const dataUri = `data:${mime};base64,${buf.toString('base64')}`;
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" viewBox="0 0 ${CANVAS} ${CANVAS}">` +
        (disabled ? DISABLED_FILTER_DEFS : '') +
        `<image x="${inset}" y="${inset}" width="${contentSize}" height="${contentSize}" href="${dataUri}" xlink:href="${dataUri}"${disabled ? DISABLED_ATTRS : ''} />` +
        `</svg>`;
    return `data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}`;
}

function padIcon(mime, buf, opts) {
    if (mime === 'image/svg+xml') return padSvg(buf.toString('utf-8'), opts);
    return padRaster(mime, buf, opts);
}

// A generic "no signal" glyph for keys that have never successfully
// fetched an icon at all, so a Fusion-less key still reads as disabled
// rather than showing nothing or the plugin's default action icon forever.
function offlinePlaceholder() {
    const r = CANVAS / 2 - CANVAS * ICON_MARGIN_FRACTION;
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${CANVAS} ${CANVAS}">` +
        `<g stroke="#999" stroke-width="4" fill="none" opacity="${DISABLED_OPACITY}">` +
        `<circle cx="${CANVAS / 2}" cy="${CANVAS / 2}" r="${r}" />` +
        `<line x1="${CANVAS / 2 - r * 0.7}" y1="${CANVAS / 2 + r * 0.7}" x2="${CANVAS / 2 + r * 0.7}" y2="${CANVAS / 2 - r * 0.7}" />` +
        `</g></svg>`;
    return `data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}`;
}

// Raw bytes of the last successfully fetched icon per commandId, so a
// disabled key can still show a dimmed version of its real glyph instead of
// only the generic offline placeholder.
const _lastGoodIcon = new Map();

export async function fetchIconDataUri(commandId, size = 32) {
    const res = await request(`/icon?commandId=${encodeURIComponent(commandId)}&size=${size}`);
    if (!res.ok) throw new Error(`No icon for ${commandId} (${res.status})`);
    const mime = res.headers.get('content-type') || 'image/png';
    const buf = Buffer.from(await res.arrayBuffer());
    _lastGoodIcon.set(commandId, { mime, buf });
    return padIcon(mime, buf, { disabled: false });
}

// Best-effort icon to show when fetchIconDataUri just threw: a dimmed,
// desaturated version of the last icon that did load, or a generic
// "no signal" glyph if none has ever loaded for this command.
export function getDisabledIconDataUri(commandId) {
    const cached = _lastGoodIcon.get(commandId);
    if (cached) return padIcon(cached.mime, cached.buf, { disabled: true });
    return offlinePlaceholder();
}
