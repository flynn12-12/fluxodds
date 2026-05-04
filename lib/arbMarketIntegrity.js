/**
 * Helpers for prematch + live arb grouping so we don't pair mismatched lines
 * (e.g. Over 220 vs Under 221) or cross-contaminate different spread ladders.
 */

export function formatLineKeyForGrouping(line, betTypeID) {
  if (line == null || !Number.isFinite(Number(line))) return 'na';
  const n = Number(line);
  if (betTypeID === 'ou') return n.toFixed(2);
  if (betTypeID === 'sp') return Math.abs(n).toFixed(2);
  return n.toFixed(2);
}

/**
 * For two-way markets, require both legs to reference the same numeric line
 * when the market uses lines (spread / total).
 */
export function twoWayLinesAreConsistent(oddTemplate, sideA, sideB) {
  if (!oddTemplate) return true;
  const bt = oddTemplate.betTypeID;
  if (bt !== 'sp' && bt !== 'ou') return true;
  const la = sideA?.line;
  const lb = sideB?.line;
  if (la == null || lb == null) return true;
  const na = Number(la);
  const nb = Number(lb);
  if (!Number.isFinite(na) || !Number.isFinite(nb)) return true;

  if (bt === 'ou') {
    return na === nb;
  }
  if (bt === 'sp') {
    return Math.abs(na - nb) < 1e-6;
  }
  return true;
}
