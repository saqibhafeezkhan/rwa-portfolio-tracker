'use client';

import { useState, useEffect, useMemo } from 'react';
import { tickerData as seedTickerData, protocols } from '@/lib/data';
import {
  buildAllocationFromHoldings,
  buildChainDistributionFromHoldings,
  getPortfolioTotalValue,
  getPortfolioChange24h,
} from '@/lib/portfolio-aggregates';
import { filterTickerMarqueeRows, mergeTickerRows } from '@/lib/ondo-ticker';
import {
  addWallet,
  filterTrackableWallets,
  getDefaultWallets,
  STORAGE_KEY,
} from '@/lib/wallets';
import { isWalletBalanceChain } from '@/lib/wallet-balance-chains';
import {
  allWalletsCached,
  fetchCachedWalletBalances,
  getCachedWalletBalances,
  removeWalletFromCache,
} from '@/lib/wallet-holdings-client';

import Header        from '@/components/Header';
import Ticker        from '@/components/Ticker';
import KpiStrip      from '@/components/KpiStrip';
import AllocationPanel from '@/components/AllocationPanel';
import ChainPanel    from '@/components/ChainPanel';
import ActivityPanel from '@/components/ActivityPanel';
import HoldingsTable from '@/components/HoldingsTable';
import ProtocolCards from '@/components/ProtocolCards';
import AppFooter     from '@/components/AppFooter';
import WalletDrawer  from '@/components/WalletDrawer';

function aggregateLiveHoldings(perWalletResults) {
  const byContract = new Map();
  for (const res of perWalletResults) {
    if (!res || !Array.isArray(res.holdings)) continue;
    for (const h of res.holdings) {
      // Same contract on different chains is a different holding, so key by chain+contract.
      const chainPart = (h.chainKey || h.chain || '').toLowerCase();
      const idPart = (h.contract || h.ticker || h.name || '').toLowerCase();
      const key = `${chainPart}::${idPart}`;
      if (!idPart) continue;
      const prev = byContract.get(key);
      if (prev) {
        prev.balance += h.balance;
        prev.value   += h.value;
      } else {
        byContract.set(key, { ...h });
      }
    }
  }
  const rows = [...byContract.values()].sort((a, b) => b.value - a.value);
  const total = rows.reduce((sum, r) => sum + r.value, 0);
  for (const r of rows) {
    r.pct = total > 0 ? +(r.value / total * 100).toFixed(2) : 0;
  }
  return rows;
}

export default function HomePage() {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [wallets, setWallets]       = useState([]);
  const [hydrated, setHydrated]     = useState(false);
  const [tickerData, setTickerData] = useState(seedTickerData);
  const [liveHoldings, setLiveHoldings] = useState([]);
  const [liveLoading, setLiveLoading]   = useState(false);

  // Live prices: manifest crons (Uniswap, USYC, Centrifuge), then ticker bundle.
  useEffect(() => {
    let cancelled = false;
    async function refreshTicker() {
      try {
        await Promise.all([
          fetch('/api/cron/uniswap-prices').catch(() => {}),
          fetch('/api/cron/usyc-stats').catch(() => {}),
          fetch('/api/cron/centrifuge-prices').catch(() => {}),
        ]);
        if (cancelled) return;
        const res = await fetch('/api/ondo/ticker');
        if (!res.ok) return;
        const j = await res.json();
        if (!cancelled && Array.isArray(j.tickerData)) {
          const next = filterTickerMarqueeRows(j.tickerData);
          if (next.length === 0) return;
          setTickerData((prev) => mergeTickerRows(prev, next));
        }
      } catch {
        /* keep seeded ticker */
      }
    }
    refreshTicker();
    const id = setInterval(refreshTicker, 60_000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, []);

  // Hydrate wallets from localStorage on mount (Solana + EVM only)
  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      try {
        setWallets(filterTrackableWallets(JSON.parse(stored)));
      } catch {
        setWallets(getDefaultWallets());
      }
    } else {
      setWallets(getDefaultWallets());
    }
    setHydrated(true);
  }, []);

  // Persist wallets to localStorage whenever they change
  useEffect(() => {
    if (hydrated) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(wallets));
    }
  }, [wallets, hydrated]);

  // Lock body scroll when drawer is open
  useEffect(() => {
    document.body.style.overflow = drawerOpen ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [drawerOpen]);

  // Live balances: whenever tracked wallets change, fan out to
  // `/api/wallet/[chain]/balances` (Solana → Helius, Ethereum → Alchemy, other EVM → viem).
  const balanceWallets = wallets.filter(w => isWalletBalanceChain(w.chainId));
  const balanceWalletKey = balanceWallets
    .map(w => {
      const addr = w.chainId === 'solana' ? w.address : w.address.toLowerCase();
      return `${w.chainId}:${addr}`;
    })
    .sort()
    .join('|');

  // Balances: fetch on first load / refresh, or only for newly added wallets.
  // Cached per wallet for the session so HMR and re-renders do not re-hit Alchemy/Helius.
  useEffect(() => {
    if (!hydrated) return;
    if (balanceWallets.length === 0) {
      setLiveHoldings([]);
      setLiveLoading(false);
      return;
    }

    if (allWalletsCached(balanceWallets)) {
      setLiveHoldings(aggregateLiveHoldings(getCachedWalletBalances(balanceWallets)));
      setLiveLoading(false);
      return;
    }

    let cancelled = false;
    setLiveLoading(true);
    (async () => {
      try {
        const results = await fetchCachedWalletBalances(balanceWallets);
        if (cancelled) return;
        setLiveHoldings(aggregateLiveHoldings(results));
      } catch {
        if (!cancelled) setLiveHoldings([]);
      } finally {
        if (!cancelled) setLiveLoading(false);
      }
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hydrated, balanceWalletKey]);

  function handleAddWallet(data) {
    const result = addWallet(wallets, data);
    if (result.ok) {
      setWallets(prev => [result.wallet, ...prev]);
    }
    return result;
  }

  function handleRemoveWallet(id) {
    setWallets(prev => {
      const removed = prev.find(w => w.id === id);
      if (removed && isWalletBalanceChain(removed.chainId)) {
        removeWalletFromCache(removed);
      }
      const next = prev.filter(w => w.id !== id);
      const remaining = next.filter(w => isWalletBalanceChain(w.chainId));
      setLiveHoldings(
        aggregateLiveHoldings(getCachedWalletBalances(remaining)),
      );
      return next;
    });
  }

  const { segments: allocationSegments, classCount } = useMemo(
    () => buildAllocationFromHoldings(liveHoldings),
    [liveHoldings],
  );

  const chainDistribution = useMemo(
    () => buildChainDistributionFromHoldings(liveHoldings),
    [liveHoldings],
  );

  const totalPortfolioValue = useMemo(
    () => getPortfolioTotalValue(liveHoldings),
    [liveHoldings],
  );

  const portfolioChange24h = useMemo(
    () => getPortfolioChange24h(liveHoldings),
    [liveHoldings],
  );

  return (
    <>
      <div className="app">
        <Header
          walletCount={wallets.length}
          onOpenDrawer={() => setDrawerOpen(true)}
        />
        <Ticker tickerData={tickerData} />
        <KpiStrip
          totalPortfolioValue={totalPortfolioValue}
          change24h={portfolioChange24h}
        />
        <div className="main-grid">
          <AllocationPanel segments={allocationSegments} classCount={classCount} />
          <ChainPanel chainData={chainDistribution} />
          <ActivityPanel />
        </div>
        <HoldingsTable holdings={liveHoldings} loading={liveLoading} />
        <ProtocolCards protocols={protocols} />
        <AppFooter />
      </div>

      <WalletDrawer
        wallets={wallets}
        isOpen={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        onAdd={handleAddWallet}
        onRemove={handleRemoveWallet}
      />
    </>
  );
}
