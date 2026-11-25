import { runHourlyPriceUpdate } from '@/lib/hourly-price-update';
import { isCronAuthorized } from '@/lib/cron-auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

async function handle(request) {
  if (!isCronAuthorized(request)) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }
  try {
    const result = await runHourlyPriceUpdate();
    return Response.json({ ok: true, ...result });
  } catch (e) {
    return Response.json(
      { ok: false, error: e instanceof Error ? e.message : 'Hourly update failed' },
      { status: 500 },
    );
  }
}

/** Append hourly snapshots + recompute 24h % from rolling buffer (max 24). Schedule hourly (e.g. Vercel Cron). */
export async function POST(request) {
  return handle(request);
}

export async function GET(request) {
  return handle(request);
}
