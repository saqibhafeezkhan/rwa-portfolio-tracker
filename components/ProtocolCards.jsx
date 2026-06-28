export default function ProtocolCards({ protocols }) {
  return (
    <div className="bottom-grid">
      {protocols.map((p) => (
        <div key={p.name} className="protocol-card">
          <div className="protocol-logo">{p.logo}</div>
          <div className="protocol-name">{p.name}</div>
          <div className="protocol-chain-label">{p.chains}</div>
          <div className="protocol-stats">
            <div>
              <div className="pstat-label">Assets</div>
              <div className="pstat-value">{p.assets}</div>
            </div>
          </div>
          {p.products ? (
            <div className="protocol-products">{p.products}</div>
          ) : null}
          <div
            className="protocol-yield"
            style={{ color: p.apyColor, textShadow: `0 0 20px ${p.apyGlow}` }}
          >
            {p.apy}
          </div>
          {p.label ? <div className="protocol-yield-label">{p.label}</div> : null}
        </div>
      ))}
    </div>
  );
}
