// Shared SportsGameOdds HTTP helpers — used by arb / live / EV / middles / bonus scans.
// Per-league timeouts prevent one stuck request from stalling the whole dashboard.

const SGO_BASE = 'https://api.sportsgameodds.com/v2';

export const SGO_LEAGUES = ['MLB', 'NBA', 'NHL', 'NFL', 'EPL', 'MLS', 'ATP'];

const DEFAULT_LEAGUE_TIMEOUT_MS = 14_000;

/**
 * Fetch one league's events. Returns { ok, events } so callers can count healthy leagues.
 * @param {string} leagueID
 * @param {string} apiKey
 * @param {{ signal?: AbortSignal, timeoutMs?: number, logLabel?: string }} [opts]
 */
export async function fetchSgoLeagueEvents(leagueID, apiKey, opts = {}) {
  const timeoutMs = opts.timeoutMs ?? DEFAULT_LEAGUE_TIMEOUT_MS;
  const logLabel = opts.logLabel ?? leagueID;
  const url = new URL(`${SGO_BASE}/events`);
  url.searchParams.set('leagueID', leagueID);
  url.searchParams.set('finalized', 'false');
  url.searchParams.set('oddsAvailable', 'true');
  url.searchParams.set('limit', '50');

  const controller = new AbortController();
  const outerSignal = opts.signal;
  let onAbort;
  if (outerSignal) {
    if (outerSignal.aborted) controller.abort();
    else {
      onAbort = () => controller.abort();
      outerSignal.addEventListener('abort', onAbort, { once: true });
    }
  }
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch(url.toString(), {
      headers: { 'x-api-key': apiKey },
      cache: 'no-store',
      signal: controller.signal,
    });
    if (!res.ok) {
      console.error(`SGO ${logLabel} failed: ${res.status} ${res.statusText}`);
      return { ok: false, events: [] };
    }
    let json;
    try {
      json = await res.json();
    } catch (e) {
      console.error(`SGO ${logLabel} JSON parse error:`, e?.message || e);
      return { ok: false, events: [] };
    }
    if (!Array.isArray(json?.data)) {
      console.error(`SGO ${logLabel}: unexpected response (expected data array)`);
      return { ok: false, events: [] };
    }
    return {
      ok: true,
      events: json.data.map((ev) => ({ ...ev, leagueID })),
    };
  } catch (e) {
    if (e?.name === 'AbortError') {
      console.error(`SGO ${logLabel}: aborted or timed out after ~${timeoutMs}ms`);
    } else {
      console.error(`SGO ${logLabel} fetch error:`, e?.message || e);
    }
    return { ok: false, events: [] };
  } finally {
    clearTimeout(timer);
    if (outerSignal && onAbort) outerSignal.removeEventListener('abort', onAbort);
  }
}

/**
 * Parallel fetch for all configured leagues.
 * @returns {Promise<Array<{ leagueID: string, ok: boolean, events: any[] }>>}
 */
export async function fetchAllSgoLeagues(apiKey, opts = {}) {
  const timeoutMs = opts.timeoutMs ?? DEFAULT_LEAGUE_TIMEOUT_MS;
  const results = await Promise.all(
    SGO_LEAGUES.map(async (leagueID) => {
      const { ok, events } = await fetchSgoLeagueEvents(leagueID, apiKey, { ...opts, timeoutMs, logLabel: leagueID });
      return { leagueID, ok, events };
    })
  );
  return results;
}

export function summarizeLeagueFetches(rows) {
  const leaguesOk = rows.filter((r) => r.ok).length;
  const fetchComplete = leaguesOk === SGO_LEAGUES.length;
  const events = rows.flatMap((r) => r.events || []);
  return { leaguesOk, fetchComplete, events, leaguesAttempted: SGO_LEAGUES.length };
}
