const API_KEY = '79c293ec2b367b3db5f733d9ba433876'

function toDecimal(american) {
  if (american > 0) return (american / 100) + 1
  return (100 / Math.abs(american)) + 1
}

function findArbs(events) {
  const arbs = []
  for (const event of events) {
    const odds = event.odds || []
    const markets = {}
    for (const odd of odds) {
      const key = odd.marketType
      if (!markets[key]) markets[key] = []
      markets[key].push(odd)
    }
    for (const [market, lines] of Object.entries(markets)) {
      const overs = lines.filter(l => l.side === 'over' || l.side === 'home')
      const unders = lines.filter(l => l.side === 'under' || l.side === 'away')
      for (const o of overs) {
        for (const u of unders) {
          if (o.sportsbook === u.sportsbook) continue
          const decO = toDecimal(o.price)
          const decU = toDecimal(u.price)
          const total = (1 / decO) + (1 / decU)
          if (total < 1) {
            const profit = ((1 - total) * 100).toFixed(2)
            arbs.push({
              game: event.awayTeam + ' vs ' + event.homeTeam,
              sport: event.sport?.toLowerCase() || 'unknown',
              time: event.startTime,
              bA: o.sportsbook,
              oA: o.price > 0 ? '+' + o.price : '' + o.price,
              bB: u.sportsbook,
              oB: u.price > 0 ? '+' + u.price : '' + u.price,
              profit: parseFloat(profit),
              sA: ((1 / decO) / total * 100).toFixed(0),
              sB: ((1 / decU) / total * 100).toFixed(0),
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
      `https://api.sportsgameodds.com/v2/events?apiKey=${API_KEY}&oddsAvailable=true&limit=100`,
      { next: { revalidate: 30 } }
    )
    const data = await res.json()
    const arbs = findArbs(data.data || [])
    return Response.json({ arbs })
  } catch (e) {
    return Response.json({ arbs: [], error: e.message })
  }
}