'use client';

import { useState, useEffect } from 'react';

function useCountUp(target, decimals = 0) {
  const [value, setValue] = useState(0);

  useEffect(() => {
    const DUR = 1500, STEP = 16;
    let interval;
    const timeout = setTimeout(() => {
      const inc = target / (DUR / STEP);
      let cur = 0;
      interval = setInterval(() => {
        cur = Math.min(cur + inc, target);
        setValue(cur);
        if (cur >= target) clearInterval(interval);
      }, STEP);
    }, 600);

    return () => {
      clearTimeout(timeout);
      clearInterval(interval);
    };
  }, [target]);

  return value.toFixed(decimals).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

export default function KpiStrip({ totalPortfolioValue = 0, change24h = null }) {
  const totalValue = useCountUp(Math.round(totalPortfolioValue), 0);
  const yieldEarned = useCountUp(0, 0);
  const chains = useCountUp(6, 0);
  const apy = useCountUp(0, 2);

  const totalMeta = change24h ? (
    <>
      <span className={change24h.up ? 'up' : 'down'}>
        {change24h.up ? '▲' : '▼'} {change24h.pct >= 0 ? '+' : ''}
        {change24h.pct.toFixed(2)}%
      </span>
      &nbsp; {change24h.usd >= 0 ? '+' : '−'}
      ${Math.abs(change24h.usd).toLocaleString('en-US', { maximumFractionDigits: 0 })} (24h)
    </>
  ) : totalPortfolioValue > 0 ? (
    'Live wallet balances'
  ) : (
    'Add wallets to track RWA holdings'
  );

  return (
    <div className="kpi-strip">
      <div className="kpi-cell scan-line">
        <div className="kpi-label">Total Portfolio Value</div>
        <div className="kpi-value">
          <span className="currency">$</span>
          {totalValue}
        </div>
        <div className="kpi-meta">{totalMeta}</div>
        <svg className="kpi-spark" viewBox="0 0 80 40">
          <polyline
            points="0,35 15,30 25,28 35,20 45,18 55,22 65,10 80,8"
            fill="none"
            stroke="rgba(74,222,128,0.6)"
            strokeWidth="1.5"
          />
        </svg>
      </div>

      <div className="kpi-cell">
        <div className="kpi-label">Yield Earned (30d)</div>
        <div className="kpi-value">
          <span className="currency">$</span>
          {yieldEarned}
        </div>
        <div className="kpi-meta">
          <span className="up">▲ +0.00%</span>&nbsp; vs prior period
        </div>
        <svg className="kpi-spark" viewBox="0 0 80 40">
          <polyline
            points="0,38 15,35 25,30 35,28 45,22 55,18 65,12 80,8"
            fill="none"
            stroke="rgba(201,168,76,0.6)"
            strokeWidth="1.5"
          />
        </svg>
      </div>

      <div className="kpi-cell">
        <div className="kpi-label">Active Chains</div>
        <div className="kpi-value">{chains}</div>
        <div className="kpi-meta">ETH · SOL · POLY · ARB · BASE · BNB</div>
      </div>

      <div className="kpi-cell">
        <div className="kpi-label">Avg. Portfolio APY</div>
        <div className="kpi-value">
          {apy}
          <span style={{ fontSize: '18px', color: 'var(--gold)' }}>%</span>
        </div>
        <div className="kpi-meta">
          <span className="up">▲ +0.00%</span>&nbsp; vs 7-day avg
        </div>
        <svg className="kpi-spark" viewBox="0 0 80 40">
          <polyline
            points="0,32 20,28 35,20 50,22 65,14 80,10"
            fill="none"
            stroke="rgba(45,212,191,0.6)"
            strokeWidth="1.5"
          />
        </svg>
      </div>
    </div>
  );
}
