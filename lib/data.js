import ondoAssetsManifest from '@/data/ondo-assets.json';
import backedAssetsManifest from '@/data/backed-assets.json';
import goldAssetsManifest from '@/data/tokenized-gold-assets.json';
import mapleAssetsManifest from '@/data/maple-assets.json';
import securitizeAssetsManifest from '@/data/securitize-assets.json';
import centrifugeAssetsManifest from '@/data/centrifuge-assets.json';
import circleUsycManifest from '@/data/circle-usyc-assets.json';
import { assetToTickerRow, filterTickerMarqueeRows } from '@/lib/ondo-ticker';
import { formatUsycEstimatedYield } from '@/lib/usyc-format';

const usycYieldDisplay = formatUsycEstimatedYield(circleUsycManifest);

// ── TICKER DATA (seed manifests; live via /api/ondo/ticker) ─────────────────────
function buildSeedTickerData() {
  const rows = [
    ...ondoAssetsManifest.assets.map((a) => assetToTickerRow(a, { priceSource: 'ondo' })),
    ...backedAssetsManifest.assets.map((a) =>
      assetToTickerRow(a, { priceSource: 'backed' }),
    ),
    ...goldAssetsManifest.assets.map((a) =>
      assetToTickerRow(a, { priceSource: 'gold' }),
    ),
    ...mapleAssetsManifest.assets.map((a) =>
      assetToTickerRow(a, { priceSource: 'maple' }),
    ),
    ...securitizeAssetsManifest.assets.map((a) =>
      assetToTickerRow(a, { priceSource: 'securitize' }),
    ),
    ...centrifugeAssetsManifest.assets.map((a) =>
      assetToTickerRow(a, { priceSource: 'centrifuge' }),
    ),
    ...circleUsycManifest.assets.map((a) =>
      assetToTickerRow(a, { priceSource: 'circle' }),
    ),
  ];
  return filterTickerMarqueeRows(rows);
}

export const tickerData = buildSeedTickerData();

const ondoAssetCount = ondoAssetsManifest.assets?.length ?? 0;
const backedAssetCount = backedAssetsManifest.assets?.length ?? 0;

function countManifestAssetsByTicker(manifest, ticker) {
  const key = ticker.toUpperCase();
  return (manifest.assets ?? []).filter(
    (a) => (a.ticker ?? a.symbol ?? '').toUpperCase() === key,
  ).length;
}

const paxosAssetCount = countManifestAssetsByTicker(goldAssetsManifest, 'PAXG');
const tetherGoldAssetCount = countManifestAssetsByTicker(goldAssetsManifest, 'XAUt');
const mapleAssetCount = mapleAssetsManifest.assets?.length ?? 0;
const securitizeAssetCount = securitizeAssetsManifest.assets?.length ?? 0;
const centrifugeAssetCount = centrifugeAssetsManifest.assets?.length ?? 0;
const circleUsycAssetCount = circleUsycManifest.assets?.length ?? 0;

// ── HOLDINGS DATA (Ondo Finance · Paxos · xStocks only) ───────────────────────
export const holdings = [
  {
    icon: '🔵', name: 'OUSG',           ticker: 'OUSG',
    protocol: 'Ondo Finance',    protocolColor: '#60a5fa',
    chain: 'Ethereum',           chainColor: '#818cf8',
    price: 107.42, change: +0.08, balance: 3840,  value: 412493, apy: 5.31, pct: 20.9,
    category: 'tbills',
  },
  {
    icon: '🌿', name: 'USDY',           ticker: 'USDY',
    protocol: 'Ondo Finance',    protocolColor: '#60a5fa',
    chain: 'Solana',             chainColor: '#14f195',
    price: 1.041,  change: +0.04, balance: 415000, value: 432015, apy: 5.02, pct: 21.9,
    category: 'tbills',
  },
  {
    icon: '🥇', name: 'Paxos Gold',    ticker: 'PAXG',
    protocol: 'Paxos',          protocolColor: '#fbbf24',
    chain: 'Ethereum',           chainColor: '#818cf8',
    price: 4534.57, change: -0.08, balance: 152.4, value: 691068, apy: 0, pct: 35.1,
    category: 'commodities',
  },
  {
    icon: '📈',  name: 'xAAPL',        ticker: 'xAAPL',
    protocol: 'xStocks/Backed',  protocolColor: '#a78bfa',
    chain: 'Solana',             chainColor: '#14f195',
    price: 214.38, change: +1.24, balance: 820,    value: 175792, apy: 0,    pct: 8.9,
    category: 'equities',
  },
  {
    icon: '📈',  name: 'xTSLA',        ticker: 'xTSLA',
    protocol: 'xStocks/Backed',  protocolColor: '#a78bfa',
    chain: 'Solana',             chainColor: '#14f195',
    price: 182.90, change: -0.88, balance: 680,    value: 124372, apy: 0,    pct: 6.3,
    category: 'equities',
  },
  {
    icon: '📈',  name: 'xNVDA',        ticker: 'xNVDA',
    protocol: 'xStocks/Backed',  protocolColor: '#a78bfa',
    chain: 'Solana',             chainColor: '#14f195',
    price: 892.14, change: +2.14, balance: 148,    value: 132037, apy: 0,    pct: 6.7,
    category: 'equities',
  },
];

// ── PROTOCOL CARDS (one box per protocol: stats + yield) ───────────────────────
export const protocols = [
  {
    logo: '🔵',
    name: 'Ondo Finance',
    chains: 'Ethereum · Solana · Polygon',
    assets: ondoAssetCount,
    products: 'OUSG · USDY',
    apy: '3.43–3.55%',
    apyColor: 'var(--gold)',
    apyGlow: 'rgba(201,168,76,0.4)',
    label: 'T-Bill & dollar yield',
  },
  {
    logo: '🥇',
    name: 'Paxos',
    chains: 'Ethereum',
    assets: paxosAssetCount,
    products: 'PAXG',
    apy: 'Gold',
    apyColor: 'var(--gold)',
    apyGlow: 'rgba(251,191,36,0.4)',
    label: 'Tokenized gold',
  },
  {
    logo: '₮',
    name: 'Tether Gold',
    chains: 'Ethereum',
    assets: tetherGoldAssetCount,
    products: 'XAUt',
    apy: 'Gold',
    apyColor: 'var(--teal)',
    apyGlow: 'rgba(45,212,191,0.4)',
    label: 'Tokenized gold',
  },
  {
    logo: '🍁',
    name: 'Maple Finance',
    chains: 'Ethereum · Solana',
    assets: mapleAssetCount,
    products: 'syrupUSDC · syrupUSDT',
    apy: 'Yield',
    apyColor: '#22c55e',
    apyGlow: 'rgba(34,197,94,0.4)',
    label: 'Institutional lending vaults',
  },
  {
    logo: '⬡',
    name: 'Securitize',
    chains: 'Ethereum · Solana',
    assets: securitizeAssetCount,
    products: 'BUIDL · VBILL · HLSCOPE',
    apy: 'Private markets',
    apyColor: '#4f46e5',
    apyGlow: 'rgba(79,70,229,0.4)',
    label: 'Tokenized fund shares',
  },
  {
    logo: '⚙',
    name: 'Centrifuge',
    chains: 'Ethereum',
    assets: centrifugeAssetCount,
    products: 'JTRSY · JAAA · ACRDX',
    apy: 'Fund NAV',
    apyColor: '#14b8a6',
    apyGlow: 'rgba(20,184,166,0.4)',
    label: 'Tokenized credit & treasury',
  },
  {
    logo: '◎',
    name: 'Circle',
    chains: 'Ethereum · Solana',
    assets: circleUsycAssetCount,
    products: 'USYC',
    apy: usycYieldDisplay ?? '—',
    apyColor: '#2775ca',
    apyGlow: 'rgba(39,117,202,0.4)',
    label: 'Tokenized T-bill yield',
  },
  {
    logo: '📈',
    name: 'xStocks (Backed)',
    chains: 'Solana · Token-2022',
    assets: backedAssetCount,
    products: 'Tokenized equities',
    apy: 'NAV',
    apyColor: 'var(--purple)',
    apyGlow: 'rgba(167,139,250,0.4)',
    label: 'Market-linked shares',
  },
];

// ── CHAIN DISTRIBUTION ────────────────────────────────────────────────────────
export const chainData = [
  { name: 'Ethereum',  pct: 56, usd: '$1,105,693', color: 'linear-gradient(90deg,#818cf8,#6366f1)',  textColor: '#818cf8' },
  { name: 'Solana',    pct: 44, usd: '$864,216',   color: 'linear-gradient(90deg,#14f195,#9945ff)',  textColor: '#14f195' },
];
