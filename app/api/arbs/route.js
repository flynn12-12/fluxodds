// app/api/arbs/route.js — TEMPORARY DIAGNOSTIC v2
// Inspects: player props structure, period markets, AND event.status fields
// so we can correctly filter out live games.

const SGO_BASE = 'https://api.sportsgameodds.com/v2'
const LEAGUES = ['MLB', 'NBA', 'NHL', 'NFL', 'EPL', 'MLS', 'ATP']

async function fetchEvents(leagueID, apiKey) {
  const url = new URL(`${SGO_BASE}/events`)
  url.searchParams.set('leagueID', leagueID)
  url.searchParams.set('finalized', 'false')
  url.searchParams.set('oddsAvailable', 'true')
  url.searchParams.set('limit', '20')
  const res = await fetch(url.toString(), {
    headers: { 'x-api-key': apiKey },
    cache: 'no-store',
  })
  if (!res.ok) return { ok: false, status: res.status, events: [] }
  const json = await res.json()
  return { ok: true, events: Array.isArray(json?.data) ? json.data : [] }
}

export async function GET() {
  const apiKey = process.env.SPORTSGAMEODDS_API_KEY
  if (!apiKey) return Response.json({ error: 'no api key' }, { status: 500 })

  const results = await Promise.all(LEAGUES.map(lg => fetchEvents(lg, apiKey)))

  const diagnostics = LEAGUES.map((leagueID, idx) => {
    const { ok, status, events } = results[idx]
    if (!ok) return { leagueID, ok: false, status }

    const periodIDs = new Set()
    const betTypeIDs = new Set()
    const statIDs = new Set()
    const sideIDs = new Set()

    let firstPropSample = null
    let firstPeriodSample = null
    let firstEventPlayers = null
    let firstEventStatus = null
    let firstEventTopLevelKeys = null
    // Count events that look "live" vs "upcoming" by various heuristics
    const liveHeuristic = { startedTrue: 0, startedFalse: 0, completedTrue: 0, completedFalse: 0, withScores: 0, total: 0 }

    for (const ev of events) {
      liveHeuristic.total++
      if (ev?.status?.started === true) liveHeuristic.startedTrue++
      if (ev?.status?.started === false) liveHeuristic.startedFalse++
      if (ev?.status?.completed === true) liveHeuristic.completedTrue++
      if (ev?.status?.completed === false) liveHeuristic.completedFalse++
      if (ev?.results || ev?.score) liveHeuristic.withScores++

      if (!firstEventStatus && ev.status) {
        firstEventStatus = ev.status
        firstEventTopLevelKeys = Object.keys(ev)
      }

      if (!firstEventPlayers && ev.players && Object.keys(ev.players).length > 0) {
        const playerIDs = Object.keys(ev.players).slice(0, 3)
        firstEventPlayers = playerIDs.map(pid => ({
          playerID: pid,
          names: ev.players[pid]?.names,
          keys: Object.keys(ev.players[pid] || {}),
        }))
      }

      const odds = ev?.odds
      if (!odds) continue

      for (const oddID in odds) {
        const o = odds[oddID]
        if (!o) continue
        if (o.periodID) periodIDs.add(o.periodID)
        if (o.betTypeID) betTypeIDs.add(o.betTypeID)
        if (o.statID) statIDs.add(o.statID)
        if (o.sideID) sideIDs.add(o.sideID)

        const isTeamSide = ['home', 'away', 'over', 'under', 'draw', 'home+draw', 'away+draw', 'not_draw', 'yes', 'no', 'even', 'odd'].includes(o.sideID)
        if (!firstPropSample && !isTeamSide && o.byBookmaker) {
          const firstBookKey = Object.keys(o.byBookmaker)[0]
          firstPropSample = {
            oddID,
            betTypeID: o.betTypeID,
            periodID: o.periodID,
            statID: o.statID,
            sideID: o.sideID,
            statEntityID: o.statEntityID,
            marketName: o.marketName,
            keys: Object.keys(o),
            firstBookmaker: { id: firstBookKey, ...o.byBookmaker[firstBookKey] },
          }
        }

        if (!firstPeriodSample && o.periodID && !['game', 'reg'].includes(o.periodID) && o.byBookmaker) {
          const firstBookKey = Object.keys(o.byBookmaker)[0]
          firstPeriodSample = {
            oddID,
            betTypeID: o.betTypeID,
            periodID: o.periodID,
            statID: o.statID,
            sideID: o.sideID,
            marketName: o.marketName,
            keys: Object.keys(o),
            firstBookmaker: { id: firstBookKey, ...o.byBookmaker[firstBookKey] },
          }
        }
      }
    }

    return {
      leagueID,
      eventCount: events.length,
      liveHeuristic,
      firstEventTopLevelKeys,
      firstEventStatus,
      periodIDs: [...periodIDs],
      betTypeIDs: [...betTypeIDs],
      statIDs: [...statIDs].slice(0, 30),
      sideIDs: [...sideIDs],
      firstPropSample,
      firstPeriodSample,
      firstEventPlayers,
    }
  })

  return Response.json({ diagnostics }, { headers: { 'Cache-Control': 'no-store' } })
}