// Genera los íconos PNG de la PWA sin dependencias (zlib de Node).
// Uso: node scripts/generate-icons.mjs  → public/icons/*.png
import { mkdirSync, writeFileSync } from 'node:fs';
import { deflateSync } from 'node:zlib';

const BLUE = [0x00, 0x7a, 0xff];
const WHITE = [0xff, 0xff, 0xff];

const crcTable = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});
const crc32 = (buf) => {
  let c = 0xffffffff;
  for (const byte of buf) c = crcTable[(c ^ byte) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
};
const chunk = (type, data) => {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
};

/** Ícono: fondo azul (redondeado o a sangre) con cinco barras de onda blancas. */
const draw = (size, { maskable }) => {
  const px = Buffer.alloc(size * size * 4);
  const radius = maskable ? 0 : size * 0.225;
  // Las barras ocupan la zona segura (60 % centrado en los maskable).
  const area = maskable ? 0.5 : 0.62;
  const left = (size * (1 - area)) / 2;
  const bars = [0.28, 0.6, 1, 0.6, 0.28];
  const slot = (size * area) / bars.length;
  const barW = slot * 0.46;
  const inRounded = (x, y) => {
    if (radius === 0) return true;
    const cx = Math.min(Math.max(x, radius), size - radius);
    const cy = Math.min(Math.max(y, radius), size - radius);
    return (x - cx) ** 2 + (y - cy) ** 2 <= radius ** 2;
  };
  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const i = (y * size + x) * 4;
      if (!inRounded(x + 0.5, y + 0.5)) continue;
      let color = BLUE;
      const index = Math.floor((x - left) / slot);
      const height = bars[index];
      if (height !== undefined) {
        const cx = left + slot * (index + 0.5);
        const half = (size * area * height) / 2;
        const dx = Math.abs(x + 0.5 - cx);
        const dy = Math.abs(y + 0.5 - size / 2);
        // Barra con extremos redondeados.
        const cap = barW / 2;
        const inside =
          dx <= cap && (dy <= half - cap || (dy - (half - cap)) ** 2 + dx ** 2 <= cap ** 2);
        if (inside) color = WHITE;
      }
      px[i] = color[0];
      px[i + 1] = color[1];
      px[i + 2] = color[2];
      px[i + 3] = 255;
    }
  }
  const raw = Buffer.alloc(size * (size * 4 + 1));
  for (let y = 0; y < size; y += 1)
    px.copy(raw, y * (size * 4 + 1) + 1, y * size * 4, (y + 1) * size * 4);
  const header = Buffer.alloc(13);
  header.writeUInt32BE(size, 0);
  header.writeUInt32BE(size, 4);
  header.set([8, 6, 0, 0, 0], 8);
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', header),
    chunk('IDAT', deflateSync(raw)),
    chunk('IEND', Buffer.alloc(0)),
  ]);
};

mkdirSync('public/icons', { recursive: true });
for (const [name, size, maskable] of [
  ['icon-192.png', 192, false],
  ['icon-512.png', 512, false],
  ['maskable-512.png', 512, true],
  ['apple-touch-icon.png', 180, true],
]) {
  writeFileSync(`public/icons/${name}`, draw(size, { maskable }));
}
console.log('Íconos generados en public/icons');
