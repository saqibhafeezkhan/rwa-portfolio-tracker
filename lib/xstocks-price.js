const XSTOCKS_BASE = 'https://api.xstocks.fi/api/v2/public/assets';

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

/** GET …/assets/{symbol}/price-data → `{ "quote": number }` */
export async function fetchXstocksQuote(symbol) {
  if (!symbol) return null;
  try {
    const url = `${XSTOCKS_BASE}/${encodeURIComponent(symbol)}/price-data`;
    const res = await fetch(url, {
      cache: 'no-store',
      headers: { Accept: 'application/json' },
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
 * Sequential fetch with light spacing (public API).
 * @param {string[]} symbols asset.symbol values e.g. SPYx
 * @returns {Promise<Record<string, string>>} symbol → price string
 */
export async function fetchXstocksQuotesForSymbols(symbols) {
  const unique = [...new Set(symbols)].filter(Boolean);
  const out = {};
  for (const sym of unique) {
    const p = await fetchXstocksQuote(sym);
    if (p != null) out[sym] = p;
    await sleep(150);
  }
  return out;
}
