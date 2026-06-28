import fs from 'fs';
import path from 'path';

import { readDataJson } from '@/lib/data-manifests';
import { fetchCentrifugeUsdPrice } from '@/lib/centrifuge-price';

const CENTRIFUGE_MANIFEST = 'centrifuge-assets.json';
const MAX_CALLS_PER_MINUTE = 2;
const ROLLING_WINDOW_MS = 60_000;

function getEthereumNetwork(asset) {
  return (asset.supportedNetworks || []).find((n) => n.chainId === 1);
}

function pruneApiCallLog(manifest) {
  const cutoff = Date.now() - ROLLING_WINDOW_MS;
  manifest.centrifugeApiCallsAt = (manifest.centrifugeApiCallsAt || []).filter(
    (t) => new Date(t).getTime() > cutoff,
  );
}

function remainingApiQuota(manifest) {
  pruneApiCallLog(manifest);
  return Math.max(0, MAX_CALLS_PER_MINUTE - (manifest.centrifugeApiCallsAt?.length ?? 0));
}

function recordApiCall(manifest, at) {
  manifest.centrifugeApiCallsAt = [...(manifest.centrifugeApiCallsAt || []), at];
  pruneApiCallLog(manifest);
}

/**
 * Update up to two Centrifuge token prices per run (rolling 60s cap of 2 API hits).
 * Rotates through manifest assets via `priceUpdateCursor`.
 */
export async function runCentrifugePriceUpdate() {
  const manifestPath = path.join(process.cwd(), 'data', CENTRIFUGE_MANIFEST);
  const manifest = readDataJson(CENTRIFUGE_MANIFEST);
  const assets = manifest.assets || [];

  if (assets.length === 0) {
    return { updatedAt: null, apiCalls: 0, results: [] };
  }

  const quota = remainingApiQuota(manifest);
  if (quota === 0) {
    return {
      updatedAt: manifest.lastUpdatedAt ?? null,
      apiCalls: 0,
      skipped: true,
      reason: 'Centrifuge API rate limit (2 calls/minute)',
      results: [],
    };
  }

  let cursor = Number(manifest.priceUpdateCursor) || 0;
  const now = new Date().toISOString();
  const results = [];
  let apiCalls = 0;

  while (apiCalls < quota && assets.length > 0) {
    const idx = cursor % assets.length;
    const asset = assets[idx];
    cursor += 1;

    const net = getEthereumNetwork(asset);
    const tokenAddress = net?.address;
    if (!tokenAddress) {
      results.push({
        symbol: asset.symbol,
        ok: false,
        error: 'No Ethereum deployment in manifest',
      });
      continue;
    }

    try {
      const priceStr = await fetchCentrifugeUsdPrice(tokenAddress);
      recordApiCall(manifest, now);
      apiCalls += 1;

      const prev = asset.price != null && asset.price !== ''
        ? parseFloat(asset.price)
        : null;
      const next = parseFloat(priceStr);

      if (prev != null && Number.isFinite(prev) && prev > 0 && Number.isFinite(next)) {
        const pct = ((next - prev) / prev) * 100;
        asset.priceChangePct24h = String(pct);
      }

      asset.price = priceStr;
      asset.lastCentrifugeQuoteAt = now;

      results.push({ symbol: asset.symbol, ok: true, price: priceStr });
    } catch (e) {
      recordApiCall(manifest, now);
      apiCalls += 1;
      results.push({
        symbol: asset.symbol,
        ok: false,
        error: e instanceof Error ? e.message : 'Centrifuge quote failed',
      });
    }
  }

  manifest.priceUpdateCursor = cursor % assets.length;
  manifest.lastUpdatedAt = now;
  if (results.some((r) => r.ok)) {
    manifest.centrifugePricesUpdatedAt = now;
  }

  fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + '\n');

  return {
    updatedAt: now,
    apiCalls,
    priceUpdateCursor: manifest.priceUpdateCursor,
    results,
  };
}
