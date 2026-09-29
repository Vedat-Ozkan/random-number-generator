// Rasterizes the app icon into PNGs. Zero dependencies. Run: node tools/make-icons.mjs
import { deflateSync, crc32 as zcrc32 } from 'node:zlib';
import { writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const OUT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'icons');
const BG = [0x11, 0x11, 0x13];
const LIGHT = [0xf2, 0xf2, 0xf3]; // arc A
const ACCENT = [0x8b, 0x93, 0xff]; // arc B
const R = 120;
const HALF_W = 14; // stroke width 28 (radius 106..134)
const ARROW_HALF_BASE = 38; // base width 76 (radius 82..158)
const ARROW_APEX = 56;
const RAD = Math.PI / 180;

const ARCS = [[200, 330], [20, 150]];
const ARROW_ANGLES = [330, 150]; // arrowheads of arc A and arc B

function arrowTriangle(deg) {
  const t = deg * RAD;
  const px = 256 + R * Math.cos(t);
  const py = 256 + R * Math.sin(t);
  const ux = Math.cos(t), uy = Math.sin(t); // radial
  const tx = -Math.sin(t), ty = Math.cos(t); // clockwise tangent
  return [
    [px - ARROW_HALF_BASE * ux, py - ARROW_HALF_BASE * uy],
    [px + ARROW_HALF_BASE * ux, py + ARROW_HALF_BASE * uy],
    [px + ARROW_APEX * tx, py + ARROW_APEX * ty],
  ];
}
const TRIANGLES = ARROW_ANGLES.map(arrowTriangle);

const cross = (a, b, p) => (b[0] - a[0]) * (p[1] - a[1]) - (b[1] - a[1]) * (p[0] - a[0]);
function inTriangle(tri, x, y) {
  const p = [x, y];
  const s = [cross(tri[0], tri[1], p), cross(tri[1], tri[2], p), cross(tri[2], tri[0], p)];
  return s.every((v) => v >= 0) || s.every((v) => v <= 0);
}

// Returns 0 (none), 1 (arc A / light) or 2 (arc B / accent).
function glyphPart(x, y) {
  const dx = x - 256, dy = y - 256;
  const d = Math.hypot(dx, dy);
  if (d >= R - HALF_W && d <= R + HALF_W) {
    let a = Math.atan2(dy, dx) / RAD;
    a = ((a % 360) + 360) % 360;
    const i = ARCS.findIndex(([s, e]) => a >= s && a <= e);
    if (i >= 0) return i + 1;
  }
  const t = TRIANGLES.findIndex((tri) => inTriangle(tri, x, y));
  return t >= 0 ? t + 1 : 0;
}

function inRoundedRect(x, y, r = 112) {
  if (x < 0 || y < 0 || x > 512 || y > 512) return false;
  const cx = x < r ? r : x > 512 - r ? 512 - r : x;
  const cy = y < r ? r : y > 512 - r ? 512 - r : y;
  return Math.hypot(x - cx, y - cy) <= r;
}

function render(size, { rounded, glyphScale }) {
  const scale = 512 / size;
  const SS = 4;
  const buf = Buffer.alloc(size * size * 4);
  for (let py = 0; py < size; py++) {
    for (let px = 0; px < size; px++) {
      let bgCount = 0, light = 0, accent = 0;
      for (let sy = 0; sy < SS; sy++) {
        for (let sx = 0; sx < SS; sx++) {
          const x = (px + (sx + 0.5) / SS) * scale;
          const y = (py + (sy + 0.5) / SS) * scale;
          if (rounded && !inRoundedRect(x, y)) continue;
          bgCount++;
          const gx = 256 + (x - 256) / glyphScale;
          const gy = 256 + (y - 256) / glyphScale;
          const part = glyphPart(gx, gy);
          if (part === 1) light++;
          else if (part === 2) accent++;
        }
      }
      const o = (py * size + px) * 4;
      if (bgCount === 0) continue;
      const wl = light / bgCount;
      const wa = accent / bgCount;
      const wb = 1 - wl - wa;
      for (let k = 0; k < 3; k++) buf[o + k] = Math.round(BG[k] * wb + LIGHT[k] * wl + ACCENT[k] * wa);
      buf[o + 3] = Math.round((bgCount / (SS * SS)) * 255);
    }
  }
  return buf;
}

const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();
function crc32(buf) {
  if (typeof zcrc32 === 'function') return zcrc32(buf) >>> 0;
  let c = 0xffffffff;
  for (const b of buf) c = CRC_TABLE[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
}

function encodePng(size, rgba) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // RGBA
  const stride = size * 4;
  const raw = Buffer.alloc((stride + 1) * size);
  for (let y = 0; y < size; y++) {
    raw[y * (stride + 1)] = 0; // filter: none
    rgba.copy(raw, y * (stride + 1) + 1, y * stride, (y + 1) * stride);
  }
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw)),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

const OUTPUTS = [
  ['icon-192.png', 192, { rounded: true, glyphScale: 1 }],
  ['icon-512.png', 512, { rounded: true, glyphScale: 1 }],
  ['icon-maskable-512.png', 512, { rounded: false, glyphScale: 0.8 }],
  ['apple-touch-icon.png', 180, { rounded: false, glyphScale: 0.8 }],
  ['icon-48.png', 48, { rounded: true, glyphScale: 1 }],
];

// favicon.ico with embedded PNGs (Google's favicon crawler requests /favicon.ico).
function encodeIco(sizes) {
  const pngs = sizes.map((s) => encodePng(s, render(s, { rounded: true, glyphScale: 1 })));
  const head = Buffer.alloc(6 + 16 * pngs.length);
  head.writeUInt16LE(1, 2); // type: icon
  head.writeUInt16LE(pngs.length, 4);
  let offset = head.length;
  pngs.forEach((png, i) => {
    const e = 6 + 16 * i;
    head[e] = sizes[i]; head[e + 1] = sizes[i]; // width, height (<256)
    head.writeUInt16LE(1, e + 4); // planes
    head.writeUInt16LE(32, e + 6); // bits per pixel
    head.writeUInt32LE(png.length, e + 8);
    head.writeUInt32LE(offset, e + 12);
    offset += png.length;
  });
  return Buffer.concat([head, ...pngs]);
}

// icon.svg uses the same geometry as the PNG rasterizer.
function svgIcon() {
  const f = (n) => Math.round(n * 100) / 100;
  const at = (deg) => [f(256 + R * Math.cos(deg * RAD)), f(256 + R * Math.sin(deg * RAD))];
  const arc = ([s, e], color) => {
    const [x0, y0] = at(s);
    const [x1, y1] = at(e);
    return `  <path d="M${x0} ${y0}A${R} ${R} 0 0 1 ${x1} ${y1}" fill="none" stroke="${color}" stroke-width="${HALF_W * 2}"/>`;
  };
  const tri = (t, color) => `  <polygon points="${t.map((p) => p.map(f).join(',')).join(' ')}" fill="${color}"/>`;
  const hex = (c) => '#' + c.map((v) => v.toString(16).padStart(2, '0')).join('').toUpperCase();
  return [
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512">',
    `  <rect width="512" height="512" rx="112" fill="${hex(BG)}"/>`,
    arc(ARCS[0], hex(LIGHT)), arc(ARCS[1], hex(ACCENT)),
    tri(TRIANGLES[0], hex(LIGHT)), tri(TRIANGLES[1], hex(ACCENT)),
    '</svg>', '',
  ].join('\n');
}

mkdirSync(OUT, { recursive: true });
writeFileSync(path.join(OUT, 'icon.svg'), svgIcon());
console.log('wrote icon.svg');
for (const [name, size, opts] of OUTPUTS) {
  writeFileSync(path.join(OUT, name), encodePng(size, render(size, opts)));
  console.log('wrote', name);
}
writeFileSync(path.join(OUT, '..', 'favicon.ico'), encodeIco([16, 32, 48]));
console.log('wrote favicon.ico');
