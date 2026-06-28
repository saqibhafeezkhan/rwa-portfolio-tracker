export {
  isWalletBalanceChain,
  WALLET_BALANCE_CHAIN_IDS,
} from '@/lib/wallet-balance-chains';

import {
  fetchEthereumWalletHoldingsViaAlchemy,
  isAlchemyConfigured,
} from '@/lib/alchemy-balances';
import { fetchEvmWalletHoldings } from '@/lib/evm-balances';
import { isSupportedEvmChain } from '@/lib/evm-chains';
import {
  fetchSolanaWalletHoldingsViaHelius,
  isHeliusConfigured,
} from '@/lib/helius-balances';

import { WALLET_BALANCE_CHAIN_IDS } from '@/lib/wallet-balance-chains';

export async function fetchWalletHoldings(chain, address, options = {}) {
  if (chain === 'solana') {
    if (!isHeliusConfigured()) {
      throw new Error('HELIUS_API_KEY is not set');
    }
    return fetchSolanaWalletHoldingsViaHelius(address, options);
  }

  if (chain === 'ethereum' && isAlchemyConfigured()) {
    return fetchEthereumWalletHoldingsViaAlchemy(address, options);
  }

  if (isSupportedEvmChain(chain)) {
    return fetchEvmWalletHoldings(chain, address, options);
  }

  throw new Error(
    `Unsupported chain "${chain}". Supported: ${WALLET_BALANCE_CHAIN_IDS.join(', ')}.`,
  );
}
