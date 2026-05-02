const API_KEY = '79c293ec2b367b3db5f733d9ba433876'

const SPORT_MAP = {
  'BASEBALL': 'mlb', 'BASKETBALL': 'nba', 'FOOTBALL': 'nfl',
  'HOCKEY': 'nhl', 'SOCCER': 'soccer', 'TENNIS': 'tennis',
}

const OPPOSING_SIDES = {
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

    for (const [oddID, oddData] of Object.entries(odds)) {
      if (!oddData?.byBookmaker) continue
      if (!oddData.bookOddsAvailable) continue
      const parts = oddID.split('-')
      if (parts.length < 2) continue
      const sideID = parts[parts.length - 1]
      const opposingSideID = OPPOSING_SIDES[sideID]
      if (!opposingSideID) continue
      if (sideID === 'away' || sideID === 'under' || sideID === 'no') continue
      const opposingOddID = [...parts.slice(0, -1), opposingSideID].join('-')
      const opposingOddData = odds[opposingOddID]
      if (!opposingOddData?.byBookmaker || !opposingOddData.bookOddsAvailable) continue

      const sidePrices = []
      for (const [bk, bd] of Object.entries(oddData.byBookmaker)) {
        if (!bd?.available) continue
        const price = parseFloat(bd?.odds)
        if (!isNaN(price)) sidePrices.push({ bk, price })
      }

      const opposingPrices = []
      for (const [bk, bd] of Object.entries(opposingOddData.byBookmaker)) {
        if (!bd?.available) continue
        const price = parseFloat(bd?.odds)
        if (!isNaN(price)) opposingPrices.push({ bk, price })
      }

      for (const a of sidePrices) {
        for (const b of opposingPrices) {
          if (a.bk === b.bk) continue
          const decA = toDecimal(a.price)
          const decB = toDecimal(b.price)
          if (!decA || !decB) continue
          const total = (1 / decA) + (1 / decB)
          const pct = (1 - total) * 100
          if (pct < 0.1 || pct > 8) continue

          const stakeA = Math.round((1 / decA) / total * 100)
          const stakeB = Math.round((1 / decB) / total * 100)
          const marketName = oddData.marketName || oddID

          let betA, betB
          if (sideID === 'home') {
            betA = `Bet ${homeTeam}`
            betB = `Bet ${awayTeam}`
          } else if (sideID === 'over') {
            betA = `Bet Over`
            betB = `Bet Under`
          } else {
            betA = `Bet ${sideID}`
            betB = `Bet ${opposingSideID}`
          }

          arbs.push({
            game: gameName, sport, time,
            bA: a.bk, oA: a.price > 0 ? `+${a.price}` : `${a.price}`, betA,
            bB: b.bk, oB: b.price > 0 ? `+${b.price}` : `${b.price}`, betB,
            profit: parseFloat(pct.toFixed(2)),
            sA: stakeA, sB: stakeB,
            market: marketName,
          })
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
      `https://api.sportsgameodds.com/v2/events?apiKey=${API_KEY}&leagueID=MLB,NBA,NHL,NFL,SOCCER,ATP,TENNIS&oddsAvailable=true&limit=50&startsAfter=${new Date().toISOString()}`,
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