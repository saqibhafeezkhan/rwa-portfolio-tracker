import { readDataJson } from '@/lib/data-manifests';
import { JUPITER_SOLANA_CHAIN_ID } from '@/lib/chain-utils';

const PROTOCOL_META = {
  ondo: {
    name: 'Ondo Finance',
    color: '#60a5fa',
  },
  backed: {
    name: 'xStocks / Backed',
    color: '#a78bfa',
  },
  circle: {
    name: 'Circle',
    color: '#2775ca',
  },
  maple: {
    name: 'Maple Finance',
    color: '#22c55e',
  },
  securitize: {
    name: 'Securitize',
    color: '#4f46e5',
  },
};

const ASSET_CLASS_TO_CATEGORY = {
  'cash-equivalent': 'tbills',
  'fixed-income': 'bonds',
  'real-estate-assets': 'realestate',
  equities: 'equities',
  commodities: 'commodities',
  'crypto-native-assets': 'crypto',
};

const ASSET_CLASS_TO_ICON = {
  'cash-equivalent': '🔵',
  'fixed-income': '⬡',
  'real-estate-assets': '🏠',
  equities: '📈',
  commodities: '🟡',
  'crypto-native-assets': '◈',
};

const SOLANA_CHAIN_META = {
  label: 'Solana',
  color: '#14f195',
  chainKey: 'solana',
};

function findSolanaNetwork(asset) {
  return (asset.supportedNetworks || []).find(
    (n) => n.chainId === JUPITER_SOLANA_CHAIN_ID && typeof n.address === 'string',
  );
}

/** Map Solana mint address → deployment metadata (ondo, backed, circle, maple, securitize manifests). */
export function buildSolanaDeploymentIndexByMint() {
  const ondoManifest = readDataJson('ondo-assets.json');
  const backedManifest = readDataJson('backed-assets.json');
  const circleManifest = readDataJson('circle-usyc-assets.json');
  const mapleManifest = readDataJson('maple-assets.json');
  const securitizeManifest = readDataJson('securitize-assets.json');

  const map = new Map();
  const seen = new Set();

  function push(asset, source) {
    const net = findSolanaNetwork(asset);
    if (!net) return;
    const mint = net.address.trim();
    if (!mint || seen.has(mint)) return;
    seen.add(mint);

    const protocol = PROTOCOL_META[source];
    const assetClass = asset.assetClass || '';

    map.set(mint, {
      mint,
      decimals: Number(net.decimals ?? 9),
      symbol: asset.symbol ?? asset.ticker ?? mint.slice(0, 6),
      ticker: asset.ticker ?? asset.symbol ?? '',
      assetName: asset.assetName ?? asset.ticker ?? asset.symbol ?? '',
      iconSrc: asset.iconSrc ?? null,
      icon: ASSET_CLASS_TO_ICON[assetClass] ?? '◉',
      assetClass,
      category: ASSET_CLASS_TO_CATEGORY[assetClass] ?? 'other',
      protocol: protocol.name,
      protocolColor: protocol.color,
      chain: SOLANA_CHAIN_META.label,
      chainColor: SOLANA_CHAIN_META.color,
      chainKey: SOLANA_CHAIN_META.chainKey,
      price: Number.parseFloat(asset.price ?? '') || 0,
      change: Number.parseFloat(asset.priceChangePct24h ?? '') || 0,
      source,
    });
  }

  for (const a of ondoManifest.assets || []) push(a, 'ondo');
  for (const a of backedManifest.assets || []) push(a, 'backed');
  for (const a of circleManifest.assets || []) push(a, 'circle');
  for (const a of mapleManifest.assets || []) push(a, 'maple');
  for (const a of securitizeManifest.assets || []) push(a, 'securitize');

  return map;
}
