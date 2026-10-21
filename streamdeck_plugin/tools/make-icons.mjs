// ==============================================================================
// Fusion Stream Deck: streamdeck_plugin/tools/make-icons.mjs
// ==============================================================================
// Copyright (c) 2026 Autodesk, Inc.
// Licensed under the MIT License. See LICENSE in the project root.
// ==============================================================================
// Generates the placeholder PNGs the Stream Deck manifest requires
// (category/plugin icons, per-action icons, default key images).
// These are deliberately plain flat-color glyphs, not Autodesk's Fusion 360
// logo - the real per-command icons come live from Fusion at runtime via
// action.setImage() in bin/plugin.js.
//
// Hand-rolled PNG encoder using only Node core (zlib) because this sandbox
// has no registry access to install an image library. Run with:
//   node tools/make-icons.mjs
import zlib from 'node:zlib';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const PLUGIN_DIR = path.join(ROOT, '..', 'com.autodesk.fusionstreamdeck.sdPlugin');

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? (0xedb88320 ^ (c >>> 1)) : c >>> 1;
    table[n] = c >>> 0;
  }
  return table;
})();

function crc32(buf) {
  let crc = 0xffffffff;
  for (let i = 0; i < buf.length; i++) crc = CRC_TABLE[(crc ^ buf[i]) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const typeBuf = Buffer.from(type, 'ascii');
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])), 0);
  return Buffer.concat([len, typeBuf, data, crc]);
}

function encodePng(width, height, rgba) {
  const sig = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // color type: RGBA
  const stride = width * 4;
  const raw = Buffer.alloc((stride + 1) * height);
  for (let y = 0; y < height; y++) {
    raw[y * (stride + 1)] = 0; // filter: none
    rgba.copy(raw, y * (stride + 1) + 1, y * stride, (y + 1) * stride);
  }
  const idat = zlib.deflateSync(raw);
  return Buffer.concat([sig, chunk('IHDR', ihdr), chunk('IDAT', idat), chunk('IEND', Buffer.alloc(0))]);
}

function makeCanvas(size, bg) {
  const rgba = Buffer.alloc(size * size * 4);
  for (let i = 0; i < size * size; i++) {
    rgba[i * 4] = bg[0];
    rgba[i * 4 + 1] = bg[1];
    rgba[i * 4 + 2] = bg[2];
    rgba[i * 4 + 3] = bg[3];
  }
  return rgba;
}

function setPixel(rgba, size, x, y, color) {
  if (x < 0 || y < 0 || x >= size || y >= size) return;
  const i = (y * size + x) * 4;
  rgba[i] = color[0];
  rgba[i + 1] = color[1];
  rgba[i + 2] = color[2];
  rgba[i + 3] = color[3];
}

function fillRect(rgba, size, x0, y0, x1, y1, color) {
  for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) setPixel(rgba, size, x, y, color);
}

const INK = [235, 235, 235, 255]; // light gray glyph, reads well on dark Stream Deck keys
const ACCENT = [255, 140, 32, 255]; // warm accent, distinct from Fusion's own blue

function glyphBox(rgba, size) {
  // simple isometric-ish cube outline: evokes CAD without copying any real logo
  const m = Math.round(size * 0.18);
  const w = size - 2 * m;
  const t = Math.max(2, Math.round(size * 0.07));
  fillRect(rgba, size, m, m, size - m, m + t, INK);
  fillRect(rgba, size, m, size - m - t, size - m, size - m, INK);
  fillRect(rgba, size, m, m, m + t, size - m, INK);
  fillRect(rgba, size, size - m - t, m, size - m, size - m, INK);
  const im = Math.round(size * 0.42);
  fillRect(rgba, size, im, im, size - im, size - im, ACCENT);
}

function glyphPlay(rgba, size) {
  const cx = size / 2;
  const cy = size / 2;
  const r = size * 0.32;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const dx = (x - cx) / r;
      const dy = (y - cy) / r;
      // triangle pointing right, roughly centered
      if (dx > -0.6 && dx < 0.8 && Math.abs(dy) < (0.8 - dx) * 0.75) {
        setPixel(rgba, size, x, y, ACCENT);
      }
    }
  }
}

function writePng(relPath, size, draw, bg = [30, 30, 30, 255]) {
  const rgba = makeCanvas(size, bg);
  draw(rgba, size);
  const full = path.join(PLUGIN_DIR, relPath);
  fs.mkdirSync(path.dirname(full), { recursive: true });
  fs.writeFileSync(full, encodePng(size, size, rgba));
  console.log('wrote', relPath, `${size}x${size}`);
}

// Plugin / category icons (square, shown in the Stream Deck action list)
writePng('imgs/plugin/category-icon.png', 28, glyphBox);
writePng('imgs/plugin/category-icon@2x.png', 56, glyphBox);
writePng('imgs/plugin/marketplace.png', 256, glyphBox);
writePng('imgs/plugin/marketplace@2x.png', 512, glyphBox);

// Run Command action icon + default key image (overridden live via setImage)
writePng('imgs/actions/run-command/icon.png', 20, glyphPlay);
writePng('imgs/actions/run-command/icon@2x.png', 40, glyphPlay);
writePng('imgs/actions/run-command/key.png', 72, glyphPlay);
writePng('imgs/actions/run-command/key@2x.png', 144, glyphPlay);

console.log('done');
