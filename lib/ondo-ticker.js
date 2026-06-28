import { pctStringFromHistory } from '@/lib/hourly-price-roll';

/** Shared mapping from Ondo bulk API or flattened JSON rows → Ticker props. */

export function formatTickerPrice(priceStr) {
  const n = parseFloat(priceStr);
  if (!Number.isFinite(n)) return '—';
  const fraction =
    n < 0.01 ? { minimumFractionDigits: 2, maximumFractionDigits: 6 }
    : n < 1 ? { minimumFractionDigits: 2, maximumFractionDigits: 4 }
    : { minimumFractionDigits: 2, maximumFractionDigits: 2 };
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', ...fraction }).format(n);
}

export function formatPctChange(pctStr) {
  const n = parseFloat(pctStr);
  if (!Number.isFinite(n)) return '0.00%';
  const rounded = Math.round(n * 100) / 100;
  const sign = rounded > 0 ? '+' : '';
  return `${sign}${rounded.toFixed(2)}%`;
}

/** Build marquee change fields from a raw 24h % string (or null). */
export function tickerChangeFromPctRaw(pctRaw) {
  const pctForRow = normalizePctRawForRow(pctRaw);
  const pct = parseFloat(pctRaw);
  return {
    change: pctForRow != null ? formatPctChange(pctRaw) : '—',
    up: Number.isFinite(pct) ? pct >= 0 : true,
    priceChangePct24h: pctForRow,
  };
}

export function rowHasTickerChange(row) {
  return row?.priceChangePct24h != null && row?.change !== '—';
}

/** Resolved raw 24h % string for persistence on ticker rows, or null when absent (matches JSON null / missing). */
export function normalizePctRawForRow(pctRaw) {
  if (pctRaw == null || pctRaw === '') return null;
  return String(pctRaw);
}

/** Display symbol for manifest/API rows (OUSG/USDY use `symbol` when `ticker` is null; xStocks → xAAPL). */
export function resolveTickerRowName(asset) {
  const ticker = (asset?.ticker ?? '').trim();
  const symbol = (asset?.symbol ?? '').trim();
  if (ticker && symbol && /x$/i.test(symbol) && !/^x/i.test(ticker)) {
    return `x${ticker}`;
  }
  return ticker || symbol;
}

/**
 * Accepts bulk API asset row or flattened manifest row (Ondo or Backed JSON shape).
 * @param {{ priceSource?: 'ondo' | 'backed' }} [opts]
 */
export function assetToTickerRow(a, opts = {}) {
  const priceSource = opts.priceSource ?? 'ondo';
  const pm = a.primaryMarket || {};
  const hourlyPct =
    a.hourlyPriceHistory?.length >= 2
      ? a.priceChangePct24h ?? pctStringFromHistory(a.hourlyPriceHistory)
      : null;
  const price = a.price ?? pm.price;
  const pctRaw =
    hourlyPct ??
    a.priceChangePct24h ??
    pm.priceChangePct24h;
  const pctForRow = normalizePctRawForRow(pctRaw);
  const pct = parseFloat(pctRaw);
  return {
    name: resolveTickerRowName(a),
    price: formatTickerPrice(price),
    change: pctForRow != null ? formatPctChange(pctRaw) : '—',
    up: Number.isFinite(pct) ? pct >= 0 : true,
    priceSource,
    priceChangePct24h: pctForRow,
  };
}

export function bulkAssetsToTickerData(assets) {
  return assets.map(assetToTickerRow);
}

/** Hide assets with null/missing price (renders as — in {@link formatTickerPrice}). */
export function filterTickerRowsWithPrice(rows) {
  if (!Array.isArray(rows)) return [];
  return rows.filter((r) => r.price != null && r.price !== '—');
}

/** True when ticker shows a flat 24h move (`0.00%`), excluding dash (no data). */
export function isTickerChangeZeroDisplay(change) {
  if (change == null || change === '—') return false;
  const n = parseFloat(String(change).replace(/%/g, '').trim());
  return Number.isFinite(n) && n === 0;
}

/** Normalized ticker symbol for deduplication (e.g. XAUt and xaut → same key). */
export function tickerRowKey(row) {
  return (row?.name ?? '').trim().toUpperCase();
}

/** Keep first occurrence of each ticker symbol. */
export function dedupeTickerRows(rows) {
  if (!Array.isArray(rows)) return [];
  const seen = new Set();
  const out = [];
  for (const r of rows) {
    const key = tickerRowKey(r);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    out.push(r);
  }
  return out;
}

/** Price OK + hide rows with no 24h % (manifest/API `priceChangePct24h` null and no rolled hourly %) + hide flat `0.00%`, then dedupe symbols. */
export function filterTickerUiRows(rows) {
  return dedupeTickerRows(
    filterTickerRowsWithPrice(rows).filter(
      (r) =>
        r.priceChangePct24h != null &&
        r.priceChangePct24h !== '' &&
        !isTickerChangeZeroDisplay(r.change),
    ),
  );
}

/** Marquee: any row with a price; keep 0% / flat change; one row per symbol. */
export function filterTickerMarqueeRows(rows) {
  return dedupeTickerRows(filterTickerRowsWithPrice(rows));
}

/**
 * Merge live ticker into the current list: keep order/symbols from `prev`, update prices
 * from `next`, append any new symbols from `next`. Never drops rows when `next` is shorter.
 */
export function mergeTickerRows(prev, next) {
  const prevRows = filterTickerMarqueeRows(prev);
  const nextRows = filterTickerMarqueeRows(next);
  if (nextRows.length === 0) return prevRows;

  const nextByKey = new Map();
  for (const row of nextRows) {
    nextByKey.set(tickerRowKey(row), row);
  }

  const merged = [];
  const seen = new Set();

  for (const row of prevRows) {
    const key = tickerRowKey(row);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    const incoming = nextByKey.get(key);
    merged.push(incoming ? mergeTickerRow(row, incoming) : row);
  }

  for (const row of nextRows) {
    const key = tickerRowKey(row);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    merged.push(row);
  }

  return merged;
}

/** Prefer live price; keep prior 24h % when the refresh row has no change data. */
export function mergeTickerRow(prev, incoming) {
  if (!incoming) return prev;
  if (!rowHasTickerChange(incoming) && rowHasTickerChange(prev)) {
    return {
      ...incoming,
      change: prev.change,
      up: prev.up,
      priceChangePct24h: prev.priceChangePct24h,
    };
  }
  return incoming;
}

const MARQUEE_MIN_ITEMS = 40;

/** Repeat unique rows so a short list still fills the ticker track (seamless loop uses 2 groups). */
export function expandTickerForMarquee(rows) {
  const unique = filterTickerMarqueeRows(rows);
  if (unique.length === 0) return [];
  if (unique.length >= MARQUEE_MIN_ITEMS) return unique;
  const out = [];
  for (let i = 0; i < MARQUEE_MIN_ITEMS; i++) {
    out.push(unique[i % unique.length]);
  }
  return out;
}
