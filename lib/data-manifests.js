import fs from 'fs';
import path from 'path';

/**
 * Server-side manifest store.
 *
 * `readDataJson` caches parsed JSON by mtime so repeated balance/ticker reads do
 * not re-parse hundreds of KB. The returned object is shared — treat it as
 * read-only. Mutating callers must use `readDataJsonForUpdate` (a deep clone).
 *
 * `writeDataJson` serializes writes per file and writes atomically (temp file +
 * rename) so concurrent cron/API runs cannot leave a half-written manifest.
 */
const readCache = new Map();
const writeQueues = new Map();

function manifestPath(filename) {
  return path.join(process.cwd(), 'data', filename);
}

export function readDataJson(filename) {
  const full = manifestPath(filename);
  const stat = fs.statSync(full);
  const cached = readCache.get(filename);

  if (cached && cached.mtimeMs === stat.mtimeMs) {
    return cached.data;
  }

  const data = JSON.parse(fs.readFileSync(full, 'utf8'));
  readCache.set(filename, { mtimeMs: stat.mtimeMs, data });
  return data;
}

/** Deep-cloned copy for read-modify-write paths. */
export function readDataJsonForUpdate(filename) {
  return JSON.parse(JSON.stringify(readDataJson(filename)));
}

/** Atomically persist a manifest and refresh the read cache. */
export function writeDataJson(filename, data) {
  const full = manifestPath(filename);
  const previous = writeQueues.get(filename) ?? Promise.resolve();

  const task = previous
    .catch(() => {})
    .then(async () => {
      const tmp = `${full}.${process.pid}.${Date.now()}.tmp`;
      await fs.promises.writeFile(tmp, `${JSON.stringify(data, null, 2)}\n`);
      await fs.promises.rename(tmp, full);

      const stat = await fs.promises.stat(full);
      readCache.set(filename, { mtimeMs: stat.mtimeMs, data });
    });

  writeQueues.set(filename, task);
  return task.finally(() => {
    if (writeQueues.get(filename) === task) writeQueues.delete(filename);
  });
}
