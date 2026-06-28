import { isAddress, getAddress, formatUnits } from 'viem';

import { buildDeploymentIndexByAddress } from '@/lib/evm-deployments';
import { fetchGoldWalletHoldingsViaViem } from '@/lib/evm-balances';

const ALCHEMY_BALANCES_URL = (apiKey) =>
  `https://api.g.alchemy.com/data/v1/${apiKey}/assets/tokens/balances/by-address`;

/** Alchemy Data API network id per wallet chain key. */
const ALCHEMY_NETWORK_BY_CHAIN = {
  ethereum: 'eth-mainnet',
};

function parseHexBalance(hex) {
  if (hex == null || hex === '' || hex === '0x') return 0n;
  try {
    return BigInt(hex);
  } catch {
    return 0n;
  }
}

function holdingContractKey(row) {
  return (row.contract || '').trim().toLowerCase();
}

/** Merge Alchemy rows with viem gold fallback; viem fills gaps only. */
export function mergeHoldingsByContract(primary, supplemental) {
  const map = new Map();
  for (const row of primary) {
    const key = holdingContractKey(row);
    if (key) map.set(key, row);
  }
  for (const row of supplemental) {
    const key = holdingContractKey(row);
    if (key && !map.has(key)) map.set(key, row);
  }
  return [...map.values()].sort((a, b) => b.value - a.value);
}

function finalizeMergedHoldings(rows, { scanned, goldFallbackScanned, provider }) {
  const totalValueUsd = rows.reduce((sum, r) => sum + r.value, 0);
  for (const r of rows) {
    r.pct = totalValueUsd > 0 ? +(r.value / totalValueUsd * 100).toFixed(2) : 0;
  }

  return {
    holdings: rows,
    scanned,
    matched: rows.length,
    goldFallbackScanned,
    totalValueUsd,
    chain: 'ethereum',
    chainId: 1,
    provider,
  };
}

/**
 * Fetch ERC-20 balances for one address on one Alchemy network.
 * @returns {Promise<Array<{ tokenAddress: string, tokenBalance: string, network: string, address: string }>>}
 */
export async function fetchAlchemyTokenBalances(walletAddress, network = 'eth-mainnet') {
  const apiKey = process.env.ALCHEMY_API_KEY;
  if (!apiKey) {
    throw new Error('ALCHEMY_API_KEY is not set');
  }
  if (!isAddress(walletAddress)) {
    throw new Error('Invalid Ethereum address');
  }

  const res = await fetch(ALCHEMY_BALANCES_URL(apiKey), {
    method: 'POST',
    cache: 'no-store',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      addresses: [
        {
          address: getAddress(walletAddress),
          networks: [network],
        },
      ],
      includeNativeTokens: false,
      includeErc20Tokens: true,
    }),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(
      `Alchemy balances ${res.status}${text ? `: ${text.slice(0, 300)}` : ''}`,
    );
  }

  const json = await res.json();
  return json?.data?.tokens ?? [];
}

function alchemyTokensToHoldings(tokens, index, { includeZero = false } = {}) {
  const rows = [];

  for (const t of tokens) {
    const contract = (t.tokenAddress || '').toLowerCase();
    if (!contract) continue;

    const meta = index.get(contract);
    if (!meta) continue;

    const rawBig = parseHexBalance(t.tokenBalance);
    if (rawBig === 0n && !includeZero) continue;

    const balance = Number.parseFloat(formatUnits(rawBig, meta.decimals));
    if (!Number.isFinite(balance)) continue;
    if (balance === 0 && !includeZero) continue;

    const value = balance * meta.price;

    rows.push({
      icon: meta.icon,
      iconSrc: meta.iconSrc,
      name: meta.assetName || meta.ticker || meta.symbol,
      ticker: meta.ticker || meta.symbol,
      protocol: meta.protocol,
      protocolColor: meta.protocolColor,
      chain: meta.chain,
      chainColor: meta.chainColor,
      chainKey: meta.chainKey,
      price: meta.price,
      change: meta.change,
      balance,
      value,
      category: meta.category,
      contract: meta.address,
      decimals: meta.decimals,
      source: meta.source,
      isLive: true,
    });
  }

  return rows;
}

/**
 * Ethereum holdings via Alchemy, with a viem `balanceOf` fallback for PAXG / XAUt /
 * syrup* / Securitize fund tokens (Alchemy only returns the first page of wallet tokens).
 */
export async function fetchEthereumWalletHoldingsViaAlchemy(
  walletAddress,
  { includeZero = false } = {},
) {
  const network = ALCHEMY_NETWORK_BY_CHAIN.ethereum;
  const tokens = await fetchAlchemyTokenBalances(walletAddress, network);
  const index = buildDeploymentIndexByAddress('ethereum');

  const alchemyRows = alchemyTokensToHoldings(tokens, index, { includeZero });

  let goldFallbackScanned = 0;
  let goldRows = [];

  try {
    const goldPayload = await fetchGoldWalletHoldingsViaViem(
      'ethereum',
      walletAddress,
      { includeZero },
    );
    goldFallbackScanned = goldPayload.scanned ?? 0;
    goldRows = goldPayload.holdings ?? [];
  } catch {
    /* keep Alchemy-only result if RPC fallback fails */
  }

  const merged = mergeHoldingsByContract(alchemyRows, goldRows);

  return finalizeMergedHoldings(merged, {
    scanned: tokens.length,
    goldFallbackScanned,
    provider: goldRows.length > 0 ? 'alchemy+viem-gold' : 'alchemy',
  });
}

export function isAlchemyConfigured() {
  return Boolean(process.env.ALCHEMY_API_KEY);
}
