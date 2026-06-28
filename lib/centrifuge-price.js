const CENTRIFUGE_PRICE_BASE = 'https://api.centrifuge.io/tokens';

export function centrifugePriceUrl(tokenAddress) {
  return `${CENTRIFUGE_PRICE_BASE}/${tokenAddress}/price`;
}

/**
 * Fetch USD price for an Ethereum token from the Centrifuge API.
 * Response shape: `{ "result": "1.104707191369434237" }`
 */
export async function fetchCentrifugeUsdPrice(tokenAddress) {
  const res = await fetch(centrifugePriceUrl(tokenAddress), {
    cache: 'no-store',
    headers: { Accept: 'application/json' },
  });

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(
      `Centrifuge price ${res.status}${text ? `: ${text.slice(0, 200)}` : ''}`,
    );
  }

  const json = await res.json();
  const result = json?.result;
  if (result == null || result === '' || !Number.isFinite(parseFloat(result))) {
    throw new Error('Centrifuge price response missing result');
  }

  return String(result);
}
