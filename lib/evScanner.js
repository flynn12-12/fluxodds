// lib/evScanner.js
//
// Positive EV bet scanner for FluxOdds.
//
// Approach: "Pinnacle-only de-vigged true line"
//   1. For each market that Pinnacle prices, take both sides of Pinnacle's quote.
//   2. De-vig (remove their juice) so true probabilities sum to exactly 1.00.
//      This gives us our best estimate of the actual probability of each outcome.
//   3. For every OTHER allowed bookmaker pricing the same market:
//      - Convert their American odds → implied probability
//      - If their implied prob < Pinnacle's true prob → bet has positive EV
//      - EV% = (trueProb × decimalOdds) - 1
//   4. Apply quality filters: vintage, market depth, EV cap.
//
// This matches the standard approach used by OddsJam, AVO, and other sharp tools.

import { SGO_LEAGUES as LEAGUES, fetchAllSgoLeagues, summarizeLeagueFetches } from './sgoClient';
import { formatLineKeyForGrouping, normalizeStatEntityForMarketKey } from './arbMarketIntegrity';
import { extractAmericanFromBook, normalizeArbSideKey, normalizePeriodForMarketKey } from './sgoOdds';

export { LEAGUES };

// Pinnacle = our reference book.
const SHARP_BOOK = 'pinnacle';

// Market types we know how to extract a fair line from.
const SUPPORTED_BETTYPES = new Set(['ml', 'sp', 'ou', 'yn', 'ml3way']);

// Quality filters
const BLOCKED_BOOKMAKERS = new Set(['unknown', 'pinnacle']); // never recommend betting AT pinnacle
const EXCHANGE_LIKE_BOOKMAKERS = new Set([
  'polymarket', 'kalshi', 'betfairexchange', 'prophetexchange',
  'prizepicks', 'underdog', 'novig', 'sporttrade',
]);

// EV bounds: < 1% is noise; > 8% is almost always a stale Pinnacle line.
const MIN_EV_PCT = 1.0;
const MAX_EV_PCT = 8.0;

// Minimum number of total bookmakers in a market for it to be trustworthy.
const MIN_MARKET_DEPTH = 3;

// How recent Pinnacle's quote must be (seconds) for us to trust it as fair.
const MAX_PINNACLE_AGE_SEC = 600; // 10 minutes

function isAllowedTargetBookmaker(bookmakerID) {
  if (!bookmakerID) return false;
  if (BLOCKED_BOOKMAKERS.has(bookmakerID)) return false;
  if (EXCHANGE_LIKE_BOOKMAKERS.has(bookmakerID)) return false;
  return true;
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

// ---------- ODDS MATH ----------

function americanToDecimal(american) {
  const n = Number(american);
  if (!Number.isFinite(n) || n === 0) return null;
  return n > 0 ? 1 + n / 100 : 1 + 100 / Math.abs(n);
}

function decimalToImplied(decimal) {
  if (!decimal || decimal <= 1) return null;
  return 1 / decimal;
}

function formatAmerican(american) {
  const n = Number(american);
  if (!Number.isFinite(n)) return String(american);
  return n > 0 ? `+${n}` : `${n}`;
}

function decimalToAmerican(decimal) {
  if (!decimal || decimal <= 1) return null;
  if (decimal >= 2) return Math.round((decimal - 1) * 100);
  return Math.round(-100 / (decimal - 1));
}

// ---------- SGO FETCH (shared client) ----------

// ---------- LABEL HELPERS (mirror arbScanner) ----------

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

const STAT_LABELS = {
  points: 'points', assists: 'assists', rebounds: 'rebounds',
  'points+assists': 'points+assists', 'points+rebounds': 'points+rebounds',
  'points+rebounds+assists': 'points+rebs+assists', 'rebounds+assists': 'rebounds+assists',
  threePointersMade: '3-pointers made', blocks: 'blocks', steals: 'steals',
  batting_hits: 'hits', batting_homeRuns: 'home runs', batting_RBI: 'RBIs',
  batting_singles: 'singles', batting_doubles: 'doubles', batting_triples: 'triples',
  batting_totalBases: 'total bases', batting_strikeouts: 'strikeouts',
  pitching_strikeouts: 'pitcher strikeouts', pitching_earnedRuns: 'earned runs',
  pitching_outs: 'outs', pitching_hits: 'hits allowed',
  shots_onGoal: 'shots on goal', goals: 'goals', goalie_saves: 'saves',
  hits: 'hits', faceOffs_won: 'faceoff wins',
  shots: 'shots', cornerKicks: 'corner kicks',
  yellowCards: 'yellow cards', redCards: 'red cards', combinedCards: 'cards',
  games: 'games', serving_aces: 'aces',
  bothTeamsScored: 'both teams to score',
};

function statLabel(statID) {
  return STAT_LABELS[statID] || statID;
}

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

function isPlayerProp(event, statEntityID) {
  if (!statEntityID) return false;
  if (statEntityID === 'home' || statEntityID === 'away' || statEntityID === 'all') return false;
  return !!event?.players?.[statEntityID];
}

function buildSideLabel(event, odd, line, sideID) {
  const home = teamShort(event, 'home');
  const away = teamShort(event, 'away');
  const isProp = isPlayerProp(event, odd.statEntityID);
  const stat = statLabel(odd.statID);

  if (isProp) {
    const pname = playerName(event, odd.statEntityID);
    if (odd.betTypeID === 'ou') {
      const dir = sideID === 'over' ? 'Over' : 'Under';
      return line != null ? `${pname} ${dir} ${line} ${stat}` : `${pname} ${dir} ${stat}`;
    }
    if (odd.betTypeID === 'yn') {
      return `${pname} ${stat}: ${sideID === 'yes' ? 'Yes' : 'No'}`;
    }
    return `${pname} ${stat}`;
  }
  if (odd.betTypeID === 'ml' || odd.betTypeID === 'ml3way') {
    if (sideID === 'home') return home;
    if (sideID === 'away') return away;
    if (sideID === 'draw') return 'Draw';
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
  if (odd.betTypeID === 'yn') {
    return `${stat}: ${sideID === 'yes' ? 'Yes' : 'No'}`;
  }
  return sideID;
}

function buildMarketLabel(event, odd) {
  if (odd.marketName) return odd.marketName;
  return odd.betTypeID;
}

// ---------- THE CORE: GROUP MARKETS, COMPUTE FAIR FROM PINNACLE ----------

/**
 * Build a map of markets in this event, keyed by market identity.
 * For each market, store the odd template + a list of (sideID, bookmaker, american, decimal, line, lastUpdatedAt).
 */
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

      const american = extractAmericanFromBook(book);
      const decimal = americanToDecimal(american);
      if (!decimal) continue;

      let line = null;
      if (odd.betTypeID === 'sp' && book.spread != null) line = Number(book.spread);
      else if (odd.betTypeID === 'ou' && book.overUnder != null) line = Number(book.overUnder);

      const lineKey = formatLineKeyForGrouping(line, odd.betTypeID);
      const marketKey = [
        odd.statID || '',
        normalizeStatEntityForMarketKey(odd.statEntityID, odd.betTypeID),
        normalizePeriodForMarketKey(odd.periodID),
        odd.betTypeID || '',
        lineKey,
      ].join('|');

      const sideID = normalizeArbSideKey(odd);
      if (sideID === 'unknown') continue;

      if (!markets.has(marketKey)) {
        markets.set(marketKey, { oddTemplate: odd, line, prices: [] });
      }
      markets.get(marketKey).prices.push({
        sideID,
        bookmakerID, american, decimal, line,
        lastUpdatedAt: book.lastUpdatedAt,
      });
    }
  }

  return markets;
}

/**
 * From the price list, find Pinnacle's two-sided quote and de-vig it.
 * Returns: { trueProbBySide: { home: 0.46, away: 0.54 }, freshness: secsAgo }
 *          or null if Pinnacle isn't priced or only has one side.
 */
function getPinnacleTrueProb(market) {
  const pinnaclePrices = market.prices.filter(p => p.bookmakerID === SHARP_BOOK);
  if (pinnaclePrices.length < 2) return null;

  const isThreeWay = market.oddTemplate.betTypeID === 'ml3way';
  if (isThreeWay && pinnaclePrices.length < 3) return null;
  if (!isThreeWay && pinnaclePrices.length < 2) return null;

  // Take Pinnacle's freshest quote per side
  const bestPerSide = {};
  for (const p of pinnaclePrices) {
    const existing = bestPerSide[p.sideID];
    if (!existing) { bestPerSide[p.sideID] = p; continue; }
    const newer = (p.lastUpdatedAt || '') > (existing.lastUpdatedAt || '');
    if (newer) bestPerSide[p.sideID] = p;
  }

  const sides = Object.keys(bestPerSide);
  if (!isThreeWay && sides.length !== 2) return null;
  if (isThreeWay && sides.length !== 3) return null;

  // De-vig: each side's true probability = its implied prob / (sum of all implied probs)
  const impliedBySide = {};
  let sumImplied = 0;
  for (const sideID of sides) {
    const impl = decimalToImplied(bestPerSide[sideID].decimal);
    if (impl == null) return null;
    impliedBySide[sideID] = impl;
    sumImplied += impl;
  }
  if (sumImplied <= 0) return null;

  const trueProbBySide = {};
  for (const sideID of sides) {
    trueProbBySide[sideID] = impliedBySide[sideID] / sumImplied;
  }

  // Freshness check
  let newestUpdate = 0;
  for (const sideID of sides) {
    const t = new Date(bestPerSide[sideID].lastUpdatedAt || 0).getTime();
    if (t > newestUpdate) newestUpdate = t;
  }
  const freshnessSec = newestUpdate ? (Date.now() - newestUpdate) / 1000 : Infinity;

  return { trueProbBySide, freshnessSec };
}

// ---------- EV DETECTION PER EVENT ----------

function findEvBetsInEvent(event) {
  if (!isPrematch(event)) return [];

  const markets = buildMarkets(event);
  const evBets = [];

  const home = teamShort(event, 'home');
  const away = teamShort(event, 'away');
  const game = `${away} @ ${home}`;
  const sport = (event.leagueID || '').toLowerCase();
  const time = event?.status?.startsAt || null;
  const eventID = event?.eventID || `${away}-${home}-${time}`;

  for (const [marketKey, market] of markets) {
    // Need enough bookmaker depth to consider this a real market
    const distinctBooks = new Set(market.prices.map(p => p.bookmakerID));
    if (distinctBooks.size < MIN_MARKET_DEPTH) continue;

    // Need Pinnacle to have a fresh, fully-priced two-sided (or three-sided) market
    const fair = getPinnacleTrueProb(market);
    if (!fair) continue;
    if (fair.freshnessSec > MAX_PINNACLE_AGE_SEC) continue;

    // For each side, find every non-Pinnacle book that's offering positive EV
    for (const sideID in fair.trueProbBySide) {
      const trueProb = fair.trueProbBySide[sideID];
      if (!trueProb || trueProb <= 0 || trueProb >= 1) continue;

      // All available bookmaker prices for this side (excluding Pinnacle)
      const sidePrices = market.prices.filter(p => p.sideID === sideID && isAllowedTargetBookmaker(p.bookmakerID));
      if (sidePrices.length === 0) continue;

      // Take the BEST price per bookmaker (max decimal)
      const bestPerBook = new Map();
      for (const p of sidePrices) {
        const cur = bestPerBook.get(p.bookmakerID);
        if (!cur || p.decimal > cur.decimal) bestPerBook.set(p.bookmakerID, p);
      }

      for (const [bookmakerID, p] of bestPerBook) {
        // EV% = (trueProb × decimalOdds) - 1
        const ev = trueProb * p.decimal - 1;
        const evPct = ev * 100;
        if (evPct < MIN_EV_PCT || evPct > MAX_EV_PCT) continue;

        // Fair odds = what the book "should" be paying given true prob
        const fairDecimal = 1 / trueProb;
        const fairAmerican = decimalToAmerican(fairDecimal);

        const betLabel = buildSideLabel(event, market.oddTemplate, p.line, sideID);
        const marketLabel = buildMarketLabel(event, market.oddTemplate);

        evBets.push({
          eventID,
          fingerprint: `${eventID}|${marketKey}|${sideID}|${bookmakerID}`,
          game, sport, time,
          market: marketLabel,
          bet: betLabel,
          bookmaker: bookmakerID,
          odds: formatAmerican(p.american),
          fairOdds: fairAmerican != null ? formatAmerican(fairAmerican) : '',
          ev: Number(evPct.toFixed(2)),
          winProb: Number((trueProb * 100).toFixed(1)),
          marketDepth: distinctBooks.size,
          pinnacleAgeSec: Math.round(fair.freshnessSec),
        });
      }
    }
  }

  return evBets;
}

// ---------- PUBLIC ----------

export async function scanAllLeaguesForEv(apiKey) {
  const rows = await fetchAllSgoLeagues(apiKey);
  const { leaguesOk, fetchComplete, events: raw } = summarizeLeagueFetches(rows);
  const events = raw.filter(isPrematch);
  const scanHealthy = fetchComplete;
  const evBets = events.flatMap(findEvBetsInEvent);
  evBets.sort((a, b) => b.ev - a.ev);
  return { evBets, eventCount: events.length, scanHealthy, leaguesOk, leaguesAttempted: LEAGUES.length };
}