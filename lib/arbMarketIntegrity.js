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
 * SGO sometimes tags team-level ML/spread/total odds with statEntityID "home" or
 * "away" on separate odd objects, while other books use "". If we key on the raw
 * value, home and away never land in the same bucket → zero two-way arbs.
 */
export function normalizeStatEntityForMarketKey(statEntityID, betTypeID) {
  if (!statEntityID) return '';
  const s = String(statEntityID).toLowerCase();
  if (betTypeID === 'ml' || betTypeID === 'ml3way' || betTypeID === 'sp' || betTypeID === 'ou') {
    if (s === 'home' || s === 'away' || s === 'all') return '';
  }
  return String(statEntityID);
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
    // Same market: home -7.5 vs away +7.5 (magnitudes match, signs opposite)
    return Math.abs(Math.abs(na) - Math.abs(nb)) < 1e-6;
  }
  return true;
}
