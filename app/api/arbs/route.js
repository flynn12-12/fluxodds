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
    const odds = event.odds

    if (!odds || typeof odds !== 'object') continue

    // Group odds by market (statID-statEntityID-periodID-betTypeID), then by side
    const markets = {}

    for (const [oddID, oddData] of Object.entries(odds)) {
      if (!oddData?.byBookmaker) continue

      // oddID format: statID-statEntityID-periodID-betTypeID-sideID
      const parts = oddID.split('-')
      if (parts.length < 5) continue
      const sideID = parts[parts.length - 1]
      const marketKey = parts.slice(0, -1).join('-')

      if (!markets[marketKey]) markets[marketKey] = {}
      if (!markets[marketKey][sideID]) markets[marketKey][sideID] = []

      for (const [bookmaker, bookData] of Object.entries(oddData.byBookmaker)) {
        const price = bookData?.odds?.american
        if (price != null) {
          markets[marketKey][sideID].push({ bookmaker, price })
        }
      }
    }

    // Find arbs across sides
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
      `https://api.sportsgameodds.com/v2/events?apiKey=${API_KEY}&leagueID=NBA,NFL,MLB,NHL,SOCCER&oddsAvailable=true&limit=50`,
      { next: { revalidate: 30 } }
    )
    const data = await res.json()
    const events = data.data || []
    const arbs = findArbs(events)
    return Response.json({ arbs, total: arbs.length, eventCount: events.length })
  } catch (e) {
    return Response.json({ arbs: [], error: e.message })
  }
}