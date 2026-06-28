/**
 * Client-side cache for `/api/wallet/[chain]/balances`.
 * Survives React re-renders and dev HMR remounts (module + window session).
 * Clears on full page reload; fetches only wallets not yet cached this session.
 */

/** @type {Map<string, object | null>} */
const cache = new Map();

/** @type {Map<string, Promise<object | null>>} */
const inflight = new Map();

export function walletCacheKey(wallet) {
  const addr =
    wallet.chainId === 'solana'
      ? wallet.address.trim()
      : wallet.address.trim().toLowerCase();
  return `${wallet.chainId}:${addr}`;
}

export function removeWalletFromCache(wallet) {
  cache.delete(walletCacheKey(wallet));
  inflight.delete(walletCacheKey(wallet));
}

async function fetchOneWallet(wallet) {
  const res = await fetch(
    `/api/wallet/${encodeURIComponent(wallet.chainId)}/balances?address=${encodeURIComponent(wallet.address)}`,
  );
  return res.ok ? res.json() : null;
}

/**
 * Return balance API payloads for each wallet, fetching only uncached entries.
 * @param {Array<{ chainId: string, address: string }>} wallets
 */
export async function fetchCachedWalletBalances(wallets) {
  const missing = wallets.filter(w => !cache.has(walletCacheKey(w)));

  await Promise.all(
    missing.map(async wallet => {
      const key = walletCacheKey(wallet);
      if (inflight.has(key)) {
        await inflight.get(key);
        return;
      }
      const promise = fetchOneWallet(wallet)
        .then(data => {
          if (data) cache.set(key, data);
          return data;
        })
        .finally(() => {
          inflight.delete(key);
        });
      inflight.set(key, promise);
      await promise;
    }),
  );

  return wallets.map(w => cache.get(walletCacheKey(w)) ?? null);
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
