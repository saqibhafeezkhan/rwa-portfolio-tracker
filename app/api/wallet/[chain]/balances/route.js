import {
  fetchWalletHoldings,
  isWalletBalanceChain,
  WALLET_BALANCE_CHAIN_IDS,
} from '@/lib/wallet-balances';
import { isValidAddressForChain } from '@/lib/address-validation';
import { rateLimit } from '@/lib/rate-limit';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

function clientKey(request) {
  return request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'local';
}

export async function GET(request, context) {
  const params = await context.params;
  const chain = params?.chain;

  if (!chain || !isWalletBalanceChain(chain)) {
    return Response.json(
      {
        error: `Unsupported chain "${chain ?? ''}". Supported: ${WALLET_BALANCE_CHAIN_IDS.join(', ')}.`,
      },
      { status: 400 },
    );
  }

  const limit = rateLimit(`${chain}:${clientKey(request)}`, {
    limit: 60,
    windowMs: 60_000,
  });
  if (!limit.allowed) {
    return Response.json(
      { error: 'Too many requests' },
      { status: 429, headers: { 'Retry-After': String(limit.retryAfter) } },
    );
  }

  const { searchParams } = new URL(request.url);
  const address = searchParams.get('address');
  const includeZero = searchParams.get('includeZero') === '1';

  if (!address) {
    return Response.json(
      { error: 'Missing required `address` query parameter.' },
      { status: 400 },
    );
  }

  if (!isValidAddressForChain(chain, address)) {
    return Response.json(
      {
        error:
          chain === 'solana'
            ? 'Invalid Solana address.'
            : 'Invalid EVM address (0x followed by 40 hex characters).',
      },
      { status: 400 },
    );
  }

  try {
    const payload = await fetchWalletHoldings(chain, address, { includeZero });
    return Response.json({ address, ...payload });
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Failed to read balances.';
    const status = message.toLowerCase().includes('invalid') ? 400 : 502;
    return Response.json({ error: message }, { status });
  }
}
