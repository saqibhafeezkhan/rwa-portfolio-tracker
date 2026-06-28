export default function ChainPanel({ chainData = [] }) {
  const count = chainData.length;
  const badge = count === 0 ? 'No balances' : `${count} ${count === 1 ? 'Network' : 'Networks'}`;

  return (
    <div className="panel">
      <div className="panel-header">
        <span className="panel-title">Chain Distribution</span>
        <span className="panel-badge">{badge}</span>
      </div>
      <div className="chain-bars">
        {count === 0 ? (
          <p style={{ padding: '8px 0', color: 'var(--text-dim)', fontSize: 12, lineHeight: 1.6 }}>
            Add a wallet with RWA balances to see chain breakdown.
          </p>
        ) : null}
        {chainData.map((c, i) => (
          <div key={i} className="chain-row">
            <span className="chain-name">{c.name}</span>
            <div className="chain-bar-track">
              <div
                className="chain-bar-fill"
                style={{ width: `${c.pct}%`, background: c.color }}
              />
            </div>
            <span className="chain-pct" style={{ color: c.textColor }}>{c.pct}%</span>
            <span className="chain-usd">{c.usd}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
