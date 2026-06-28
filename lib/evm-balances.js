import {
  createPublicClient,
  http,
  isAddress,
  getAddress,
  formatUnits,
} from 'viem';

import {
  collectEvmDeployments,
  collectGoldEvmDeployments,
} from '@/lib/evm-deployments';
import {
  MULTICALL3_ADDRESS,
  getEvmChainConfig,
  resolveEvmRpcUrl,
  SUPPORTED_EVM_CHAIN_KEYS,
} from '@/lib/evm-chains';

const ERC20_BALANCE_OF_ABI = [
  {
    type: 'function',
    name: 'balanceOf',
    stateMutability: 'view',
    inputs: [{ name: 'owner', type: 'address' }],
    outputs: [{ name: '', type: 'uint256' }],
  },
];

/** One viem client per chain, cached for the lifetime of the process. */
const clientCache = new Map();

/**
 * Public client for `chain`, configured to auto-batch every read into a
 * single Multicall3 call (`batch: { multicall: true }`) — drastically
 * reduces RPC round-trips when fanning out balanceOf across many contracts.
 */
export function getEvmClient(walletChainKey) {
  if (clientCache.has(walletChainKey)) return clientCache.get(walletChainKey);

  const chain = getEvmChainConfig(walletChainKey);
  if (!chain) throw new Error(`Unsupported EVM chain: ${walletChainKey}`);

  const rpcUrl = resolveEvmRpcUrl(chain);

  const client = createPublicClient({
    chain: chain.viemChain,
    transport: http(rpcUrl, {
      batch: true,
      timeout: 20_000,
      retryCount: 2,
    }),
    batch: {
      multicall: {
        wait: 16,
      },
    },
  });

  clientCache.set(walletChainKey, client);
  return client;
}

function deploymentToHoldingRow(d, rawBig, includeZero) {
  if (rawBig === 0n && !includeZero) return null;

  const balance = Number.parseFloat(formatUnits(rawBig, d.decimals));
  if (!Number.isFinite(balance)) return null;
  if (balance === 0 && !includeZero) return null;

  const value = balance * d.price;

  return {
    icon: d.icon,
    iconSrc: d.iconSrc,
    name: d.assetName || d.ticker || d.symbol,
    ticker: d.ticker || d.symbol,
    protocol: d.protocol,
    protocolColor: d.protocolColor,
    chain: d.chain,
    chainColor: d.chainColor,
    chainKey: d.chainKey,
    price: d.price,
    change: d.change,
    balance,
    value,
    category: d.category,
    contract: d.address,
    decimals: d.decimals,
    source: d.source,
    isLive: true,
  };
}

/**
 * Batch-read `balanceOf(wallet)` for `deployments` via Multicall3.
 * Returns holdings rows plus how many contracts were scanned.
 */
export async function fetchBalancesForDeployments(
  walletChainKey,
  walletAddress,
  deployments,
  { includeZero = false } = {},
) {
  if (!deployments.length) {
    return { rows: [], scanned: 0, totalValueUsd: 0 };
  }

  const chain = getEvmChainConfig(walletChainKey);
  if (!chain) {
    throw new Error(
      `Unsupported EVM chain "${walletChainKey}". Supported: ${SUPPORTED_EVM_CHAIN_KEYS.join(', ')}.`,
    );
  }
  if (!isAddress(walletAddress)) {
    throw new Error(`Invalid ${chain.label} address`);
  }

  const owner = getAddress(walletAddress);
  const client = getEvmClient(walletChainKey);

  const contracts = deployments.map((d) => ({
    address: getAddress(d.address),
    abi: ERC20_BALANCE_OF_ABI,
    functionName: 'balanceOf',
    args: [owner],
  }));

  const results = await client.multicall({
    contracts,
    multicallAddress: MULTICALL3_ADDRESS,
    allowFailure: true,
    batchSize: 1024,
  });

  const rows = [];
  let totalValueUsd = 0;

  for (let i = 0; i < deployments.length; i++) {
    const d = deployments[i];
    const r = results[i];
    if (!r || r.status !== 'success') continue;

    const raw = r.result;
    const rawBig = typeof raw === 'bigint' ? raw : BigInt(raw ?? 0);
    const row = deploymentToHoldingRow(d, rawBig, includeZero);
    if (!row) continue;

    totalValueUsd += row.value;
    rows.push(row);
  }

  rows.sort((a, b) => b.value - a.value);
  return { rows, scanned: deployments.length, totalValueUsd };
}

function finalizeHoldingsPayload(rows, chain, scanned, extra = {}) {
  const totalValueUsd = rows.reduce((sum, r) => sum + r.value, 0);
  const totalForPct = totalValueUsd;

  for (const r of rows) {
    r.pct = totalForPct > 0 ? +(r.value / totalForPct * 100).toFixed(2) : 0;
  }

  return {
    holdings: rows,
    scanned,
    totalValueUsd,
    chain: chain.walletChainId,
    chainId: chain.chainId,
    ...extra,
  };
}

/**
 * Direct `balanceOf` reads for manifest tokens Alchemy often skips (gold, maple, securitize).
 * Used as a fallback when Alchemy token lists miss those balances.
 */
export async function fetchGoldWalletHoldingsViaViem(
  walletChainKey,
  walletAddress,
  { includeZero = false } = {},
) {
  const chain = getEvmChainConfig(walletChainKey);
  if (!chain) {
    throw new Error(
      `Unsupported EVM chain "${walletChainKey}". Supported: ${SUPPORTED_EVM_CHAIN_KEYS.join(', ')}.`,
    );
  }

  const deployments = collectGoldEvmDeployments(walletChainKey);
  const { rows, scanned } = await fetchBalancesForDeployments(
    walletChainKey,
    walletAddress,
    deployments,
    { includeZero },
  );

  return finalizeHoldingsPayload(rows, chain, scanned, {
    provider: 'viem-gold',
  });
}

/**
 * Batch-read `balanceOf(wallet)` for every token in the ondo + backed
 * manifests that has a deployment on `walletChainKey`, using viem's
 * `multicall`. Each call is `allowFailure: true` so one non-ERC-20
 * contract can't sink the batch.
 *
 * Returns rows in HoldingsTable shape (with on-chain balance + USD value),
 * plus a small summary block. By default zero-balance rows are filtered out.
 */
export async function fetchEvmWalletHoldings(
  walletChainKey,
  walletAddress,
  { includeZero = false } = {},
) {
  const chain = getEvmChainConfig(walletChainKey);
  if (!chain) {
    throw new Error(
      `Unsupported EVM chain "${walletChainKey}". Supported: ${SUPPORTED_EVM_CHAIN_KEYS.join(', ')}.`,
    );
  }

  const deployments = collectEvmDeployments(walletChainKey);
  if (deployments.length === 0) {
    return {
      holdings: [],
      scanned: 0,
      totalValueUsd: 0,
      chain: chain.walletChainId,
      chainId: chain.chainId,
    };
  }

  const { rows, scanned } = await fetchBalancesForDeployments(
    walletChainKey,
    walletAddress,
    deployments,
    { includeZero },
  );

  return finalizeHoldingsPayload(rows, chain, scanned);
}
