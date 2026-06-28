import { runCentrifugePriceUpdate } from '@/lib/centrifuge-price-update';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function authorized(request) {
  if (process.env.NODE_ENV === 'development' && !process.env.CRON_SECRET) {
    return true;
  }
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const auth = request.headers.get('authorization');
  return auth === `Bearer ${secret}`;
}

async function handle(request) {
  if (!authorized(request)) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }
  try {
    const result = await runCentrifugePriceUpdate();
    return Response.json({ ok: true, ...result });
  } catch (e) {
    return Response.json(
      {
        ok: false,
        error: e instanceof Error ? e.message : 'Centrifuge price update failed',
      },
      { status: 500 },
    );
  }
}

/** Refresh Centrifuge token prices (max 2 Centrifuge API calls per minute). */
export async function POST(request) {
  return handle(request);
}

export async function GET(request) {
  return handle(request);
}
