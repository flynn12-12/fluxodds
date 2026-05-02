const API_KEY = '79c293ec2b367b3db5f733d9ba433876'

function toDecimal(american) {
  if (!american) return null
  const n = parseFloat(american)
  if (isNaN(n)) return null
  if (n > 0) return (n / 100) + 1
  return (100 / Math.abs(n)) + 1
}

const OPPOSING_SIDES = {
  'home': 'away',
  'away': 'home',
  'over': 'under',
  'under': 'over',
  'yes': 'no',
  'no': 'yes',
}

const SPORT_MAP = {
  'BASEBALL': 'mlb',
  'BASKETBALL': 'nba',
  'FOOTBALL': 'nfl',
  'HOCKEY': 'nhl',
  'SOCCER': 'soccer',
  'TENNIS': 'tennis',
}

function findArbs(events) {
  const arbs = []

  for (const event of events) {
    // Skip live events - prematch only
    if (event.status?.started || event.status?.live) continue

    const gameName = `${event.teams?.away?.names?.medium || 'Away'} vs ${event.teams?.home?.names?.medium || 'Home'}`
    const sport = SPORT_MAP[event.sportID] || (event.sportID || 'unknown').toLowerCase()
    const time = event.startsAt || ''
    const odds = event.odds

    if (!odds || typeof odds !== 'object') continue

    // Only look at oddIDs that have an opposing side
    for (const [oddID, oddData] of Object.entries(odds)) {
      if (!oddData?.byBookmaker) continue
      if (!oddData.bookOddsAvailable) continue

      const parts = oddID.split('-')
      if (parts.length < 2) continue
      const sideID = parts[parts.length - 1]
      const opposingSideID = OPPOSING_SIDES[sideID]
      if (!opposingSideID) continue

      // Build opposing oddID
      const opposingOddID = [...parts.slice(0, -1), opposingSideID].join('-')
      const opposingOddData = odds[opposingOddID]
      if (!opposingOddData?.byBookmaker) continue
      if (!opposingOddData.bookOddsAvailable) continue

      // Only process each pair once (home before away, over before under)
      if (sideID === 'away' || sideID === 'under' || sideID === 'no') continue

      // Get all prices for side A and side B
      const sidePrices = []
      for (const [bookmaker, bookData] of Object.entries(oddData.byBookmaker)) {
        if (!bookData?.available) continue
        const price = parseFloat(bookData?.odds)
        if (!isNaN(price)) sidePrices.push({ bookmaker, price })
      }

      const opposingPrices = []
      for (const [bookmaker, bookData] of Object.entries(opposingOddData.byBookmaker)) {
        if (!bookData?.available) continue
        const price = parseFloat(bookData?.odds)
        if (!isNaN(price)) opposingPrices.push({ bookmaker, price })
      }

      // Find arbs across bookmakers
      for (const a of sidePrices) {
        for (const b of opposingPrices) {
          if (a.bookmaker === b.bookmaker) continue
          const decA = toDecimal(a.price)
          const decB = toDecimal(b.price)
          if (!decA || !decB) continue
          const total = (1 / decA) + (1 / decB)
          if (total < 1) {
            const profit = ((1 - total) * 100).toFixed(2)
            arbs.push({
              game: gameName, sport, time,
              bA: a.bookmaker,
              oA: a.price > 0 ? `+${a.price}` : `${a.price}`,
              bB: b.bookmaker,
              oB: b.price > 0 ? `+${b.price}` : `${b.price}`,
              profit: parseFloat(profit),
              sA: Math.round((1/decA)/total*100),
              sB: Math.round((1/decB)/total*100),
              market: oddData.marketName || oddID,
            })
          }
        }
      }
    }
  }

  return arbs.sort((a, b) => b.profit - a.profit)
}

export const maxDuration = 30

export async function GET() {
  try {
    const res = await fetch(
      `https://api.sportsgameodds.com/v2/events?apiKey=${API_KEY}&leagueID=MLB,NBA,NHL,NFL&oddsAvailable=true&limit=50`,
      { next: { revalidate: 10 } }
    )
    const data = await res.json()
    const events = data.data || []
    const arbs = findArbs(events)
    return Response.json({ arbs: arbs.slice(0, 60), total: arbs.slice(0, 60).length, eventCount: events.length })
  } catch (e) {
    return Response.json({ arbs: [], error: e.message })
  }
}