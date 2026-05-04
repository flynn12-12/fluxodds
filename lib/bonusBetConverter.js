// lib/bonusBetConverter.js
//
// Bonus Bet Converter (formerly "Free Bet Converter") for FluxOdds.
//
// HOW IT WORKS:
//   A "bonus bet" / "free bet" is a Stake-Not-Returned (SNR) bet — you only
//   keep the profit, not the original stake. So a $100 bonus bet at +400
//   pays $400 profit (not $500 like a normal bet).
//
//   The conversion strategy:
//     1. Place the bonus bet on a longshot (+200 to +800 typically) at the
//        BONUS BOOK (the place that gave you the bonus).
//     2. Hedge the OPPOSITE outcome at a DIFFERENT book with REAL CASH.
//     3. No matter who wins, you walk away with guaranteed real cash worth
//        ~70-80% of the bonus bet face value.
//
// MATH (lock conversion, equal payout regardless of outcome):
//   bonus_stake = $B (the bonus bet face value)
//   bonus_dec  = decimal odds of the longshot at bonus book
//   hedge_dec  = decimal odds of the opposite outcome at hedge book
//
//   Bonus winnings if it hits = B × (bonus_dec - 1)   (SNR — stake not returned)
//   Hedge cost                = $H (we solve for this)
//   Hedge winnings if it hits = H × (hedge_dec - 1)
//
//   Lock condition: payout if bonus wins == payout if hedge wins
//      B(bonus_dec - 1) - H == H(hedge_dec - 1) - 0
//      → H = B(bonus_dec - 1) / hedge_dec
//
//   Locked profit (either outcome) = B(bonus_dec - 1) - H
//   Conversion rate = locked_profit / B (typically 0.65 - 0.85)

import { SGO_LEAGUES as LEAGUES, fetchAllSgoLeagues, summarizeLeagueFetches } from './sgoClient';
import { formatLineKeyForGrouping } from './arbMarketIntegrity';

export { LEAGUES };

// Two-way markets only for now. Three-way (soccer) requires hedging two legs
// not one — we can add that later as a separate code path.
const SUPPORTED_BETTYPES = new Set(['ml', 'sp', 'ou']);

// Same blocked-book logic as our other scanners.
const BLOCKED_BOOKMAKERS = new Set(['unknown']);
const EXCHANGE_LIKE_BOOKMAKERS = new Set([
  'polymarket', 'kalshi', 'betfairexchange', 'prophetexchange',
  'prizepicks', 'underdog', 'novig', 'sporttrade',
]);

// We want bonus bet leg to be a real longshot — bigger longshot = better conversion.
// But too long (e.g. +1500) often means stale lines or markets the book won't take action on.
const MIN_BONUS_LEG_DECIMAL = 3.0; // +200 American
const MAX_BONUS_LEG_DECIMAL = 9.0; // +800 American

// Don't return conversions worse than this — most legit conversions land 65-82%.
const MIN_CONVERSION_RATE = 0.50;
// Filter out anything that looks too good — usually stale lines or junk markets.
const MAX_CONVERSION_RATE = 0.92;

function isAllowedHedgeBook(bookmakerID) {
  if (!bookmakerID) return false;
  if (BLOCKED_BOOKMAKERS.has(bookmakerID)) return false;
  if (EXCHANGE_LIKE_BOOKMAKERS.has(bookmakerID)) return false;
  return true;
}

// ---------- ODDS MATH ----------

function americanToDecimal(american) {
  const n = Number(american);
  if (!Number.isFinite(n) || n === 0) return null;
  return n > 0 ? 1 + n / 100 : 1 + 100 / Math.abs(n);
}

function formatAmerican(american) {
  const n = Number(american);
  if (!Number.isFinite(n)) return String(american);
  return n > 0 ? `+${n}` : `${n}`;
}

// ---------- PRE-MATCH FILTER ----------

function isPrematch(event) {
  const s = event?.status;
  if (!s) return false;
  if (s.started === true || s.live === true) return false;
  if (s.completed === true || s.ended === true || s.cancelled === true) return false;
  if (s.startsAt) {
    const t = new Date(s.startsAt).getTime();
    if (Number.isFinite(t) && t < Date.now()) return false;
  }
  return true;
}

// ---------- SGO FETCH (shared client) ----------

// ---------- LABEL HELPERS ----------

function teamShort(event, which) {
  return (
    event?.teams?.[which]?.names?.short ||
    event?.teams?.[which]?.names?.medium ||
    event?.teams?.[which]?.names?.long ||
    which
  );
}

function playerName(event, playerID) {
  const p = event?.players?.[playerID];
  if (!p) return playerID;
  return p.name || `${p.firstName || ''} ${p.lastName || ''}`.trim() || playerID;
}

function isPlayerProp(event, statEntityID) {
  if (!statEntityID) return false;
  if (statEntityID === 'home' || statEntityID === 'away' || statEntityID === 'all') return false;
  return !!event?.players?.[statEntityID];
}

const STAT_LABELS = {
  points: 'points', batting_hits: 'hits', batting_homeRuns: 'home runs',
  batting_RBI: 'RBIs', pitching_strikeouts: 'pitcher strikeouts',
  shots_onGoal: 'shots on goal', goals: 'goals',
  assists: 'assists', rebounds: 'rebounds', threePointersMade: '3-pointers made',
  shots: 'shots', cornerKicks: 'corner kicks',
  games: 'games',
};
const statLabel = (id) => STAT_LABELS[id] || id;

function gameTotalUnit(leagueID) {
  switch (leagueID) {
    case 'MLB': return 'runs';
    case 'NHL': return 'goals';
    case 'NBA': case 'WNBA': case 'NFL': case 'NCAAFB': case 'NCAAMB': return 'points';
    case 'EPL': case 'MLS': return 'goals';
    case 'ATP': return 'games';
    default: return '';
  }
}

function buildSideLabel(event, odd, line, sideID) {
  const home = teamShort(event, 'home');
  const away = teamShort(event, 'away');
  const isProp = isPlayerProp(event, odd.statEntityID);

  if (isProp) {
    const pname = playerName(event, odd.statEntityID);
    if (odd.betTypeID === 'ou') {
      const dir = sideID === 'over' ? 'Over' : 'Under';
      return line != null ? `${pname} ${dir} ${line} ${statLabel(odd.statID)}` : `${pname} ${dir}`;
    }
    return `${pname}`;
  }
  if (odd.betTypeID === 'ml') {
    if (sideID === 'home') return home;
    if (sideID === 'away') return away;
    return sideID;
  }
  if (odd.betTypeID === 'sp') {
    const team = sideID === 'home' ? home : away;
    if (line == null) return team;
    const n = Number(line);
    return `${team} ${n > 0 ? '+' : ''}${n}`;
  }
  if (odd.betTypeID === 'ou') {
    const dir = sideID === 'over' ? 'Over' : 'Under';
    const unit = (odd.statID === 'points' || odd.statID === 'goals') ? gameTotalUnit(event.leagueID) : statLabel(odd.statID);
    if (line == null) return dir;
    return unit ? `${dir} ${line} ${unit}` : `${dir} ${line}`;
  }
  return sideID;
}

// ---------- MARKET BUILDING ----------

function buildMarkets(event) {
  const odds = event?.odds;
  if (!odds || typeof odds !== 'object') return new Map();

  const markets = new Map();
  for (const oddID in odds) {
    const odd = odds[oddID];
    if (!odd || odd.cancelled) continue;
    if (!SUPPORTED_BETTYPES.has(odd.betTypeID)) continue;
    if (!odd.byBookmaker) continue;

    for (const bookmakerID in odd.byBookmaker) {
      const book = odd.byBookmaker[bookmakerID];
      if (!book || book.available === false) continue;
      const american = book.odds;
      const decimal = americanToDecimal(american);
      if (!decimal) continue;

      let line = null;
      if (odd.betTypeID === 'sp' && book.spread != null) line = Number(book.spread);
      else if (odd.betTypeID === 'ou' && book.overUnder != null) line = Number(book.overUnder);

      const lineKey = formatLineKeyForGrouping(line, odd.betTypeID);
      const marketKey = [
        odd.statID || '', odd.statEntityID || '',
        odd.periodID || '', odd.betTypeID || '', lineKey,
      ].join('|');

      if (!markets.has(marketKey)) {
        markets.set(marketKey, { oddTemplate: odd, line, prices: [] });
      }
      markets.get(marketKey).prices.push({
        sideID: odd.sideID,
        bookmakerID, american, decimal, line,
        lastUpdatedAt: book.lastUpdatedAt,
      });
    }
  }
  return markets;
}

// ---------- FIND CONVERSIONS ----------

/**
 * Find best hedge price for the OPPOSITE side of a given bonus-bet leg.
 * Returns { bookmakerID, american, decimal } or null if no acceptable hedge.
 */
function findBestHedge(market, bonusSideID, bonusBookID) {
  // Determine the opposing side ID
  const isThreeWay = market.oddTemplate.betTypeID === 'ml3way';
  if (isThreeWay) return null; // we don't handle 3-way here

  const opposingSideID = (() => {
    if (bonusSideID === 'home') return 'away';
    if (bonusSideID === 'away') return 'home';
    if (bonusSideID === 'over') return 'under';
    if (bonusSideID === 'under') return 'over';
    return null;
  })();
  if (!opposingSideID) return null;

  // All allowed hedge prices for the opposing side (excluding the bonus book itself
  // — you can't hedge at the same book as the bonus bet typically; if you could,
  // there'd be no need for this tool).
  const candidates = market.prices.filter(p =>
    p.sideID === opposingSideID &&
    p.bookmakerID !== bonusBookID &&
    isAllowedHedgeBook(p.bookmakerID)
  );
  if (candidates.length === 0) return null;

  // BEST hedge = lowest decimal odds (cheapest hedge cost). Wait — actually
  // we want the BEST hedge price, which means the HIGHEST decimal odds for
  // the hedger (more payout per dollar staked = less hedge cost needed for
  // same coverage). So pick MAX decimal.
  let best = null;
  for (const c of candidates) {
    if (!best || c.decimal > best.decimal) best = c;
  }
  return best;
}

/**
 * Compute lock conversion details for a given (bonus leg, hedge leg) pair.
 * Returns { hedgeStake, lockedProfit, conversionRate } or null if invalid.
 */
function computeLock(bonusAmount, bonusDecimal, hedgeDecimal) {
  if (!bonusDecimal || !hedgeDecimal) return null;
  if (bonusDecimal <= 1 || hedgeDecimal <= 1) return null;

  // Hedge stake H solving: B(bonus_dec - 1) - H = H(hedge_dec - 1)
  // → B(bonus_dec - 1) = H × hedge_dec
  // → H = B(bonus_dec - 1) / hedge_dec
  const bonusWinIfHits = bonusAmount * (bonusDecimal - 1);
  const hedgeStake = bonusWinIfHits / hedgeDecimal;
  const lockedProfit = bonusWinIfHits - hedgeStake;
  const conversionRate = lockedProfit / bonusAmount;

  if (lockedProfit <= 0) return null;
  return {
    hedgeStake: Math.round(hedgeStake * 100) / 100,
    lockedProfit: Math.round(lockedProfit * 100) / 100,
    conversionRate: Math.round(conversionRate * 10000) / 10000,
  };
}

// ---------- PUBLIC ENTRY ----------

/**
 * Find all viable bonus-bet conversions given:
 *   - bonusBookID: lowercase bookmaker ID where the bonus bet must be placed
 *   - bonusAmount: face value of bonus bet in dollars
 *
 * Returns: { conversions: [...], scanned: N }
 */
export async function findBonusConversions(apiKey, { bonusBookID, bonusAmount }) {
  if (!bonusBookID || !bonusAmount || bonusAmount <= 0) {
    return { conversions: [], scanned: 0, error: 'Invalid input' };
  }

  const rows = await fetchAllSgoLeagues(apiKey);
  const { leaguesOk, fetchComplete, events } = summarizeLeagueFetches(rows);
  const prematchEvents = events.filter(isPrematch);

  const conversions = [];

  for (const event of prematchEvents) {
    const markets = buildMarkets(event);

    for (const [marketKey, market] of markets) {
      // Find every bonus-eligible leg AT THE USER'S BONUS BOOK
      const bonusLegs = market.prices.filter(p =>
        p.bookmakerID === bonusBookID &&
        p.decimal >= MIN_BONUS_LEG_DECIMAL &&
        p.decimal <= MAX_BONUS_LEG_DECIMAL
      );
      if (bonusLegs.length === 0) continue;

      for (const bonusLeg of bonusLegs) {
        const hedge = findBestHedge(market, bonusLeg.sideID, bonusBookID);
        if (!hedge) continue;

        const lock = computeLock(bonusAmount, bonusLeg.decimal, hedge.decimal);
        if (!lock) continue;
        if (lock.conversionRate < MIN_CONVERSION_RATE) continue;
        if (lock.conversionRate > MAX_CONVERSION_RATE) continue;

        const bonusBetLabel = buildSideLabel(event, market.oddTemplate, bonusLeg.line, bonusLeg.sideID);
        const hedgeBetLabel = buildSideLabel(event, market.oddTemplate, hedge.line, hedge.sideID);

        const home = teamShort(event, 'home');
        const away = teamShort(event, 'away');

        conversions.push({
          eventID: event.eventID,
          game: `${away} @ ${home}`,
          sport: (event.leagueID || '').toLowerCase(),
          time: event?.status?.startsAt || null,
          market: market.oddTemplate.marketName || market.oddTemplate.betTypeID,

          bonusBet: {
            book: bonusLeg.bookmakerID,
            label: bonusBetLabel,
            odds: formatAmerican(bonusLeg.american),
            decimal: bonusLeg.decimal,
            stake: bonusAmount, // user's full bonus
          },
          hedge: {
            book: hedge.bookmakerID,
            label: hedgeBetLabel,
            odds: formatAmerican(hedge.american),
            decimal: hedge.decimal,
            stake: lock.hedgeStake, // real cash needed
          },
          lockedProfit: lock.lockedProfit,
          conversionRate: lock.conversionRate, // 0.0–1.0
          conversionPct: Math.round(lock.conversionRate * 10000) / 100, // 71.50
        });
      }
    }
  }

  // Best conversions first
  conversions.sort((a, b) => b.conversionRate - a.conversionRate);

  const out = {
    conversions: conversions.slice(0, 100),
    scanned: prematchEvents.length,
    fetchComplete,
    leaguesOk,
    leaguesAttempted: LEAGUES.length,
  };

  if (!fetchComplete && out.conversions.length === 0 && out.scanned === 0) {
    return {
      ...out,
      error:
        'Odds feed is temporarily incomplete — we could not load enough leagues. Wait a minute and try again.',
      detail: `Loaded ${leaguesOk} of ${LEAGUES.length} leagues successfully.`,
    };
  }

  return out;
}