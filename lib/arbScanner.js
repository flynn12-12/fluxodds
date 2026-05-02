// lib/arbScanner.js
//
// Core arbitrage-detection logic for FluxOdds.

const SGO_BASE = 'https://api.sportsgameodds.com/v2';
export const LEAGUES = ['MLB', 'NBA', 'NHL', 'NFL', 'EPL', 'MLS', 'ATP'];

const MAIN_PERIOD_BY_LEAGUE = {
  MLB: 'game', NBA: 'game', NHL: 'game', NFL: 'game',
  EPL: 'reg', MLS: 'reg', ATP: 'game',
};

const TWO_WAY_MARKETS = {
  ml: 'Moneyline',
  sp: 'Spread',
  ou: 'Total',
};

const THREE_WAY_MARKETS = {
  ml3way: 'Moneyline (3-way)',
};

// ---------- QUALITY FILTERS ----------

// Bookmakers we never trust as data sources.
const BLOCKED_BOOKMAKERS = new Set([
  'unknown',  // SGO returns this for unidentified/stale feeds — produces phantom arbs
]);

// Prediction markets, DFS sites, and exchanges. Hidden by default because they
// produce a lot of phantom arbs vs traditional sportsbooks. Toggle to false
// to surface them.
const EXCHANGE_LIKE_BOOKMAKERS = new Set([
  'polymarket', 'kalshi', 'betfairexchange', 'prophetexchange',
  'prizepicks', 'underdog', 'novig', 'sporttrade',
]);
const EXCLUDE_EXCHANGES = true;

// Real arb profit is almost always 0.1–3%. Above 15% is virtually certain
// to be bad data (mismatched markets, stale prices, etc.)
const MAX_REALISTIC_PROFIT_PCT = 15;

// Filter out novelty totals like "Over/Under 0.5" or "Under 1.5" — these are
// usually proposition markets misclassified as totals.
const MIN_REALISTIC_TOTAL = 1.5;

function isAllowedBookmaker(bookmakerID) {
  if (!bookmakerID) return false;
  if (BLOCKED_BOOKMAKERS.has(bookmakerID)) return false;
  if (EXCLUDE_EXCHANGES && EXCHANGE_LIKE_BOOKMAKERS.has(bookmakerID)) return false;
  return true;
}

// ---------- odds math ----------

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

// ---------- SGO fetching ----------

async function fetchEventsForLeague(leagueID, apiKey) {
  const url = new URL(`${SGO_BASE}/events`);
  url.searchParams.set('leagueID', leagueID);
  url.searchParams.set('finalized', 'false');
  url.searchParams.set('oddsAvailable', 'true');
  url.searchParams.set('limit', '50');

  const res = await fetch(url.toString(), {
    headers: { 'x-api-key': apiKey },
    cache: 'no-store',
  });

  if (!res.ok) {
    console.error(`SGO ${leagueID} failed: ${res.status} ${res.statusText}`);
    return [];
  }

  const json = await res.json();
  return Array.isArray(json?.data)
    ? json.data.map((ev) => ({ ...ev, leagueID }))
    : [];
}

// ---------- side label helpers ----------

function teamShort(event, which) {
  return (
    event?.teams?.[which]?.names?.short ||
    event?.teams?.[which]?.names?.medium ||
    event?.teams?.[which]?.names?.long ||
    which
  );
}

function buildSideLabel(event, sideID, betTypeID, line) {
  const home = teamShort(event, 'home');
  const away = teamShort(event, 'away');

  if (betTypeID === 'ml' || betTypeID === 'ml3way') {
    if (sideID === 'home') return home;
    if (sideID === 'away') return away;
    if (sideID === 'draw') return 'Draw';
    return sideID;
  }
  if (betTypeID === 'sp') {
    const team = sideID === 'home' ? home : away;
    if (line == null) return team;
    const n = Number(line);
    const sign = n > 0 ? '+' : '';
    return `${team} ${sign}${n}`;
  }
  if (betTypeID === 'ou') {
    const dir = sideID === 'over' ? 'Over' : 'Under';
    return line != null ? `${dir} ${line}` : dir;
  }
  return sideID;
}

// ---------- best-price extraction ----------

function buildMarkets(event) {
  const odds = event?.odds;
  if (!odds || typeof odds !== 'object') return new Map();

  const mainPeriod = MAIN_PERIOD_BY_LEAGUE[event.leagueID] || 'game';
  const markets = new Map();

  for (const oddID in odds) {
    const odd = odds[oddID];
    if (!odd || odd.cancelled) continue;
    if (odd.periodID !== mainPeriod) continue;

    const isTwoWay = !!TWO_WAY_MARKETS[odd.betTypeID];
    const isThreeWay = !!THREE_WAY_MARKETS[odd.betTypeID];
    if (!isTwoWay && !isThreeWay) continue;
    if (!odd.byBookmaker || typeof odd.byBookmaker !== 'object') continue;

    for (const bookmakerID in odd.byBookmaker) {
      // Filter out blocked / exchange bookmakers
      if (!isAllowedBookmaker(bookmakerID)) continue;

      const book = odd.byBookmaker[bookmakerID];
      if (!book || book.available === false) continue;

      const american = book.odds;
      const decimal = americanToDecimal(american);
      if (!decimal) continue;

      let line = null;
      if (odd.betTypeID === 'sp') line = book.spread != null ? Number(book.spread) : null;
      else if (odd.betTypeID === 'ou') line = book.overUnder != null ? Number(book.overUnder) : null;

      // Skip novelty total markets (Over/Under 0.5, 1.5)
      if (odd.betTypeID === 'ou' && line != null && line < MIN_REALISTIC_TOTAL) continue;

      const lineKey = line != null ? Math.abs(line).toFixed(2) : 'na';
      const marketKey = `${odd.betTypeID}|${lineKey}`;

      if (!markets.has(marketKey)) {
        markets.set(marketKey, { betTypeID: odd.betTypeID, line, sides: {} });
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

// ---------- arb detection ----------

function fingerprintArb(eventID, betTypeID, lineKey, sides) {
  const sideKeys = Object.keys(sides).sort();
  const parts = sideKeys.map((s) => `${s}:${sides[s].bookmaker}`);
  return `${eventID}|${betTypeID}|${lineKey}|${parts.join(',')}`;
}

function findArbsInEvent(event) {
  const arbs = [];
  const markets = buildMarkets(event);

  const home = teamShort(event, 'home');
  const away = teamShort(event, 'away');
  const game = `${away} @ ${home}`;
  const sport = (event.leagueID || '').toLowerCase();
  const time = event?.status?.startsAt || event?.startTime || null;
  const eventID = event?.eventID || event?.id || `${away}-${home}-${time}`;

  for (const [marketKey, market] of markets) {
    const sideIDs = Object.keys(market.sides);
    const isTwoWay = !!TWO_WAY_MARKETS[market.betTypeID];
    const isThreeWay = !!THREE_WAY_MARKETS[market.betTypeID];

    if (isTwoWay && sideIDs.length !== 2) continue;
    if (isThreeWay && sideIDs.length !== 3) continue;

    // Require different bookmakers on each leg — can't arb a book vs itself
    const bookmakers = sideIDs.map((s) => market.sides[s].bookmaker);
    if (new Set(bookmakers).size !== sideIDs.length) continue;

    const implied = sideIDs.map((s) => decimalToImplied(market.sides[s].decimal));
    if (implied.some((p) => p == null)) continue;

    const impliedSum = implied.reduce((a, b) => a + b, 0);
    if (impliedSum >= 1) continue;

    const profit = (1 - impliedSum) * 100;

    // Reject impossibly large profits (bad data)
    if (profit > MAX_REALISTIC_PROFIT_PCT) continue;

    const lineKey = marketKey.split('|')[1];

    const stakeShares = implied.map((p) => Math.round((p / impliedSum) * 100));
    const drift = 100 - stakeShares.reduce((a, b) => a + b, 0);
    if (drift !== 0) stakeShares[0] += drift;

    const marketLabel = isThreeWay
      ? THREE_WAY_MARKETS[market.betTypeID]
      : TWO_WAY_MARKETS[market.betTypeID];

    if (isTwoWay) {
      const [aID, bID] = sideIDs;
      const a = market.sides[aID];
      const b = market.sides[bID];
      arbs.push({
        eventID,
        fingerprint: fingerprintArb(eventID, market.betTypeID, lineKey, market.sides),
        game, sport, time,
        bA: a.bookmaker,
        oA: formatAmerican(a.american),
        betA: `${buildSideLabel(event, aID, market.betTypeID, a.line)} on ${a.bookmaker}`,
        bB: b.bookmaker,
        oB: formatAmerican(b.american),
        betB: `${buildSideLabel(event, bID, market.betTypeID, b.line)} on ${b.bookmaker}`,
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
        fingerprint: fingerprintArb(eventID, market.betTypeID, lineKey, market.sides),
        game, sport, time,
        threeWay: true,
        legs: sides.map((s) => ({
          bookmaker: s.bookmaker,
          odds: formatAmerican(s.american),
          bet: `${buildSideLabel(event, s.sideID, market.betTypeID, s.line)} on ${s.bookmaker}`,
          stake: s.share,
        })),
        bA: sides[0].bookmaker,
        oA: formatAmerican(sides[0].american),
        betA: `${buildSideLabel(event, sides[0].sideID, market.betTypeID, sides[0].line)} on ${sides[0].bookmaker}`,
        bB: sides[1].bookmaker,
        oB: formatAmerican(sides[1].american),
        betB: `${buildSideLabel(event, sides[1].sideID, market.betTypeID, sides[1].line)} on ${sides[1].bookmaker}`,
        profit: Number(profit.toFixed(2)),
        sA: stakeShares[0],
        sB: stakeShares[1],
        market: marketLabel,
      });
    }
  }

  return arbs;
}

// ---------- public API ----------

export async function scanAllLeagues(apiKey) {
  const results = await Promise.all(
    LEAGUES.map((lg) => fetchEventsForLeague(lg, apiKey))
  );
  const events = results.flat();
  const arbs = events.flatMap(findArbsInEvent);
  arbs.sort((a, b) => b.profit - a.profit);
  return { arbs, eventCount: events.length };
}