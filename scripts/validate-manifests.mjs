#!/usr/bin/env node
/**
 * Validates every deployment address in data/*.json.
 * Run automatically before `npm run build` and manually via `npm run validate:data`.
 */

import { readFileSync, readdirSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { validateManifestAssets } from './lib/validate-manifest.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = join(__dirname, '..', 'data');

const files = readdirSync(DATA_DIR).filter(
  (name) => name.endsWith('.json') && !name.startsWith('.'),
);

let errors = [];
let checked = 0;

for (const file of files) {
  let manifest;
  try {
    manifest = JSON.parse(readFileSync(join(DATA_DIR, file), 'utf8'));
  } catch (e) {
    errors.push(`${file}: invalid JSON (${e.message})`);
    continue;
  }

  checked += manifest.assets?.length ?? 0;
  errors.push(...validateManifestAssets(manifest.assets, file));
}

if (errors.length > 0) {
  console.error(`Manifest validation failed (${errors.length}):`);
  for (const error of errors) console.error(`  - ${error}`);
  process.exit(1);
}

console.log(`Manifest validation passed (${checked} assets across ${files.length} files).`);
