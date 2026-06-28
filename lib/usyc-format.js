/** Format manifest `estimatedYield` for UI (e.g. `3.14%`). */
export function formatUsycEstimatedYield(manifest) {
  const n = parseFloat(manifest?.estimatedYield);
  if (!Number.isFinite(n)) return null;
  return `${n.toFixed(2)}%`;
}
