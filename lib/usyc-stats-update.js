import fs from 'fs';
import path from 'path';

import { readDataJson } from '@/lib/data-manifests';

const USYC_STATS_URL = 'https://usyc.hashnote.com/api/stats';
const CIRCLE_MANIFEST = 'circle-usyc-assets.json';

/**
 * Fetch Hashnote USYC stats and persist `latest_price` + yield fields on
 * `data/circle-usyc-assets.json`.
 */
export async function runUsycStatsUpdate() {
  const manifestPath = path.join(process.cwd(), 'data', CIRCLE_MANIFEST);
  const manifest = readDataJson(CIRCLE_MANIFEST);

  const res = await fetch(USYC_STATS_URL, {
    cache: 'no-store',
    headers: { Accept: 'application/json' },
  });
  if (!res.ok) {
    throw new Error(`USYC stats ${res.status}`);
  }

  const body = await res.json();
  const stats = body?.data;
  if (!stats || stats.latest_price == null) {
    throw new Error('USYC stats response missing data.latest_price');
  }

  const priceStr = String(stats.latest_price);
  const next = parseFloat(priceStr);
  const now = stats.last_updated ?? new Date().toISOString();

  const asset = (manifest.assets || []).find(
    (a) => (a.ticker ?? a.symbol ?? '').toUpperCase() === 'USYC',
  );
  if (!asset) {
    throw new Error('USYC asset not found in circle-usyc-assets.json');
  }

  const prev = asset.price != null && asset.price !== '' ? parseFloat(asset.price) : null;
  if (prev != null && Number.isFinite(prev) && prev > 0 && Number.isFinite(next)) {
    const pct = ((next - prev) / prev) * 100;
    asset.priceChangePct24h = String(pct);
  }

  asset.price = priceStr;
  asset.lastStatsAt = now;

  manifest.lastUpdatedAt = now;
  manifest.statsLastUpdated = now;
  if (stats.estimated_yield != null) {
    manifest.estimatedYield = String(stats.estimated_yield);
  }
  if (stats.gross_yield != null) {
    manifest.grossYield = String(stats.gross_yield);
  }
  if (stats.total_supply != null) {
    manifest.totalSupply = String(stats.total_supply);
  }
  if (stats.total_aum != null) {
    manifest.totalAum = String(stats.total_aum);
  }

  fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + '\n');

  return {
    updatedAt: now,
    price: priceStr,
    estimatedYield: manifest.estimatedYield ?? null,
    grossYield: manifest.grossYield ?? null,
  };
}
