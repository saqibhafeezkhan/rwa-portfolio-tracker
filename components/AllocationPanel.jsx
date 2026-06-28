export default function AllocationPanel({ segments = [], classCount = 0 }) {
  const hasData = segments.length > 0;
  const label = hasData
    ? `${classCount} ${classCount === 1 ? 'CLASS' : 'CLASSES'}`
    : 'NO DATA';

  return (
    <div className="panel scan-line">
      <div className="panel-header">
        <span className="panel-title">Asset Allocation</span>
        <span className="panel-badge">by Category</span>
      </div>
      <div className="chart-area">
        {hasData ? (
          <div className="donut-wrapper">
            <svg className="donut-svg" viewBox="0 0 160 160">
              <defs>
                <filter id="glow">
                  <feGaussianBlur stdDeviation="2" result="blur" />
                  <feMerge>
                    <feMergeNode in="blur" />
                    <feMergeNode in="SourceGraphic" />
                  </feMerge>
                </filter>
              </defs>
              <circle cx="80" cy="80" r="60" fill="none" stroke="var(--bg3)" strokeWidth="22" />
              {segments.map((s, i) => (
                <circle
                  key={i}
                  cx="80" cy="80" r="60"
                  fill="none"
                  stroke={s.color}
                  strokeWidth="22"
                  strokeDasharray={`${s.dash} ${376.8 - s.dash}`}
                  strokeDashoffset={s.offset}
                  transform="rotate(-90 80 80)"
                  style={{
                    animation: `donutDraw 1.2s ${s.delay}s ease both`,
                    animationFillMode: 'both',
                  }}
                />
              ))}
              <text x="80" y="76" textAnchor="middle" fontFamily="Cormorant Garamond,serif" fontSize="14" fill="var(--text)">RWA</text>
              <text x="80" y="91" textAnchor="middle" fontFamily="DM Mono,monospace" fontSize="9" fill="var(--text-dim)">{label}</text>
            </svg>

            <div className="donut-legend">
              {segments.map((s, i) => (
                <div
                  key={i}
                  className="legend-item"
                  style={{ animationDelay: `${0.6 + i * 0.15}s` }}
                >
                  <div className="legend-dot" style={{ background: s.color }} />
                  <span className="legend-name">{s.name}</span>
                  <span className="legend-pct">{s.pct}</span>
                  <span className="legend-val">{s.val}</span>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <p style={{ padding: '24px 16px', color: 'var(--text-dim)', fontSize: 12, lineHeight: 1.6 }}>
            Add a wallet with RWA balances to see allocation by category.
          </p>
        )}
      </div>
    </div>
  );
}
