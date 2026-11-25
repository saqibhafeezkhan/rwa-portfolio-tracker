#!/usr/bin/env node
/**
 * Refresh Circle USYC price and yield from https://usyc.hashnote.com/api/stats
 *
 * Run: npm run sync:usyc
 */

import { readFileSync, writeFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { applyAssetPriceSnapshot } from '../lib/hourly-price-roll.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const MANIFEST_PATH = join(__dirname, '..', 'data', 'circle-usyc-assets.json');
const USYC_STATS_URL = 'https://usyc.hashnote.com/api/stats';

const res = await fetch(USYC_STATS_URL, {
  headers: { Accept: 'application/json' },
});
if (!res.ok) {
  console.error(`USYC stats ${res.status}`);
  process.exit(1);
}

const body = await res.json();
const stats = body?.data;
if (!stats?.latest_price) {
  console.error('Missing data.latest_price');
  process.exit(1);
}

const manifest = JSON.parse(readFileSync(MANIFEST_PATH, 'utf8'));
const asset = (manifest.assets || []).find(
  (a) => (a.ticker ?? a.symbol ?? '').toUpperCase() === 'USYC',
);
if (!asset) {
  console.error('USYC not in circle-usyc-assets.json');
  process.exit(1);
}

const priceStr = String(stats.latest_price);
const now = stats.last_updated ?? new Date().toISOString();

// A single quote is not a 24h change. Append to the hourly roll instead; the
// per-quote delta is stored only as informational metadata.
const prev = asset.price != null && asset.price !== '' ? parseFloat(asset.price) : null;
if (prev != null && Number.isFinite(prev) && prev > 0) {
  asset.lastQuoteChangePct = String(((parseFloat(priceStr) - prev) / prev) * 100);
}
applyAssetPriceSnapshot(asset, priceStr, { at: now });
asset.lastStatsAt = now;

manifest.lastUpdatedAt = now;
manifest.statsLastUpdated = now;
if (stats.estimated_yield != null) manifest.estimatedYield = String(stats.estimated_yield);
if (stats.gross_yield != null) manifest.grossYield = String(stats.gross_yield);
if (stats.total_supply != null) manifest.totalSupply = String(stats.total_supply);
if (stats.total_aum != null) manifest.totalAum = String(stats.total_aum);

writeFileSync(MANIFEST_PATH, JSON.stringify(manifest, null, 2) + '\n');

console.log(
  JSON.stringify(
    {
      updatedAt: now,
      price: priceStr,
      estimatedYield: manifest.estimatedYield,
      grossYield: manifest.grossYield,
    },
    null,
    2,
  ),
);
