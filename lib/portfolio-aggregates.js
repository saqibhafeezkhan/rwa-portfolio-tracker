const DONUT_CIRCUMFERENCE = 376.8;

const CATEGORY_META = {
  tbills: { name: 'T-Bills', color: '#c9a84c' },
  bonds: { name: 'Corp. Bonds', color: '#818cf8' },
  equities: { name: 'Equities', color: '#a78bfa' },
  commodities: { name: 'Commodities', color: '#f59e0b' },
  realestate: { name: 'Real Estate', color: '#2dd4bf' },
  crypto: { name: 'Crypto', color: '#60a5fa' },
  other: { name: 'Other', color: '#8a8070' },
};

const CATEGORY_ORDER = [
  'tbills',
  'bonds',
  'equities',
  'commodities',
  'realestate',
  'crypto',
  'other',
];

const CHAIN_STYLES = {
  Ethereum: {
    color: 'linear-gradient(90deg,#818cf8,#6366f1)',
    textColor: '#818cf8',
  },
  Solana: {
    color: 'linear-gradient(90deg,#14f195,#9945ff)',
    textColor: '#14f195',
  },
  Polygon: {
    color: 'linear-gradient(90deg,#c084fc,#a855f7)',
    textColor: '#c084fc',
  },
  Arbitrum: {
    color: 'linear-gradient(90deg,#60a5fa,#3b82f6)',
    textColor: '#60a5fa',
  },
  Base: {
    color: 'linear-gradient(90deg,#0052ff,#003ecb)',
    textColor: '#0052ff',
  },
  'BNB Chain': {
    color: 'linear-gradient(90deg,#f3ba2f,#d4a017)',
    textColor: '#f3ba2f',
  },
};

function formatUsd(n) {
  if (!Number.isFinite(n) || n <= 0) return '$0';
  return `$${n.toLocaleString('en-US', { maximumFractionDigits: 0 })}`;
}

function sumHoldingsValue(holdings) {
  const list = Array.isArray(holdings) ? holdings : [];
  return list.reduce((sum, h) => sum + (Number(h.value) || 0), 0);
}

/** Total USD value across all live holdings. */
export function getPortfolioTotalValue(holdings) {
  return sumHoldingsValue(holdings);
}

/**
 * Value-weighted 24h portfolio change from each holding’s `change` (%).
 * Returns null when total is zero or no holdings have change data.
 */
export function getPortfolioChange24h(holdings) {
  const list = Array.isArray(holdings) ? holdings : [];
  const total = sumHoldingsValue(list);
  if (total <= 0) return null;

  let weightedPct = 0;
  let covered = 0;

  for (const h of list) {
    const value = Number(h.value) || 0;
    const change = Number(h.change);
    if (value <= 0 || !Number.isFinite(change)) continue;
    weightedPct += (value / total) * change;
    covered += value;
  }

  if (covered <= 0) return null;

  const usd = total * (weightedPct / 100);
  return {
    pct: weightedPct,
    usd,
    up: weightedPct >= 0,
  };
}

/** Donut segments + legend rows from live holdings, grouped by `category`. */
export function buildAllocationFromHoldings(holdings) {
  const list = Array.isArray(holdings) ? holdings : [];
  const total = sumHoldingsValue(list);

  if (total <= 0) {
    return { segments: [], total: 0, classCount: 0 };
  }

  const byCategory = new Map();
  for (const h of list) {
    const cat = h.category || 'other';
    byCategory.set(cat, (byCategory.get(cat) || 0) + (Number(h.value) || 0));
  }

  const segments = [];
  let cumulative = 0;
  let delay = 0.5;

  for (const cat of CATEGORY_ORDER) {
    const value = byCategory.get(cat);
    if (!value || value <= 0) continue;

    const pct = value / total;
    const dash = DONUT_CIRCUMFERENCE * pct;
    const meta = CATEGORY_META[cat] ?? CATEGORY_META.other;

    segments.push({
      color: meta.color,
      offset: -cumulative,
      dash,
      name: meta.name,
      pct: `${Math.round(pct * 100)}%`,
      val: formatUsd(value),
      delay,
    });

    cumulative += dash;
    delay += 0.15;
  }

  return {
    segments,
    total,
    classCount: segments.length,
  };
}

/** Horizontal bar rows from live holdings, grouped by `chain` label. */
export function buildChainDistributionFromHoldings(holdings) {
  const list = Array.isArray(holdings) ? holdings : [];
  const total = sumHoldingsValue(list);

  if (total <= 0) return [];

  const byChain = new Map();
  for (const h of list) {
    const name = h.chain || 'Unknown';
    byChain.set(name, (byChain.get(name) || 0) + (Number(h.value) || 0));
  }

  return [...byChain.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([name, value]) => {
      const style = CHAIN_STYLES[name] ?? {
        color: 'linear-gradient(90deg,#8a8070,#6b6560)',
        textColor: '#8a8070',
      };
      return {
        name,
        pct: Math.round((value / total) * 100),
        usd: formatUsd(value),
        color: style.color,
        textColor: style.textColor,
      };
    });
}
