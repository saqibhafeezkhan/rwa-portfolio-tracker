'use client';

import { useState } from 'react';

const FILTERS = [
  { key: 'all',         label: 'All' },
  { key: 'tbills',      label: 'T-Bills' },
  { key: 'realestate',  label: 'Real Estate' },
  { key: 'equities',    label: 'Equities' },
  { key: 'bonds',       label: 'Bonds' },
];

function formatBalance(n) {
  if (!Number.isFinite(n)) return '—';
  if (n === 0) return '0';
  if (Math.abs(n) >= 1) return n.toLocaleString('en-US', { maximumFractionDigits: 4 });
  return n.toLocaleString('en-US', { maximumFractionDigits: 6 });
}

function formatPrice(n) {
  if (!Number.isFinite(n) || n === 0) return '—';
  const fraction =
    n < 0.01 ? { minimumFractionDigits: 2, maximumFractionDigits: 6 }
    : n < 1   ? { minimumFractionDigits: 2, maximumFractionDigits: 4 }
    :           { minimumFractionDigits: 2, maximumFractionDigits: 2 };
  return `$${n.toLocaleString('en-US', fraction)}`;
}

function formatValue(n) {
  if (!Number.isFinite(n)) return '—';
  return `$${n.toLocaleString('en-US', { maximumFractionDigits: 2 })}`;
}

export default function HoldingsTable({ holdings, loading = false }) {
  const [filter, setFilter] = useState('all');

  const filtered = filter === 'all'
    ? holdings
    : holdings.filter(h => h.category === filter);

  return (
    <div className="table-wrap scan-line">
      <div className="table-header-row">
        <span className="panel-title">
          Holdings
          {loading && (
            <span style={{ marginLeft: 10, color: 'var(--text-dim)', fontSize: 11 }}>
              · syncing on-chain…
            </span>
          )}
        </span>
        <div className="filter-group">
          {FILTERS.map(f => (
            <button
              key={f.key}
              className={`filter-btn ${filter === f.key ? 'active' : ''}`}
              onClick={() => setFilter(f.key)}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      <table>
        <thead>
          <tr>
            <th>Asset</th>
            <th>Protocol</th>
            <th>Chain</th>
            <th>Price</th>
            <th>24h Chg</th>
            <th>Balance</th>
            <th>Value</th>
            <th>Allocation</th>
          </tr>
        </thead>
        <tbody>
          {filtered.length === 0 && !loading && (
            <tr>
              <td colSpan={8} style={{ padding: '32px 16px', textAlign: 'center', color: 'var(--text-dim)' }}>
                No holdings yet. Add an Ethereum or Solana wallet to load on-chain balances.
              </td>
            </tr>
          )}
          {filtered.map((h, i) => {
            const chgColor = h.change > 0 ? 'var(--green)' : h.change < 0 ? 'var(--red)' : 'var(--text-dim)';
            const chgSign  = h.change > 0 ? '+' : '';

            return (
              <tr key={`${h.contract || h.ticker || h.name}-${i}`}>
                <td>
                  <div className="asset-name-cell">
                    <div className="asset-icon" style={{ background: 'rgba(255,255,255,0.05)' }}>
                      {h.iconSrc
                        ? <img src={h.iconSrc} alt="" width={20} height={20} style={{ borderRadius: '50%' }} />
                        : h.icon}
                    </div>
                    <div>
                      <div className="asset-name">
                        {h.name}
                        {h.isLive && (
                          <span style={{
                            marginLeft: 6, fontSize: 9, letterSpacing: 0.5,
                            color: 'var(--green)', textTransform: 'uppercase',
                          }}>
                            ● live
                          </span>
                        )}
                      </div>
                      <div className="asset-ticker">{h.ticker}</div>
                    </div>
                  </div>
                </td>
                <td>
                  <span
                    className="protocol-tag"
                    style={{
                      color: h.protocolColor,
                      borderColor: `${h.protocolColor}33`,
                      background: `${h.protocolColor}11`,
                    }}
                  >
                    {h.protocol}
                  </span>
                </td>
                <td>
                  <span
                    className="chain-tag"
                    style={{
                      color: h.chainColor,
                      borderColor: `${h.chainColor}44`,
                      background: `${h.chainColor}11`,
                    }}
                  >
                    {h.chain}
                  </span>
                </td>
                <td>{formatPrice(h.price)}</td>
                <td style={{ color: chgColor }}>{chgSign}{Number(h.change || 0).toFixed(2)}%</td>
                <td>{formatBalance(h.balance)}</td>
                <td style={{ fontFamily: "'Cormorant Garamond',serif", fontSize: '16px' }}>
                  {formatValue(h.value)}
                </td>
                <td className="bar-cell">
                  <div style={{ fontSize: '10px', color: 'var(--text-dim)', marginBottom: '3px' }}>
                    {h.pct}%
                  </div>
                  <div
                    className="mini-bar"
                    style={{ width: `${(h.pct || 0) * 6}px`, background: `${h.protocolColor}88` }}
                  />
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
