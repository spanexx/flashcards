// WHY: PWA install prompts want real raster icons, and this project has no
// image build step. This small, dependency-free generator keeps the committed
// PNGs and favicon reproducible from one source: the Lucide Layers mark.
// PACK: pwa-deploy
// 2026-10-23 opencode: created for the pwa-deploy pack [pack: pwa-deploy]
// 2026-10-25 opencode: replaced the old card artwork with the shared Lucide
// Layers mark and added the multi-size favicon. [pack: pwa-deploy]

import { mkdir, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { deflateSync } from "node:zlib";

const here = dirname(fileURLToPath(import.meta.url));
const publicDir = join(here, "..", "public");
const iconsDir = join(publicDir, "icons");

const COLORS = {
  background: [0x2f, 0x5d, 0x50, 255],
  ink: [0xff, 0xff, 0xff, 255],
};

function canvas(size) {
  const pixels = new Uint8Array(size * size * 4);
  for (let index = 0; index < pixels.length; index += 4) {
    pixels[index] = COLORS.background[0];
    pixels[index + 1] = COLORS.background[1];
    pixels[index + 2] = COLORS.background[2];
    pixels[index + 3] = COLORS.background[3];
  }
  return pixels;
}

function blend(pixels, size, x, y, color, coverage) {
  if (x < 0 || y < 0 || x >= size || y >= size || coverage <= 0) return;
  const offset = (y * size + x) * 4;
  const alpha = Math.min(1, coverage);
  for (let channel = 0; channel < 4; channel += 1) {
    pixels[offset + channel] = Math.round(
      pixels[offset + channel] * (1 - alpha) + color[channel] * alpha,
    );
  }
}

function distanceToSegment(x, y, x1, y1, x2, y2) {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const lengthSquared = dx * dx + dy * dy;
  if (lengthSquared === 0) return Math.hypot(x - x1, y - y1);
  const along = Math.max(0, Math.min(1, ((x - x1) * dx + (y - y1) * dy) / lengthSquared));
  return Math.hypot(x - (x1 + along * dx), y - (y1 + along * dy));
}

function line(pixels, size, x1, y1, x2, y2, width, color) {
  const half = width / 2;
  const left = Math.max(0, Math.floor(Math.min(x1, x2) - half - 1));
  const top = Math.max(0, Math.floor(Math.min(y1, y2) - half - 1));
  const right = Math.min(size - 1, Math.ceil(Math.max(x1, x2) + half + 1));
  const bottom = Math.min(size - 1, Math.ceil(Math.max(y1, y2) + half + 1));
  const samples = 4;
  const step = 1 / samples;
  for (let y = top; y <= bottom; y += 1) {
    for (let x = left; x <= right; x += 1) {
      let hits = 0;
      for (let sy = 0; sy < samples; sy += 1) {
        for (let sx = 0; sx < samples; sx += 1) {
          if (distanceToSegment(x + (sx + 0.5) * step, y + (sy + 0.5) * step, x1, y1, x2, y2) <= half) {
            hits += 1;
          }
        }
      }
      blend(pixels, size, x, y, color, hits / (samples * samples));
    }
  }
}

function draw(size) {
  const pixels = canvas(size);
  const scale = size / 512;
  const point = (x, y) => [x * scale, y * scale];
  const width = 32 * scale;
  const strokes = [
    [[256, 96], [416, 178]],
    [[416, 178], [256, 260]],
    [[256, 260], [96, 178]],
    [[96, 178], [256, 96]],
    [[96, 266], [256, 348]],
    [[256, 348], [416, 266]],
    [[96, 350], [256, 432]],
    [[256, 432], [416, 350]],
  ];
  for (const [[fromX, fromY], [toX, toY]] of strokes) {
    const [x1, y1] = point(fromX, fromY);
    const [x2, y2] = point(toX, toY);
    line(pixels, size, x1, y1, x2, y2, width, COLORS.ink);
  }
  return pixels;
}

function chunk(type, data) {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length, 0);
  const body = Buffer.concat([Buffer.from(type, "ascii"), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body) >>> 0, 0);
  return Buffer.concat([length, body, crc]);
}

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let index = 0; index < 256; index += 1) {
    let value = index;
    for (let bit = 0; bit < 8; bit += 1) {
      value = value & 1 ? 0xedb88320 ^ (value >>> 1) : value >>> 1;
    }
    table[index] = value >>> 0;
  }
  return table;
})();

function crc32(buffer) {
  let value = 0xffffffff;
  for (const byte of buffer) value = CRC_TABLE[(value ^ byte) & 0xff] ^ (value >>> 8);
  return (value ^ 0xffffffff) >>> 0;
}

function png(size) {
  const pixels = draw(size);
  const raw = Buffer.alloc(size * (size * 4 + 1));
  for (let y = 0; y < size; y += 1) {
    const row = y * (size * 4 + 1);
    raw[row] = 0;
    Buffer.from(pixels.buffer, y * size * 4, size * 4).copy(raw, row + 1);
  }
  const header = Buffer.alloc(13);
  header.writeUInt32BE(size, 0);
  header.writeUInt32BE(size, 4);
  header[8] = 8;
  header[9] = 6;
  header[10] = 0;
  header[11] = 0;
  header[12] = 0;
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", header),
    chunk("IDAT", deflateSync(raw, { level: 9 })),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

function ico(images) {
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0);
  header.writeUInt16LE(1, 2);
  header.writeUInt16LE(images.length, 4);
  let offset = 6 + images.length * 16;
  const entries = images.map(({ size, data }) => {
    const entry = Buffer.alloc(16);
    entry[0] = size >= 256 ? 0 : size;
    entry[1] = size >= 256 ? 0 : size;
    entry[2] = 0;
    entry[3] = 0;
    entry.writeUInt16LE(1, 4);
    entry.writeUInt16LE(32, 6);
    entry.writeUInt32LE(data.length, 8);
    entry.writeUInt32LE(offset, 12);
    offset += data.length;
    return entry;
  });
  return Buffer.concat([header, ...entries, ...images.map(({ data }) => data)]);
}

await mkdir(iconsDir, { recursive: true });
for (const [name, size] of [
  ["icon-192.png", 192],
  ["icon-512.png", 512],
  ["icon-maskable-512.png", 512],
]) {
  await writeFile(join(iconsDir, name), png(size));
  console.log(`wrote public/icons/${name} (${size}x${size})`);
}

const favicon = ico([16, 32, 48].map((size) => ({ size, data: png(size) })));
await writeFile(join(publicDir, "favicon.ico"), favicon);
console.log("wrote public/favicon.ico (16, 32, 48)");
