// 앱 아이콘 생성 (전화기 glyph + 미드나이트 배경 + 민트 링)
// 실행: node scripts/generate-icons.mjs  (출력: public/icons/, public/favicon.svg)
import sharp from 'sharp';
import { mkdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const outDir = path.resolve(__dirname, '..', 'public', 'icons');
mkdirSync(outDir, { recursive: true });

const BG = '#0b1120';
const MINT = '#34d399';

// 전화 수화기 path (Lucide phone, 24x24) — 흰색으로 렌더 후 민트로 채움
const PHONE_PATH =
  'M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z';

function svgGlyph(size, { rounded = 0, bg = BG } = {}) {
  const pad = size * 0.22;
  const box = size - pad * 2;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  <rect width="${size}" height="${size}" rx="${rounded || size * 0.24}" fill="${bg}"/>
  <circle cx="${size / 2}" cy="${size / 2}" r="${size * 0.33}" fill="none" stroke="${MINT}" stroke-opacity="0.35" stroke-width="${size * 0.03}"/>
  <g transform="translate(${pad},${pad}) scale(${box / 24})">
    <path d="${PHONE_PATH}" fill="${MINT}"/>
  </g>
</svg>`;
}

for (const size of [192, 512]) {
  const svg = svgGlyph(size);
  await sharp(Buffer.from(svg)).png().toFile(path.join(outDir, `icon-${size}.png`));
  console.log('wrote icon-' + size + '.png');
}
// maskable (여백 포함 — 안드로이드 적응형 아이콘 크롭 대응)
for (const size of [192, 512]) {
  const canvas = size;
  const inner = Math.floor(size * 0.72);
  const svg = svgGlyph(inner, { rounded: inner * 0.24 });
  const composite = await sharp({
    create: { width: canvas, height: canvas, channels: 4, background: BG },
  })
    .composite([{ input: Buffer.from(svg), left: Math.floor((canvas - inner) / 2), top: Math.floor((canvas - inner) / 2) }])
    .png()
    .toBuffer();
  await sharp(composite).toFile(path.join(outDir, `maskable-${size}.png`));
  console.log('wrote maskable-' + size + '.png');
}
// apple touch (180) + favicon svg
await sharp(Buffer.from(svgGlyph(180))).png().toFile(path.resolve(__dirname, '..', 'public', 'apple-touch-icon.png'));
await sharp(Buffer.from(svgGlyph(512))).png().toFile(path.join(outDir, 'icon-512.png'));
console.log('done');
