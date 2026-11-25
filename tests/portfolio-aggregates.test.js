import test from 'node:test';
import assert from 'node:assert/strict';

import {
  buildAllocationFromHoldings,
  buildChainDistributionFromHoldings,
  getPortfolioChange24h,
  getPortfolioTotalValue,
} from '../lib/portfolio-aggregates.js';

test('totals sum only numeric values', () => {
  const total = getPortfolioTotalValue([
    { value: 10 },
    { value: 2.5 },
    { value: null },
    { value: 'nope' },
  ]);
  assert.equal(total, 12.5);
});

test('24h change ignores holdings without change data instead of diluting', () => {
  const change = getPortfolioChange24h([
    { value: 100, change: 10 },
    { value: 100, change: null },
    { value: 100 },
  ]);
  assert.ok(change);
  assert.equal(change.pct, 10);
  assert.equal(change.usd, 10);
  assert.equal(change.up, true);
});

test('24h change is null when no holding has change data', () => {
  assert.equal(
    getPortfolioChange24h([
      { value: 100, change: null },
      { value: 0, change: 5 },
    ]),
    null,
  );
});

test('allocation groups by category and derives donut offsets', () => {
  const { segments, classCount, total } = buildAllocationFromHoldings([
    { value: 75, category: 'tbills' },
    { value: 25, category: 'equities' },
  ]);
  assert.equal(total, 100);
  assert.equal(classCount, 2);
  assert.equal(segments[0].name, 'T-Bills');
  assert.equal(segments[0].pct, '75%');
  assert.equal(segments[0].offset, -0);
  assert.equal(segments[1].offset, -282.6);
});

test('chain distribution sorts descending by value', () => {
  const rows = buildChainDistributionFromHoldings([
    { value: 10, chain: 'Solana' },
    { value: 30, chain: 'Ethereum' },
  ]);
  assert.equal(rows[0].name, 'Ethereum');
  assert.equal(rows[0].pct, 75);
  assert.equal(rows[1].name, 'Solana');
});
