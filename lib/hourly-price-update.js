import fs from 'fs';
import path from 'path';
import { fetchJupiterPriceMap, pickJupiterUsdPrice } from '@/lib/jupiter-price';
import { fetchXstocksQuotesForSymbols } from '@/lib/xstocks-price';
import { applyAssetPriceSnapshot } from '@/lib/hourly-price-roll';
import { readDataJson } from '@/lib/data-manifests';
import {
  resolveOndoSnapshotPrice,
  resolveBackedSnapshotPrice,
} from '@/lib/resolve-snapshot-price';
import { getChain900Address } from '@/lib/chain-utils';

const ONDO_ASSETS = 'https://app.ondo.finance/api/v2/assets';

function collectMintAddresses(ondoManifest, backedManifest) {
  const set = new Set();
  for (const a of ondoManifest.assets || []) {
    const m = getChain900Address(a);
    if (m) set.add(m);
  }
  for (const a of backedManifest.assets || []) {
    const m = getChain900Address(a);
    if (m) set.add(m);
  }
  return [...set];
}

/**
 * Appends one hourly price snapshot per asset, trims to 24 entries (FIFO),
 * sets price + priceChangePct24h from window (oldest → newest in buffer).
 */
export async function runHourlyPriceUpdate() {
  const ondoPath = path.join(process.cwd(), 'data', 'ondo-assets.json');
  const backedPath = path.join(process.cwd(), 'data', 'backed-assets.json');

  let ondo = readDataJson('ondo-assets.json');
  let backed = readDataJson('backed-assets.json');

  const mints = collectMintAddresses(ondo, backed);

  const [jupiterByMint, bulk] = await Promise.all([
    (async () => {
      try {
        return mints.length > 0 ? await fetchJupiterPriceMap(mints) : {};
      } catch {
        return {};
      }
    })(),
    fetch(ONDO_ASSETS, {
      cache: 'no-store',
      headers: { Accept: 'application/json' },
    }).then(async (res) => {
      if (!res.ok) throw new Error(`Ondo assets ${res.status}`);
      return res.json();
    }),
  ]);

  const bulkBySymbol = new Map((bulk.assets || []).map((a) => [a.symbol, a]));

  const backedNeedXstocks = (backed.assets || [])
    .filter((asset) => {
      const mint = getChain900Address(asset);
      if (!mint) return true;
      const jup = jupiterByMint[mint];
      return pickJupiterUsdPrice(jup) == null;
    })
    .map((a) => a.symbol);

  const xstocksMap = await fetchXstocksQuotesForSymbols(backedNeedXstocks);

  const now = new Date().toISOString();

  for (const asset of ondo.assets || []) {
    const bulkRow = bulkBySymbol.get(asset.symbol);
    const priceStr = resolveOndoSnapshotPrice(bulkRow, asset, jupiterByMint);
    const pm = bulkRow?.primaryMarket || {};
    const bulkPct =
      pm.priceChangePct24h ?? bulkRow?.priceChangePct24h ?? asset.priceChangePct24h;
    applyAssetPriceSnapshot(asset, priceStr, { at: now, bulkPctFallback: bulkPct });
  }

  for (const asset of backed.assets || []) {
    const priceStr = resolveBackedSnapshotPrice(asset, jupiterByMint, xstocksMap);
    applyAssetPriceSnapshot(asset, priceStr, { at: now });
  }

  const rolledAt = now;
  ondo.hourlyRollAt = rolledAt;
  backed.hourlyRollAt = rolledAt;

  fs.writeFileSync(ondoPath, JSON.stringify(ondo, null, 2) + '\n');
  fs.writeFileSync(backedPath, JSON.stringify(backed, null, 2) + '\n');

  return {
    hourlyRollAt: rolledAt,
    ondoAssetCount: ondo.assets?.length ?? 0,
    backedAssetCount: backed.assets?.length ?? 0,
  };
}
