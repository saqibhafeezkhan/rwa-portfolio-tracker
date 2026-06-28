/** Client-safe — chains that support `/api/wallet/[chain]/balances`. */

export const WALLET_BALANCE_CHAIN_IDS = [
  'solana',
  'ethereum',
  'polygon',
  'arbitrum',
  'base',
  'bnb',
];

export function isWalletBalanceChain(chainId) {
  return WALLET_BALANCE_CHAIN_IDS.includes(chainId);
}
