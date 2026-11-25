#!/usr/bin/env node
/**
 * Normalizes hourly price history:
 * - ensures every asset has `hourlyPriceHistory: []`
 * - drops snapshots older than the 25h rolling window (e.g. seeded data)
 * - clears `priceChangePct24h` when fewer than 2 fresh snapshots remain
 *
 * Run: npm run migrate:hourly
 */

import { readFileSync, readdirSync, writeFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = join(__dirname, '..', 'data');
const CUTOFF = Date.now() - 25 * 60 * 60 * 1000;

const files = readdirSync(DATA_DIR).filter(
  (name) => name.endsWith('.json') && !name.startsWith('.'),
);

let touchedAssets = 0;
let clearedChanges = 0;

for (const filename of files) {
  const full = join(DATA_DIR, filename);
  const manifest = JSON.parse(readFileSync(full, 'utf8'));
  if (!Array.isArray(manifest.assets)) continue;

  let changed = false;

  for (const asset of manifest.assets) {
    const history = Array.isArray(asset.hourlyPriceHistory)
      ? asset.hourlyPriceHistory
      : [];

    const fresh = history.filter((snapshot) => {
      const at = Date.parse(snapshot?.at);
      return Number.isFinite(at) && at >= CUTOFF;
    });

    if (fresh.length !== history.length) {
      asset.hourlyPriceHistory = fresh;
      changed = true;
      touchedAssets += 1;
    } else if (!Array.isArray(asset.hourlyPriceHistory)) {
      asset.hourlyPriceHistory = [];
      changed = true;
    }

    if (fresh.length < 2 && asset.priceChangePct24h != null) {
      asset.priceChangePct24h = null;
      changed = true;
      clearedChanges += 1;
    }
  }

  if (changed) {
    writeFileSync(full, `${JSON.stringify(manifest, null, 2)}\n`);
    console.error(`Migrated ${filename}`);
  }
}

console.error(
  `Pruned history for ${touchedAssets} assets; cleared ${clearedChanges} stale changes.`,
);
