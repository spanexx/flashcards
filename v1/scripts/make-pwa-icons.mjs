// WHY: PWA install prompts want real raster icons, and this project has no
// image build step. This small, dependency-free generator keeps the committed
// PNGs reproducible from one source.
// PACK: pwa-deploy
// 2026-10-23 opencode: created for the pwa-deploy pack [pack: pwa-deploy]

import { mkdir, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { deflateSync } from "node:zlib";

const here = dirname(fileURLToPath(import.meta.url));
const output = join(here, "..", "public", "icons");

const COLORS = {
  background: [0x2f, 0x5d, 0x50, 255],
  back: [0x7f, 0xb3, 0xa2, 255],
  card: [0xff, 0xff, 0xff, 255],
  line: [0x2f, 0x5d, 0x50, 255],
  softLine: [0xb7, 0xc9, 0xc3, 255],
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

function insideRoundedRect(x, y, left, top, width, height, radius) {
  if (x < left || y < top || x >= left + width || y >= top + height) return false;
  const nearestX = x < left + radius ? left + radius : x > left + width - radius ? left + width - radius : x;
  const nearestY = y < top + radius ? top + radius : y > top + height - radius ? top + height - radius : y;
  const dx = x - nearestX;
  const dy = y - nearestY;
  return dx * dx + dy * dy <= radius * radius;
}

function roundedRect(pixels, size, left, top, width, height, radius, color) {
  for (let y = Math.floor(top); y < Math.ceil(top + height); y += 1) {
    for (let x = Math.floor(left); x < Math.ceil(left + width); x += 1) {
      if (!insideRoundedRect(x, y, left, top, width, height, radius)) continue;
      const offset = (y * size + x) * 4;
      pixels[offset] = color[0];
      pixels[offset + 1] = color[1];
      pixels[offset + 2] = color[2];
      pixels[offset + 3] = color[3];
    }
  }
}

function draw(size) {
  const pixels = canvas(size);
  const scale = size / 512;
  const rect = (left, top, width, height, radius, color) =>
    roundedRect(pixels, size, left * scale, top * scale, width * scale, height * scale, radius * scale, color);

  rect(170, 120, 210, 260, 30, COLORS.back);
  rect(120, 170, 270, 190, 30, COLORS.card);
  rect(152, 210, 200, 18, 9, COLORS.line);
  rect(152, 252, 145, 18, 9, COLORS.softLine);
  rect(152, 294, 170, 18, 9, COLORS.softLine);
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

await mkdir(output, { recursive: true });
for (const [name, size] of [
  ["icon-192.png", 192],
  ["icon-512.png", 512],
  ["icon-maskable-512.png", 512],
]) {
  await writeFile(join(output, name), png(size));
  console.log(`wrote public/icons/${name} (${size}x${size})`);
}
