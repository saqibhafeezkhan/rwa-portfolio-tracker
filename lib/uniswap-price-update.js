import fs from 'fs';
import path from 'path';

import { readDataJson } from '@/lib/data-manifests';
import { fetchUniswapUsdPrice } from '@/lib/uniswap-price';

const UNISWAP_CONFIG = 'uniswap-price-tokens.json';
const DEFAULT_MANIFEST = 'tokenized-gold-assets.json';

function manifestFilename(token) {
  return token.manifest ?? DEFAULT_MANIFEST;
}

/**
 * For each token in `uniswap-price-tokens.json`, request a 1-unit → USDC quote,
 * set `price` on the matching row in the configured manifest, and derive
 * `priceChangePct24h` from the previous stored price (minute-over-minute).
 */
export async function runUniswapPriceUpdate() {
  const config = readDataJson(UNISWAP_CONFIG);
  const tokens = config.tokens || [];

  const apiKey = process.env.UNISWAP_API_KEY;
  if (!apiKey) {
    throw new Error('UNISWAP_API_KEY is not set');
  }

  const chainId = config.chainId ?? 1;
  const tokenOut = config.tokenOut;
  const tokenOutDecimals = config.tokenOutDecimals ?? 6;
  const tokenOutChainId = config.tokenOutChainId ?? chainId;
  const swapper = config.swapper ?? process.env.UNISWAP_SWAPPER_ADDRESS;

  const manifestNames = [...new Set(tokens.map(manifestFilename))];
  const manifests = new Map();
  const manifestPaths = new Map();
  const bySymbolPerManifest = new Map();

  for (const name of manifestNames) {
    const data = readDataJson(name);
    manifests.set(name, data);
    manifestPaths.set(name, path.join(process.cwd(), 'data', name));
    bySymbolPerManifest.set(
      name,
      new Map((data.assets || []).map((a) => [a.symbol, a])),
    );
  }

  const results = [];
  const now = new Date().toISOString();
  const touchedManifests = new Set();

  for (const token of tokens) {
    const manifestName = manifestFilename(token);
    const bySymbol = bySymbolPerManifest.get(manifestName);
    const manifestSymbol = token.manifestSymbol ?? token.symbol;
    const asset = bySymbol?.get(manifestSymbol);

    if (!asset) {
      results.push({
        symbol: token.symbol,
        ok: false,
        error: `Not in ${manifestName}`,
      });
      continue;
    }

    try {
      const priceStr = await fetchUniswapUsdPrice(token, {
        apiKey,
        chainId,
        tokenOut,
        tokenOutDecimals,
        tokenOutChainId,
        swapper,
      });

      if (!priceStr || !Number.isFinite(parseFloat(priceStr))) {
        results.push({ symbol: token.symbol, ok: false, error: 'No price in quote' });
        continue;
      }

      const prev = asset.price != null && asset.price !== ''
        ? parseFloat(asset.price)
        : null;
      const next = parseFloat(priceStr);

      if (prev != null && Number.isFinite(prev) && prev > 0 && Number.isFinite(next)) {
        const pct = ((next - prev) / prev) * 100;
        asset.priceChangePct24h = String(pct);
      }

      asset.price = priceStr;
      asset.lastUniswapQuoteAt = now;
      touchedManifests.add(manifestName);

      results.push({ symbol: token.symbol, ok: true, price: priceStr, manifest: manifestName });
    } catch (e) {
      results.push({
        symbol: token.symbol,
        ok: false,
        error: e instanceof Error ? e.message : 'Quote failed',
      });
    }
  }

  for (const name of touchedManifests) {
    const data = manifests.get(name);
    data.lastUpdatedAt = now;
    data.uniswapPricesUpdatedAt = now;
    fs.writeFileSync(
      manifestPaths.get(name),
      JSON.stringify(data, null, 2) + '\n',
    );
  }

  config.lastUpdatedAt = now;
  const configPath = path.join(process.cwd(), 'data', UNISWAP_CONFIG);
  fs.writeFileSync(configPath, JSON.stringify(config, null, 2) + '\n');

  return {
    updatedAt: now,
    tokenCount: tokens.length,
    results,
  };
}
