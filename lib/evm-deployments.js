import { readDataJson } from '@/lib/data-manifests';
import { getEvmChainConfig } from '@/lib/evm-chains';
import { isValidEvmAddress } from '@/lib/address-validation';
import { assetChangePctRaw } from '@/lib/ondo-ticker';

const PROTOCOL_META = {
  ondo: {
    name: 'Ondo Finance',
    color: '#60a5fa',
  },
  backed: {
    name: 'xStocks / Backed',
    color: '#a78bfa',
  },
  gold: {
    name: 'Paxos',
    color: '#fbbf24',
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
  centrifuge: {
    name: 'Centrifuge',
    color: '#14b8a6',
  },
};

function protocolForGoldAsset(asset) {
  const ticker = (asset.ticker ?? asset.symbol ?? '').toUpperCase();
  if (ticker === 'XAUT') {
    return { name: 'Tether Gold', color: '#fbbf24' };
  }
  return PROTOCOL_META.gold;
}

/** Map manifest `assetClass` to a HoldingsTable filter category. */
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

function findNetworkForChain(asset, chainId) {
  return (asset.supportedNetworks || []).find(
    (n) => n.chainId === chainId && typeof n.address === 'string',
  );
}

function normalizeEvmAddress(address) {
  return typeof address === 'string' ? address.trim().toLowerCase() : null;
}

function changeToNumber(pctRaw) {
  if (pctRaw == null || pctRaw === '') return null;
  const n = Number.parseFloat(pctRaw);
  return Number.isFinite(n) ? n : null;
}

/**
 * Collect every deployment for `walletChainKey` (one of the keys in
 * `EVM_CHAINS`) across the ondo + backed manifests as a flat list of
 * `{ address, decimals, …metadata }` rows suitable for a viem multicall
 * batch. Dedupes by lowercased contract address.
 *
 * Sources: ondo-assets.json, backed-assets.json, tokenized-gold-assets.json,
 * maple-assets.json, securitize-assets.json, centrifuge-assets.json, circle-usyc-assets.json
 */
export function collectEvmDeployments(walletChainKey) {
  const chain = getEvmChainConfig(walletChainKey);
  if (!chain) return [];

  const ondoManifest = readDataJson('ondo-assets.json');
  const backedManifest = readDataJson('backed-assets.json');
  const goldManifest = readDataJson('tokenized-gold-assets.json');
  const mapleManifest = readDataJson('maple-assets.json');
  const securitizeManifest = readDataJson('securitize-assets.json');
  const centrifugeManifest = readDataJson('centrifuge-assets.json');
  const circleManifest = readDataJson('circle-usyc-assets.json');

  const rows = [];
  const seen = new Set();

  function push(asset, source) {
    const net = findNetworkForChain(asset, chain.chainId);
    if (!net) return;
    const addr = normalizeEvmAddress(net.address);
    if (!addr || !isValidEvmAddress(addr)) {
      console.warn(
        `[manifest] Skipping invalid EVM address for ${asset.symbol ?? asset.ticker} on chain ${chain.chainId}: ${net.address}`,
      );
      return;
    }
    if (seen.has(addr)) return;
    seen.add(addr);

    const protocol = source === 'gold' ? protocolForGoldAsset(asset) : PROTOCOL_META[source];
    const assetClass = asset.assetClass || '';

    rows.push({
      address: addr,
      decimals: Number(net.decimals ?? 18),
      symbol: asset.symbol ?? asset.ticker ?? addr.slice(0, 6),
      ticker: asset.ticker ?? asset.symbol ?? '',
      assetName: asset.assetName ?? asset.ticker ?? asset.symbol ?? '',
      iconSrc: asset.iconSrc ?? null,
      icon: ASSET_CLASS_TO_ICON[assetClass] ?? '◉',
      assetClass,
      category: ASSET_CLASS_TO_CATEGORY[assetClass] ?? 'other',
      protocol: protocol.name,
      protocolColor: protocol.color,
      chain: chain.label,
      chainColor: chain.color,
      chainKey: chain.walletChainId,
      price: Number.parseFloat(asset.price ?? '') || 0,
      change: changeToNumber(assetChangePctRaw(asset)),
      source,
    });
  }

  for (const a of ondoManifest.assets || []) push(a, 'ondo');
  for (const a of backedManifest.assets || []) push(a, 'backed');
  for (const a of goldManifest.assets || []) push(a, 'gold');
  for (const a of mapleManifest.assets || []) push(a, 'maple');
  for (const a of securitizeManifest.assets || []) push(a, 'securitize');
  for (const a of centrifugeManifest.assets || []) push(a, 'centrifuge');
  for (const a of circleManifest.assets || []) push(a, 'circle');

  return rows;
}

/** Map lowercased contract address → deployment row for a given EVM chain. */
export function buildDeploymentIndexByAddress(walletChainKey) {
  const map = new Map();
  for (const d of collectEvmDeployments(walletChainKey)) {
    map.set(d.address.toLowerCase(), d);
  }
  return map;
}

/** Manifest tokens often missed by Alchemy’s first token page. */
export function collectGoldEvmDeployments(walletChainKey) {
  return collectEvmDeployments(walletChainKey).filter(
    (d) =>
      d.source === 'gold' ||
      d.source === 'maple' ||
      d.source === 'securitize' ||
      d.source === 'centrifuge',
  );
}
