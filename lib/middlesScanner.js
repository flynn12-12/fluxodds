// lib/middlesScanner.js
//
// Middles scanner for FluxOdds.
//
// A "middle" occurs when two sportsbooks offer overlapping lines on the same
// spread or total market. Example:
//   Book A: Over 220.5 (-110)   Book B: Under 222.5 (-110)
//   If the total lands 221 or 222, BOTH bets win.
//   If it lands outside that window, one side loses but the other wins,
//   so the combined loss is small (just the juice).
//
// We scan for middles on spread (sp) and over/under (ou) markets where two
// bookmakers show different lines with a gap (the "middle window").

import { SGO_LEAGUES as LEAGUES, fetchAllSgoLeagues, summarizeLeagueFetches } from './sgoClient';

export { LEAGUES };

const SUPPORTED_BETTYPES = new Set(['sp', 'ou']);

const BLOCKED_BOOKMAKERS = new Set(['unknown']);
const EXCHANGE_LIKE_BOOKMAKERS = new Set([
  'polymarket', 'kalshi', 'betfairexchange', 'prophetexchange',
  'prizepicks', 'underdog', 'novig', 'sporttrade',
]);
const EXCLUDE_EXCHANGES = true;

// Only show middles where the combined juice cost is reasonable.
// A middle with 20% juice isn't worth it even if the window is wide.
const MAX_JUICE_PCT = 12;

// Minimum gap between lines to count as a middle (in points/runs/etc).
const MIN_MIDDLE_GAP = 0.5;

// Skip unrealistically wide windows — usually stale data.
const MAX_MIDDLE_GAP = 30;

function isAllowedBookmaker(id) {
  if (!id) return false;
  if (BLOCKED_BOOKMAKERS.has(id)) return false;
  if (EXCLUDE_EXCHANGES && EXCHANGE_LIKE_BOOKMAKERS.has(id)) return false;
  return true;
}

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

function decimalToImplied(d) {
  return d && d > 1 ? 1 / d : null;
}

function formatAmerican(a) {
  const n = Number(a);
  if (!Number.isFinite(n)) return String(a);
  return n > 0 ? `+${n}` : `${n}`;
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

const STAT_LABELS = {
  points: 'points', assists: 'assists', rebounds: 'rebounds',
  'points+assists': 'points+assists', 'points+rebounds': 'points+rebounds',
  'points+rebounds+assists': 'points+rebs+assists', 'rebounds+assists': 'rebounds+assists',
  threePointersMade: '3-pointers made', blocks: 'blocks', steals: 'steals',
  batting_hits: 'hits', batting_homeRuns: 'home runs', batting_RBI: 'RBIs',
  batting_totalBases: 'total bases', batting_strikeouts: 'strikeouts',
  pitching_strikeouts: 'pitcher strikeouts', pitching_earnedRuns: 'earned runs',
  shots_onGoal: 'shots on goal', goals: 'goals', goalie_saves: 'saves',
  shots: 'shots', cornerKicks: 'corner kicks',
  games: 'games', serving_aces: 'aces',
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
  '1i': '1st Inn', '2i': '2nd Inn', '3i': '3rd Inn',
  '1ix3': 'F3', '1ix5': 'F5', '1ix7': 'F7',
  '1s': '1st Set', '2s': '2nd Set',
};
const periodLabel = (id) => PERIOD_LABELS[id] ?? id;

function isPlayerProp(event, statEntityID) {
  if (!statEntityID) return false;
  if (statEntityID === 'home' || statEntityID === 'away' || statEntityID === 'all') return false;
  return !!event?.players?.[statEntityID];
}

function buildMarketLabel(event, odd) {
  if (odd.marketName) return odd.marketName;
  const pTag = periodLabel(odd.periodID);
  const isProp = isPlayerProp(event, odd.statEntityID);
  if (isProp) {
    const pname = playerName(event, odd.statEntityID);
    return `${pname} — ${statLabel(odd.statID)}`;
  }
  let base;
  if (odd.betTypeID === 'sp') base = 'Spread';
  else if (odd.betTypeID === 'ou') base = 'Total';
  else base = odd.betTypeID;
  return pTag ? `${base} (${pTag})` : base;
}

// ---------- COLLECT ALL BOOKMAKER LINES PER MARKET ----------

/**
 * Instead of collapsing to best-price-per-side like the arb scanner, we keep
 * every distinct (bookmaker, line) combination so we can compare lines across books.
 *
 * Groups by: (statID, statEntityID, periodID, betTypeID) — WITHOUT line,
 * because we specifically WANT to compare different lines.
 */
function buildMiddleMarkets(event) {
  const odds = event?.odds;
  if (!odds || typeof odds !== 'object') return new Map();

  const markets = new Map();

  for (const oddID in odds) {
    const odd = odds[oddID];
    if (!odd || odd.cancelled) continue;
    if (!SUPPORTED_BETTYPES.has(odd.betTypeID)) continue;
    if (!odd.byBookmaker) continue;

    for (const bookmakerID in odd.byBookmaker) {
      if (!isAllowedBookmaker(bookmakerID)) continue;
      const book = odd.byBookmaker[bookmakerID];
      if (!book || book.available === false) continue;

      const decimal = americanToDecimal(book.odds);
      if (!decimal) continue;

      let line = null;
      if (odd.betTypeID === 'sp' && book.spread != null) line = Number(book.spread);
      else if (odd.betTypeID === 'ou' && book.overUnder != null) line = Number(book.overUnder);
      if (line == null) continue;

      // Key WITHOUT line so we group all lines for the same market together
      const marketKey = [
        odd.statID || '', odd.statEntityID || '',
        odd.periodID || '', odd.betTypeID || '',
      ].join('|');

      if (!markets.has(marketKey)) {
        markets.set(marketKey, { oddTemplate: odd, entries: [] });
      }
      markets.get(marketKey).entries.push({
        sideID: odd.sideID,
        bookmakerID,
        american: book.odds,
        decimal,
        line,
      });
    }
  }

  return markets;
}

// ---------- MIDDLE DETECTION ----------

function findMiddlesInEvent(event) {
  if (!isPrematch(event)) return [];

  const markets = buildMiddleMarkets(event);
  const middles = [];

  const home = teamShort(event, 'home');
  const away = teamShort(event, 'away');
  const game = `${away} @ ${home}`;
  const sport = (event.leagueID || '').toLowerCase();
  const time = event?.status?.startsAt || null;
  const eventID = event?.eventID || `${away}-${home}-${time}`;

  for (const [marketKey, market] of markets) {
    const { oddTemplate, entries } = market;
    const marketLabel = buildMarketLabel(event, oddTemplate);

    if (oddTemplate.betTypeID === 'ou') {
      // Over/Under middles: find book A with Over X and book B with Under Y where Y > X
      const overs = entries.filter(e => e.sideID === 'over');
      const unders = entries.filter(e => e.sideID === 'under');

      for (const ov of overs) {
        for (const un of unders) {
          if (ov.bookmakerID === un.bookmakerID) continue;
          const gap = un.line - ov.line;
          if (gap < MIN_MIDDLE_GAP || gap > MAX_MIDDLE_GAP) continue;

          const implA = decimalToImplied(ov.decimal);
          const implB = decimalToImplied(un.decimal);
          if (!implA || !implB) continue;

          const totalJuice = (implA + implB - 1) * 100;
          if (totalJuice > MAX_JUICE_PCT) continue;

          const unit = (oddTemplate.statID === 'points' || oddTemplate.statID === 'goals')
            ? gameTotalUnit(event.leagueID)
            : statLabel(oddTemplate.statID);

          const fingerprint = `mid|${eventID}|${marketKey}|${ov.bookmakerID}:${ov.line}|${un.bookmakerID}:${un.line}`;

          middles.push({
            eventID,
            fingerprint,
            game, sport, time,
            market: marketLabel,
            type: 'total',
            lowLine: ov.line,
            highLine: un.line,
            gap,
            unit: unit || '',
            bA: ov.bookmakerID,
            oA: formatAmerican(ov.american),
            betA: `Over ${ov.line} ${unit}`,
            lineA: ov.line,
            bB: un.bookmakerID,
            oB: formatAmerican(un.american),
            betB: `Under ${un.line} ${unit}`,
            lineB: un.line,
            juice: Number(totalJuice.toFixed(2)),
          });
        }
      }
    }

    if (oddTemplate.betTypeID === 'sp') {
      // Spread middles: Book A has Team X at +3.5, Book B has Team Y at -2.5
      // which means if Team X loses by 3, both bets win.
      // Sides: home spread vs away spread.
      const homeEntries = entries.filter(e => e.sideID === 'home');
      const awayEntries = entries.filter(e => e.sideID === 'away');

      for (const h of homeEntries) {
        for (const a of awayEntries) {
          if (h.bookmakerID === a.bookmakerID) continue;

          // Home spread + away spread should sum > 0 for a middle to exist.
          // e.g. Home +3.5 (line=3.5) and Away -2.5 (line=-2.5) → 3.5 + (-2.5) = 1.0 > 0
          // Alternatively: Home -2.5 and Away +3.5 → -2.5 + 3.5 = 1.0 > 0
          const gap = h.line + a.line;
          if (gap < MIN_MIDDLE_GAP || gap > MAX_MIDDLE_GAP) continue;

          const implA = decimalToImplied(h.decimal);
          const implB = decimalToImplied(a.decimal);
          if (!implA || !implB) continue;

          const totalJuice = (implA + implB - 1) * 100;
          if (totalJuice > MAX_JUICE_PCT) continue;

          const hSign = h.line > 0 ? '+' : '';
          const aSign = a.line > 0 ? '+' : '';

          const fingerprint = `mid|${eventID}|${marketKey}|${h.bookmakerID}:h${h.line}|${a.bookmakerID}:a${a.line}`;

          middles.push({
            eventID,
            fingerprint,
            game, sport, time,
            market: marketLabel,
            type: 'spread',
            lowLine: Math.min(Math.abs(h.line), Math.abs(a.line)),
            highLine: Math.max(Math.abs(h.line), Math.abs(a.line)),
            gap,
            unit: 'pts',
            bA: h.bookmakerID,
            oA: formatAmerican(h.american),
            betA: `${home} ${hSign}${h.line}`,
            lineA: h.line,
            bB: a.bookmakerID,
            oB: formatAmerican(a.american),
            betB: `${away} ${aSign}${a.line}`,
            lineB: a.line,
            juice: Number(totalJuice.toFixed(2)),
          });
        }
      }
    }
  }

  // Sort: lowest juice first (cheapest middles are best)
  middles.sort((a, b) => a.juice - b.juice);
  return middles;
}

// ---------- PUBLIC ----------

export async function scanAllLeaguesForMiddles(apiKey) {
  const rows = await fetchAllSgoLeagues(apiKey);
  const { leaguesOk, fetchComplete, events: raw } = summarizeLeagueFetches(rows);
  const events = raw.filter(isPrematch);
  const scanHealthy = fetchComplete;
  const middles = events.flatMap(findMiddlesInEvent);
  middles.sort((a, b) => {
    // Prefer wider gaps, then lower juice
    if (b.gap !== a.gap) return b.gap - a.gap;
    return a.juice - b.juice;
  });
  return { middles, eventCount: events.length, scanHealthy, leaguesOk, leaguesAttempted: LEAGUES.length };
}
