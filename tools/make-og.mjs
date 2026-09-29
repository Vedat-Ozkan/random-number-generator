// Draws og.png (1200x630) with zero dependencies. Run: node tools/make-og.mjs
import { deflateSync, crc32 as zcrc32 } from 'node:zlib';
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const OUT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'og.png');
const W = 1200, H = 630, SS = 3;

/* ---- icon geometry (copied from make-icons.mjs) ---- */
const R = 120, HALF_W = 18, RAD = Math.PI / 180;
const ARCS = [[200, 330], [20, 150]];
function arrowTriangle(deg) {
  const t = deg * RAD;
  const px = 256 + R * Math.cos(t), py = 256 + R * Math.sin(t);
  const ux = Math.cos(t), uy = Math.sin(t), tx = -Math.sin(t), ty = Math.cos(t);
  return [[px - 46 * ux, py - 46 * uy], [px + 46 * ux, py + 46 * uy], [px + 64 * tx, py + 64 * ty]];
}
const TRIANGLES = [330, 150].map(arrowTriangle);
const cross = (a, b, p) => (b[0] - a[0]) * (p[1] - a[1]) - (b[1] - a[1]) * (p[0] - a[0]);
function inTriangle(tri, x, y) {
  const p = [x, y];
  const s = [cross(tri[0], tri[1], p), cross(tri[1], tri[2], p), cross(tri[2], tri[0], p)];
  return s.every((v) => v >= 0) || s.every((v) => v <= 0);
}
function inGlyph(x, y) {
  const dx = x - 256, dy = y - 256, d = Math.hypot(dx, dy);
  if (d >= R - HALF_W && d <= R + HALF_W) {
    let a = Math.atan2(dy, dx) / RAD;
    a = ((a % 360) + 360) % 360;
    if (ARCS.some(([s, e]) => a >= s && a <= e)) return true;
  }
  return TRIANGLES.some((tri) => inTriangle(tri, x, y));
}

/* ---- shapes ---- */
function inRR(x, y, x0, y0, w, h, r) {
  if (x < x0 || y < y0 || x > x0 + w || y > y0 + h) return false;
  const cx = Math.min(Math.max(x, x0 + r), x0 + w - r);
  const cy = Math.min(Math.max(y, y0 + r), y0 + h - r);
  return Math.hypot(x - cx, y - cy) <= r;
}
const inCircle = (x, y, cx, cy, r) => Math.hypot(x - cx, y - cy) <= r;

const FONT = {
  R: '11110 10001 10001 11110 10100 10010 10001',
  A: '01110 10001 10001 11111 10001 10001 10001',
  N: '10001 11001 10101 10011 10001 10001 10001',
  D: '11110 10001 10001 10001 10001 10001 11110',
  O: '01110 10001 10001 10001 10001 10001 01110',
  M: '10001 11011 10101 10101 10001 10001 10001',
};
const CELLS = [];
[...'RANDOM'].forEach((ch, i) => {
  FONT[ch].split(' ').forEach((row, r) => {
    [...row].forEach((bit, c) => { if (bit === '1') CELLS.push([470 + i * 128 + c * 20, 190 + r * 20]); });
  });
});

const hex = (s) => [1, 3, 5].map((i) => parseInt(s.slice(i, i + 2), 16));
const C = {
  bg: hex('#0F1416'), bar: hex('#00ACC1'), white: hex('#FFFFFF'), word: hex('#E1E8EA'),
  die: hex('#7B1FA2'), coin: hex('#FFB300'), t1: hex('#1976D2'), t2: hex('#E64A19'),
};
const PIPS = [[27.5, 27.5], [82.5, 27.5], [55, 55], [27.5, 82.5], [82.5, 82.5]];

function colorAt(x, y) {
  let c = C.bg;
  if (y >= H - 8) c = C.bar;
  const s = 300 / 512;
  const gx = (x - 110) / s, gy = (y - 165) / s;
  if (inRR(gx, gy, 0, 0, 512, 512, 112)) c = inGlyph(gx, gy) ? C.white : C.bar;
  if (x >= 470 && x <= 1080 && y >= 190 && y <= 330) {
    for (const [cx, cy] of CELLS) if (inRR(x, y, cx, cy, 18, 18, 4)) { c = C.word; break; }
  }
  if (y >= 380 && y <= 490) {
    if (inRR(x, y, 470, 380, 110, 110, 24)) {
      c = C.die;
      if (PIPS.some(([px, py]) => inCircle(x, y, 470 + px, 380 + py, 10))) c = C.white;
    }
    if (inCircle(x, y, 665, 435, 55)) c = C.coin;
    if (inRR(x, y, 750, 380, 110, 110, 26)) c = C.t1;
    if (inRR(x, y, 890, 380, 110, 110, 26)) c = C.t2;
  }
  return c;
}

/* ---- PNG ---- */
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

const stride = W * 3;
const raw = Buffer.alloc((stride + 1) * H);
for (let py = 0; py < H; py++) {
  raw[py * (stride + 1)] = 0;
  for (let px = 0; px < W; px++) {
    let r = 0, g = 0, b = 0;
    for (let sy = 0; sy < SS; sy++) {
      for (let sx = 0; sx < SS; sx++) {
        const c = colorAt(px + (sx + 0.5) / SS, py + (sy + 0.5) / SS);
        r += c[0]; g += c[1]; b += c[2];
      }
    }
    const n = SS * SS, o = py * (stride + 1) + 1 + px * 3;
    raw[o] = Math.round(r / n); raw[o + 1] = Math.round(g / n); raw[o + 2] = Math.round(b / n);
  }
}
const ihdr = Buffer.alloc(13);
ihdr.writeUInt32BE(W, 0);
ihdr.writeUInt32BE(H, 4);
ihdr[8] = 8; ihdr[9] = 2; // RGB
writeFileSync(OUT, Buffer.concat([
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
  chunk('IHDR', ihdr), chunk('IDAT', deflateSync(raw)), chunk('IEND', Buffer.alloc(0)),
]));
console.log('wrote og.png');
