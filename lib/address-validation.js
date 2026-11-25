/** Client-safe address validation shared by the UI, API routes, and sync scripts. */

const EVM_ADDRESS_RE = /^0x[0-9a-fA-F]{40}$/;
const SOLANA_ADDRESS_RE = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;

export function isValidEvmAddress(address) {
  return typeof address === 'string' && EVM_ADDRESS_RE.test(address.trim());
}

export function isValidSolanaAddress(address) {
  return typeof address === 'string' && SOLANA_ADDRESS_RE.test(address.trim());
}

/** True when `address` is well-formed for the given wallet chain id. */
export function isValidAddressForChain(chainId, address) {
  if (chainId === 'solana') return isValidSolanaAddress(address);
  return isValidEvmAddress(address);
}

/** Case-insensitive for EVM, case-sensitive for Solana (Base58). */
export function addressesMatch(chainId, a, b) {
  if (typeof a !== 'string' || typeof b !== 'string') return false;
  if (chainId === 'solana') return a.trim() === b.trim();
  return a.trim().toLowerCase() === b.trim().toLowerCase();
}
