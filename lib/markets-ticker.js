import { readDataJson } from '@/lib/data-manifests';
import { runUsycStatsUpdate } from '@/lib/usyc-stats-update';
import { fetchJupiterPriceMap, pickJupiterUsdPrice } from '@/lib/jupiter-price';
import { fetchXstocksQuotesForSymbols } from '@/lib/xstocks-price';
import {
  assetToTickerRow,
  formatTickerPrice,
  filterTickerMarqueeRows,
  resolveTickerRowName,
  tickerChangeFromPctRaw,
} from '@/lib/ondo-ticker';
import { getChain900Address } from '@/lib/chain-utils';
import { pctStringFromHistory } from '@/lib/hourly-price-roll';

const ONDO_ASSETS = 'https://app.ondo.finance/api/v2/assets';

function collectMintAddresses(
  ondoAssetsManifest,
  backedAssetsManifest,
  circleManifest,
  mapleManifest,
  securitizeManifest,
) {
  const set = new Set();
  for (const a of ondoAssetsManifest.assets || []) {
    const m = getChain900Address(a);
    if (m) set.add(m);
  }
  for (const a of backedAssetsManifest.assets || []) {
    const m = getChain900Address(a);
    if (m) set.add(m);
  }
  for (const a of circleManifest?.assets || []) {
    const m = getChain900Address(a);
    if (m) set.add(m);
  }
  for (const a of mapleManifest?.assets || []) {
    const m = getChain900Address(a);
    if (m) set.add(m);
  }
  for (const a of securitizeManifest?.assets || []) {
    const m = getChain900Address(a);
    if (m) set.add(m);
  }
  return [...set];
}

function ondoManifestBySymbol(ondoAssetsManifest) {
  return new Map(
    (ondoAssetsManifest.assets || []).map((a) => [a.symbol, a]),
  );
}

/** Prefer rolled 24h % when hourly buffer has ≥2 points. */
function hourlyPctRaw(manifestRow) {
  if (!manifestRow?.hourlyPriceHistory || manifestRow.hourlyPriceHistory.length < 2) {
    return null;
  }
  return (
    manifestRow.priceChangePct24h ??
    pctStringFromHistory(manifestRow.hourlyPriceHistory)
  );
}

function ondoRowToTicker(a, manifestRow, jupiterByMint) {
  const pm = a.primaryMarket || {};
  const mint = manifestRow ? getChain900Address(manifestRow) : null;
  const jup = mint ? jupiterByMint[mint] : null;
  const jPrice = pickJupiterUsdPrice(jup);
  const hourlyPct = hourlyPctRaw(manifestRow);

  if (mint && jPrice != null) {
    const priceStr = String(jPrice);
    const pctRaw =
      hourlyPct ??
      pm.priceChangePct24h ??
      a.priceChangePct24h ??
      manifestRow?.priceChangePct24h;
    return {
      name: a.ticker,
      price: formatTickerPrice(priceStr),
      ...tickerChangeFromPctRaw(pctRaw),
      priceSource: 'jupiter',
    };
  }

  const pctRaw =
    hourlyPct ??
    pm.priceChangePct24h ??
    a.priceChangePct24h;
  return {
    name: a.ticker,
    price: formatTickerPrice(a.price ?? pm.price),
    ...tickerChangeFromPctRaw(pctRaw),
    priceSource: 'ondo',
  };
}

function backedPctRaw(asset, hourlyPct) {
  return hourlyPct ?? asset.priceChangePct24h ?? null;
}

function backedAssetToTicker(a, jupiterByMint, xstocksBySymbol) {
  const hourlyPct = hourlyPctRaw(a);
  const mint = getChain900Address(a);
  const jup = mint ? jupiterByMint[mint] : null;
  const jPrice = pickJupiterUsdPrice(jup);

  if (jPrice != null) {
    return {
      name: resolveTickerRowName(a),
      price: formatTickerPrice(String(jPrice)),
      ...tickerChangeFromPctRaw(backedPctRaw(a, hourlyPct)),
      priceSource: 'jupiter',
    };
  }

  const xs = xstocksBySymbol?.[a.symbol];
  if (xs != null && xs !== '') {
    return {
      name: resolveTickerRowName(a),
      price: formatTickerPrice(String(xs)),
      ...tickerChangeFromPctRaw(backedPctRaw(a, hourlyPct)),
      priceSource: 'xstocks',
    };
  }

  return {
    name: resolveTickerRowName(a),
    price: formatTickerPrice(a.price ?? ''),
    ...tickerChangeFromPctRaw(backedPctRaw(a, hourlyPct)),
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
  const hourlyPct = hourlyPctRaw(a);
  const mint = getChain900Address(a);
  const jup = mint ? jupiterByMint[mint] : null;
  const jPrice = pickJupiterUsdPrice(jup);

  if (jPrice != null) {
    const pctRaw = hourlyPct ?? a.priceChangePct24h;
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
  const hourlyPct = hourlyPctRaw(a);
  const mint = getChain900Address(a);
  const jup = mint ? jupiterByMint[mint] : null;
  const jPrice = pickJupiterUsdPrice(jup);

  if (jPrice != null) {
    const pctRaw = hourlyPct ?? a.priceChangePct24h;
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

export async function buildLiveTickerPayload() {
  const ondoAssetsManifest = readDataJson('ondo-assets.json');
  const backedAssetsManifest = readDataJson('backed-assets.json');
  let goldAssetsManifest;
  try {
    goldAssetsManifest = readDataJson('tokenized-gold-assets.json');
  } catch {
    goldAssetsManifest = { assets: [] };
  }
  let mapleAssetsManifest;
  try {
    mapleAssetsManifest = readDataJson('maple-assets.json');
  } catch {
    mapleAssetsManifest = { assets: [] };
  }
  let securitizeAssetsManifest;
  try {
    securitizeAssetsManifest = readDataJson('securitize-assets.json');
  } catch {
    securitizeAssetsManifest = { assets: [] };
  }
  let centrifugeAssetsManifest;
  try {
    centrifugeAssetsManifest = readDataJson('centrifuge-assets.json');
  } catch {
    centrifugeAssetsManifest = { assets: [] };
  }
  let circleUsycManifest;
  try {
    circleUsycManifest = readDataJson('circle-usyc-assets.json');
  } catch {
    circleUsycManifest = { assets: [] };
  }

  try {
    await runUsycStatsUpdate();
    circleUsycManifest = readDataJson('circle-usyc-assets.json');
  } catch {
    /* keep last persisted manifest */
  }

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
    }).then(async (res) => {
      if (!res.ok) throw new Error(`Ondo assets ${res.status}`);
      return res.json();
    }),
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

  const ondoRows = (data.assets || []).map((a) =>
    ondoRowToTicker(a, manifestMap.get(a.symbol), jupiterByMint),
  );

  const extraRows = [];

  for (const a of backedAssetsManifest.assets || []) {
    extraRows.push(backedAssetToTicker(a, jupiterByMint, xstocksMap));
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
