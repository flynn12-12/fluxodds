export const revalidate = 30
export const maxDuration = 30

const API_KEY = '79c293ec2b367b3db5f733d9ba433876'

const BAD_BOOKS = new Set(['unknown', 'kalshi', 'polymarket', 'sporttrade', 'novig', 'prophetexchange'])

const SPORT_MAP = {
  'BASEBALL': 'mlb', 'BASKETBALL': 'nba', 'FOOTBALL': 'nfl',
  'HOCKEY': 'nhl', 'SOCCER': 'soccer', 'TENNIS': 'tennis',
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

    // Group odds by their "market base" (oddID without the sideID at the end)
    // For each market base, collect all sides and their bookmaker prices
    const marketGroups = {}

    for (const [oddID, oddData] of Object.entries(odds)) {
      if (!oddData?.byBookmaker) continue
      if (!oddData.bookOddsAvailable) continue

      const parts = oddID.split('-')
      if (parts.length < 2) continue

      const sideID = parts[parts.length - 1]
      const marketBase = parts.slice(0, -1).join('-')

      if (!marketGroups[marketBase]) marketGroups[marketBase] = {}
      if (!marketGroups[marketBase][sideID]) marketGroups[marketBase][sideID] = []

      // Get the line value for this oddID (for props like over/under)
      const lineValue = oddData.overUnder || oddData.line || null

      for (const [bookmaker, bookData] of Object.entries(oddData.byBookmaker)) {
        if (!bookData?.available) continue
        if (BAD_BOOKS.has(bookmaker.toLowerCase())) continue
        const price = parseFloat(bookData?.odds)
        if (!isNaN(price)) {
          marketGroups[marketBase][sideID].push({
            bookmaker,
            price,
            line: lineValue,
            marketName: oddData.marketName || marketBase,
          })
        }
      }
    }

    // Find arbs within each market
    for (const [marketBase, sides] of Object.entries(marketGroups)) {
      const sideKeys = Object.keys(sides)
      if (sideKeys.length < 2) continue

      // Get opposing sides
      const pairs = [
        ['home', 'away'],
        ['over', 'under'],
        ['yes', 'no'],
      ]

      for (const [sideA, sideB] of pairs) {
        const pricesA = sides[sideA] || []
        const pricesB = sides[sideB] || []

        if (pricesA.length === 0 || pricesB.length === 0) continue

        for (const a of pricesA) {
          for (const b of pricesB) {
            if (a.bookmaker === b.bookmaker) continue

            // For over/under props, only compare same line
            if (sideA === 'over' && a.line !== null && b.line !== null && a.line !== b.line) continue

            const decA = toDecimal(a.price)
            const decB = toDecimal(b.price)
            if (!decA || !decB) continue

            const total = (1 / decA) + (1 / decB)
            const profitPct = (1 - total) * 100

            // Real arbs only: 0.1% to 8%
            if (profitPct < 0.1 || profitPct > 8) continue

            const stakeA = Math.round((1 / decA) / total * 100)
            const stakeB = Math.round((1 / decB) / total * 100)

            // Build human-readable bet instructions
            let betA, betB
            const marketName = a.marketName

            if (sideA === 'home') {
              betA = `${homeTeam} on ${a.bookmaker}`
              betB = `${awayTeam} on ${b.bookmaker}`
            } else if (sideA === 'over') {
              const line = a.line ? ` ${a.line}` : ''
              betA = `Over${line} on ${a.bookmaker}`
              betB = `Under${line} on ${b.bookmaker}`
            } else {
              betA = `${sideA} on ${a.bookmaker}`
              betB = `${sideB} on ${b.bookmaker}`
            }

            arbs.push({
              game: gameName,
              sport,
              time,
              bA: a.bookmaker,
              oA: a.price > 0 ? `+${a.price}` : `${a.price}`,
              betA,
              bB: b.bookmaker,
              oB: b.price > 0 ? `+${b.price}` : `${b.price}`,
              betB,
              profit: parseFloat(profitPct.toFixed(2)),
              sA: stakeA,
              sB: stakeB,
              market: marketName,
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
      `https://api.sportsgameodds.com/v2/events?apiKey=${API_KEY}&leagueID=MLB,NBA,NHL,NFL,SOCCER&oddsAvailable=true&limit=50`,
      { next: { revalidate: 30 } }
    )
    const data = await res.json()
    const events = data.data || []
    const arbs = findArbs(events)
    return Response.json({ arbs: arbs.slice(0, 60), total: arbs.slice(0, 60).length, eventCount: events.length })
  } catch (err) {
    return Response.json({ arbs: [], error: err.message })
  }
}