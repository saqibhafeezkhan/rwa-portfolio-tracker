import { readDataJsonForUpdate, writeDataJson } from '@/lib/data-manifests';
import { fetchUniswapUsdPrice } from '@/lib/uniswap-price';

const UNISWAP_CONFIG = 'uniswap-price-tokens.json';
const DEFAULT_MANIFEST = 'tokenized-gold-assets.json';

function manifestFilename(token) {
  return token.manifest ?? DEFAULT_MANIFEST;
}

/**
 * For each token in `uniswap-price-tokens.json`, request a 1-unit → USDC quote
 * and set `price` on the matching manifest row. The previous-quote delta is
 * stored as `lastQuoteChangePct` (informational); a real 24h change comes from
 * the hourly roll instead of being mislabeled here.
 */
export async function runUniswapPriceUpdate() {
  const config = readDataJsonForUpdate(UNISWAP_CONFIG);
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
  const bySymbolPerManifest = new Map();

  for (const name of manifestNames) {
    const data = readDataJsonForUpdate(name);
    manifests.set(name, data);
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
        asset.lastQuoteChangePct = String(((next - prev) / prev) * 100);
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

  await Promise.all(
    [...touchedManifests].map(async (name) => {
      const data = manifests.get(name);
      data.lastUpdatedAt = now;
      data.uniswapPricesUpdatedAt = now;
      await writeDataJson(name, data);
    }),
  );

  config.lastUpdatedAt = now;
  await writeDataJson(UNISWAP_CONFIG, config);

  return {
    updatedAt: now,
    tokenCount: tokens.length,
    results,
  };
}
