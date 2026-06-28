'use client';

import { useState, useRef, useEffect } from 'react';
import { CHAINS, getChainById, shortAddr, timeAgo } from '@/lib/wallets';

export default function WalletDrawer({ wallets, isOpen, onClose, onAdd, onRemove }) {
  const [selectedChain, setSelectedChain] = useState('ethereum');
  const [label, setLabel]                 = useState('');
  const [address, setAddress]             = useState('');
  const [error, setError]                 = useState('');
  const [removingId, setRemovingId]       = useState(null);
  const [flashId, setFlashId]             = useState(null);
  const addrRef = useRef(null);

  // Keyboard shortcuts
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape' && isOpen) onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [isOpen, onClose]);

  const chain = CHAINS.find(c => c.id === selectedChain);
  const addrPlaceholder =
    selectedChain === 'solana'
      ? 'Base58 address (32–44 chars)…'
      : '0x… (42 chars)';

  function handleAdd() {
    setError('');
    const result = onAdd({ label, address, chainId: selectedChain });
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setLabel('');
    setAddress('');
    // Flash the first card briefly
    setFlashId(result.wallet?.id);
    setTimeout(() => setFlashId(null), 700);
  }

  function handlePaste() {
    navigator.clipboard.readText()
      .then(text => { setAddress(text.trim()); setError(''); })
      .catch(() => setError('Clipboard access denied — paste manually.'));
  }

  function handleRemove(id) {
    setRemovingId(id);
    setTimeout(() => {
      onRemove(id);
      setRemovingId(null);
    }, 300);
  }

  return (
    <>
      {/* Backdrop */}
      <div
        className={`drawer-backdrop ${isOpen ? 'visible' : ''}`}
        onClick={onClose}
      />

      {/* Drawer panel */}
      <aside
        className={`wallet-drawer ${isOpen ? 'open' : ''}`}
        role="dialog"
        aria-label="Wallet Manager"
      >
        {/* Header */}
        <div className="drawer-header">
          <div className="drawer-title-group">
            <span className="drawer-title">Wallet Manager</span>
            <span className="drawer-subtitle">
              {wallets.length} wallet{wallets.length !== 1 ? 's' : ''} tracked
            </span>
          </div>
          <button className="drawer-close" onClick={onClose} aria-label="Close">✕</button>
        </div>

        {/* Add wallet form */}
        <div className="add-wallet-form">
          <div className="form-section-label">Add Wallet</div>

          <div className="form-row">
            <label className="form-label">
              Label <span className="form-optional">(optional)</span>
            </label>
            <input
              className="form-input"
              type="text"
              placeholder="e.g. Main Treasury"
              maxLength={32}
              autoComplete="off"
              value={label}
              onChange={e => setLabel(e.target.value)}
            />
          </div>

          <div className="form-row">
            <label className="form-label">Network</label>
            <div className="chain-grid">
              {CHAINS.map(c => (
                <div
                  key={c.id}
                  className={`chain-option ${selectedChain === c.id ? 'active' : ''}`}
                  style={{ '--chain-color': c.color }}
                  onClick={() => { setSelectedChain(c.id); setError(''); }}
                >
                  <span className="chain-option-icon">{c.icon}</span>
                  <span className="chain-option-label">{c.label}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="form-row">
            <label className="form-label">Wallet Address</label>
            <div className="input-wrapper">
              <input
                ref={addrRef}
                className="form-input addr-input"
                type="text"
                placeholder={addrPlaceholder}
                autoComplete="off"
                spellCheck={false}
                value={address}
                onChange={e => { setAddress(e.target.value); setError(''); }}
                onKeyDown={e => e.key === 'Enter' && handleAdd()}
              />
              <button className="paste-btn" onClick={handlePaste} title="Paste from clipboard">
                ⊕ Paste
              </button>
            </div>
            <div className={`form-error ${error ? 'visible' : ''}`}>{error}</div>
          </div>

          <button className="add-wallet-btn" onClick={handleAdd}>
            <span>+ Track Wallet</span>
          </button>
        </div>

        {/* Wallet list */}
        <div className="wallet-list-header">
          <span className="form-section-label">Tracked Wallets</span>
          <span className="wallet-count-badge">{wallets.length}</span>
        </div>

        <div className="wallet-list">
          {wallets.length === 0 ? (
            <div className="wallet-empty">
              <div className="wallet-empty-icon">⬡</div>
              <div className="wallet-empty-text">No wallets tracked yet</div>
              <div className="wallet-empty-sub">Add your first wallet above</div>
            </div>
          ) : (
            wallets.map(w => (
              <WalletCard
                key={w.id}
                wallet={w}
                isRemoving={removingId === w.id}
                isFlashing={flashId === w.id}
                onRemove={() => handleRemove(w.id)}
              />
            ))
          )}
        </div>
      </aside>
    </>
  );
}

function WalletCard({ wallet: w, isRemoving, isFlashing, onRemove }) {
  const chain = getChainById(w.chainId);
  const label = chain?.label ?? w.chainId;
  const icon  = chain?.icon  ?? '?';

  return (
    <div className={`wallet-card ${isRemoving ? 'removing' : ''} ${isFlashing ? 'flash' : ''}`}>
      <div className="wcard-left">
        <div
          className="wcard-chain-icon"
          style={{
            background: `${w.color}22`,
            color: w.color,
            borderColor: `${w.color}44`,
          }}
        >
          {icon}
        </div>
        <div className="wcard-info">
          <div className="wcard-label">{w.label}</div>
          <div className="wcard-addr" title={w.address}>{shortAddr(w.address)}</div>
          <div className="wcard-meta">
            <span className="wcard-chain" style={{ color: w.color }}>{label}</span>
            <span className="wcard-dot">·</span>
            <span className="wcard-time">{timeAgo(w.addedAt)}</span>
          </div>
        </div>
      </div>
      <div className="wcard-right">
        <div className="wcard-value">{w.value}</div>
        <div className={`wcard-change ${w.up ? 'up' : 'down'}`}>
          {w.up ? '▲' : '▼'} {w.change}
        </div>
        <div className="wcard-assets">{w.assets} asset{w.assets !== 1 ? 's' : ''}</div>
      </div>
      <button
        type="button"
        className="wcard-remove"
        onClick={onRemove}
        title="Remove wallet"
        aria-label={`Remove ${w.label}`}
      >
        ✕
      </button>
    </div>
  );
}
