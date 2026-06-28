import { SUPPORTED_EVM_CHAIN_KEYS } from '@/lib/evm-chains';

/** Solana + EVM chains only. */
export const TRACKABLE_CHAIN_IDS = ['solana', ...SUPPORTED_EVM_CHAIN_KEYS];

// ── SUPPORTED CHAINS (wallet drawer + validation) ─────────────────────────────
export const CHAINS = [
  { id: 'ethereum',  label: 'Ethereum',   color: '#818cf8', icon: 'Ξ',  prefix: '0x', addrLen: 42 },
  { id: 'solana',    label: 'Solana',     color: '#14f195', icon: '◎',  prefix: null, addrLen: 44 },
  { id: 'polygon',   label: 'Polygon',    color: '#c084fc', icon: '⬟',  prefix: '0x', addrLen: 42 },
  { id: 'arbitrum',  label: 'Arbitrum',   color: '#60a5fa', icon: '🔵', prefix: '0x', addrLen: 42 },
  { id: 'base',      label: 'Base',       color: '#c9a84c', icon: '🔷', prefix: '0x', addrLen: 42 },
  { id: 'bnb',       label: 'BNB Chain',  color: '#fbbf24', icon: '⬡',  prefix: '0x', addrLen: 42 },
];

export const STORAGE_KEY = 'rwa_tracker_wallets';

const TRACKABLE_SET = new Set(TRACKABLE_CHAIN_IDS);

export function isTrackableChain(chainId) {
  return TRACKABLE_SET.has(chainId);
}

/** Drop wallets saved under chains we no longer support. */
export function filterTrackableWallets(wallets) {
  if (!Array.isArray(wallets)) return [];
  return wallets.filter(w => isTrackableChain(w.chainId));
}

// ── DEFAULT WALLETS ────────────────────────────────────────────────────────────
export function getDefaultWallets() {
  return [];
}

// ── ADD WALLET (pure — takes existing wallets array, returns result) ───────────
export function addWallet(currentWallets, { label, address, chainId }) {
  if (!isTrackableChain(chainId)) {
    return { ok: false, error: 'Only Solana and EVM chains can be tracked.' };
  }

  const chain = CHAINS.find(c => c.id === chainId);
  if (!chain) return { ok: false, error: 'Unknown chain.' };

  const trimmed = address.trim();
  if (!trimmed) return { ok: false, error: 'Address is required.' };

  if (currentWallets.some(
    w => w.address.toLowerCase() === trimmed.toLowerCase() && w.chainId === chainId
  )) {
    return { ok: false, error: 'Wallet already tracked.' };
  }

  const wallet = {
    id: `w${Date.now()}`,
    label: label.trim() || shortAddr(trimmed),
    address: trimmed,
    chainId,
    addedAt: Date.now(),
    color: chain.color,
    value: `$${(Math.random() * 500000 + 10000).toLocaleString('en-US', { maximumFractionDigits: 0 })}`,
    assets: Math.floor(Math.random() * 8) + 1,
    change: `${Math.random() > 0.5 ? '+' : '-'}${(Math.random() * 3).toFixed(2)}%`,
    up: Math.random() > 0.4,
  };

  return { ok: true, wallet };
}

// ── HELPERS ───────────────────────────────────────────────────────────────────
export function getChainById(id) {
  return CHAINS.find(c => c.id === id);
}

export function shortAddr(addr) {
  if (!addr || addr.length < 12) return addr;
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}

export function timeAgo(ts) {
  const diff = Date.now() - ts;
  const mins  = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days  = Math.floor(diff / 86400000);
  if (days > 0)  return `${days}d ago`;
  if (hours > 0) return `${hours}h ago`;
  if (mins > 0)  return `${mins}m ago`;
  return 'just now';
}
