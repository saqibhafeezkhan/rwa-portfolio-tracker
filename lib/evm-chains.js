import { mainnet, bsc, polygon, base, arbitrum } from 'viem/chains';

/** Multicall3 is deployed at the same canonical address on every chain below. */
export const MULTICALL3_ADDRESS = '0xcA11bde05977b3631167028862bE2a173976CA11';

/**
 * Single source of truth for the EVM chains we support in the Holdings tab.
 * Keyed by the `wallets.js` chain id (what gets stored on each wallet row)
 * so we can go directly from `wallet.chainId` → on-chain config.
 *
 *   walletChainId — matches `CHAINS[].id` in `lib/wallets.js`
 *   chainId       — numeric EVM chain id used inside the manifests
 *   viemChain     — viem/chains export for `createPublicClient`
 *   label/color   — UI metadata for the chain badge in HoldingsTable
 *   defaultRpc    — fallback public RPC if no env var is set
 *   rpcEnv        — name of the env var that can override the RPC URL
 */
export const EVM_CHAINS = {
  ethereum: {
    walletChainId: 'ethereum',
    chainId: 1,
    viemChain: mainnet,
    label: 'Ethereum',
    color: '#818cf8',
    defaultRpc: 'https://eth.llamarpc.com',
    rpcEnv: 'ETHEREUM_RPC_URL',
  },
  polygon: {
    walletChainId: 'polygon',
    chainId: 137,
    viemChain: polygon,
    label: 'Polygon',
    color: '#c084fc',
    defaultRpc: 'https://polygon-rpc.com',
    rpcEnv: 'POLYGON_RPC_URL',
  },
  arbitrum: {
    walletChainId: 'arbitrum',
    chainId: 42161,
    viemChain: arbitrum,
    label: 'Arbitrum',
    color: '#60a5fa',
    defaultRpc: 'https://arb1.arbitrum.io/rpc',
    rpcEnv: 'ARBITRUM_RPC_URL',
  },
  base: {
    walletChainId: 'base',
    chainId: 8453,
    viemChain: base,
    label: 'Base',
    color: '#0052ff',
    defaultRpc: 'https://mainnet.base.org',
    rpcEnv: 'BASE_RPC_URL',
  },
  bnb: {
    walletChainId: 'bnb',
    chainId: 56,
    viemChain: bsc,
    label: 'BNB Chain',
    color: '#f3ba2f',
    defaultRpc: 'https://bsc-dataseed.binance.org',
    rpcEnv: 'BNB_RPC_URL',
  },
};

/** Wallet-chain keys we support for on-chain balance reads. */
export const SUPPORTED_EVM_CHAIN_KEYS = Object.keys(EVM_CHAINS);

/** Resolve our wallet-chain key (`'ethereum'`…) to its full config, or null. */
export function getEvmChainConfig(walletChainKey) {
  return EVM_CHAINS[walletChainKey] ?? null;
}

/** Pick RPC URL: non-empty env override → chain default (Ethereum may use Alchemy). */
export function resolveEvmRpcUrl(chain) {
  const envValue = chain.rpcEnv ? process.env[chain.rpcEnv]?.trim() : '';
  if (envValue) return envValue;

  if (chain.walletChainId === 'ethereum') {
    const apiKey = process.env.ALCHEMY_API_KEY?.trim();
    if (apiKey) return `https://eth-mainnet.g.alchemy.com/v2/${apiKey}`;
  }

  return chain.defaultRpc;
}

/** True if `wallet.chainId` is an EVM chain we can read balances for. */
export function isSupportedEvmChain(walletChainKey) {
  return walletChainKey in EVM_CHAINS;
}
