const API_KEY = '79c293ec2b367b3db5f733d9ba433876'

function toDecimal(american) {
  if (!american || isNaN(american)) return null
  const n = parseFloat(american)
  if (n > 0) return (n / 100) + 1
  return (100 / Math.abs(n)) + 1
}

function findArbs(events) {
  const arbs = []

  for (const event of events) {
    const gameName = `${event.teams?.away?.names?.medium || 'Away'} vs ${event.teams?.home?.names?.medium || 'Home'}`
    const sport = (event.sportID || 'unknown').toLowerCase()
    const time = event.startsAt || ''

    const oddsObj = event.odds || {}

    // Group by market then by outcome
    const markets = {}
    for (const [bookmaker, marketData] of Object.entries(oddsObj)) {
      if (typeof marketData !== 'object') continue
      for (const [marketKey, outcomes] of Object.entries(marketData)) {
        if (typeof outcomes !== 'object') continue
        if (!markets[marketKey]) markets[marketKey] = {}
        for (const [side, price] of Object.entries(outcomes)) {
          if (!markets[marketKey][side]) markets[marketKey][side] = []
          markets[marketKey][side].push({ bookmaker, price })
        }
      }
    }

    // Find arbs across books
    for (const [market, sides] of Object.entries(markets)) {
      const sideKeys = Object.keys(sides)
      if (sideKeys.length < 2) continue

      const sideA = sides[sideKeys[0]] || []
      const sideB = sides[sideKeys[1]] || []

      for (const a of sideA) {
        for (const b of sideB) {
          if (a.bookmaker === b.bookmaker) continue
          const decA = toDecimal(a.price)
          const decB = toDecimal(b.price)
          if (!decA || !decB) continue
          const total = (1 / decA) + (1 / decB)
          if (total < 1) {
            const profit = ((1 - total) * 100).toFixed(2)
            arbs.push({
              game: gameName,
              sport,
              time,
              bA: a.bookmaker,
              oA: a.price > 0 ? `+${a.price}` : `${a.price}`,
              bB: b.bookmaker,
              oB: b.price > 0 ? `+${b.price}` : `${b.price}`,
              profit: parseFloat(profit),
              sA: Math.round((1 / decA) / total * 100),
              sB: Math.round((1 / decB) / total * 100),
              market,
            })
          }
        }
      }
    }
  }

  return arbs.sort((a, b) => b.profit - a.profit)
}

export async function GET() {
  try {
    const res = await fetch(
      `https://api.sportsgameodds.com/v2/events?apiKey=${API_KEY}&oddsAvailable=true&limit=100&includeOdds=true`,
      { next: { revalidate: 30 } }
    )
    const data = await res.json()
    const events = data.data || []
    const arbs = findArbs(events)
    return Response.json({ arbs, total: arbs.length })
  } catch (e) {
    return Response.json({ arbs: [], error: e.message })
  }
}