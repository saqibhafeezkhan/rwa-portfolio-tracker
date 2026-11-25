import { readDataJson } from '@/lib/data-manifests';
import { fetchJupiterPriceMap, pickJupiterChangePct, pickJupiterUsdPrice } from '@/lib/jupiter-price';
import { fetchXstocksQuotesForSymbols } from '@/lib/xstocks-price';
import {
  assetToTickerRow,
  firstFinitePct,
  formatTickerPrice,
  filterTickerMarqueeRows,
  recentHistoryPct,
  resolveTickerRowName,
  tickerChangeFromPctRaw,
} from '@/lib/ondo-ticker';
import { getChain900Address } from '@/lib/chain-utils';
import { writeTickerSnapshot } from '@/lib/ticker-snapshot';

const ONDO_ASSETS = 'https://app.ondo.finance/api/v2/assets';
const CACHE_TTL_MS = 60_000;
const BUILD_TIMEOUT_MS = 20_000;

function collectMintAddresses(...manifests) {
  const set = new Set();
  for (const manifest of manifests) {
    for (const a of manifest?.assets || []) {
      const m = getChain900Address(a);
      if (m) set.add(m);
    }
  }
  return [...set];
}

function ondoManifestBySymbol(ondoAssetsManifest) {
  return new Map(
    (ondoAssetsManifest.assets || []).map((a) => [a.symbol, a]),
  );
}

/** Live Ondo ticker → price + 24h %. Used to enrich Backed xStocks. */
function ondoMarketByTicker(ondoBulk) {
  const map = new Map();
  for (const asset of ondoBulk.assets || []) {
    const ticker = (asset.ticker || asset.symbol || '').toUpperCase();
    if (!ticker) continue;
    const pct = firstFinitePct(
      asset.primaryMarket?.priceChangePct24h,
      asset.priceChangePct24h,
    );
    const priceRaw = asset.price ?? asset.primaryMarket?.price;
    const price = priceRaw != null && Number.isFinite(Number(priceRaw))
      ? Number(priceRaw)
      : null;
    if (pct != null || price != null) map.set(ticker, { pct, price });
  }
  return map;
}

function ondoRowToTicker(a, manifestRow, jupiterByMint) {
  const pm = a.primaryMarket || {};
  const mint = manifestRow ? getChain900Address(manifestRow) : null;
  const jup = mint ? jupiterByMint[mint] : null;
  const jPrice = pickJupiterUsdPrice(jup);

  // Live API change first; rolled history / real manifest values as fallback.
  const pctRaw =
    firstFinitePct(pm.priceChangePct24h, a.priceChangePct24h) ??
    recentHistoryPct(manifestRow?.hourlyPriceHistory);

  if (mint && jPrice != null) {
    return {
      name: a.ticker,
      price: formatTickerPrice(String(jPrice)),
      ...tickerChangeFromPctRaw(pctRaw),
      priceSource: 'jupiter',
    };
  }

  return {
    name: a.ticker,
    price: formatTickerPrice(a.price ?? pm.price),
    ...tickerChangeFromPctRaw(pctRaw),
    priceSource: 'ondo',
  };
}

function backedAssetToTicker(a, jupiterByMint, xstocksBySymbol, ondoMarket) {
  const mint = getChain900Address(a);
  const jup = mint ? jupiterByMint[mint] : null;
  const jPrice = pickJupiterUsdPrice(jup);
  const ondo = ondoMarket.get((a.ticker || a.symbol || '').toUpperCase());

  // Tokenized equities have no Jupiter change; use the live Ondo change for the
  // same underlying ticker when available.
  const pctRaw =
    firstFinitePct(pickJupiterChangePct(jup), ondo?.pct) ??
    recentHistoryPct(a.hourlyPriceHistory);

  const change = tickerChangeFromPctRaw(pctRaw);
  const name = resolveTickerRowName(a);

  if (jPrice != null) {
    return { name, price: formatTickerPrice(String(jPrice)), ...change, priceSource: 'jupiter' };
  }

  const xs = xstocksBySymbol?.[a.symbol];
  if (xs != null && xs !== '') {
    return { name, price: formatTickerPrice(String(xs)), ...change, priceSource: 'xstocks' };
  }

  // Last live fallback: the same underlying's Ondo quote.
  if (ondo?.price != null) {
    return {
      name,
      price: formatTickerPrice(String(ondo.price)),
      ...change,
      priceSource: 'ondo',
    };
  }

  return {
    name,
    price: formatTickerPrice(a.price ?? ''),
    ...change,
    priceSource: 'backed',
  };
}

function goldAssetsToTickerRows(goldAssetsManifest) {
  return filterTickerMarqueeRows(
    (goldAssetsManifest.assets || []).map((a) =>
      assetToTickerRow(a, { priceSource: 'gold' }),
    ),
  );
}

function securitizeAssetToTicker(a, jupiterByMint) {
  const mint = getChain900Address(a);
  const jup = mint ? jupiterByMint[mint] : null;
  const jPrice = pickJupiterUsdPrice(jup);

  if (jPrice != null) {
    const pctRaw =
      firstFinitePct(pickJupiterChangePct(jup), a.priceChangePct24h) ??
      recentHistoryPct(a.hourlyPriceHistory);
    return {
      name: resolveTickerRowName(a),
      price: formatTickerPrice(String(jPrice)),
      ...tickerChangeFromPctRaw(pctRaw),
      priceSource: 'jupiter',
    };
  }

  return assetToTickerRow(a, { priceSource: 'securitize' });
}

function securitizeAssetsToTickerRows(securitizeAssetsManifest, jupiterByMint) {
  return filterTickerMarqueeRows(
    (securitizeAssetsManifest.assets || []).map((a) =>
      securitizeAssetToTicker(a, jupiterByMint),
    ),
  );
}

function centrifugeAssetsToTickerRows(centrifugeAssetsManifest) {
  return filterTickerMarqueeRows(
    (centrifugeAssetsManifest.assets || []).map((a) =>
      assetToTickerRow(a, { priceSource: 'centrifuge' }),
    ),
  );
}

function mapleAssetToTicker(a, jupiterByMint) {
  const mint = getChain900Address(a);
  const jup = mint ? jupiterByMint[mint] : null;
  const jPrice = pickJupiterUsdPrice(jup);

  if (jPrice != null) {
    const pctRaw =
      firstFinitePct(pickJupiterChangePct(jup), a.priceChangePct24h) ??
      recentHistoryPct(a.hourlyPriceHistory);
    return {
      name: resolveTickerRowName(a),
      price: formatTickerPrice(String(jPrice)),
      ...tickerChangeFromPctRaw(pctRaw),
      priceSource: 'jupiter',
    };
  }

  return assetToTickerRow(a, { priceSource: 'maple' });
}

function mapleAssetsToTickerRows(mapleAssetsManifest, jupiterByMint) {
  return filterTickerMarqueeRows(
    (mapleAssetsManifest.assets || []).map((a) =>
      mapleAssetToTicker(a, jupiterByMint),
    ),
  );
}

function circleUsycAssetsToTickerRows(circleManifest) {
  return filterTickerMarqueeRows(
    (circleManifest.assets || []).map((a) =>
      assetToTickerRow(a, { priceSource: 'circle' }),
    ),
  );
}

function optionalManifest(filename) {
  try {
    return readDataJson(filename);
  } catch {
    return { assets: [] };
  }
}

async function buildLiveTickerPayloadUncached() {
  const ondoAssetsManifest = readDataJson('ondo-assets.json');
  const backedAssetsManifest = readDataJson('backed-assets.json');
  const goldAssetsManifest = optionalManifest('tokenized-gold-assets.json');
  const mapleAssetsManifest = optionalManifest('maple-assets.json');
  const securitizeAssetsManifest = optionalManifest('securitize-assets.json');
  const centrifugeAssetsManifest = optionalManifest('centrifuge-assets.json');
  const circleUsycManifest = optionalManifest('circle-usyc-assets.json');

  const mints = collectMintAddresses(
    ondoAssetsManifest,
    backedAssetsManifest,
    circleUsycManifest,
    mapleAssetsManifest,
    securitizeAssetsManifest,
  );

  const [jupiterByMint, data] = await Promise.all([
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
      signal: AbortSignal.timeout(12_000),
    })
      .then(async (res) => {
        if (!res.ok) throw new Error(`Ondo assets ${res.status}`);
        return res.json();
      })
      // Keep the dashboard populated from manifests if Ondo is unavailable.
      .catch(() => ({ assets: [] })),
  ]);
  const manifestMap = ondoManifestBySymbol(ondoAssetsManifest);

  const backedNeedXstocks = (backedAssetsManifest.assets || [])
    .filter((asset) => {
      const m = getChain900Address(asset);
      if (!m) return true;
      return pickJupiterUsdPrice(jupiterByMint[m]) == null;
    })
    .map((asset) => asset.symbol);

  const xstocksMap = await fetchXstocksQuotesForSymbols(backedNeedXstocks);
  const ondoMarket = ondoMarketByTicker(data);

  const ondoRows = data.assets?.length > 0
    ? data.assets.map((a) => ondoRowToTicker(a, manifestMap.get(a.symbol), jupiterByMint))
    : (ondoAssetsManifest.assets || []).map((a) =>
        assetToTickerRow(a, { priceSource: 'ondo' }),
      );

  const extraRows = [];

  for (const a of backedAssetsManifest.assets || []) {
    extraRows.push(backedAssetToTicker(a, jupiterByMint, xstocksMap, ondoMarket));
  }
  for (const r of goldAssetsToTickerRows(goldAssetsManifest)) {
    extraRows.push(r);
  }
  for (const r of mapleAssetsToTickerRows(mapleAssetsManifest, jupiterByMint)) {
    extraRows.push(r);
  }
  for (const r of securitizeAssetsToTickerRows(securitizeAssetsManifest, jupiterByMint)) {
    extraRows.push(r);
  }
  for (const r of centrifugeAssetsToTickerRows(centrifugeAssetsManifest)) {
    extraRows.push(r);
  }
  for (const r of circleUsycAssetsToTickerRows(circleUsycManifest)) {
    extraRows.push(r);
  }

  return {
    lastUpdatedAt:
      data.lastUpdatedAt ??
      goldAssetsManifest.lastUpdatedAt ??
      mapleAssetsManifest.lastUpdatedAt ??
      securitizeAssetsManifest.lastUpdatedAt ??
      centrifugeAssetsManifest.lastUpdatedAt ??
      circleUsycManifest.lastUpdatedAt ??
      null,
    jupiterMintCount: mints.length,
    goldAssetCount: goldAssetsManifest.assets?.length ?? 0,
    mapleAssetCount: mapleAssetsManifest.assets?.length ?? 0,
    securitizeAssetCount: securitizeAssetsManifest.assets?.length ?? 0,
    centrifugeAssetCount: centrifugeAssetsManifest.assets?.length ?? 0,
    circleUsycAssetCount: circleUsycManifest.assets?.length ?? 0,
    tickerData: filterTickerMarqueeRows([...ondoRows, ...extraRows]),
  };
}

/** Cache + coalesce concurrent ticker builds; all tabs share one provider fetch. */
let cachedPayload = null;
let cachedAt = 0;
let inflight = null;

function timeoutAfter(ms) {
  return new Promise((_, reject) => {
    const id = setTimeout(() => reject(new Error('Ticker build timed out')), ms);
    // Do not keep the process alive just for this timer.
    if (typeof id === 'object' && typeof id.unref === 'function') id.unref();
  });
}

export async function buildLiveTickerPayload({ maxAgeMs = CACHE_TTL_MS } = {}) {
  const now = Date.now();
  if (cachedPayload && now - cachedAt < maxAgeMs) return cachedPayload;
  if (!inflight) {
    inflight = buildLiveTickerPayloadUncached()
      .then((payload) => {
        cachedPayload = payload;
        cachedAt = Date.now();
        void writeTickerSnapshot(payload);
        return payload;
      })
      .catch((error) => {
        if (cachedPayload) return cachedPayload; // serve stale rather than fail
        throw error;
      })
      .finally(() => {
        inflight = null;
      });
  }

  try {
    return await Promise.race([inflight, timeoutAfter(BUILD_TIMEOUT_MS)]);
  } catch (error) {
    if (cachedPayload) return cachedPayload;
    throw error;
  }
}
