#!/usr/bin/env node
/**
 * Fetches https://app.ondo.finance/api/v2/assets then, per asset,
 * GET https://app.ondo.finance/api/v2/assets/{symbol.toLowerCase()}/info
 * to attach supportedNetworks (chainId, address, decimals).
 *
 * Run: node scripts/sync-ondo-assets.mjs
 */

import { writeFileSync, readFileSync, existsSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT = join(__dirname, '..', 'data', 'ondo-assets.json');

const BASE = 'https://app.ondo.finance/api/v2/assets';

function pickAssetClass(tags) {
  const ac = (tags || []).find((t) => t.categorySlug === 'asset-class');
  return ac ? ac.tagSlug : null;
}

function mapNetworks(info) {
  return (info.supportedNetworks || []).map((n) => ({
    chainId: n.chainId,
    address: n.address,
    decimals: n.decimals,
  }));
}

async function fetchJson(url) {
  const res = await fetch(url, { headers: { Accept: 'application/json' } });
  if (!res.ok) throw new Error(`${url} → ${res.status}`);
  return res.json();
}

const CONCURRENCY = 5;
const DELAY_MS = 120;

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function mapPool(items, limit, fn) {
  const out = new Array(items.length);
  let i = 0;
  async function worker() {
    while (i < items.length) {
      const idx = i++;
      out[idx] = await fn(items[idx], idx);
      await sleep(DELAY_MS);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, () => worker()));
  return out;
}

function loadPreviousHourlyBySymbol() {
  const map = new Map();
  if (!existsSync(OUT)) return map;
  try {
    const prev = JSON.parse(readFileSync(OUT, 'utf8'));
    for (const x of prev.assets || []) {
      map.set(x.symbol, Array.isArray(x.hourlyPriceHistory) ? x.hourlyPriceHistory : []);
    }
  } catch {
    /* ignore */
  }
  return map;
}

async function main() {
  const hourlyBySymbol = loadPreviousHourlyBySymbol();

  console.error('Fetching asset list…');
  const list = await fetchJson(BASE);
  const rows = list.assets || [];

  console.error(`Fetching /info for ${rows.length} symbols (${CONCURRENCY} concurrent)…`);

  const enriched = await mapPool(rows, CONCURRENCY, async (a) => {
    const slug = (a.symbol || '').toLowerCase();
    const infoUrl = `${BASE}/${encodeURIComponent(slug)}/info`;
    let networks = [];
    try {
      const info = await fetchJson(infoUrl);
      networks = mapNetworks(info);
    } catch (e) {
      console.error(`warn: ${slug}: ${e.message}`);
    }

    const um = a.underlyingMarket || {};
    const pm = a.primaryMarket || {};

    return {
      symbol: a.symbol,
      ticker: a.ticker,
      iconSrc: a.iconSrc,
      assetName: a.assetName,
      assetClass: pickAssetClass(a.tags),
      price: pm.price ?? null,
      priceChangePct24h: pm.priceChangePct24h ?? null,
      marketCap: um.marketCap ?? null,
      supportedNetworks: networks,
      hourlyPriceHistory: hourlyBySymbol.get(a.symbol) ?? [],
    };
  });

  const payload = {
    lastUpdatedAt: list.lastUpdatedAt ?? new Date().toISOString(),
    networksSyncedAt: new Date().toISOString(),
    assets: enriched,
  };

  writeFileSync(OUT, JSON.stringify(payload, null, 2) + '\n');
  console.error(`Wrote ${OUT} (${enriched.length} assets).`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
