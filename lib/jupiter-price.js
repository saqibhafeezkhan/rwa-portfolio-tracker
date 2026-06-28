const JUPITER_PRICE_V3 = 'https://api.jup.ag/price/v3';

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

/** Prefer stockData.price (equity reference), then.usdPrice. */
export function pickJupiterUsdPrice(entry) {
  if (!entry || typeof entry !== 'object') return null;
  const sd = entry.stockData?.price;
  if (sd != null && Number.isFinite(Number(sd))) return Number(sd);
  const usd = entry.usdPrice;
  if (usd != null && Number.isFinite(Number(usd))) return Number(usd);
  return null;
}

/**
 * @param {string[]} mintAddresses unique Solana mints (case-sensitive base58)
 * @returns {Promise<Record<string, object>>} raw Jupiter entries keyed by mint
 */
export async function fetchJupiterPriceMap(mintAddresses) {
  const unique = [...new Set(mintAddresses)].filter(Boolean);
  const out = {};
  const chunkSize = 50;

  for (let i = 0; i < unique.length; i += chunkSize) {
    const chunk = unique.slice(i, i + chunkSize);
    const qs = new URLSearchParams();
    qs.set('ids', chunk.join(','));
    const url = `${JUPITER_PRICE_V3}?${qs.toString()}`;
    let j = null;
    let lastErr;
    for (let attempt = 0; attempt < 5; attempt += 1) {
      if (attempt > 0) {
        await sleep(Math.min(8000, 1000 * 2 ** (attempt - 1)));
      }
      const res = await fetch(url, {
        cache: 'no-store',
        headers: { Accept: 'application/json' },
      });
      if (res.status === 429) {
        lastErr = new Error(`Jupiter price ${res.status}`);
        continue;
      }
      if (!res.ok) throw new Error(`Jupiter price ${res.status}`);
      j = await res.json();
      break;
    }
    if (!j) throw lastErr ?? new Error('Jupiter rate limited');
    Object.assign(out, j);
    if (i + chunkSize < unique.length) {
      await sleep(1100);
    }
  }

  return out;
}
