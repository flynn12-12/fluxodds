/**
 * Normalize SportsGameOdds book / odd fields — payloads vary by league and API version.
 */

function num(x) {
  const n = Number(x);
  return Number.isFinite(n) ? n : NaN;
}

/**
 * Best-effort American odds from a per-bookmaker quote object.
 * SGO has used `odds`, `american`, `price`, or nested shapes.
 */
export function extractAmericanFromBook(book) {
  if (!book || typeof book !== 'object') return null;

  const direct = [book.odds, book.american, book.price, book.line];
  for (const v of direct) {
    const n = num(v);
    if (Number.isFinite(n) && n !== 0) return n;
  }

  const nested = book.americanOdds || book.AmericanOdds || book.oddsAmerican;
  if (nested && typeof nested === 'object') {
    const n = num(nested.odds ?? nested.american ?? nested.price ?? nested.value);
    if (Number.isFinite(n) && n !== 0) return n;
  }

  return null;
}

/**
 * Canonical side bucket for two-way / three-way arb maps (`market.sides[sideKey]`).
 */
export function normalizeArbSideKey(odd) {
  if (!odd) return 'unknown';
  const bt = odd.betTypeID || '';
  const sid = String(odd.sideID ?? '').trim().toLowerCase();
  const se = String(odd.statEntityID ?? '').trim().toLowerCase();

  if (bt === 'ml3way' || sid === 'draw' || se === 'draw') {
    if (sid === 'draw' || se === 'draw') return 'draw';
  }

  if (bt === 'ml' || bt === 'ml3way') {
    if (sid === 'home' || sid === '1' || sid === 'h') return 'home';
    if (sid === 'away' || sid === '2' || sid === 'a') return 'away';
    if (se === 'home') return 'home';
    if (se === 'away') return 'away';
  }

  if (bt === 'sp') {
    if (sid === 'home' || sid === '1' || sid === 'h') return 'home';
    if (sid === 'away' || sid === '2' || sid === 'a') return 'away';
    if (se === 'home') return 'home';
    if (se === 'away') return 'away';
  }

  if (bt === 'ou') {
    if (sid === 'over' || sid === 'o') return 'over';
    if (sid === 'under' || sid === 'u') return 'under';
  }

  if (bt === 'yn') {
    if (sid === 'yes' || sid === 'y' || sid === '1') return 'yes';
    if (sid === 'no' || sid === 'n' || sid === '2') return 'no';
  }

  if (sid) return sid;
  if (se && se !== 'all') return se;
  return 'unknown';
}

/**
 * Merge full-game style period tags so home/away ML odds share one bucket.
 * (Do not collapse named periods like 1h / 1q — those are different markets.)
 */
export function normalizePeriodForMarketKey(periodID) {
  const p = String(periodID ?? '').trim().toLowerCase();
  if (!p || p === 'game' || p === 'reg' || p === 'full' || p === 'match') return '';
  return String(periodID ?? '');
}
