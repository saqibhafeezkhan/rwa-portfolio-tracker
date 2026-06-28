#!/usr/bin/env node
/**
 * Reads data/backed-assets.json:
 * 1) Jupiter (chain 900 mints) for price + mcap when available
 * 2) api.xstocks.fi …/assets/{symbol}/price-data for remaining null prices
 *
 * Run: npm run jupiter:backed
 */

import { readFileSync, writeFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { applyJupiterPricesToBackedPayload } from './lib/jupiter-backed-fill.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT = join(__dirname, '..', 'data', 'backed-assets.json');

async function main() {
  const raw = readFileSync(OUT, 'utf8');
  const payload = JSON.parse(raw);
  console.error('Fetching Jupiter + xstocks.fi fallback prices…');
  const stats = await applyJupiterPricesToBackedPayload(payload);
  console.error(stats);
  writeFileSync(OUT, JSON.stringify(payload, null, 2) + '\n');
  console.error(`Updated ${OUT}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
