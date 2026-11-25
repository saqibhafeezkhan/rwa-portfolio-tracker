/**
 * Rolling hourly snapshots (FIFO): max 24 entries; oldest dropped when length > 24.
 */

export function rollHourlyPrices(history, entry) {
  const entryAt = Date.parse(entry?.at);
  const cutoff = (Number.isFinite(entryAt) ? entryAt : Date.now()) - 25 * 60 * 60 * 1000;

  // Drop snapshots from an older run (e.g. seeded data) so a long gap cannot
  // turn a months-old price into a fake 24h change.
  const h = (Array.isArray(history) ? history : []).filter((snapshot) => {
    const at = Date.parse(snapshot?.at);
    return Number.isFinite(at) && at >= cutoff;
  });

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

/** Span in ms between the oldest and newest snapshot, or 0 when unknown. */
export function historySpanMs(history) {
  if (!Array.isArray(history) || history.length < 2) return 0;
  const first = Date.parse(history[0]?.at);
  const last = Date.parse(history[history.length - 1]?.at);
  if (!Number.isFinite(first) || !Number.isFinite(last)) return 0;
  return Math.max(0, last - first);
}

/**
 * Same as {@link pctStringFromHistory}, but only when the newest snapshot is
 * recent and the window is long enough to represent a 24h move. Prevents
 * months-old seeded history (or a 2-hour partial buffer) from being shown as
 * a live 24h change.
 */
export function pctStringFromHistoryWithin(
  history,
  {
    now = Date.now(),
    maxAgeMs = 2 * 60 * 60 * 1000,
    minSpanMs = 20 * 60 * 60 * 1000,
  } = {},
) {
  if (!Array.isArray(history) || history.length < 2) return null;
  const firstAt = Date.parse(history[0]?.at);
  const lastAt = Date.parse(history[history.length - 1]?.at);
  if (!Number.isFinite(firstAt) || !Number.isFinite(lastAt)) return null;
  if (now - lastAt > maxAgeMs) return null;
  if (now - firstAt > 30 * 60 * 60 * 1000) return null;
  if (historySpanMs(history) < minSpanMs) return null;
  return pctStringFromHistory(history);
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

  const pct =
    historySpanMs(asset.hourlyPriceHistory) >= 20 * 60 * 60 * 1000
      ? pctStringFromHistory(asset.hourlyPriceHistory)
      : null;
  if (pct != null) {
    asset.priceChangePct24h = pct;
  } else if (
    bulkPctFallback != null &&
    bulkPctFallback !== '' &&
    Number.isFinite(parseFloat(bulkPctFallback))
  ) {
    // Until the hourly buffer spans ~24h, use the provider's live 24h value.
    asset.priceChangePct24h = String(bulkPctFallback);
  } else {
    // No trustworthy 24h reference (e.g. seeded "0") — show "—" instead.
    asset.priceChangePct24h = null;
  }

  return true;
}
