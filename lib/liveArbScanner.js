// lib/liveArbScanner.js
//
// LIVE arbitrage scanner — opposite of arbScanner.js.
// Only includes games that are currently in progress (started=true and live=true).
// Skips pre-match and finished games.
//
// Includes game-state context (current period, clock) so the dashboard can show
// "TOP 6th" or "2nd Half (49')" next to each live arb.

import { SGO_LEAGUES as LEAGUES, fetchAllSgoLeagues, summarizeLeagueFetches } from './sgoClient';
import { formatLineKeyForGrouping, twoWayLinesAreConsistent } from './arbMarketIntegrity';

export { LEAGUES };

const TWO_WAY_BETTYPES = new Set(['ml', 'sp', 'ou', 'yn']);
const THREE_WAY_BETTYPES = new Set(['ml3way']);

const BLOCKED_BOOKMAKERS = new Set(['unknown']);
const EXCHANGE_LIKE_BOOKMAKERS = new Set([
  'polymarket', 'kalshi', 'betfairexchange', 'prophetexchange',
  'prizepicks', 'underdog', 'novig', 'sporttrade',
]);
const EXCLUDE_EXCHANGES = true;

// Live arbs are noisier — cap slightly below prematch but allow real edges.
const MAX_REALISTIC_PROFIT_PCT = 18;
const MIN_REALISTIC_TOTAL = 1.5;

function isAllowedBookmaker(id) {
  if (!id) return false;
  if (BLOCKED_BOOKMAKERS.has(id)) return false;
  if (EXCLUDE_EXCHANGES && EXCHANGE_LIKE_BOOKMAKERS.has(id)) return false;
  return true;
}

// ---------- LIVE FILTER (opposite of pre-match) ----------

function isLive(event) {
  const s = event?.status;
  if (!s) return false;
  if (s.completed === true || s.ended === true || s.cancelled === true) return false;
  // Either flag means "in progress"
  return s.started === true || s.live === true;
}

// ---------- ODDS MATH ----------

function americanToDecimal(american) {
  const n = Number(american);
  if (!Number.isFinite(n) || n === 0) return null;
  return n > 0 ? 1 + n / 100 : 1 + 100 / Math.abs(n);
}
function decimalToImplied(d) { return d && d > 1 ? 1 / d : null; }
function formatAmerican(a) {
  const n = Number(a);
  if (!Number.isFinite(n)) return String(a);
  return n > 0 ? `+${n}` : `${n}`;
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
  threePointersMade: '3-pointers made', blocks: 'blocks', steals: 'steals',
  batting_hits: 'hits', batting_homeRuns: 'home runs', batting_RBI: 'RBIs',
  batting_singles: 'singles', batting_doubles: 'doubles', batting_triples: 'triples',
  batting_totalBases: 'total bases', batting_strikeouts: 'strikeouts',
  pitching_strikeouts: 'pitcher strikeouts', pitching_earnedRuns: 'earned runs',
  pitching_outs: 'outs', pitching_hits: 'hits allowed',
  shots_onGoal: 'shots on goal', goals: 'goals', goalie_saves: 'saves',
  hits: 'hits',
  shots: 'shots', cornerKicks: 'corner kicks',
  yellowCards: 'yellow cards', redCards: 'red cards', combinedCards: 'cards',
  games: 'games', serving_aces: 'aces',
  bothTeamsScored: 'both teams to score',
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

const PERIOD_LABELS = {
  game: '', reg: '',
  '1h': '1H', '2h': '2H',
  '1q': '1Q', '2q': '2Q', '3q': '3Q', '4q': '4Q',
  '1p': '1P', '2p': '2P', '3p': '3P',
  '1i': '1st Inn', '2i': '2nd Inn', '3i': '3rd Inn', '4i': '4th Inn',
  '5i': '5th Inn', '6i': '6th Inn', '7i': '7th Inn', '8i': '8th Inn',
  '1ix3': 'F3', '1ix5': 'F5', '1ix7': 'F7',
  '1s': '1st Set', '2s': '2nd Set',
};
const periodLabel = (id) => PERIOD_LABELS[id] ?? id;

function isPlayerProp(event, statEntityID) {
  if (!statEntityID) return false;
  if (statEntityID === 'home' || statEntityID === 'away' || statEntityID === 'all') return false;
  return !!event?.players?.[statEntityID];
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
    if (odd.betTypeID === 'yn') return `${pname} ${statLabel(odd.statID)}: ${sideID === 'yes' ? 'Yes' : 'No'}`;
    return `${pname}`;
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
  if (odd.betTypeID === 'yn') return `${statLabel(odd.statID)}: ${sideID === 'yes' ? 'Yes' : 'No'}`;
  return sideID;
}

function buildMarketLabel(event, odd) {
  if (odd.marketName) return odd.marketName;
  return odd.betTypeID;
}

// Live game state pretty-printer e.g. "8th Inn", "2nd Half (49')", "3rd Q 4:32"
function gameStatusLabel(event) {
  const s = event?.status;
  if (!s) return '';
  // Prefer SGO's own display string when present
  if (s.displayShort) {
    if (s.clock) return `${s.displayShort} ${s.clock}`;
    return s.displayShort;
  }
  if (s.displayLong) return s.displayLong;
  return periodLabel(s.currentPeriodID);
}

// ---------- MARKETS ----------

function buildMarkets(event) {
  const odds = event?.odds;
  if (!odds || typeof odds !== 'object') return new Map();

  const markets = new Map();
  for (const oddID in odds) {
    const odd = odds[oddID];
    if (!odd || odd.cancelled) continue;
    const isTwo = TWO_WAY_BETTYPES.has(odd.betTypeID);
    const isThree = THREE_WAY_BETTYPES.has(odd.betTypeID);
    if (!isTwo && !isThree) continue;
    if (!odd.byBookmaker) continue;

    for (const bookmakerID in odd.byBookmaker) {
      if (!isAllowedBookmaker(bookmakerID)) continue;
      const book = odd.byBookmaker[bookmakerID];
      if (!book || book.available === false) continue;
      const decimal = americanToDecimal(book.odds);
      if (!decimal) continue;
      if (decimal < MIN_REALISTIC_TOTAL) continue;

      let line = null;
      if (odd.betTypeID === 'sp' && book.spread != null) line = Number(book.spread);
      else if (odd.betTypeID === 'ou' && book.overUnder != null) line = Number(book.overUnder);

      const lineKey = formatLineKeyForGrouping(line, odd.betTypeID);
      const marketKey = [
        odd.statID || '', odd.statEntityID || '',
        odd.periodID || '', odd.betTypeID || '', lineKey,
      ].join('|');

      if (!markets.has(marketKey)) {
        markets.set(marketKey, { oddTemplate: odd, line, sides: {} });
      }
      const market = markets.get(marketKey);
      const cur = market.sides[odd.sideID];
      if (!cur || decimal > cur.decimal) {
        market.sides[odd.sideID] = { bookmaker: bookmakerID, american: book.odds, decimal, line };
      }
    }
  }
  return markets;
}

function fingerprintArb(eventID, marketKey, sides) {
  const sideKeys = Object.keys(sides).sort();
  const parts = sideKeys.map((s) => `${s}:${sides[s].bookmaker}`);
  return `live|${eventID}|${marketKey}|${parts.join(',')}`;
}

function findArbsInEvent(event) {
  if (!isLive(event)) return [];

  const markets = buildMarkets(event);
  const arbs = [];
  const home = teamShort(event, 'home');
  const away = teamShort(event, 'away');
  const game = `${away} @ ${home}`;
  const sport = (event.leagueID || '').toLowerCase();
  const time = event?.status?.startsAt || null;
  const eventID = event?.eventID || `${away}-${home}-${time}`;
  const liveStatus = gameStatusLabel(event);

  for (const [marketKey, market] of markets) {
    const sideIDs = Object.keys(market.sides);
    const isTwo = TWO_WAY_BETTYPES.has(market.oddTemplate.betTypeID);
    const isThree = THREE_WAY_BETTYPES.has(market.oddTemplate.betTypeID);
    if (isTwo && sideIDs.length !== 2) continue;
    if (isThree && sideIDs.length !== 3) continue;

    if (isTwo && sideIDs.length === 2) {
      const [x, y] = sideIDs;
      if (!twoWayLinesAreConsistent(market.oddTemplate, market.sides[x], market.sides[y])) continue;
    }

    const bookmakers = sideIDs.map((s) => market.sides[s].bookmaker);
    if (new Set(bookmakers).size !== sideIDs.length) continue;

    const implied = sideIDs.map((s) => decimalToImplied(market.sides[s].decimal));
    if (implied.some((p) => p == null)) continue;

    const sumImplied = implied.reduce((a, b) => a + b, 0);
    if (sumImplied >= 1) continue;

    const profit = (1 - sumImplied) * 100;
    if (profit > MAX_REALISTIC_PROFIT_PCT) continue;

    const stakeShares = implied.map((p) => Math.round((p / sumImplied) * 100));
    const drift = 100 - stakeShares.reduce((a, b) => a + b, 0);
    if (drift !== 0) stakeShares[0] += drift;

    const marketLabel = buildMarketLabel(event, market.oddTemplate);

    if (isTwo) {
      const [aID, bID] = sideIDs;
      const a = market.sides[aID];
      const b = market.sides[bID];
      arbs.push({
        eventID,
        fingerprint: fingerprintArb(eventID, marketKey, market.sides),
        game, sport, time,
        liveStatus,
        bA: a.bookmaker,
        oA: formatAmerican(a.american),
        betA: `${buildSideLabel(event, market.oddTemplate, a.line, aID)} on ${a.bookmaker}`,
        bB: b.bookmaker,
        oB: formatAmerican(b.american),
        betB: `${buildSideLabel(event, market.oddTemplate, b.line, bID)} on ${b.bookmaker}`,
        profit: Number(profit.toFixed(2)),
        sA: stakeShares[0],
        sB: stakeShares[1],
        market: marketLabel,
      });
    } else {
      const sides = sideIDs.map((id, i) => ({
        sideID: id, ...market.sides[id], share: stakeShares[i],
      }));
      arbs.push({
        eventID,
        fingerprint: fingerprintArb(eventID, marketKey, market.sides),
        game, sport, time,
        liveStatus,
        threeWay: true,
        legs: sides.map((s) => ({
          bookmaker: s.bookmaker,
          odds: formatAmerican(s.american),
          bet: `${buildSideLabel(event, market.oddTemplate, s.line, s.sideID)} on ${s.bookmaker}`,
          stake: s.share,
        })),
        bA: sides[0].bookmaker,
        oA: formatAmerican(sides[0].american),
        betA: `${buildSideLabel(event, market.oddTemplate, sides[0].line, sides[0].sideID)} on ${sides[0].bookmaker}`,
        bB: sides[1].bookmaker,
        oB: formatAmerican(sides[1].american),
        betB: `${buildSideLabel(event, market.oddTemplate, sides[1].line, sides[1].sideID)} on ${sides[1].bookmaker}`,
        profit: Number(profit.toFixed(2)),
        sA: stakeShares[0],
        sB: stakeShares[1],
        market: marketLabel,
      });
    }
  }
  return arbs;
}

// ---------- PUBLIC ----------

export async function scanAllLeaguesForLiveArbs(apiKey) {
  const rows = await fetchAllSgoLeagues(apiKey);
  const { leaguesOk, fetchComplete, events: allEvents } = summarizeLeagueFetches(rows);
  const scanHealthy = fetchComplete;
  const events = allEvents.filter(isLive);
  const arbs = events.flatMap(findArbsInEvent);
  arbs.sort((a, b) => b.profit - a.profit);
  return {
    arbs,
    eventCount: events.length,
    scanHealthy,
    leaguesOk,
    leaguesAttempted: LEAGUES.length,
  };
}