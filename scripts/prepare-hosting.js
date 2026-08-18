'use strict';

const fs = require('node:fs');
const path = require('node:path');

const projectRoot = path.resolve(__dirname, '..');
const outputRoot = path.join(projectRoot, '.firebase-public');
const publicFiles = [
  'index.html',
  'app.js',
  'rotation-engine.js',
  'sw.js',
  'manifest.json',
  'version.json',
  'logo.png',
  'icon-192.png',
  'icon-512.png',
  'vendor/qrcode.js',
  'vendor/qrcode.LICENSE'
];

fs.rmSync(outputRoot, { recursive: true, force: true });
fs.mkdirSync(outputRoot, { recursive: true });

for (const relativePath of publicFiles) {
  const sourcePath = path.join(projectRoot, relativePath);
  const outputPath = path.join(outputRoot, relativePath);
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.copyFileSync(sourcePath, outputPath);
}

console.log(`Prepared ${publicFiles.length} Firebase Hosting files.`);
