const JUPITER_PRICE_V3 = 'https://api.jup.ag/price/v3';
const CHUNK_SIZE = 100;
const MAX_ATTEMPTS = 3;
const TOTAL_BUDGET_MS = 10_000;

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

/** Prefer stockData.price (equity reference), then usdPrice. */
export function pickJupiterUsdPrice(entry) {
  if (!entry || typeof entry !== 'object') return null;
  const sd = entry.stockData?.price;
  if (sd != null && Number.isFinite(Number(sd))) return Number(sd);
  const usd = entry.usdPrice;
  if (usd != null && Number.isFinite(Number(usd))) return Number(usd);
  return null;
}

/** Jupiter's own 24h % (absent for tokenized equities, which only expose stockData). */
export function pickJupiterChangePct(entry) {
  if (!entry || typeof entry !== 'object') return null;
  const candidates = [entry.priceChange24h, entry.stockData?.priceChange24h];
  for (const value of candidates) {
    if (value != null && Number.isFinite(Number(value))) return Number(value);
  }
  return null;
}

/**
 * Fetch Jupiter prices in bounded chunks. Rate limits or provider errors return
 * the prices collected so far instead of failing the whole ticker for minutes.
 *
 * @param {string[]} mintAddresses unique Solana mints (case-sensitive base58)
 * @returns {Promise<Record<string, object>>} raw Jupiter entries keyed by mint
 */
export async function fetchJupiterPriceMap(mintAddresses) {
  const unique = [...new Set(mintAddresses)].filter(Boolean);
  const out = {};
  const deadline = Date.now() + TOTAL_BUDGET_MS;

  for (let i = 0; i < unique.length; i += CHUNK_SIZE) {
    if (Date.now() > deadline) {
      console.warn('[jupiter] price budget exhausted; using partial results');
      break;
    }

    const chunk = unique.slice(i, i + CHUNK_SIZE);
    const qs = new URLSearchParams();
    qs.set('ids', chunk.join(','));
    const url = `${JUPITER_PRICE_V3}?${qs.toString()}`;

    let json = null;

    for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt += 1) {
      if (attempt > 0) {
        await sleep(400 * attempt);
      }
      try {
        const res = await fetch(url, {
          cache: 'no-store',
          headers: { Accept: 'application/json' },
          signal: AbortSignal.timeout(8_000),
        });

        if (res.status === 429) continue;
        if (!res.ok) {
          console.warn(`[jupiter] price ${res.status}; using partial results`);
          return out;
        }

        json = await res.json();
        break;
      } catch (e) {
        if (attempt === MAX_ATTEMPTS - 1) {
          console.warn(
            `[jupiter] price request failed (${e?.name ?? 'error'}); using partial results`,
          );
        }
      }
    }

    if (!json) {
      // Give up on the rest of the chunks rather than stalling the ticker.
      break;
    }

    Object.assign(out, json);

    if (i + CHUNK_SIZE < unique.length) {
      await sleep(400);
    }
  }

  return out;
}
