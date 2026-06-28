export default function ActivityPanel() {
  return (
    <div className="panel">
      <div className="panel-header">
        <span className="panel-title">Recent Activity</span>
        <div className="live-dot" style={{ width: '5px', height: '5px', marginLeft: '4px' }} />
      </div>
      <div className="activity-list">
        <p className="activity-empty">No activity</p>
      </div>
    </div>
  );
}
