import { isValidEvmAddress } from '@/lib/address-validation';

const UNISWAP_QUOTE_URL = 'https://trade-api.gateway.uniswap.org/v1/quote';

const DEFAULT_SWAPPER = '0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045';

/**
 * Build EXACT_INPUT amount for 1 whole token (10^decimals base units).
 */
export function oneTokenAmountWei(decimals) {
  return (10n ** BigInt(decimals)).toString();
}

/**
 * USD price from Uniswap quote `aggregatedOutputs[0].amount` (USDC, 6 decimals).
 */
export function usdPriceFromAggregatedAmount(amountRaw, usdcDecimals = 6) {
  const raw = BigInt(amountRaw);
  const divisor = 10n ** BigInt(usdcDecimals);
  const whole = raw / divisor;
  const frac = raw % divisor;
  const fracStr = frac.toString().padStart(Number(usdcDecimals), '0').replace(/0+$/, '');
  return fracStr ? `${whole}.${fracStr}` : whole.toString();
}

function pickAggregatedAmount(quoteJson) {
  const agg = quoteJson?.quote?.aggregatedOutputs;
  if (Array.isArray(agg) && agg.length > 0 && agg[0]?.amount != null) {
    return agg[0].amount;
  }
  const outputs = quoteJson?.quote?.orderInfo?.outputs;
  if (Array.isArray(outputs) && outputs.length > 0 && outputs[0]?.startAmount != null) {
    return outputs[0].startAmount;
  }
  return null;
}

/**
 * Fetch USDC-denominated price for one token via Uniswap Trading API quote.
 *
 * @param {object} token — row from `data/uniswap-price-tokens.json` (`tokenIn`, `decimals`)
 * @param {object} opts — chain ids, USDC address, swapper, API key
 * @returns {Promise<string|null>} price string in USD (USDC), e.g. "4529.19"
 */
export async function fetchUniswapUsdPrice(token, opts = {}) {
  const apiKey = opts.apiKey ?? process.env.UNISWAP_API_KEY;
  if (!apiKey) {
    throw new Error('UNISWAP_API_KEY is not set');
  }

  const chainId = opts.chainId ?? 1;
  const tokenOutChainId = opts.tokenOutChainId ?? chainId;
  const tokenOut = opts.tokenOut;
  const tokenOutDecimals = opts.tokenOutDecimals ?? 6;
  const swapper = opts.swapper ?? process.env.UNISWAP_SWAPPER_ADDRESS ?? DEFAULT_SWAPPER;

  if (!tokenOut) throw new Error('tokenOut (USDC) is required');
  if (!isValidEvmAddress(token.tokenIn)) {
    throw new Error(`Invalid tokenIn address: ${token.tokenIn}`);
  }
  if (!isValidEvmAddress(tokenOut)) {
    throw new Error(`Invalid tokenOut address: ${tokenOut}`);
  }

  const body = {
    type: 'EXACT_INPUT',
    amount: oneTokenAmountWei(token.decimals),
    tokenInChainId: chainId,
    tokenOutChainId,
    tokenIn: token.tokenIn,
    tokenOut,
    swapper,
  };

  const res = await fetch(UNISWAP_QUOTE_URL, {
    method: 'POST',
    cache: 'no-store',
    signal: AbortSignal.timeout(15_000),
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'x-universal-router-version': '2.0',
      'x-erc20eth-enabled': 'false',
      'x-permit2-disabled': 'false',
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`Uniswap quote ${res.status}${text ? `: ${text.slice(0, 200)}` : ''}`);
  }

  const json = await res.json();
  const amountRaw = pickAggregatedAmount(json);
  if (amountRaw == null) return null;

  return usdPriceFromAggregatedAmount(amountRaw, tokenOutDecimals);
}
