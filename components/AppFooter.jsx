export default function AppFooter({ lastUpdatedAt = null }) {
  const parsed = lastUpdatedAt ? new Date(lastUpdatedAt) : null;
  const updated =
    parsed && !Number.isNaN(parsed.getTime())
      ? `${parsed.toLocaleString('en-US', {
          month: 'short',
          day: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
          timeZone: 'UTC',
        })} UTC`
      : '—';

  return (
    <footer>
      <span>RWA Portfolio Tracker · Cross-Chain</span>
      <span>Prices updated: {updated}</span>
      <span>Powered by Ondo Finance · Paxos · Tether · Circle · xStocks</span>
    </footer>
  );
}
