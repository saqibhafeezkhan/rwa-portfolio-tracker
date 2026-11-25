import fs from 'fs';
import path from 'path';

/**
 * Best-effort snapshot of the last live ticker payload. The dashboard reads it
 * on the first server render so returning/new visitors see fresh prices without
 * waiting for the browser fetch. Writes fail silently on read-only hosts.
 */
const SNAPSHOT_FILE = path.join(process.cwd(), 'data', '.ticker-snapshot.json');
const MAX_AGE_MS = 10 * 60_000;

export function readTickerSnapshot() {
  try {
    const parsed = JSON.parse(fs.readFileSync(SNAPSHOT_FILE, 'utf8'));
    if (!Array.isArray(parsed?.tickerData) || parsed.tickerData.length === 0) {
      return null;
    }
    const savedAt = Date.parse(parsed.savedAt);
    if (!Number.isFinite(savedAt) || Date.now() - savedAt > MAX_AGE_MS) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export async function writeTickerSnapshot(payload) {
  if (!Array.isArray(payload?.tickerData) || payload.tickerData.length === 0) return;
  try {
    const tmp = `${SNAPSHOT_FILE}.${process.pid}.${Date.now()}.tmp`;
    await fs.promises.writeFile(
      tmp,
      JSON.stringify({
        savedAt: new Date().toISOString(),
        lastUpdatedAt: payload.lastUpdatedAt ?? null,
        tickerData: payload.tickerData,
      }),
    );
    await fs.promises.rename(tmp, SNAPSHOT_FILE);
  } catch {
    /* read-only filesystem — the in-memory server cache still works */
  }
}
