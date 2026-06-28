'use client';

import { useState, useEffect } from 'react';

export default function AppFooter() {
  const [time, setTime] = useState('');

  useEffect(() => {
    const tick = () =>
      setTime(new Date().toLocaleTimeString('en-US', {
        hour: '2-digit', minute: '2-digit', second: '2-digit',
      }));
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);

  return (
    <footer>
      <span>RWA Portfolio Tracker · Cross-Chain</span>
      <span>Last indexed: {time}</span>
      <span>Powered by Ondo Finance · Paxos · Tether · Circle · xStocks</span>
    </footer>
  );
}
