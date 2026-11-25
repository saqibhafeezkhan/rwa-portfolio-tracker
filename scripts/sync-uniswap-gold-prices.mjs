#!/usr/bin/env node
/**
 * Refresh tokenized-gold USD prices via Uniswap quote API.
 * Requires UNISWAP_API_KEY in environment (e.g. from .env.local).
 *
 * Run: npm run uniswap:gold
 * Or:  node --env-file=.env.local scripts/sync-uniswap-gold-prices.mjs
 */

import { readFileSync, writeFileSync, existsSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { applyAssetPriceSnapshot } from '../lib/hourly-price-roll.js';
import { isValidEvmAddress } from '../lib/address-validation.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');

const UNISWAP_QUOTE_URL = 'https://trade-api.gateway.uniswap.org/v1/quote';
const DEFAULT_SWAPPER = '0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045';

function loadEnvLocal() {
  const path = join(ROOT, '.env.local');
  if (!existsSync(path)) return;
  for (const line of readFileSync(path, 'utf8').split('\n')) {
    const t = line.trim();
    if (!t || t.startsWith('#')) continue;
    const i = t.indexOf('=');
    if (i === -1) continue;
    const key = t.slice(0, i).trim();
    const val = t.slice(i + 1).trim().replace(/^["']|["']$/g, '');
    if (!process.env[key]) process.env[key] = val;
  }
}

function readJson(name) {
  return JSON.parse(readFileSync(join(ROOT, 'data', name), 'utf8'));
}

function writeJson(name, data) {
  writeFileSync(join(ROOT, 'data', name), JSON.stringify(data, null, 2) + '\n');
}

function oneTokenAmountWei(decimals) {
  return (10n ** BigInt(decimals)).toString();
}

function usdPriceFromAggregatedAmount(amountRaw, usdcDecimals = 6) {
  const raw = BigInt(amountRaw);
  const divisor = 10n ** BigInt(usdcDecimals);
  const whole = raw / divisor;
  const frac = raw % divisor;
  const fracStr = frac.toString().padStart(Number(usdcDecimals), '0').replace(/0+$/, '');
  return fracStr ? `${whole}.${fracStr}` : whole.toString();
}

async function fetchQuote(token, config, apiKey) {
  const res = await fetch(UNISWAP_QUOTE_URL, {
    method: 'POST',
    signal: AbortSignal.timeout(15_000),
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'x-universal-router-version': '2.0',
      'x-erc20eth-enabled': 'false',
      'x-permit2-disabled': 'false',
    },
    body: JSON.stringify({
      type: 'EXACT_INPUT',
      amount: oneTokenAmountWei(token.decimals),
      tokenInChainId: config.chainId ?? 1,
      tokenOutChainId: config.tokenOutChainId ?? config.chainId ?? 1,
      tokenIn: token.tokenIn,
      tokenOut: config.tokenOut,
      swapper: config.swapper ?? process.env.UNISWAP_SWAPPER_ADDRESS ?? DEFAULT_SWAPPER,
    }),
  });
  if (!res.ok) throw new Error(`Uniswap ${res.status}: ${(await res.text()).slice(0, 200)}`);
  const json = await res.json();
  const amount = json?.quote?.aggregatedOutputs?.[0]?.amount;
  if (amount == null) throw new Error('No aggregatedOutputs amount');
  return usdPriceFromAggregatedAmount(amount, config.tokenOutDecimals ?? 6);
}

async function main() {
  loadEnvLocal();
  const apiKey = process.env.UNISWAP_API_KEY;
  if (!apiKey) {
    console.error('Set UNISWAP_API_KEY in .env.local or the environment.');
    process.exit(1);
  }

  const config = readJson('uniswap-price-tokens.json');
  const gold = readJson('tokenized-gold-assets.json');
  const bySymbol = new Map((gold.assets || []).map((a) => [a.symbol, a]));
  const now = new Date().toISOString();

  for (const token of config.tokens || []) {
    const sym = token.manifestSymbol ?? token.symbol;
    const asset = bySymbol.get(sym);
    if (!asset) {
      console.warn(`Skip ${token.symbol}: not in tokenized-gold-assets.json`);
      continue;
    }
    if (!isValidEvmAddress(token.tokenIn) || !isValidEvmAddress(config.tokenOut)) {
      throw new Error(`Invalid token address for ${sym}`);
    }
    const priceStr = await fetchQuote(token, config, apiKey);
    const prev = asset.price ? parseFloat(asset.price) : null;
    const next = parseFloat(priceStr);
    if (prev != null && prev > 0 && Number.isFinite(next)) {
      asset.lastQuoteChangePct = String(((next - prev) / prev) * 100);
    }
    applyAssetPriceSnapshot(asset, priceStr, { at: now });
    asset.lastUniswapQuoteAt = now;
    console.log(`${sym}: $${priceStr}`);
  }

  gold.lastUpdatedAt = now;
  gold.uniswapPricesUpdatedAt = now;
  config.lastUpdatedAt = now;
  writeJson('tokenized-gold-assets.json', gold);
  writeJson('uniswap-price-tokens.json', config);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
