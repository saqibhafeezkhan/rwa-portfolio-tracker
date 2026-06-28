/** Solana deployment tagged with chainId 900 (Jupiter pricing). */
export const JUPITER_SOLANA_CHAIN_ID = 900;

export function getChain900Address(asset) {
  const n = (asset.supportedNetworks || []).find(
    (x) => x.chainId === JUPITER_SOLANA_CHAIN_ID,
  );
  return n?.address ?? null;
}
