import test from 'node:test';
import assert from 'node:assert/strict';

import {
  assetToTickerRow,
  dedupeTickerRows,
  filterTickerMarqueeRows,
  mergeTickerRows,
  recentHistoryPct,
} from '../lib/ondo-ticker.js';
import { rollHourlyPrices } from '../lib/hourly-price-roll.js';

test('seeded zero change is treated as unknown, not 0.00%', () => {
  const row = assetToTickerRow({
    symbol: 'COSTx',
    ticker: 'COST',
    price: '100',
    priceChangePct24h: '0',
    hourlyPriceHistory: [],
  });
  assert.equal(row.change, '—');
  assert.equal(row.priceChangePct24h, null);
});

test('manifest change alone is not trusted without a recent history window', () => {
  const row = assetToTickerRow({
    symbol: 'PAXG',
    ticker: 'PAXG',
    price: '4447.78',
    priceChangePct24h: '0.51',
    hourlyPriceHistory: [],
  });
  assert.equal(row.change, '—');
});

test('stale hourly history is ignored', () => {
  const now = Date.parse('2026-11-26T12:00:00Z');
  const pct = recentHistoryPct(
    [
      { at: '2026-05-17T16:07:54.145Z', price: '100' },
      { at: '2026-05-17T16:10:59.998Z', price: '110' },
    ],
    now,
  );
  assert.equal(pct, null);
});

test('full recent 24h window produces a change', () => {
  const now = Date.parse('2026-11-26T12:00:00Z');
  const pct = recentHistoryPct(
    [
      { at: '2026-11-25T12:00:00Z', price: '100' },
      { at: '2026-11-26T11:00:00Z', price: '105' },
    ],
    now,
  );
  assert.equal(pct, '5');
});

test('rolling prunes snapshots older than the 24h window', () => {
  const history = rollHourlyPrices(
    [
      { at: '2026-05-17T16:07:54.145Z', price: '100' },
      { at: '2026-05-17T16:08:57.092Z', price: '101' },
    ],
    { at: '2026-11-25T19:37:00.000Z', price: '120' },
  );
  assert.equal(history.length, 1);
  assert.equal(history[0].price, '120');
});

test('dedupe keeps the first row per symbol', () => {
  const rows = dedupeTickerRows([
    { name: 'OUSG', price: '$1.00' },
    { name: 'ousg', price: '$2.00' },
    { name: 'USDY', price: '$1.00' },
  ]);
  assert.equal(rows.length, 2);
  assert.equal(rows[0].price, '$1.00');
});

test('merge keeps prior change when the refresh has none', () => {
  const merged = mergeTickerRows(
    [{ name: 'OUSG', price: '$107.00', change: '+0.50%', up: true, priceChangePct24h: '0.5' }],
    [{ name: 'OUSG', price: '$108.00', change: '—', up: true, priceChangePct24h: null }],
  );
  assert.equal(merged[0].price, '$108.00');
  assert.equal(merged[0].change, '+0.50%');
});

test('marquee filters rows without a price', () => {
  const rows = filterTickerMarqueeRows([
    { name: 'A', price: '$1.00' },
    { name: 'B', price: '—' },
  ]);
  assert.equal(rows.length, 1);
});
