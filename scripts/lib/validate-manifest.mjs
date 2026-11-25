import {
  isValidEvmAddress,
  isValidSolanaAddress,
} from '../../lib/address-validation.js';

/** EVM chains this app actually scans (see lib/evm-chains.js). */
const EVM_CHAIN_IDS = new Set([1, 56, 137, 8453, 42161]);
const SOLANA_CHAIN_ID = 900;

/**
 * Returns human-readable errors for malformed deployment addresses.
 * @param {Array<object>} assets manifest `assets` array
 * @param {string} manifestName
 */
export function validateManifestAssets(assets, manifestName) {
  const errors = [];

  for (const asset of assets || []) {
    const symbol = asset.symbol ?? asset.ticker ?? '(unknown)';
    for (const net of asset.supportedNetworks || []) {
      if (net.chainId === SOLANA_CHAIN_ID) {
        if (!isValidSolanaAddress(net.address)) {
          errors.push(`${manifestName}: ${symbol} has invalid Solana mint ${net.address}`);
        }
        continue;
      }

      if (EVM_CHAIN_IDS.has(net.chainId) && !isValidEvmAddress(net.address)) {
        errors.push(
          `${manifestName}: ${symbol} has invalid EVM address on chain ${net.chainId}: ${net.address}`,
        );
      }
    }
  }

  return errors;
}
