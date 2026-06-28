'use client';

import { useLayoutEffect, useMemo, useRef } from 'react';
import { expandTickerForMarquee, filterTickerMarqueeRows } from '@/lib/ondo-ticker';

const PX_PER_SECOND = 72;

function TickerItems({ rows, keySuffix = '' }) {
  return rows.map((t, i) => (
    <span
      key={`${t.name}-${i}${keySuffix}`}
      className="ticker-item"
      title={t.priceSource ? `Price source: ${t.priceSource}` : undefined}
    >
      <span className="ticker-name">{t.name}</span>
      <span className="ticker-price">{t.price}</span>
      <span
        className={`ticker-change ${
          t.change === '—' ? 'flat' : t.up ? 'up' : 'down'
        }`}
      >
        {t.change === '—' ? (
          '—'
        ) : (
          <>
            {t.up ? '▲' : '▼'} {t.change}
          </>
        )}
      </span>
    </span>
  ));
}

export default function Ticker({ tickerData }) {
  const trackRef = useRef(null);
  const groupRef = useRef(null);

  const unique = useMemo(() => filterTickerMarqueeRows(tickerData), [tickerData]);
  const marqueeItems = useMemo(() => expandTickerForMarquee(tickerData), [tickerData]);

  const rowKey = useMemo(
    () => unique.map((t) => `${t.name}:${t.price}:${t.change}`).join('|'),
    [unique],
  );

  useLayoutEffect(() => {
    const track = trackRef.current;
    const group = groupRef.current;
    if (!track || !group || marqueeItems.length === 0) return;

    const setDuration = () => {
      const halfWidth = group.getBoundingClientRect().width;
      if (halfWidth <= 0) return;
      const seconds = Math.max(20, halfWidth / PX_PER_SECOND);
      track.style.animation = 'none';
      void track.offsetWidth;
      track.style.animation = '';
      track.style.animationDuration = `${seconds}s`;
      track.style.animationPlayState = 'running';
    };

    setDuration();

    const ro = new ResizeObserver(setDuration);
    ro.observe(group);

    const onVisible = () => {
      if (document.visibilityState === 'visible') {
        track.style.animationPlayState = 'running';
      }
    };
    document.addEventListener('visibilitychange', onVisible);

    return () => {
      ro.disconnect();
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [rowKey, marqueeItems.length]);

  if (marqueeItems.length === 0) {
    return (
      <div className="ticker-wrap">
        <div className="ticker-track ticker-track--idle">
          <span className="ticker-item">No ticker data</span>
        </div>
      </div>
    );
  }

  return (
    <div className="ticker-wrap">
      <div className="ticker-track" ref={trackRef}>
        <div className="ticker-group" ref={groupRef}>
          <TickerItems rows={marqueeItems} />
        </div>
        <div className="ticker-group" aria-hidden="true">
          <TickerItems rows={marqueeItems} keySuffix="-dup" />
        </div>
      </div>
    </div>
  );
}
