#!/usr/bin/env node
/**
 * Paginates https://api.backed.fi/api/v2/public/assets and writes
 * data/backed-assets.json aligned with data/ondo-assets.json shape.
 *
 * Fields absent from Backed (price, 24h change, market cap, asset class) → null (never "").
 *
 * Run: node scripts/sync-backed-assets.mjs
 */

import { writeFileSync, readFileSync, existsSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { applyJupiterPricesToBackedPayload } from './lib/jupiter-backed-fill.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT = join(__dirname, '..', 'data', 'backed-assets.json');
const BASE = 'https://api.backed.fi/api/v2/public/assets';

/** Numeric chain IDs where known; non‑EVM chains use null (ondo JSON uses numbers only where applicable). */
const CHAIN_ID_BY_NETWORK = {
  Ethereum: 1,
  Arbitrum: 42161,
  BinanceSmartChain: 56,
  Mantle: 5000,
  HyperEVM: 999,
  Ink: 57073,
  Solana: 900,
  Ton: null,
  Tron: null,
};

function defaultDecimals(network) {
  switch (network) {
    case 'Solana':
      return 9;
    case 'Ton':
      return 9;
    case 'Tron':
      return 18;
    default:
      return 18;
  }
}

function deploymentsToSupportedNetworks(deployments) {
  return (deployments || []).map((d) => ({
    chainId: CHAIN_ID_BY_NETWORK[d.network] ?? null,
    address: d.address,
    decimals: defaultDecimals(d.network),
  }));
}

function mapNode(n) {
  return {
    symbol: n.symbol,
    ticker: n.underlyingSymbol,
    iconSrc: n.logo,
    assetName: n.name,
    assetClass: null,
    price: null,
    priceChangePct24h: null,
    marketCap: null,
    supportedNetworks: deploymentsToSupportedNetworks(n.deployments),
  };
}

async function fetchAllNodes() {
  const all = [];
  let page = 0;
  let hasNext = true;
  while (hasNext) {
    const res = await fetch(`${BASE}?page=${page}`, {
      headers: { Accept: 'application/json' },
    });
    if (!res.ok) throw new Error(`${BASE}?page=${page} → ${res.status}`);
    const j = await res.json();
    const nodes = j.nodes || [];
    all.push(...nodes);
    hasNext = Boolean(j.page?.hasNextPage);
    page += 1;
    if (page > 200) throw new Error('pagination safety stop');
  }
  return all;
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

  const syncedAt = new Date().toISOString();
  console.error('Fetching Backed assets…');
  const nodes = await fetchAllNodes();
  const payload = {
    lastUpdatedAt: syncedAt,
    networksSyncedAt: syncedAt,
    assets: nodes.map((n) => {
      const row = mapNode(n);
      row.hourlyPriceHistory = hourlyBySymbol.get(row.symbol) ?? [];
      return row;
    }),
  };

  console.error('Fetching Jupiter prices (Solana chain 900 mints)…');
  const jStats = await applyJupiterPricesToBackedPayload(payload);
  console.error('Jupiter:', jStats);

  writeFileSync(OUT, JSON.stringify(payload, null, 2) + '\n');
  console.error(`Wrote ${OUT} (${payload.assets.length} assets).`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
