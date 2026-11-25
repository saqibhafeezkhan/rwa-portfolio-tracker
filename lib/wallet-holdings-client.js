/**
 * Client-side cache for `/api/wallet/[chain]/balances`.
 * Survives React re-renders and dev HMR remounts (module + window session).
 * Clears on full page reload; fetches only wallets not yet cached this session.
 */

/** @type {Map<string, object | null>} */
const cache = new Map();

/** @type {Map<string, Promise<{ data: object | null, error: string | null }>>} */
const inflight = new Map();

export function walletCacheKey(wallet) {
  const addr =
    wallet.chainId === 'solana'
      ? wallet.address.trim()
      : wallet.address.trim().toLowerCase();
  return `${wallet.chainId}:${addr}`;
}

export function removeWalletFromCache(wallet) {
  const key = walletCacheKey(wallet);
  cache.delete(key);
  inflight.delete(key);
}

export function clearWalletBalancesCache() {
  cache.clear();
  inflight.clear();
}

async function fetchOneWallet(wallet) {
  try {
    const res = await fetch(
      `/api/wallet/${encodeURIComponent(wallet.chainId)}/balances?address=${encodeURIComponent(wallet.address)}`,
      { signal: AbortSignal.timeout(25_000) },
    );

    if (!res.ok) {
      let message = `Request failed (${res.status})`;
      try {
        const body = await res.json();
        if (body?.error) message = body.error;
      } catch {
        /* non-JSON error body */
      }
      return { data: null, error: message };
    }

    return { data: await res.json(), error: null };
  } catch (e) {
    const message =
      e?.name === 'TimeoutError'
        ? 'Wallet balance request timed out'
        : e?.message || 'Network error';
    return { data: null, error: message };
  }
}

/**
 * Return balance API payloads for each wallet, fetching only uncached entries.
 * One wallet failing does not discard the others.
 * @param {Array<{ chainId: string, address: string }>} wallets
 * @returns {Promise<{ results: Array<object | null>, error: string | null }>}
 */
export async function fetchCachedWalletBalances(wallets) {
  const missing = wallets.filter(w => !cache.has(walletCacheKey(w)));
  let firstError = null;

  await Promise.all(
    missing.map(async wallet => {
      const key = walletCacheKey(wallet);
      if (inflight.has(key)) {
        const existing = await inflight.get(key);
        if (!existing.data && existing.error && !firstError) firstError = existing.error;
        return;
      }

      const promise = fetchOneWallet(wallet)
        .then(result => {
          if (result.data) cache.set(key, result.data);
          return result;
        })
        .finally(() => {
          inflight.delete(key);
        });

      inflight.set(key, promise);
      const result = await promise;
      if (!result.data && result.error && !firstError) firstError = result.error;
    }),
  );

  return {
    results: wallets.map(w => cache.get(walletCacheKey(w)) ?? null),
    error: firstError,
  };
}

/** Cached payloads for wallets already loaded this session (no network). */
export function getCachedWalletBalances(wallets) {
  return wallets.map(w => cache.get(walletCacheKey(w)) ?? null);
}

export function allWalletsCached(wallets) {
  return (
    wallets.length > 0 &&
    wallets.every(w => cache.has(walletCacheKey(w)))
  );
}
