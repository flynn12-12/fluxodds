const API_KEY = '79c293ec2b367b3db5f733d9ba433876'

function toDecimal(american) {
  if (!american) return null
  const n = parseFloat(american)
  if (isNaN(n)) return null
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

    // Group by market (everything except last part = sideID)
    const markets = {}

    for (const [oddID, oddData] of Object.entries(odds)) {
      if (!oddData?.byBookmaker) continue
      if (!oddData.bookOddsAvailable) continue

      const parts = oddID.split('-')
      if (parts.length < 2) continue
      const sideID = parts[parts.length - 1]
      const marketKey = parts.slice(0, -1).join('-')

      if (!markets[marketKey]) markets[marketKey] = {}
      if (!markets[marketKey][sideID]) markets[marketKey][sideID] = []

      for (const [bookmaker, bookData] of Object.entries(oddData.byBookmaker)) {
        if (!bookData?.available) continue
        const price = bookData?.odds
        if (price != null) {
          markets[marketKey][sideID].push({ bookmaker, price: parseFloat(price) })
        }
      }
    }

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
              game: gameName, sport, time,
              bA: a.bookmaker,
              oA: a.price > 0 ? `+${a.price}` : `${a.price}`,
              bB: b.bookmaker,
              oB: b.price > 0 ? `+${b.price}` : `${b.price}`,
              profit: parseFloat(profit),
              sA: Math.round((1/decA)/total*100),
              sB: Math.round((1/decB)/total*100),
              market,
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
  const url = `https://api.sportsgameodds.com/v2/events?apiKey=${API_KEY}&leagueID=MLB,NHL&oddsAvailable=true&limit=5`
  try {
    const res = await fetch(url, { cache: 'no-store' })
    const text = await res.text()
    return new Response(text, { headers: { 'content-type': 'application/json' } })
  } catch (e) {
    return Response.json({ error: e.message, url })
  }
}