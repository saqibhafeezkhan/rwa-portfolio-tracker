import { buildSolanaDeploymentIndexByMint } from '@/lib/solana-deployments';

const HELIUS_BASE = 'https://api.helius.xyz/v1';
const PAGE_LIMIT = 100;

/** Base58 Solana address (rough check). */
export function isValidSolanaAddress(address) {
  if (typeof address !== 'string') return false;
  const t = address.trim();
  if (t.length < 32 || t.length > 44) return false;
  return /^[1-9A-HJ-NP-Za-km-z]+$/.test(t);
}

function heliusBalancesUrl(walletAddress, apiKey, page) {
  const params = new URLSearchParams({
    page: String(page),
    limit: String(PAGE_LIMIT),
    showNative: 'false',
    showNfts: 'false',
    showZeroBalance: 'false',
    'api-key': apiKey,
  });
  return `${HELIUS_BASE}/wallet/${encodeURIComponent(walletAddress)}/balances?${params}`;
}

/**
 * Fetch all SPL token balances for a wallet (paginated, limit 100 per page).
 */
export async function fetchHeliusWalletBalances(walletAddress) {
  const apiKey = process.env.HELIUS_API_KEY;
  if (!apiKey) {
    throw new Error('HELIUS_API_KEY is not set');
  }
  if (!isValidSolanaAddress(walletAddress)) {
    throw new Error('Invalid Solana address');
  }

  const wallet = walletAddress.trim();
  const all = [];
  let page = 1;
  let totalUsdValue = 0;

  while (true) {
    const res = await fetch(heliusBalancesUrl(wallet, apiKey, page), {
      method: 'GET',
      cache: 'no-store',
    });

    if (!res.ok) {
      const text = await res.text().catch(() => '');
      throw new Error(
        `Helius balances ${res.status}${text ? `: ${text.slice(0, 300)}` : ''}`,
      );
    }

    const json = await res.json();
    const batch = json?.balances ?? [];
    all.push(...batch);

    if (typeof json?.totalUsdValue === 'number') {
      totalUsdValue = json.totalUsdValue;
    }

    const hasMore = json?.pagination?.hasMore === true;
    if (!hasMore) break;
    page += 1;
  }

  return { balances: all, totalUsdValue, pagesFetched: page };
}

/**
 * Solana holdings via Helius: match mints to ondo / backed manifests.
 * Uses Helius `balance` and USD value from manifest price or Helius quotes.
 */
export async function fetchSolanaWalletHoldingsViaHelius(
  walletAddress,
  { includeZero = false } = {},
) {
  const { balances: tokens, pagesFetched } = await fetchHeliusWalletBalances(walletAddress);
  const index = buildSolanaDeploymentIndexByMint();

  const rows = [];
  let totalValueUsd = 0;

  for (const t of tokens) {
    const mint = (t.mint || '').trim();
    if (!mint) continue;

    const meta = index.get(mint);
    if (!meta) continue;

    const balance = Number(t.balance);
    if (!Number.isFinite(balance)) continue;
    if (balance === 0 && !includeZero) continue;

    const heliusPrice = Number(t.pricePerToken);
    const heliusUsd = Number(t.usdValue);
    const price =
      meta.price > 0
        ? meta.price
        : Number.isFinite(heliusPrice)
          ? heliusPrice
          : 0;

    let value;
    if (meta.price > 0) {
      value = balance * meta.price;
    } else if (Number.isFinite(heliusUsd)) {
      value = heliusUsd;
    } else if (price > 0) {
      value = balance * price;
    } else {
      value = 0;
    }

    totalValueUsd += value;

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
      price,
      change: meta.change,
      balance,
      value,
      category: meta.category,
      contract: mint,
      decimals: meta.decimals,
      source: meta.source,
      isLive: true,
    });
  }

  rows.sort((a, b) => b.value - a.value);

  const totalForPct = rows.reduce((sum, r) => sum + r.value, 0);
  for (const r of rows) {
    r.pct = totalForPct > 0 ? +(r.value / totalForPct * 100).toFixed(2) : 0;
  }

  return {
    holdings: rows,
    scanned: tokens.length,
    matched: rows.length,
    totalValueUsd,
    chain: 'solana',
    pagesFetched,
    provider: 'helius',
  };
}

export function isHeliusConfigured() {
  return Boolean(process.env.HELIUS_API_KEY);
}
