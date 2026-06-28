#!/usr/bin/env node
/**
 * Adds hourlyPriceHistory: [] to each asset in data/*.json manifests.
 */

import { readFileSync, writeFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..', 'data');

function migrate(name) {
  const p = join(ROOT, name);
  const j = JSON.parse(readFileSync(p, 'utf8'));
  for (const a of j.assets || []) {
    if (!Array.isArray(a.hourlyPriceHistory)) {
      a.hourlyPriceHistory = [];
    }
  }
  writeFileSync(p, JSON.stringify(j, null, 2) + '\n');
  console.error(`Migrated ${p}`);
}

migrate('ondo-assets.json');
migrate('backed-assets.json');
migrate('tokenized-gold-assets.json');
