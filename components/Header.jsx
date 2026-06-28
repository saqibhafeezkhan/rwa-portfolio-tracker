export default function Header({ walletCount, onOpenDrawer }) {
  return (
    <header>
      <div className="logo-group">
        <span className="logo-title">⬡ RWA Portfolio Tracker</span>
        <span className="logo-subtitle">Real World Assets · Cross-Chain</span>
      </div>
      <div className="header-right">
        <div className="chain-pills">
          <span className="chain-pill eth">ETH</span>
          <span className="chain-pill sol">SOL</span>
          <span className="chain-pill bnb">BNB</span>
          <span className="chain-pill poly">POLY</span>
          <span className="chain-pill arb">ARB</span>
          <span className="chain-pill base">BASE</span>
        </div>
        <button className="manage-wallets-btn" onClick={onOpenDrawer}>
          <span className="manage-wallets-icon">◈</span>
          <span className="manage-wallets-text">Wallets</span>
          <span className="manage-wallets-count">{walletCount}</span>
        </button>
        <div className="live-badge">
          <div className="live-dot" />
          Live Feed
        </div>
      </div>
    </header>
  );
}
