// lib/arbScanner.js
//
// Pre-match arbitrage scanner for FluxOdds.
// - Filters out live/in-progress games (started=true OR live=true)
// - Supports game markets, period markets (1H, 1Q, 1P, 1st inning, 1st set, etc.)
// - Supports player props (Over/Under on individual player stats)
// - Supports 2-way and 3-way (soccer draw) outcomes
// - Quality filters: skips exchange platforms, "unknown" books, phantom arbs

import { SGO_LEAGUES as LEAGUES, fetchAllSgoLeagues, summarizeLeagueFetches } from './sgoClient';

export { LEAGUES };

// ---------- BET TYPES ----------

// Two-way market types we accept.
const TWO_WAY_BETTYPES = new Set(['ml', 'sp', 'ou', 'yn']);
// Three-way market types (home/away/draw).
const THREE_WAY_BETTYPES = new Set(['ml3way']);

// ---------- QUALITY FILTERS ----------

// Bookmakers we never trust as data sources.
const BLOCKED_BOOKMAKERS = new Set([
  'unknown',
]);

// Prediction markets / DFS / exchanges. Hidden by default — they have legitimate
// odds but produce noisy arbs vs traditional sportsbooks. Toggle to false to surface.
const EXCHANGE_LIKE_BOOKMAKERS = new Set([
  'polymarket', 'kalshi', 'betfairexchange', 'prophetexchange',
  'prizepicks', 'underdog', 'novig', 'sporttrade',
]);
const EXCLUDE_EXCHANGES = true;

// Real arb profit is almost always 0.1–3%. Above 15% is virtually certain
// to be bad data (mismatched markets, stale prices, etc.)
const MAX_REALISTIC_PROFIT_PCT = 15;

function isAllowedBookmaker(bookmakerID) {
  if (!bookmakerID) return false;
  if (BLOCKED_BOOKMAKERS.has(bookmakerID)) return false;
  if (EXCLUDE_EXCHANGES && EXCHANGE_LIKE_BOOKMAKERS.has(bookmakerID)) return false;
  return true;
}

// ---------- PRE-MATCH FILTER ----------

// True if the event is upcoming (not started and not live).
function isPrematch(event) {
  const s = event?.status;
  if (!s) return false;
  if (s.started === true) return false;
  if (s.live === true) return false;
  if (s.completed === true) return false;
  if (s.ended === true) return false;
  if (s.cancelled === true) return false;
  // If the start time is in the past, treat as live regardless of status flag
  // (catches events SGO hasn't flipped to "started" yet).
  if (s.startsAt) {
    const startsAt = new Date(s.startsAt).getTime();
    if (Number.isFinite(startsAt) && startsAt < Date.now()) return false;
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

// ---------- SGO FETCHING (shared client with per-league timeout) ----------

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

// Friendly stat names for player props
const STAT_LABELS = {
  // basketball
  points: 'points',
  assists: 'assists',
  rebounds: 'rebounds',
  'points+assists': 'points+assists',
  'points+rebounds': 'points+rebounds',
  'points+rebounds+assists': 'points+rebs+assists',
  'rebounds+assists': 'rebounds+assists',
  threePointersMade: '3-pointers made',
  threePointersAttempted: '3-pointers attempted',
  blocks: 'blocks',
  steals: 'steals',
  'blocks+steals': 'blocks+steals',
  turnovers: 'turnovers',
  freeThrowsMade: 'free throws made',
  freeThrowsAttempted: 'free throws attempted',
  fieldGoalsMade: 'field goals made',
  fieldGoalsAttempted: 'field goals attempted',
  doubleDouble: 'double-double',
  tripleDouble: 'triple-double',
  fantasyScore: 'fantasy score',
  // baseball
  batting_hits: 'hits',
  batting_homeRuns: 'home runs',
  batting_RBI: 'RBIs',
  batting_singles: 'singles',
  batting_doubles: 'doubles',
  batting_triples: 'triples',
  batting_totalBases: 'total bases',
  batting_basesOnBalls: 'walks',
  batting_strikeouts: 'strikeouts',
  batting_stolenBases: 'stolen bases',
  'batting_hits+runs+rbi': 'hits+runs+RBIs',
  pitching_strikeouts: 'pitcher strikeouts',
  pitching_earnedRuns: 'earned runs',
  pitching_hits: 'hits allowed',
  pitching_outs: 'outs',
  pitching_basesOnBalls: 'walks allowed',
  pitching_pitchesThrown: 'pitches thrown',
  pitching_win: 'pitcher win',
  // hockey
  shots_onGoal: 'shots on goal',
  goals: 'goals',
  'goals+assists': 'goals+assists',
  goalie_saves: 'saves',
  'powerPlay_goals+assists': 'power play points',
  hits: 'hits',
  faceOffs_won: 'faceoff wins',
  plusMinus: '+/-',
  minutesPlayed: 'minutes played',
  // soccer
  shots: 'shots',
  cornerKicks: 'corner kicks',
  yellowCards: 'yellow cards',
  redCards: 'red cards',
  combinedCards: 'cards',
  weightedCards: 'cards (weighted)',
  fouls: 'fouls',
  passes_attempted: 'passes attempted',
  tackles: 'tackles',
  clearances: 'clearances',
  goalie_goalsAgainst: 'goals allowed',
  shots_assisted: 'key passes',
  dribbles_attempted: 'dribbles',
  // tennis
  games: 'games',
  serving_aces: 'aces',
  // generic
  bothTeamsScored: 'both teams to score',
  firstToScore: 'first to score',
  lastToScore: 'last to score',
};

function statLabel(statID) {
  return STAT_LABELS[statID] || statID;
}

// Period ID → human label
const PERIOD_LABELS = {
  game: '',           // no badge for full game
  reg: '',            // soccer regulation = main market
  '1h': '1H',
  '2h': '2H',
  '1q': '1Q',
  '2q': '2Q',
  '3q': '3Q',
  '4q': '4Q',
  '1p': '1P',
  '2p': '2P',
  '3p': '3P',
  '1i': '1st Inn',
  '2i': '2nd Inn',
  '3i': '3rd Inn',
  '4i': '4th Inn',
  '5i': '5th Inn',
  '1ix3': 'F3',
  '1ix5': 'F5',
  '1ix7': 'F7',
  '1s': '1st Set',
  '2s': '2nd Set',
  '1mx5': '1st 5min',
  '1mx10': '1st 10min',
};

function periodLabel(periodID) {
  return PERIOD_LABELS[periodID] ?? periodID;
}

// Sport-specific units for game-total over/under (when statID === 'points')
function gameTotalUnit(leagueID) {
  switch (leagueID) {
    case 'MLB': return 'runs';
    case 'NHL': return 'goals';
    case 'NBA':
    case 'WNBA':
    case 'NFL':
    case 'NCAAFB':
    case 'NCAAMB':
    case 'NCAAWB': return 'points';
    case 'EPL':
    case 'MLS': return 'goals';
    case 'ATP': return 'games';
    default: return '';
  }
}

// ---------- MARKET CATEGORIZATION ----------

// True if this is a player prop (statEntityID points to a specific player).
function isPlayerProp(event, statEntityID) {
  if (!statEntityID) return false;
  if (statEntityID === 'home' || statEntityID === 'away' || statEntityID === 'all') return false;
  // Player IDs in the players map
  return !!event?.players?.[statEntityID];
}

// Build a human-readable bet-side label.
function buildSideLabel(event, odd, line, sideID) {
  const home = teamShort(event, 'home');
  const away = teamShort(event, 'away');
  const isProp = isPlayerProp(event, odd.statEntityID);
  const stat = statLabel(odd.statID);

  // Player props: "Aaron Judge Over 1.5 hits"
  if (isProp) {
    const pname = playerName(event, odd.statEntityID);
    if (odd.betTypeID === 'ou') {
      const dir = sideID === 'over' ? 'Over' : 'Under';
      return line != null ? `${pname} ${dir} ${line} ${stat}` : `${pname} ${dir} ${stat}`;
    }
    if (odd.betTypeID === 'yn') {
      const ans = sideID === 'yes' ? 'Yes' : 'No';
      return `${pname} ${stat}: ${ans}`;
    }
    if (odd.betTypeID === 'sp') {
      const sign = line > 0 ? '+' : '';
      return line != null ? `${pname} ${sign}${line} ${stat}` : `${pname} ${stat}`;
    }
    return `${pname} ${stat}`;
  }

  // Team / game markets
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
    const sign = n > 0 ? '+' : '';
    return `${team} ${sign}${n}`;
  }
  if (odd.betTypeID === 'ou') {
    const dir = sideID === 'over' ? 'Over' : 'Under';
    // For team-total over/under, include unit (runs, goals, points, etc)
    const unit = (odd.statID === 'points' || odd.statID === 'goals') ? gameTotalUnit(event.leagueID) : statLabel(odd.statID);
    if (line == null) return dir;
    return unit ? `${dir} ${line} ${unit}` : `${dir} ${line}`;
  }
  if (odd.betTypeID === 'yn') {
    const ans = sideID === 'yes' ? 'Yes' : 'No';
    return `${stat}: ${ans}`;
  }
  return sideID;
}

// Friendly market label (e.g. "Moneyline (1H)", "Aaron Judge — Hits")
function buildMarketLabel(event, odd) {
  // SGO provides marketName on each odd which is already nicely formatted
  // ("1st Inning 3-Way Moneyline", "1st Half Over/Under", etc.). Use it
  // as our base label when present.
  if (odd.marketName) return odd.marketName;

  const periodTag = periodLabel(odd.periodID);
  const isProp = isPlayerProp(event, odd.statEntityID);

  if (isProp) {
    const pname = playerName(event, odd.statEntityID);
    return `${pname} — ${statLabel(odd.statID)}`;
  }
  let base;
  if (odd.betTypeID === 'ml') base = 'Moneyline';
  else if (odd.betTypeID === 'ml3way') base = 'Moneyline (3-way)';
  else if (odd.betTypeID === 'sp') base = 'Spread';
  else if (odd.betTypeID === 'ou') base = 'Total';
  else if (odd.betTypeID === 'yn') base = `${statLabel(odd.statID)} Yes/No`;
  else base = odd.betTypeID;
  return periodTag ? `${base} (${periodTag})` : base;
}

// ---------- BEST-PRICE EXTRACTION ----------

/**
 * Group all available odds into markets keyed by (statID, statEntityID, periodID, betTypeID, line).
 * For each market+side, keep the bookmaker offering the best decimal price.
 */
function buildMarkets(event) {
  const odds = event?.odds;
  if (!odds || typeof odds !== 'object') return new Map();

  const markets = new Map();

  for (const oddID in odds) {
    const odd = odds[oddID];
    if (!odd || odd.cancelled) continue;

    // Only allow market types we know how to arb
    const isTwoWay = TWO_WAY_BETTYPES.has(odd.betTypeID);
    const isThreeWay = THREE_WAY_BETTYPES.has(odd.betTypeID);
    if (!isTwoWay && !isThreeWay) continue;

    if (!odd.byBookmaker || typeof odd.byBookmaker !== 'object') continue;

    for (const bookmakerID in odd.byBookmaker) {
      if (!isAllowedBookmaker(bookmakerID)) continue;
      const book = odd.byBookmaker[bookmakerID];
      if (!book || book.available === false) continue;

      const american = book.odds;
      const decimal = americanToDecimal(american);
      if (!decimal) continue;

      // Per-bookmaker line (different books can offer different spreads/totals)
      let line = null;
      if (odd.betTypeID === 'sp' && book.spread != null) line = Number(book.spread);
      else if (odd.betTypeID === 'ou' && book.overUnder != null) line = Number(book.overUnder);

      // Group by absolute line so opposing sides on the same line collide
      const lineKey = line != null ? Math.abs(line).toFixed(2) : 'na';
      const marketKey = [
        odd.statID || '',
        odd.statEntityID || '',
        odd.periodID || '',
        odd.betTypeID || '',
        lineKey,
      ].join('|');

      if (!markets.has(marketKey)) {
        markets.set(marketKey, {
          oddTemplate: odd, // use this odd's metadata for labeling
          line,
          sides: {},
        });
      }
      const market = markets.get(marketKey);

      const current = market.sides[odd.sideID];
      if (!current || decimal > current.decimal) {
        market.sides[odd.sideID] = { bookmaker: bookmakerID, american, decimal, line };
      }
    }
  }

  return markets;
}

// ---------- ARB DETECTION PER EVENT ----------

function fingerprintArb(eventID, marketKey, sides) {
  const sideKeys = Object.keys(sides).sort();
  const parts = sideKeys.map((s) => `${s}:${sides[s].bookmaker}`);
  return `${eventID}|${marketKey}|${parts.join(',')}`;
}

function findArbsInEvent(event) {
  if (!isPrematch(event)) return [];

  const markets = buildMarkets(event);
  const arbs = [];

  const home = teamShort(event, 'home');
  const away = teamShort(event, 'away');
  const game = `${away} @ ${home}`;
  const sport = (event.leagueID || '').toLowerCase();
  const time = event?.status?.startsAt || event?.startTime || null;
  const eventID = event?.eventID || event?.id || `${away}-${home}-${time}`;

  for (const [marketKey, market] of markets) {
    const sideIDs = Object.keys(market.sides);
    const isTwoWay = TWO_WAY_BETTYPES.has(market.oddTemplate.betTypeID);
    const isThreeWay = THREE_WAY_BETTYPES.has(market.oddTemplate.betTypeID);

    if (isTwoWay && sideIDs.length !== 2) continue;
    if (isThreeWay && sideIDs.length !== 3) continue;

    // Require different bookmakers on each leg
    const bookmakers = sideIDs.map((s) => market.sides[s].bookmaker);
    if (new Set(bookmakers).size !== sideIDs.length) continue;

    const implied = sideIDs.map((s) => decimalToImplied(market.sides[s].decimal));
    if (implied.some((p) => p == null)) continue;

    const impliedSum = implied.reduce((a, b) => a + b, 0);
    if (impliedSum >= 1) continue;

    const profit = (1 - impliedSum) * 100;
    if (profit > MAX_REALISTIC_PROFIT_PCT) continue;

    // Stake split
    const stakeShares = implied.map((p) => Math.round((p / impliedSum) * 100));
    const drift = 100 - stakeShares.reduce((a, b) => a + b, 0);
    if (drift !== 0) stakeShares[0] += drift;

    const marketLabel = buildMarketLabel(event, market.oddTemplate);

    if (isTwoWay) {
      const [aID, bID] = sideIDs;
      const a = market.sides[aID];
      const b = market.sides[bID];
      arbs.push({
        eventID,
        fingerprint: fingerprintArb(eventID, marketKey, market.sides),
        game, sport, time,
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
      // 3-way (typically soccer regulation moneyline, or 3-way 1st-inning MLB ML)
      const sides = sideIDs.map((id, i) => ({
        sideID: id, ...market.sides[id], share: stakeShares[i],
      }));
      arbs.push({
        eventID,
        fingerprint: fingerprintArb(eventID, marketKey, market.sides),
        game, sport, time,
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

// ---------- PUBLIC API ----------

export async function scanAllLeagues(apiKey) {
  const rows = await fetchAllSgoLeagues(apiKey);
  const { leaguesOk, fetchComplete, events } = summarizeLeagueFetches(rows);
  const scanHealthy = fetchComplete;
  const prematchEvents = events.filter(isPrematch);

  const arbs = prematchEvents.flatMap(findArbsInEvent);
  arbs.sort((a, b) => b.profit - a.profit);

  return {
    arbs,
    eventCount: prematchEvents.length,
    scanHealthy,
    leaguesOk,
    leaguesAttempted: LEAGUES.length,
  };
}