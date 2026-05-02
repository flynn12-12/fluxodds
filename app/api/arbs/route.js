const API_KEY = '79c293ec2b367b3db5f733d9ba433876'
const API_BASE = 'https://api.sportsgameodds.com/v2'
 
const SPORT_MAP = {
  'BASEBALL': 'mlb', 'BASKETBALL': 'nba', 'FOOTBALL': 'nfl',
  'HOCKEY': 'nhl', 'SOCCER': 'soccer', 'TENNIS': 'tennis',
}
 
function toDecimal(american) {
  const n = parseInt(american)
  if (isNaN(n)) return null
  if (n > 0) return (n / 100) + 1
  return (100 / Math.abs(n)) + 1
}
 
function findArbs(events) {
  const arbs = []
 
  for (const event of events) {
    const awayTeam = event.teams?.away?.names?.medium || event.teams?.away?.names?.long || 'Away'
    const homeTeam = event.teams?.home?.names?.medium || event.teams?.home?.names?.long || 'Home'
    const gameName = `${awayTeam} vs ${homeTeam}`
    const sport = SPORT_MAP[event.sportID] || (event.sportID || 'unknown').toLowerCase()
    const time = event.startsAt || ''
    const odds = event.odds
    if (!odds || typeof odds !== 'object') continue
 
    // Group by betType + periodID, then by side
    const markets = {}
    for (const [oddID, odd] of Object.entries(odds)) {
      if (!odd?.byBookmaker) continue
      const betType = odd.betTypeID
      const side = odd.sideID
      const period = odd.periodID || 'game'
 
      // Only full game odds
      if (period !== 'game') continue
 
      const key = `${betType}|${period}`
      if (!markets[key]) markets[key] = { betType, sides: {} }
      if (!markets[key].sides[side]) markets[key].sides[side] = []
 
      for (const [bk, bd] of Object.entries(odd.byBookmaker)) {
        if (!bd?.available) continue
        const price = parseInt(bd.odds)
        if (isNaN(price)) continue
        const line = bd.spread || bd.overUnder || null
        markets[key].sides[side].push({ bk, price, line, marketName: odd.marketName || betType })
      }
    }
 
    // Find arbs in each market
    for (const { betType, sides } of Object.values(markets)) {
      const pairs = [['home','away'], ['over','under'], ['yes','no']]
 
      for (const [sideA, sideB] of pairs) {
        const pricesA = sides[sideA] || []
        const pricesB = sides[sideB] || []
        if (!pricesA.length || !pricesB.length) continue
 
        // Get best price for each side
        const bestA = pricesA.reduce((best, cur) => {
          const d = toDecimal(cur.price)
          return d > toDecimal(best.price) ? cur : best
        })
        const bestB = pricesB.reduce((best, cur) => {
          const d = toDecimal(cur.price)
          return d > toDecimal(best.price) ? cur : best
        })
 
        if (bestA.bk === bestB.bk) continue
 
        const decA = toDecimal(bestA.price)
        const decB = toDecimal(bestB.price)
        if (!decA || !decB) continue
 
        const impliedSum = (1 / decA) + (1 / decB)
        if (impliedSum >= 1) continue
 
        const profitPct = ((1 / impliedSum) - 1) * 100
        if (profitPct < 0.1 || profitPct > 10) continue
 
        const stakeA = Math.round((100 / decA) / impliedSum)
        const stakeB = Math.round((100 / decB) / impliedSum)
 
        let betA, betB, marketLabel
        if (sideA === 'home') {
          betA = `${homeTeam} on ${bestA.bk}`
          betB = `${awayTeam} on ${bestB.bk}`
          marketLabel = betType === 'sp' ? `Spread ${bestA.line || ''}` : 'Moneyline'
        } else if (sideA === 'over') {
          const line = bestA.line || bestB.line || ''
          betA = `Over ${line} on ${bestA.bk}`
          betB = `Under ${line} on ${bestB.bk}`
          marketLabel = `Total ${line}`
        } else {
          betA = `Yes on ${bestA.bk}`
          betB = `No on ${bestB.bk}`
          marketLabel = bestA.marketName || betType
        }
 
        arbs.push({
          game: gameName, sport, time,
          bA: bestA.bk,
          oA: bestA.price > 0 ? `+${bestA.price}` : `${bestA.price}`,
          betA,
          bB: bestB.bk,
          oB: bestB.price > 0 ? `+${bestB.price}` : `${bestB.price}`,
          betB,
          profit: parseFloat(profitPct.toFixed(2)),
          sA: stakeA,
          sB: stakeB,
          market: marketLabel,
        })
      }
    }
  }
 
  return arbs.sort((a, b) => b.profit - a.profit)
}
 
export const maxDuration = 30
 
export async function GET() {
  try {
    const res = await fetch(
      `${API_BASE}/events?leagueID=MLB,NBA,NHL,NFL,SOCCER,ATP,TENNIS&finalized=false&oddsAvailable=true&limit=100`,
      {
        headers: { 'x-api-key': API_KEY },
        cache: 'no-store'
      }
    )
    const data = await res.json()
    const events = data.data || []
    const arbs = findArbs(events)
    return Response.json({ arbs: arbs.slice(0, 60), total: arbs.slice(0, 60).length, eventCount: events.length })
  } catch (err) {
    return Response.json({ arbs: [], error: err.message })
  }
}
 