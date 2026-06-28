import { buildLiveTickerPayload } from '@/lib/markets-ticker';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const payload = await buildLiveTickerPayload();
    return Response.json(payload);
  } catch (e) {
    return Response.json(
      { error: e instanceof Error ? e.message : 'Ticker build failed' },
      { status: 502 },
    );
  }
}
