import { cp, mkdir, rm } from 'node:fs/promises';
import { resolve } from 'node:path';

const root = process.cwd();
const webDir = resolve(root, 'www');
const requiredFiles = [
  'index.html',
  'style.css',
  'engine.js',
  'entidades.js',
  'ui.js'
];

await rm(webDir, { recursive: true, force: true });
await mkdir(webDir, { recursive: true });

for (const file of requiredFiles) {
  await cp(resolve(root, file), resolve(webDir, file));
}

console.log('Neon Tower web assets copied to ./www');
