import { after } from 'next/server';
import { buildLiveTickerPayload } from '@/lib/markets-ticker';
import { refreshMarketPrices } from '@/lib/market-refresh';
import { rateLimit } from '@/lib/rate-limit';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

function clientKey(request) {
  return request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'local';
}

export async function GET(request) {
  const limit = rateLimit(`ticker:${clientKey(request)}`, {
    limit: 120,
    windowMs: 60_000,
  });
  if (!limit.allowed) {
    return Response.json(
      { error: 'Too many requests' },
      { status: 429, headers: { 'Retry-After': String(limit.retryAfter) } },
    );
  }

  try {
    const payload = await buildLiveTickerPayload();

    // Provider-priced manifests (Uniswap / Centrifuge / USYC) refresh in the
    // background at most every 5 minutes; never blocks this response.
    after(() => refreshMarketPrices().catch(() => {}));

    return Response.json(payload, {
      headers: {
        'Cache-Control': 'private, max-age=30, stale-while-revalidate=60',
      },
    });
  } catch (e) {
    return Response.json(
      { error: e instanceof Error ? e.message : 'Ticker build failed' },
      { status: 502 },
    );
  }
}
