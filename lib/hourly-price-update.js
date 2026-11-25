import {
  fetchJupiterPriceMap,
  pickJupiterChangePct,
  pickJupiterUsdPrice,
} from '@/lib/jupiter-price';
import { fetchXstocksQuotesForSymbols } from '@/lib/xstocks-price';
import { applyAssetPriceSnapshot } from '@/lib/hourly-price-roll';
import { readDataJsonForUpdate, writeDataJson } from '@/lib/data-manifests';
import {
  resolveOndoSnapshotPrice,
  resolveBackedSnapshotPrice,
} from '@/lib/resolve-snapshot-price';
import { getChain900Address } from '@/lib/chain-utils';
import { firstFinitePct } from '@/lib/ondo-ticker';

const ONDO_ASSETS = 'https://app.ondo.finance/api/v2/assets';

const EXTRA_MANIFESTS = [
  'tokenized-gold-assets.json',
  'maple-assets.json',
  'securitize-assets.json',
  'centrifuge-assets.json',
  'circle-usyc-assets.json',
];

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

function ondoChangeByTicker(bulk) {
  const map = new Map();
  for (const a of bulk.assets || []) {
    const ticker = (a.ticker || a.symbol || '').toUpperCase();
    if (!ticker) continue;
    const pct = firstFinitePct(
      a.primaryMarket?.priceChangePct24h,
      a.priceChangePct24h,
    );
    if (pct != null) map.set(ticker, pct);
  }
  return map;
}

const HISTORY_INTERVAL_MS = 55 * 60_000;

function shouldAppendHistory(manifest) {
  const last = Date.parse(manifest?.hourlyRollAt ?? '');
  if (!Number.isFinite(last) || Date.now() - last >= HISTORY_INTERVAL_MS) return true;
  // Take one extra point shortly after a reset so live provider changes can be
  // used as the 24h fallback while the hourly window matures.
  return (manifest?.assets || []).some(
    (asset) => (asset.hourlyPriceHistory?.length ?? 0) < 2,
  );
}

/**
 * Refreshes Ondo/Backed prices and, at most once an hour, appends one price
 * snapshot per asset (trimmed to 24) and recomputes 24h % from a full window.
 * Price-only runs (triggered by the ticker refresh) keep holdings values live
 * without flooding the hourly history buffer.
 */
export async function runHourlyPriceUpdate() {
  const ondo = readDataJsonForUpdate('ondo-assets.json');
  const backed = readDataJsonForUpdate('backed-assets.json');
  const appendHistory = shouldAppendHistory(ondo) || shouldAppendHistory(backed);

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
      signal: AbortSignal.timeout(15_000),
    }).then(async (res) => {
      if (!res.ok) throw new Error(`Ondo assets ${res.status}`);
      return res.json();
    }),
  ]);

  const bulkBySymbol = new Map((bulk.assets || []).map((a) => [a.symbol, a]));
  const bulkByTicker = ondoChangeByTicker(bulk);

  const backedNeedXstocks = (backed.assets || [])
    .filter((asset) => {
      const mint = getChain900Address(asset);
      if (!mint) return true;
      return pickJupiterUsdPrice(jupiterByMint[mint]) == null;
    })
    .map((a) => a.symbol);

  const xstocksMap = await fetchXstocksQuotesForSymbols(backedNeedXstocks);

  const now = new Date().toISOString();

  function applyPrice(asset, priceStr, fallbackPct) {
    if (!priceStr || !Number.isFinite(parseFloat(priceStr))) return;
    if (appendHistory) {
      applyAssetPriceSnapshot(asset, priceStr, {
        at: now,
        bulkPctFallback: fallbackPct,
      });
    } else {
      asset.price = priceStr;
    }
  }

  for (const asset of ondo.assets || []) {
    const bulkRow = bulkBySymbol.get(asset.symbol);
    const priceStr = resolveOndoSnapshotPrice(bulkRow, asset, jupiterByMint);
    const pm = bulkRow?.primaryMarket || {};
    const bulkPct = firstFinitePct(pm.priceChangePct24h, bulkRow?.priceChangePct24h);
    applyPrice(asset, priceStr, bulkPct);
  }

  for (const asset of backed.assets || []) {
    const priceStr = resolveBackedSnapshotPrice(asset, jupiterByMint, xstocksMap);
    const mint = getChain900Address(asset);
    const fallbackPct = firstFinitePct(
      mint ? pickJupiterChangePct(jupiterByMint[mint]) : null,
      bulkByTicker.get((asset.ticker || asset.symbol || '').toUpperCase()),
    );
    applyPrice(asset, priceStr, fallbackPct);
  }

  if (appendHistory) {
    ondo.hourlyRollAt = now;
    backed.hourlyRollAt = now;
  }

  await Promise.all([
    writeDataJson('ondo-assets.json', ondo),
    writeDataJson('backed-assets.json', backed),
  ]);

  // Give the other manifests an hourly 24h history too, using their last
  // provider-updated price. This is what makes their ticker change real after
  // a full day instead of the old per-quote delta.
  let extraAssets = 0;
  if (appendHistory) {
    await Promise.all(
      EXTRA_MANIFESTS.map(async (filename) => {
        let manifest;
        try {
          manifest = readDataJsonForUpdate(filename);
        } catch {
          return;
        }
        for (const asset of manifest.assets || []) {
          if (!Number.isFinite(parseFloat(asset.price))) continue;
          applyAssetPriceSnapshot(asset, String(asset.price), { at: now });
          extraAssets += 1;
        }
        await writeDataJson(filename, manifest);
      }),
    );
  }

  return {
    hourlyRollAt: appendHistory ? now : ondo.hourlyRollAt ?? null,
    rolledHistory: appendHistory,
    ondoAssetCount: ondo.assets?.length ?? 0,
    backedAssetCount: backed.assets?.length ?? 0,
    extraAssetCount: extraAssets,
  };
}

