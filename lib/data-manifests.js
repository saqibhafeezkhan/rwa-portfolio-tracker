import fs from 'fs';
import path from 'path';

/** Server-side read of `data/*.json` so hourly cron writes are visible without rebuild. */
export function readDataJson(filename) {
  const full = path.join(process.cwd(), 'data', filename);
  const raw = fs.readFileSync(full, 'utf8');
  return JSON.parse(raw);
}
