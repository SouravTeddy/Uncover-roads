// Run with: node scripts/generate-icons.mjs
// Requires: npm install --save-dev sharp (then remove after use if desired)
import sharp from 'sharp';
import { readFileSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');
const iconsDir = join(root, 'public', 'icons');
mkdirSync(iconsDir, { recursive: true });

const svgBuffer = readFileSync(join(root, 'public', 'icon.svg'));

const exports = [
  { name: 'icon-512.png',            size: 512, maskable: false },
  { name: 'icon-192.png',            size: 192, maskable: false },
  { name: 'icon-192-maskable.png',   size: 192, maskable: true  },
  { name: 'icon-1024.png',           size: 1024, maskable: false },
  { name: 'icon-180.png',            size: 180, maskable: false },
  { name: 'favicon-32.png',          size: 32,  maskable: false },
  { name: 'favicon-16.png',          size: 16,  maskable: false },
];

for (const { name, size, maskable } of exports) {
  let pipeline = sharp(svgBuffer, { density: Math.ceil(size * 72 / 100) })
    .resize(size, size, { fit: 'contain', background: '#ead0b8' });

  if (maskable) {
    // For maskable: compass occupies inner 80% — add 10% padding each side
    const padded = Math.round(size * 0.1);
    const innerSize = size - padded * 2;
    pipeline = sharp(svgBuffer, { density: Math.ceil(innerSize * 72 / 100) })
      .resize(innerSize, innerSize, { fit: 'contain', background: { r: 234, g: 208, b: 184, alpha: 0 } });

    const inner = await pipeline.png().toBuffer();
    await sharp({
      create: {
        width: size,
        height: size,
        channels: 4,
        background: '#ead0b8',
      }
    })
      .composite([{ input: inner, top: padded, left: padded }])
      .png()
      .toFile(join(iconsDir, name));
  } else {
    await pipeline.png().toFile(join(iconsDir, name));
  }

  console.log(`✓ ${name} (${size}×${size}${maskable ? ', maskable' : ''})`);
}

console.log('\nAll icons generated in public/icons/');
