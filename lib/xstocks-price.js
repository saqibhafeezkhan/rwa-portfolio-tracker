const XSTOCKS_BASE = 'https://api.xstocks.fi/api/v2/public/assets';
const FALLBACK_CONCURRENCY = 6;
const FALLBACK_BUDGET_MS = 5_000;

/** GET …/assets/{symbol}/price-data → `{ "quote": number }` */
export async function fetchXstocksQuote(symbol) {
  if (!symbol) return null;
  try {
    const url = `${XSTOCKS_BASE}/${encodeURIComponent(symbol)}/price-data`;
    const res = await fetch(url, {
      cache: 'no-store',
      headers: { Accept: 'application/json' },
      signal: AbortSignal.timeout(5_000),
    });
    if (!res.ok) return null;
    const j = await res.json();
    const q = j.quote;
    if (q != null && Number.isFinite(Number(q))) return String(q);
    return null;
  } catch {
    return null;
  }
}

/**
 * Bounded-concurrency fallback fetch for symbols Jupiter could not quote.
 * @param {string[]} symbols asset.symbol values e.g. SPYx
 * @returns {Promise<Record<string, string>>} symbol → price string
 */
export async function fetchXstocksQuotesForSymbols(symbols) {
  const unique = [...new Set(symbols)].filter(Boolean);
  const out = {};
  let index = 0;
  const deadline = Date.now() + FALLBACK_BUDGET_MS;

  async function worker() {
    while (index < unique.length && Date.now() < deadline) {
      const sym = unique[index];
      index += 1;
      const p = await fetchXstocksQuote(sym);
      if (p != null) out[sym] = p;
    }
  }

  await Promise.all(
    Array.from({ length: Math.min(FALLBACK_CONCURRENCY, unique.length) }, () => worker()),
  );
  return out;
}
