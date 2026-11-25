/**
 * Fills Backed asset `price` (and optional `marketCap`) from Jupiter Price API v3
 * using the Solana deployment (chainId 900) mint as `ids`.
 * When Jupiter has no quote, falls back to api.xstocks.fi price-data by asset.symbol.
 *
 * @see https://api.jup.ag/price/v3?ids=
 */

import { fetchXstocksQuotesForSymbols } from '../../lib/xstocks-price.js';
import { applyAssetPriceSnapshot } from '../../lib/hourly-price-roll.js';

const JUPITER_PRICE_V3 = 'https://api.jup.ag/price/v3';
export const JUPITER_SOLANA_CHAIN_ID = 900;

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

export function getChain900Mint(asset) {
  const n = (asset.supportedNetworks || []).find(
    (x) => x.chainId === JUPITER_SOLANA_CHAIN_ID,
  );
  return n?.address ?? null;
}

/** Match lib/jupiter-price: stockData.price, then usdPrice. Also return mcap and change when present. */
export function pickJupiterFields(entry) {
  if (!entry || typeof entry !== 'object') {
    return { priceStr: null, marketCap: null, changePct: null };
  }
  const sd = entry.stockData;
  let p = null;
  if (sd?.price != null && Number.isFinite(Number(sd.price))) {
    p = Number(sd.price);
  } else if (entry.usdPrice != null && Number.isFinite(Number(entry.usdPrice))) {
    p = Number(entry.usdPrice);
  }
  const priceStr = p != null ? String(p) : null;
  const marketCap =
    sd?.mcap != null && Number.isFinite(Number(sd.mcap)) ? String(sd.mcap) : null;
  const changePct =
    entry.priceChange24h != null && Number.isFinite(Number(entry.priceChange24h))
      ? String(entry.priceChange24h)
      : null;
  return { priceStr, marketCap, changePct };
}

async function fetchOneChunk(chunk) {
  const qs = new URLSearchParams();
  qs.set('ids', chunk.join(','));
  const url = `${JUPITER_PRICE_V3}?${qs.toString()}`;
  let lastErr;
  for (let attempt = 0; attempt < 5; attempt += 1) {
    if (attempt > 0) {
      const wait = Math.min(8000, 1000 * 2 ** (attempt - 1));
      await sleep(wait);
    }
    const res = await fetch(url, {
      headers: { Accept: 'application/json' },
      signal: AbortSignal.timeout(15_000),
    });
    if (res.status === 429) {
      lastErr = new Error(`Jupiter price HTTP 429`);
      continue;
    }
    if (!res.ok) {
      throw new Error(`Jupiter price HTTP ${res.status}`);
    }
    return res.json();
  }
  throw lastErr ?? new Error('Jupiter rate limited');
}

export async function fetchJupiterPriceMap(mintAddresses) {
  const unique = [...new Set(mintAddresses)].filter(Boolean);
  const out = {};
  const chunkSize = 50;
  for (let i = 0; i < unique.length; i += chunkSize) {
    const chunk = unique.slice(i, i + chunkSize);
    const j = await fetchOneChunk(chunk);
    Object.assign(out, j);
    if (i + chunkSize < unique.length) await sleep(1100);
  }
  return out;
}

/**
 * Mutates `payload.assets` in place. Sets `price` / `marketCap` when Jupiter returns data for chain 900 mint.
 * @returns {{ filled: number, skipped: number, mints: number }}
 */
export async function applyJupiterPricesToBackedPayload(payload) {
  const assets = payload.assets || [];
  const mints = [];
  for (const a of assets) {
    const m = getChain900Mint(a);
    if (m) mints.push(m);
  }

  if (mints.length === 0) {
    return { filled: 0, skipped: assets.length, mints: 0 };
  }

  let jupiterByMint;
  try {
    jupiterByMint = await fetchJupiterPriceMap(mints);
  } catch (e) {
    console.error('Jupiter fetch failed:', e.message);
    return { filled: 0, skipped: assets.length, mints: mints.length, error: e.message };
  }

  let filled = 0;
  let skipped = 0;

  for (const a of assets) {
    const mint = getChain900Mint(a);
    if (!mint) {
      skipped += 1;
      continue;
    }
    const entry = jupiterByMint[mint];
    const { priceStr, marketCap, changePct } = pickJupiterFields(entry);
    if (priceStr != null) {
      applyAssetPriceSnapshot(a, priceStr, { bulkPctFallback: changePct });
      filled += 1;
      if (marketCap != null) {
        a.marketCap = marketCap;
      }
    } else {
      skipped += 1;
    }
  }

  payload.jupiterSyncedAt = new Date().toISOString();

  const needXstocks = assets
    .filter((a) => a.price == null || a.price === '')
    .map((a) => a.symbol);
  let xstocksFilled = 0;
  if (needXstocks.length > 0) {
    const xMap = await fetchXstocksQuotesForSymbols(needXstocks);
    for (const a of assets) {
      if (a.price != null && a.price !== '') continue;
      const p = xMap[a.symbol];
      if (p != null) {
        applyAssetPriceSnapshot(a, p);
        xstocksFilled += 1;
      }
    }
    payload.xstocksSyncedAt = new Date().toISOString();
  }

  return {
    filled,
    skipped,
    mints: mints.length,
    xstocksFilled,
    xstocksAttempted: needXstocks.length,
  };
}
