/**
 * Generate app icons from SVG source
 *
 * Run: node scripts/generate-icons.js
 *
 * Requires: npm install sharp
 */

import sharp from 'sharp';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const ASSETS_DIR = path.join(__dirname, '../assets');
const SVG_PATH = path.join(ASSETS_DIR, 'icon.svg');

const sizes = [16, 32, 64, 128, 256, 512, 1024];

async function generateIcons() {
  console.log('Generating icons from SVG...');

  const svgBuffer = fs.readFileSync(SVG_PATH);

  // Generate main PNG (512x512)
  await sharp(svgBuffer)
    .resize(512, 512)
    .png()
    .toFile(path.join(ASSETS_DIR, 'icon.png'));
  console.log('Created: icon.png (512x512)');

  // Generate various sizes for icns/ico creation
  for (const size of sizes) {
    await sharp(svgBuffer)
      .resize(size, size)
      .png()
      .toFile(path.join(ASSETS_DIR, `icon-${size}.png`));
    console.log(`Created: icon-${size}.png`);
  }

  // Generate tray icon (16x16 and 32x32 for retina)
  await sharp(svgBuffer)
    .resize(16, 16)
    .png()
    .toFile(path.join(ASSETS_DIR, 'tray-icon.png'));
  console.log('Created: tray-icon.png (16x16)');

  await sharp(svgBuffer)
    .resize(32, 32)
    .png()
    .toFile(path.join(ASSETS_DIR, 'tray-icon@2x.png'));
  console.log('Created: tray-icon@2x.png (32x32)');

  console.log('\nDone! PNG icons generated.');
  console.log('\nTo create .icns (macOS) and .ico (Windows):');
  console.log('  macOS: Use iconutil or an online converter');
  console.log('  Windows: Use an online converter or ImageMagick');
  console.log('\nFor electron-builder, the PNG files should work for development.');
}

generateIcons().catch(console.error);
