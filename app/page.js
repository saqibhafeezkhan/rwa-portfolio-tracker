import HomePage from '@/components/HomePage';
import { tickerData, protocols } from '@/lib/data';
import { readTickerSnapshot } from '@/lib/ticker-snapshot';

/** Dynamic because the ticker snapshot and manifests change at runtime. */
export const dynamic = 'force-dynamic';

export default async function Page(props) {
  if (props.params) await props.params;
  if (props.searchParams) await props.searchParams;

  const snapshot = readTickerSnapshot();
  const initialTickerData =
    snapshot?.tickerData?.length > 0 ? snapshot.tickerData : tickerData;

  return (
    <HomePage
      initialTickerData={initialTickerData}
      initialTickerUpdatedAt={snapshot?.lastUpdatedAt ?? null}
      protocols={protocols}
    />
  );
}
