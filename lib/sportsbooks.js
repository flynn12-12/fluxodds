// Canonical sportsbook IDs (lowercase) used in FluxOdds UI + client filters.
// IDs align with SportsGameOdds / scanner output where possible.
export const ALL_SPORTSBOOKS = [
  { id: 'draftkings', label: 'DraftKings' },
  { id: 'fanduel', label: 'FanDuel' },
  { id: 'betmgm', label: 'BetMGM' },
  { id: 'caesars', label: 'Caesars' },
  { id: 'espnbet', label: 'ESPN Bet' },
  { id: 'fanatics', label: 'Fanatics' },
  { id: 'bet365', label: 'bet365' },
  { id: 'betrivers', label: 'BetRivers' },
  { id: 'hardrockbet', label: 'Hard Rock Bet' },
  { id: 'unibet', label: 'Unibet' },
  { id: 'pointsbet', label: 'PointsBet' },
  { id: 'wynnbet', label: 'WynnBET' },
  { id: 'circa', label: 'Circa' },
  { id: 'bovada', label: 'Bovada' },
  { id: 'mybookie', label: 'MyBookie' },
  { id: 'betonline', label: 'BetOnline' },
  { id: 'barstoolsportsbook', label: 'Barstool Sportsbook' },
  { id: 'thescorebet', label: 'theScore Bet' },
  { id: 'betway', label: 'Betway' },
  { id: '888sport', label: '888sport' },
  { id: 'bwin', label: 'Bwin' },
  { id: 'williamhill', label: 'William Hill' },
  { id: 'ladbrokes', label: 'Ladbrokes' },
  { id: 'paddypower', label: 'Paddy Power' },
  { id: 'skybet', label: 'Sky Bet' },
  { id: 'betfred', label: 'Betfred' },
  { id: 'tab', label: 'TAB' },
  { id: 'sportsbet', label: 'Sportsbet' },
  { id: 'playup', label: 'PlayUp' },
  { id: 'lowvig', label: 'LowVig' },
  { id: 'heritage', label: 'Heritage' },
  { id: 'bookmaker', label: 'Bookmaker' },
  { id: 'jazzsports', label: 'Jazz Sports' },
  { id: 'betdsi', label: 'BetDSI' },
  { id: 'youwager', label: 'YouWager' },
  { id: 'intertops', label: 'Everygame' },
  { id: 'pinnacle', label: 'Pinnacle' },
  { id: 'matchbook', label: 'Matchbook' },
  { id: 'betanysports', label: 'BetAnySports' },
  { id: 'betus', label: 'BetUS' },
  { id: 'gtbets', label: 'GTbets' },
  { id: 'bet105', label: 'bet105' },
  { id: 'fliff', label: 'Fliff' },
  { id: 'underdog', label: 'Underdog' },
  { id: 'prizepicks', label: 'PrizePicks' },
  { id: 'novig', label: 'Novig' },
  { id: 'polymarket', label: 'Polymarket' },
  { id: 'kalshi', label: 'Kalshi' },
  { id: 'betfairexchange', label: 'Betfair Exchange' },
  { id: 'prophetexchange', label: 'Prophet Exchange' },
  { id: 'sporttrade', label: 'Sporttrade' },
]

export const ALL_SPORTSBOOK_IDS = new Set(ALL_SPORTSBOOKS.map((b) => b.id))

// Books shown in the bonus converter dropdown (API-tested set).
const BONUS_DROPDOWN_IDS = new Set([
  'draftkings', 'fanduel', 'betmgm', 'caesars', 'espnbet', 'fanatics', 'bet365', 'betrivers',
  'hardrockbet', 'unibet', 'pointsbet', 'wynnbet', 'circa', 'bovada', 'mybookie', 'betonline',
])
export const BONUS_DROPDOWN_BOOKS = ALL_SPORTSBOOKS.filter((b) => BONUS_DROPDOWN_IDS.has(b.id))

export function bookLabel(id) {
  if (!id) return ''
  const row = ALL_SPORTSBOOKS.find((b) => b.id === id.toLowerCase())
  return row ? row.label : id.replace(/_/g, ' ')
}
