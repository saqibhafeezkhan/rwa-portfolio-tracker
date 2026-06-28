/**
 * Rolling hourly snapshots (FIFO): max 24 entries; oldest dropped when length > 24.
 */

export function rollHourlyPrices(history, entry) {
  const h = Array.isArray(history) ? [...history] : [];
  h.push(entry);
  while (h.length > 24) {
    h.shift();
  }
  return h;
}

/** % change from oldest snapshot in the buffer to the newest (24-point window). */
export function pctStringFromHistory(history) {
  if (!history || history.length < 2) return null;
  const a = parseFloat(history[0].price);
  const b = parseFloat(history[history.length - 1].price);
  if (!Number.isFinite(a) || a === 0 || !Number.isFinite(b)) return null;
  return String(((b - a) / a) * 100);
}

/**
 * Append a price snapshot, update `price`, and recompute `priceChangePct24h` from the rolling window.
 * @param {object} asset manifest row (mutated)
 * @param {string} priceStr
 * @param {{ at?: string, bulkPctFallback?: string | null }} [opts]
 * @returns {boolean} false when priceStr is not a finite number
 */
export function applyAssetPriceSnapshot(asset, priceStr, opts = {}) {
  const { at = new Date().toISOString(), bulkPctFallback = null } = opts;
  if (!priceStr || !Number.isFinite(parseFloat(priceStr))) return false;

  asset.hourlyPriceHistory = rollHourlyPrices(asset.hourlyPriceHistory, {
    at,
    price: priceStr,
  });
  asset.price = priceStr;

  const pct = pctStringFromHistory(asset.hourlyPriceHistory);
  if (pct != null) {
    asset.priceChangePct24h = pct;
  } else if (
    bulkPctFallback != null &&
    bulkPctFallback !== '' &&
    (asset.hourlyPriceHistory?.length ?? 0) < 2
  ) {
    asset.priceChangePct24h = String(bulkPctFallback);
  }

  return true;
}
