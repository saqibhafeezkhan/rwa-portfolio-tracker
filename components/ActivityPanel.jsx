function updatedLabel(iso) {
  const ts = Date.parse(iso);
  if (!Number.isFinite(ts)) return null;
  return `${new Date(ts).toISOString().slice(11, 16)} UTC`;
}

export default function ActivityPanel({
  lastUpdatedAt = null,
  walletCount = 0,
  holdingsCount = 0,
  loading = false,
}) {
  const updated = updatedLabel(lastUpdatedAt);

  return (
    <div className="panel">
      <div className="panel-header">
        <span className="panel-title">Dashboard Sync</span>
        <div className="live-dot" style={{ width: '5px', height: '5px', marginLeft: '4px' }} />
      </div>
      <div className="activity-list">
        <div className="activity-item">
          <div className="activity-icon bridge">◈</div>
          <div className="activity-body">
            <div className="activity-title">Market prices</div>
            <div className="activity-meta">
              {updated ? `Updated at ${updated}` : 'Waiting for first refresh'}
            </div>
          </div>
        </div>
        <div className="activity-item">
          <div className="activity-icon mint">⬡</div>
          <div className="activity-body">
            <div className="activity-title">
              {walletCount} wallet{walletCount === 1 ? '' : 's'} tracked
            </div>
            <div className="activity-meta">
              {loading
                ? 'Syncing on-chain balances…'
                : `${holdingsCount} RWA position${holdingsCount === 1 ? '' : 's'} found`}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
