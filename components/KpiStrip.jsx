'use client';

import { useEffect, useRef, useState } from 'react';

function formatNumber(value, decimals = 0) {
  if (!Number.isFinite(value)) return '0';
  const fixed = Math.abs(value).toFixed(decimals);
  const [whole, fraction] = fixed.split('.');
  const grouped = whole.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return decimals > 0 ? `${grouped}.${fraction}` : grouped;
}

function useCountUp(target, decimals = 0) {
  const safeTarget = Number.isFinite(target) ? target : 0;
  const [value, setValue] = useState(safeTarget);
  const previous = useRef(safeTarget);

  useEffect(() => {
    const from = previous.current;
    const to = safeTarget;
    previous.current = to;

    if (from === to) {
      setValue(to);
      return undefined;
    }

    const duration = 700;
    const start = performance.now();
    let frame;

    const tick = (now) => {
      const t = Math.min(1, (now - start) / duration);
      const eased = 1 - (1 - t) ** 3;
      setValue(from + (to - from) * eased);
      if (t < 1) frame = requestAnimationFrame(tick);
    };

    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [safeTarget]);

  return formatNumber(value, decimals);
}

export default function KpiStrip({
  totalPortfolioValue = 0,
  change24h = null,
  walletCount = 0,
  holdingsCount = 0,
  chainData = [],
}) {
  const totalValue = useCountUp(Math.round(totalPortfolioValue), 0);
  const wallets = useCountUp(walletCount, 0);
  const chains = useCountUp(chainData.length, 0);
  const assets = useCountUp(holdingsCount, 0);

  const totalMeta = change24h ? (
    <>
      <span className={change24h.up ? 'up' : 'down'}>
        {change24h.up ? '▲' : '▼'} {change24h.pct >= 0 ? '+' : ''}
        {change24h.pct.toFixed(2)}%
      </span>
      &nbsp; {change24h.usd >= 0 ? '+' : '−'}
      ${Math.abs(change24h.usd).toLocaleString('en-US', { maximumFractionDigits: 0 })} (24h)
    </>
  ) : walletCount === 0 ? (
    'Add wallets to track RWA holdings'
  ) : totalPortfolioValue > 0 ? (
    'Live wallet balances'
  ) : (
    'No RWA balances found in tracked wallets'
  );

  const chainNames = chainData.map((c) => c.name).join(' · ');
  const walletsMeta =
    walletCount === 0 ? 'No wallets tracked yet' : 'Solana + EVM wallets';
  const chainsMeta = chainNames || 'No chains with balances';
  const assetsMeta =
    holdingsCount === 0 ? 'No matching RWA positions' : 'RWA positions across wallets';

  return (
    <div className="kpi-strip">
      <div className="kpi-cell scan-line">
        <div className="kpi-label">Total Portfolio Value</div>
        <div className="kpi-value">
          <span className="currency">$</span>
          {totalValue}
        </div>
        <div className="kpi-meta">{totalMeta}</div>
      </div>

      <div className="kpi-cell">
        <div className="kpi-label">Tracked Wallets</div>
        <div className="kpi-value">{wallets}</div>
        <div className="kpi-meta">{walletsMeta}</div>
      </div>

      <div className="kpi-cell">
        <div className="kpi-label">Active Chains</div>
        <div className="kpi-value">{chains}</div>
        <div className="kpi-meta">{chainsMeta}</div>
      </div>

      <div className="kpi-cell">
        <div className="kpi-label">Assets Tracked</div>
        <div className="kpi-value">{assets}</div>
        <div className="kpi-meta">{assetsMeta}</div>
      </div>
    </div>
  );
}
