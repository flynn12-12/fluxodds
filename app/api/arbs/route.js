// Based exactly on SportsGameOdds official arbitrage calculator docs
// https://sportsgameodds.com/docs/examples/arbitrage-calculator
 
const API_KEY = '79c293ec2b367b3db5f733d9ba433876'
const API_BASE = 'https://api.sportsgameodds.com/v2'
 
const SPORT_MAP = {
  'BASEBALL': 'mlb', 'BASKETBALL': 'nba', 'FOOTBALL': 'nfl',
  'HOCKEY': 'nhl', 'SOCCER': 'soccer', 'TENNIS': 'tennis',
}
 
function americanToDecimal(american) {
  const n = parseInt(american)
  if (isNaN(n)) return null
  if (n > 0) return (n / 100) + 1
  return (100 / Math.abs(n)) + 1
}
 
function findArbs(events) {
  const opportunities = []
 
  for (const event of events) {
    const awayName = event.teams?.away?.names?.medium || event.teams?.away?.names?.long || 'Away'
    const homeName = event.teams?.home?.names?.medium || event.teams?.home?.names?.long || 'Home'
    const matchup = `${awayName} vs ${homeName}`
    const sport = SPORT_MAP[event.sportID] || (event.sportID || 'unknown').toLowerCase()
    const time = event.startsAt || ''
 
    // Group odds by betType + periodID + side
    // markets[betType][periodID][side] = list of {bookmaker, price, line, decimal}
    const markets = {}
 
    for (const [oddID, odd] of Object.entries(event.odds || {})) {
      const betType = odd.betTypeID
      const side = odd.sideID
      const period = odd.periodID || 'game'
 
      // Only full game odds
      if (period !== 'game') continue
 
      const key = `${betType}|${period}`
      if (!markets[key]) markets[key] = { betType, sides: {} }
      if (!markets[key].sides[side]) markets[key].sides[side] = []
 
      for (const [bookmakerID, bookmakerData] of Object.entries(odd.byBookmaker || {})) {
        if (!bookmakerData.available) continue
 
        const oddsStr = bookmakerData.odds
        if (!oddsStr) continue
 
        let price
        try { price = parseInt(oddsStr) } catch { continue }
        if (isNaN(price)) continue
 
        // Get line value based on bet type (from official docs)
        let line = null
        if (betType === 'sp') line = bookmakerData.spread
        else if (betType === 'ou') line = bookmakerData.overUnder
 
        const decimal = americanToDecimal(price)
        if (!decimal) continue
 
        markets[key].sides[side].push({
          bookmaker: bookmakerID,
          american: price,
          decimal,
          line,
          marketName: odd.marketName || betType,
        })
      }
    }
 
    // Check each market for arbitrage (exactly as per official docs)
    for (const { betType, sides } of Object.values(markets)) {
      const sidePairs = [
        ['home', 'away'],
        ['over', 'under'],
        ['yes', 'no'],
      ]
 
      for (const [sideA, sideB] of sidePairs) {
        const pricesA = sides[sideA] || []
        const pricesB = sides[sideB] || []
        if (!pricesA.length || !pricesB.length) continue
 
        // Find best odds for each side (highest decimal = best for bettor)
        const bestA = pricesA.reduce((best, cur) => cur.decimal > best.decimal ? cur : best)
        const bestB = pricesB.reduce((best, cur) => cur.decimal > best.decimal ? cur : best)
 
        if (bestA.bookmaker === bestB.bookmaker) continue
 
        // Calculate implied probability sum
        const impliedSum = (1 / bestA.decimal) + (1 / bestB.decimal)
 
        // Arbitrage exists when sum < 1
        if (impliedSum >= 1) continue
 
        const profitPct = ((1 / impliedSum) - 1) * 100
 
        // Only realistic arbs
        if (profitPct < 0.1 || profitPct > 10) continue
 
        // Calculate optimal stakes for $100 total
        const stakeA = Math.round((100 / bestA.decimal) / impliedSum)
        const stakeB = Math.round((100 / bestB.decimal) / impliedSum)
 
        // Build human-readable instructions
        let betA, betB, marketLabel
        if (sideA === 'home') {
          betA = `${homeName} on ${bestA.bookmaker}`
          betB = `${awayName} on ${bestB.bookmaker}`
          marketLabel = betType === 'sp'
            ? `Spread (${bestA.line || ''})`
            : 'Moneyline'
        } else if (sideA === 'over') {
          const line = bestA.line || bestB.line || ''
          betA = `Over ${line} on ${bestA.bookmaker}`
          betB = `Under ${line} on ${bestB.bookmaker}`
          marketLabel = `Total O/U ${line}`
        } else {
          betA = `Yes on ${bestA.bookmaker}`
          betB = `No on ${bestB.bookmaker}`
          marketLabel = bestA.marketName
        }
 
        opportunities.push({
          game: matchup,
          sport,
          time,
          bA: bestA.bookmaker,
          oA: bestA.american > 0 ? `+${bestA.american}` : `${bestA.american}`,
          betA,
          bB: bestB.bookmaker,
          oB: bestB.american > 0 ? `+${bestB.american}` : `${bestB.american}`,
          betB,
          profit: parseFloat(profitPct.toFixed(2)),
          sA: stakeA,
          sB: stakeB,
          market: marketLabel,
        })
      }
    }
  }
 
  return opportunities.sort((a, b) => b.profit - a.profit)
}
 
export const maxDuration = 30
 
export async function GET() {
  try {
    // Exactly as per official docs: finalized=false for upcoming games, x-api-key header
    const res = await fetch(
      `${API_BASE}/events?leagueID=MLB,NBA,NHL,NFL,SOCCER,ATP,TENNIS&finalized=false&oddsAvailable=true&limit=100`,
      {
        headers: { 'x-api-key': API_KEY },
        cache: 'no-store',
      }
    )
 
    if (!res.ok) {
      const text = await res.text()
      return Response.json({ arbs: [], error: `API error ${res.status}: ${text}` })
    }
 
    const data = await res.json()
    const events = data.data || []
    const arbs = findArbs(events)
 
    return Response.json({
      arbs: arbs.slice(0, 60),
      total: arbs.slice(0, 60).length,
      eventCount: events.length,
    })
  } catch (err) {
    return Response.json({ arbs: [], error: err.message })
  }
}
 