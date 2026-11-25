import { WALLET_BALANCE_CHAIN_IDS } from '@/lib/wallet-balance-chains';
import {
  addressesMatch,
  isValidAddressForChain,
} from '@/lib/address-validation';

/** Solana + EVM chains only. */
export const TRACKABLE_CHAIN_IDS = [...WALLET_BALANCE_CHAIN_IDS];

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
  if (!isValidAddressForChain(chainId, trimmed)) {
    return {
      ok: false,
      error:
        chainId === 'solana'
          ? 'Invalid Solana address (32–44 Base58 characters).'
          : 'Invalid EVM address (0x followed by 40 hex characters).',
    };
  }

  // Solana addresses are Base58 (case-sensitive); EVM addresses are not.
  if (currentWallets.some(
    w => w.chainId === chainId && addressesMatch(chainId, w.address, trimmed)
  )) {
    return { ok: false, error: 'Wallet already tracked.' };
  }

  const wallet = {
    id: newWalletId(),
    label: label.trim() || shortAddr(trimmed),
    address: trimmed,
    chainId,
    addedAt: Date.now(),
    color: chain.color,
  };

  return { ok: true, wallet };
}

// ── HELPERS ───────────────────────────────────────────────────────────────────
function newWalletId() {
  try {
    return `w-${crypto.randomUUID()}`;
  } catch {
    return `w-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  }
}

export function getChainById(id) {
  return CHAINS.find(c => c.id === id);
}

export function shortAddr(addr) {
  if (!addr || addr.length < 12) return addr;
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}

export function timeAgo(ts) {
  if (!Number.isFinite(ts)) return '—';
  const diff = Date.now() - ts;
  const mins  = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days  = Math.floor(diff / 86400000);
  if (days > 0)  return `${days}d ago`;
  if (hours > 0) return `${hours}h ago`;
  if (mins > 0)  return `${mins}m ago`;
  return 'just now';
}
