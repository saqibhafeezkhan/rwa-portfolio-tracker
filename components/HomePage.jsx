'use client';

import { useState, useEffect, useMemo, useRef } from 'react';
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
  clearWalletBalancesCache,
  fetchCachedWalletBalances,
  getCachedWalletBalances,
  removeWalletFromCache,
} from '@/lib/wallet-holdings-client';

import Header from '@/components/Header';
import Ticker from '@/components/Ticker';
import KpiStrip from '@/components/KpiStrip';
import AllocationPanel from '@/components/AllocationPanel';
import ChainPanel from '@/components/ChainPanel';
import ActivityPanel from '@/components/ActivityPanel';
import HoldingsTable from '@/components/HoldingsTable';
import ProtocolCards from '@/components/ProtocolCards';
import AppFooter from '@/components/AppFooter';
import WalletDrawer from '@/components/WalletDrawer';

function aggregateLiveHoldings(perWalletResults) {
  const byContract = new Map();

  for (const res of perWalletResults) {
    if (!res || !Array.isArray(res.holdings)) continue;
    for (const h of res.holdings) {
      const chainPart = String(h.chainKey || h.chain || '').toLowerCase();
      const idRaw = String(h.contract || h.ticker || h.name || '');
      if (!idRaw) continue;

      // Same contract on different chains is a different holding, so key by chain+contract.
      // Solana mints are Base58 (case-sensitive); lowercasing them can merge distinct tokens.
      const idPart = chainPart === 'solana' ? idRaw : idRaw.toLowerCase();
      const key = `${chainPart}::${idPart}`;
      const prev = byContract.get(key);

      if (prev) {
        prev.balance += Number(h.balance) || 0;
        prev.value += Number(h.value) || 0;
      } else {
        byContract.set(key, { ...h });
      }
    }
  }

  const rows = [...byContract.values()].sort((a, b) => b.value - a.value);
  const total = rows.reduce((sum, r) => sum + (Number(r.value) || 0), 0);
  for (const r of rows) {
    r.pct = total > 0 ? +((Number(r.value) / total) * 100).toFixed(2) : 0;
  }
  return rows;
}

export default function HomePage({
  initialTickerData = [],
  initialTickerUpdatedAt = null,
  protocols = [],
}) {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [wallets, setWallets] = useState([]);
  const [hydrated, setHydrated] = useState(false);
  const [tickerData, setTickerData] = useState(initialTickerData);
  const [tickerUpdatedAt, setTickerUpdatedAt] = useState(initialTickerUpdatedAt);
  const [liveHoldings, setLiveHoldings] = useState([]);
  const [liveLoading, setLiveLoading] = useState(false);
  const [liveError, setLiveError] = useState(null);
  const [balanceNonce, setBalanceNonce] = useState(0);
  const tickerInFlight = useRef(false);

  // Live prices: fetch immediately on mount, then poll once a minute while visible.
  // Provider refreshes run server-side (after the response), never from the browser.
  useEffect(() => {
    let cancelled = false;

    async function refreshTicker() {
      if (tickerInFlight.current) return;
      tickerInFlight.current = true;
      try {
        const res = await fetch('/api/ondo/ticker', { cache: 'no-store' });
        if (!res.ok) return;
        const j = await res.json();
        if (cancelled || !Array.isArray(j.tickerData)) return;

        const next = filterTickerMarqueeRows(j.tickerData);
        if (next.length === 0) return;

        setTickerData((prev) => mergeTickerRows(prev, next));
        setTickerUpdatedAt(j.lastUpdatedAt ?? new Date().toISOString());
      } catch {
        /* keep the last good ticker */
      } finally {
        tickerInFlight.current = false;
      }
    }

    refreshTicker();
    const id = setInterval(() => {
      if (document.visibilityState === 'visible') refreshTicker();
    }, 60_000);

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
    return () => {
      document.body.style.overflow = '';
    };
  }, [drawerOpen]);

  // Live balances: whenever tracked wallets change, fan out to
  // `/api/wallet/[chain]/balances` (Solana → Helius, Ethereum → Alchemy, other EVM → viem).
  const balanceWallets = useMemo(
    () => wallets.filter(w => isWalletBalanceChain(w.chainId)),
    [wallets],
  );

  const balanceWalletKey = useMemo(
    () =>
      balanceWallets
        .map(w => {
          const addr = w.chainId === 'solana' ? w.address : w.address.toLowerCase();
          return `${w.chainId}:${addr}`;
        })
        .sort()
        .join('|'),
    [balanceWallets],
  );

  // Balances: fetch on first load / refresh, or only for newly added wallets.
  // Cached per wallet for the session so HMR and re-renders do not re-hit Alchemy/Helius.
  useEffect(() => {
    if (!hydrated) return;

    if (balanceWallets.length === 0) {
      setLiveHoldings([]);
      setLiveLoading(false);
      setLiveError(null);
      return undefined;
    }

    if (allWalletsCached(balanceWallets)) {
      setLiveHoldings(aggregateLiveHoldings(getCachedWalletBalances(balanceWallets)));
      setLiveLoading(false);
      setLiveError(null);
      return undefined;
    }

    let cancelled = false;
    setLiveLoading(true);
    setLiveError(null);

    (async () => {
      try {
        const { results, error } = await fetchCachedWalletBalances(balanceWallets);
        if (cancelled) return;
        setLiveHoldings(aggregateLiveHoldings(results));
        setLiveError(error);
      } catch (e) {
        if (!cancelled) {
          setLiveError(e instanceof Error ? e.message : 'Failed to load balances');
        }
      } finally {
        if (!cancelled) setLiveLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [hydrated, balanceWalletKey, balanceNonce]);

  // Per-wallet summaries for the drawer, derived from the same on-chain payloads.
  const walletStats = useMemo(() => {
    const map = {};
    for (const wallet of wallets) {
      if (!isWalletBalanceChain(wallet.chainId)) continue;
      const payload = getCachedWalletBalances([wallet])[0];
      const items = Array.isArray(payload?.holdings) ? payload.holdings : [];
      map[wallet.id] = {
        loaded: Boolean(payload),
        value: getPortfolioTotalValue(items),
        assets: items.length,
        change: getPortfolioChange24h(items),
      };
    }
    return map;
  }, [wallets, liveHoldings]);

  function handleAddWallet(data) {
    const result = addWallet(wallets, data);
    if (result.ok) {
      setWallets(prev => [result.wallet, ...prev]);
    }
    return result;
  }

  function handleRemoveWallet(id) {
    const removed = wallets.find(w => w.id === id);
    if (removed && isWalletBalanceChain(removed.chainId)) {
      removeWalletFromCache(removed);
    }

    const next = wallets.filter(w => w.id !== id);
    setWallets(next);

    const remaining = next.filter(w => isWalletBalanceChain(w.chainId));
    setLiveHoldings(aggregateLiveHoldings(getCachedWalletBalances(remaining)));
  }

  function retryBalances() {
    clearWalletBalancesCache();
    setLiveError(null);
    setBalanceNonce(n => n + 1);
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
          walletCount={wallets.length}
          holdingsCount={liveHoldings.length}
          chainData={chainDistribution}
        />
        <div className="main-grid">
          <AllocationPanel segments={allocationSegments} classCount={classCount} />
          <ChainPanel chainData={chainDistribution} />
          <ActivityPanel
            lastUpdatedAt={tickerUpdatedAt}
            walletCount={wallets.length}
            holdingsCount={liveHoldings.length}
            loading={liveLoading}
          />
        </div>
        <HoldingsTable
          holdings={liveHoldings}
          loading={liveLoading}
          error={liveError}
          onRetry={retryBalances}
          hasWallets={wallets.length > 0}
        />
        <ProtocolCards protocols={protocols} />
        <AppFooter lastUpdatedAt={tickerUpdatedAt} />
      </div>

      <WalletDrawer
        wallets={wallets}
        walletStats={walletStats}
        isOpen={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        onAdd={handleAddWallet}
        onRemove={handleRemoveWallet}
      />
    </>
  );
}
