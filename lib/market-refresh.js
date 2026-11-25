import { runUniswapPriceUpdate } from '@/lib/uniswap-price-update';
import { runCentrifugePriceUpdate } from '@/lib/centrifuge-price-update';
import { runUsycStatsUpdate } from '@/lib/usyc-stats-update';
import { runHourlyPriceUpdate } from '@/lib/hourly-price-update';

/**
 * Refresh provider-priced manifests in the background (Uniswap / Centrifuge /
 * Circle USYC). Throttled to once every 5 minutes and run via `after()` so it
 * never slows down the ticker response. Client polling no longer triggers
 * cron endpoints.
 */
const REFRESH_INTERVAL_MS = 5 * 60_000;

let lastRunAt = 0;
let running = false;

export async function refreshMarketPrices({ force = false } = {}) {
  if (running) return;
  if (!force && Date.now() - lastRunAt < REFRESH_INTERVAL_MS) return;

  running = true;
  lastRunAt = Date.now();
  try {
    await Promise.allSettled([
      runUniswapPriceUpdate(),
      runCentrifugePriceUpdate(),
      runUsycStatsUpdate(),
      // Price-only unless an hour has passed; keeps Ondo/Backed holdings fresh.
      runHourlyPriceUpdate(),
    ]);
  } finally {
    running = false;
  }
}
