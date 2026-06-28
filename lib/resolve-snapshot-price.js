import { pickJupiterUsdPrice } from '@/lib/jupiter-price';
import { getChain900Address } from '@/lib/chain-utils';

/** Snapshot price string for persisting hourly rolls (same precedence as live ticker). */

export function resolveOndoSnapshotPrice(bulkRow, manifestAsset, jupiterByMint) {
  if (!manifestAsset) return '';
  const mint = getChain900Address(manifestAsset);
  const jup = mint ? jupiterByMint[mint] : null;
  const jPrice = pickJupiterUsdPrice(jup);
  if (mint && jPrice != null) return String(jPrice);
  if (!bulkRow) {
    return manifestAsset.price != null && manifestAsset.price !== ''
      ? String(manifestAsset.price)
      : '';
  }
  const pm = bulkRow.primaryMarket || {};
  const p = bulkRow.price ?? pm.price;
  return p != null && p !== '' ? String(p) : '';
}

/**
 * @param {Record<string, string>} [xstocksBySymbol] pre-fetched api.xstocks.fi quotes keyed by asset.symbol
 */
export function resolveBackedSnapshotPrice(
  manifestAsset,
  jupiterByMint,
  xstocksBySymbol,
) {
  if (!manifestAsset) return '';
  const mint = getChain900Address(manifestAsset);
  const jup = mint ? jupiterByMint[mint] : null;
  const jPrice = pickJupiterUsdPrice(jup);
  if (jPrice != null) return String(jPrice);
  const xs = xstocksBySymbol?.[manifestAsset.symbol];
  if (xs != null && xs !== '') return String(xs);
  return manifestAsset.price != null && manifestAsset.price !== ''
    ? String(manifestAsset.price)
    : '';
}
