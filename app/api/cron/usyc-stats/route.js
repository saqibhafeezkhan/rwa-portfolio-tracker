import { runUsycStatsUpdate } from '@/lib/usyc-stats-update';
import { isCronAuthorized } from '@/lib/cron-auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

async function handle(request) {
  if (!isCronAuthorized(request)) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }
  try {
    const result = await runUsycStatsUpdate();
    return Response.json({ ok: true, ...result });
  } catch (e) {
    return Response.json(
      { ok: false, error: e instanceof Error ? e.message : 'USYC stats update failed' },
      { status: 500 },
    );
  }
}

/** Refresh USYC price + yield from Hashnote stats API. */
export async function POST(request) {
  return handle(request);
}

export async function GET(request) {
  return handle(request);
}
