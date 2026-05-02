const API_KEY = '79c293ec2b367b3db5f733d9ba433876'

const BAD_BOOKS = new Set(['unknown', 'kalshi', 'polymarket', 'sporttrade', 'novig', 'prophetexchange'])

const SPORT_MAP = {
  'BASEBALL': 'mlb', 'BASKETBALL': 'nba', 'FOOTBALL': 'nfl',
  'HOCKEY': 'nhl', 'SOCCER': 'soccer', 'TENNIS': 'tennis',
}

const OPPOSING = {
  'home': 'away', 'away': 'home',
  'over': 'under', 'under': 'over',
  'yes': 'no', 'no': 'yes',
}

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
    if (event.status?.started || event.status?.live) continue

    const awayTeam = event.teams?.away?.names?.medium || 'Away'
    const homeTeam = event.teams?.home?.names?.medium || 'Home'
    const gameName = `${awayTeam} vs ${homeTeam}`
    const sport = SPORT_MAP[event.sportID] || (event.sportID || 'unknown').toLowerCase()
    const time = event.startsAt || ''
    const odds = event.odds
    if (!odds || typeof odds !== 'object') continue

    // Group by marketBase + sideID
    const groups = {}
    for (const [oddID, oddData] of Object.entries(odds)) {
      if (!oddData?.byBookmaker) continue
      if (!oddData.bookOddsAvailable) continue
      const parts = oddID.split('-')
      if (parts.length < 2) continue
      const sideID = parts[parts.length - 1]
      const marketBase = parts.slice(0, -1).join('-')
      if (!groups[marketBase]) groups[marketBase] = {}
      if (!groups[marketBase][sideID]) groups[marketBase][sideID] = []
      for (const [bk, bd] of Object.entries(oddData.byBookmaker)) {
        if (!bd?.available) continue
        if (BAD_BOOKS.has(bk.toLowerCase())) continue
        const price = parseFloat(bd?.odds)
        if (!isNaN(price)) groups[marketBase][sideID].push({ bk, price, marketName: oddData.marketName || marketBase })
      }
    }

    // Find arbs
    for (const [marketBase, sides] of Object.entries(groups)) {
      for (const [sideA, sideB] of [['home','away'],['over','under'],['yes','no']]) {
        const pricesA = sides[sideA] || []
        const pricesB = sides[sideB] || []
        if (!pricesA.length || !pricesB.length) continue

        for (const a of pricesA) {
          for (const b of pricesB) {
            if (a.bk === b.bk) continue
            const decA = toDecimal(a.price)
            const decB = toDecimal(b.price)
            if (!decA || !decB) continue
            const total = (1 / decA) + (1 / decB)
            const pct = (1 - total) * 100
            if (pct < 0.1 || pct > 8) continue

            const stakeA = Math.round((1 / decA) / total * 100)
            const stakeB = Math.round((1 / decB) / total * 100)

            let betA, betB
            if (sideA === 'home') {
              betA = `${homeTeam} on ${a.bk}`
              betB = `${awayTeam} on ${b.bk}`
            } else if (sideA === 'over') {
              betA = `Over on ${a.bk}`
              betB = `Under on ${b.bk}`
            } else {
              betA = `Yes on ${a.bk}`
              betB = `No on ${b.bk}`
            }

            arbs.push({
              game: gameName, sport, time,
              bA: a.bk, oA: a.price > 0 ? `+${a.price}` : `${a.price}`, betA,
              bB: b.bk, oB: b.price > 0 ? `+${b.price}` : `${b.price}`, betB,
              profit: parseFloat(pct.toFixed(2)),
              sA: stakeA, sB: stakeB,
              market: a.marketName,
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
      `https://api.sportsgameodds.com/v2/events?apiKey=${API_KEY}&leagueID=MLB,NBA,NHL,NFL,SOCCER&oddsAvailable=true&limit=50`,
      { cache: 'no-store' }
    )
    const data = await res.json()
    const events = data.data || []
    const arbs = findArbs(events)
    return Response.json({ arbs: arbs.slice(0, 60), total: arbs.slice(0, 60).length, eventCount: events.length })
  } catch (err) {
    return Response.json({ arbs: [], error: err.message })
  }
}