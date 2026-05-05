'use client'
import { useState, useEffect, useMemo } from 'react'
import { supabase } from './supabase'
import { ALL_SPORTSBOOKS, ALL_SPORTSBOOK_IDS, BONUS_DROPDOWN_BOOKS } from '../lib/sportsbooks'
import { getSportsbookUrl } from '../lib/sportsbookLinks'

const TICKS = [
  {game:'PSG vs Bayern',sport:'Soccer',profit:'+5.1%',books:'Unibet / DraftKings'},
  {game:'Man City vs Arsenal',sport:'Soccer',profit:'+4.7%',books:'FanDuel / Unibet'},
  {game:'Liverpool vs Chelsea',sport:'Soccer',profit:'+3.8%',books:'BetRivers / FanDuel'},
  {game:'Lakers vs Celtics',sport:'NBA',profit:'+3.2%',books:'DraftKings / FanDuel'},
  {game:'Warriors vs Nuggets',sport:'NBA',profit:'+2.9%',books:'Caesars / PointsBet'},
  {game:'Chiefs vs Ravens',sport:'NFL',profit:'+2.1%',books:'PointsBet / BetRivers'},
]

const BOOK_PREFS_KEY = 'fluxodds_hidden_books_v1'

const SPORT_TAG = 'bg-zinc-800/80 text-zinc-400 border border-zinc-700/80 text-[9px] font-semibold px-[6px] py-[1px] rounded-md'
const MARKET_TAG = 'bg-orange-500/10 text-orange-400 border border-orange-500/20 text-[9px] font-semibold px-[6px] py-[1px] rounded-md'
const LIVE_TAG = 'bg-red-900/15 text-red-400 border border-red-800/30 text-[9px] font-bold px-[6px] py-[1px] rounded uppercase tracking-wider'

const cleanBet = (betStr, bookmaker) => {
  if (!betStr) return ''
  if (!bookmaker) return betStr
  return betStr.replace(new RegExp(`\\s+on\\s+${bookmaker}$`, 'i'), '').trim()
}

const fmtTime = (iso) => {
  if (!iso) return ''
  try {
    const d = new Date(iso)
    return d.toLocaleString(undefined, { month:'short', day:'numeric', hour:'numeric', minute:'2-digit' })
  } catch { return iso }
}

const liveAgeSeconds = (firstSeenAt) => {
  if (!firstSeenAt) return null
  const ms = Date.now() - new Date(firstSeenAt).getTime()
  return Math.max(0, Math.floor(ms / 1000))
}

const fmtAge = (sec) => {
  if (sec == null) return ''
  if (sec < 60) return `${sec}s`
  if (sec < 3600) return `${Math.floor(sec/60)}m ${sec%60}s`
  return `${Math.floor(sec/3600)}h ${Math.floor((sec%3600)/60)}m`
}

const FREE_PROFIT_CAP = 2
const FREE_EV_CAP = 1.5

const BookLink = ({ bookId, className }) => {
  const url = getSportsbookUrl(bookId)
  const iconSrc = bookId ? `/sportsbooks/${bookId.toLowerCase()}.svg` : null
  if (!url) {
    return (
      <span className={`${className} flex items-center gap-[5px]`}>
        {iconSrc && <img src={iconSrc} alt="" width={16} height={16} className="rounded-[3px] flex-shrink-0" />}
        {bookId}
      </span>
    )
  }
  return (
    <a href={url} target="_blank" rel="noopener noreferrer"
      className={`${className} no-underline hover:text-[#e87028] transition-colors cursor-pointer flex items-center gap-[5px]`}
      onClick={(e) => e.stopPropagation()}
    >
      {iconSrc && <img src={iconSrc} alt="" width={16} height={16} className="rounded-[3px] flex-shrink-0 hover:opacity-80 transition-opacity" />}
      {bookId}
    </a>
  )
}

export default function Home() {
  const [view, setView] = useState('marketing')
  const [dashView, setDashView] = useState('home')
  const [toolName, setToolName] = useState('Prematch Arbitrage')
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [loginOpen, setLoginOpen] = useState(false)
  const [loginTab, setLoginTab] = useState('login')
  const [selectedArb, setSelectedArb] = useState(null)
  const [bankroll, setBankroll] = useState(100)
  const [sport, setSport] = useState('all')
  const [minP, setMinP] = useState(0)
  const [query, setQuery] = useState('')
  const [faqOpen, setFaqOpen] = useState(null)
  const [secs, setSecs] = useState(0)
  const [contactSent, setContactSent] = useState(false)
  const [signupEmail, setSignupEmail] = useState('')
  const [signupPassword, setSignupPassword] = useState('')
  const [userPlan, setUserPlan] = useState(null)
  const [user, setUser] = useState(null)
  const [liveData, setLiveData] = useState([])      // prematch arbs
  const [liveArbsData, setLiveArbsData] = useState([]) // in-game live arbs
  const [evData, setEvData] = useState([])
  const [middlesData, setMiddlesData] = useState([])

  const [bonusBook, setBonusBook] = useState('draftkings')
  const [bonusAmount, setBonusAmount] = useState(100)
  const [bonusLoading, setBonusLoading] = useState(false)
  const [bonusResults, setBonusResults] = useState(null)
  const [bonusError, setBonusError] = useState('')

  const [hiddenBooks, setHiddenBooks] = useState([])
  const [bookSearch, setBookSearch] = useState('')
  const [booksPanelOpen, setBooksPanelOpen] = useState(true)

  const isPrematchView = toolName === 'Prematch Arbitrage'
  const isLiveView = toolName === 'Live Arbitrage'
  const isEvView = toolName === 'Positive EV Bets'
  const isMiddlesView = toolName === 'Middles Finder'
  const isCalcView = toolName === 'Bet Calculator'
  const isPnlView = toolName === 'P&L Tracker'
  const isBonusView = toolName === 'Bonus Bet Converter'

  const [calcTab, setCalcTab] = useState('arb')
  const [calcBankroll, setCalcBankroll] = useState(100)
  const [calcOddsA, setCalcOddsA] = useState('')
  const [calcOddsB, setCalcOddsB] = useState('')
  const [convertInput, setConvertInput] = useState('')
  const [convertFormat, setConvertFormat] = useState('american')
  const [parlayLegs, setParlayLegs] = useState([{ odds: '' }, { odds: '' }])
  const [parlayStake, setParlayStake] = useState(100)
  const [holdOddsA, setHoldOddsA] = useState('')
  const [holdOddsB, setHoldOddsB] = useState('')

  const [pnlBets, setPnlBets] = useState([])
  const [pnlLoading, setPnlLoading] = useState(false)
  const [pnlForm, setPnlForm] = useState({ game: '', bookmaker: '', betType: 'arb', odds: '', stake: '', result: 'pending', profit: '', sport: 'nba', notes: '' })
  const [pnlFormOpen, setPnlFormOpen] = useState(false)
  const [pnlFilter, setPnlFilter] = useState('all')
  const [pnlSportFilter, setPnlSportFilter] = useState('all')
  const [pnlEditId, setPnlEditId] = useState(null)

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (session) {
        setUser(session.user)
        const { data: profile } = await supabase
          .from('profiles').select('plan').eq('user_id', session.user.id).single()
        setUserPlan(profile?.plan || 'free')
      } else { setUserPlan('free') }
    })
    supabase.auth.onAuthStateChange(async (_event, session) => {
      setUser(session?.user || null)
      if (session?.user) {
        const { data: profile } = await supabase
          .from('profiles').select('plan').eq('user_id', session.user.id).single()
        setUserPlan(profile?.plan || 'free')
      } else { setUserPlan('free') }
    })
  }, [])

  useEffect(() => {
    const t = setInterval(() => setSecs(s => s + 1), 1000)
    return () => clearInterval(t)
  }, [])

  useEffect(() => {
    try {
      const raw = typeof window !== 'undefined' ? localStorage.getItem(BOOK_PREFS_KEY) : null
      if (!raw) return
      const arr = JSON.parse(raw)
      if (Array.isArray(arr)) {
        setHiddenBooks(arr.map(String).map((x) => x.toLowerCase()).filter((x) => ALL_SPORTSBOOK_IDS.has(x)))
      }
    } catch { /* ignore */ }
  }, [])

  useEffect(() => {
    try {
      if (typeof window !== 'undefined') localStorage.setItem(BOOK_PREFS_KEY, JSON.stringify(hiddenBooks))
    } catch { /* ignore */ }
  }, [hiddenBooks])

  const hiddenBookSet = useMemo(() => new Set(hiddenBooks.map((x) => String(x).toLowerCase())), [hiddenBooks])
  const bookAllowed = (id) => !hiddenBookSet.has(String(id || '').toLowerCase())

  // Prematch arbs
  useEffect(() => {
    let cancelled = false
    const fetchArbs = async () => {
      try {
        const res = await fetch('/api/arbs', { cache: 'no-store' })
        const data = await res.json()
        if (cancelled) return
        if (!res.ok || data.error) {
          console.error('arbs fetch failed:', data.error || data.detail || res.status)
          return
        }
        setLiveData(data.arbs || [])
      } catch (e) { console.error('arbs fetch:', e) }
    }
    fetchArbs()
    const interval = setInterval(fetchArbs, 1000)
    return () => { cancelled = true; clearInterval(interval) }
  }, [])

  // Live in-game arbs
  useEffect(() => {
    let cancelled = false
    const fetchLive = async () => {
      try {
        const res = await fetch('/api/live-arbs', { cache: 'no-store' })
        const data = await res.json()
        if (cancelled) return
        if (!res.ok || data.error) {
          console.error('live-arbs fetch failed:', data.error || res.status)
          return
        }
        setLiveArbsData(data.arbs || [])
      } catch (e) { console.error('live-arbs fetch:', e) }
    }
    fetchLive()
    const interval = setInterval(fetchLive, 1000)
    return () => { cancelled = true; clearInterval(interval) }
  }, [])

  // EV bets
  useEffect(() => {
    let cancelled = false
    const fetchEv = async () => {
      try {
        const res = await fetch('/api/ev', { cache: 'no-store' })
        const data = await res.json()
        if (!cancelled) setEvData(data.evBets || [])
      } catch (e) { console.error('ev fetch:', e) }
    }
    fetchEv()
    const interval = setInterval(fetchEv, 2000)
    return () => { cancelled = true; clearInterval(interval) }
  }, [])

  // Middles
  useEffect(() => {
    let cancelled = false
    const fetchMiddles = async () => {
      try {
        const res = await fetch('/api/middles', { cache: 'no-store' })
        const data = await res.json()
        if (!cancelled) setMiddlesData(data.middles || [])
      } catch (e) { console.error('middles fetch:', e) }
    }
    fetchMiddles()
    const interval = setInterval(fetchMiddles, 2000)
    return () => { cancelled = true; clearInterval(interval) }
  }, [])

  // P&L bet logs
  const pnlFetchRef = { current: async (uid) => {
    if (!uid) return
    setPnlLoading(true)
    try {
      const { data, error } = await supabase
        .from('bet_logs')
        .select('*')
        .eq('user_id', uid)
        .order('created_at', { ascending: false })
        .limit(500)
      if (error) throw error
      setPnlBets(data || [])
    } catch (e) { console.error('pnl fetch:', e) }
    finally { setPnlLoading(false) }
  }}
  const refreshPnlBets = () => { if (user?.id) pnlFetchRef.current(user.id) }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { if (user?.id) pnlFetchRef.current(user.id) }, [user?.id])

  const filterArbs = (arr) => arr.filter(a => {
    if (sport !== 'all' && a.sport !== sport) return false
    if (a.profit < minP) return false
    if (!bookAllowed(a.bA) || !bookAllowed(a.bB)) return false
    if (query && !a.game.toLowerCase().includes(query)
      && !(a.bA || '').toLowerCase().includes(query)
      && !(a.bB || '').toLowerCase().includes(query)) return false
    return true
  })

  const filteredArbs = filterArbs(liveData)
  const filteredLiveArbs = filterArbs(liveArbsData)

  const filteredEv = evData.filter(e => {
    if (sport !== 'all' && e.sport !== sport) return false
    if (e.ev < minP) return false
    if (!bookAllowed(e.bookmaker)) return false
    if (query && !e.game.toLowerCase().includes(query)
      && !(e.bookmaker || '').toLowerCase().includes(query)
      && !(e.bet || '').toLowerCase().includes(query)) return false
    return true
  })

  const filteredMiddles = middlesData.filter(m => {
    if (sport !== 'all' && m.sport !== sport) return false
    if (!bookAllowed(m.bA) || !bookAllowed(m.bB)) return false
    if (query && !m.game.toLowerCase().includes(query)
      && !(m.bA || '').toLowerCase().includes(query)
      && !(m.bB || '').toLowerCase().includes(query)) return false
    return true
  })

  const filteredBonusConversions = useMemo(() => {
    if (!bonusResults?.conversions?.length) return []
    if (!bookAllowed(bonusBook)) return []
    return bonusResults.conversions.filter((c) => bookAllowed(c?.hedge?.book))
  }, [bonusResults, bonusBook, hiddenBookSet])

  const isPro = userPlan === 'pro'
  const shouldBlurArb = (a) => userPlan === 'free' && a.profit > FREE_PROFIT_CAP
  const shouldBlurEv = (e) => userPlan === 'free' && e.ev > FREE_EV_CAP
  const middlesLocked = userPlan === 'free'
  const bonusLocked = userPlan === 'free'

  useEffect(() => {
    if (!bookAllowed(bonusBook)) {
      const first = BONUS_DROPDOWN_BOOKS.find((b) => bookAllowed(b.id))
      if (first) setBonusBook(first.id)
    }
  }, [hiddenBookSet, bonusBook])

  const booksPanelFiltered = useMemo(() => {
    const q = bookSearch.trim().toLowerCase()
    if (!q) return ALL_SPORTSBOOKS
    return ALL_SPORTSBOOKS.filter((b) => b.label.toLowerCase().includes(q) || b.id.includes(q))
  }, [bookSearch])

  const openTool = (name) => {
    if (!user) { setLoginOpen(true); return }
    setToolName(name); setDashView('arb'); setView('dashboard'); setSidebarOpen(false); setBooksPanelOpen(false)
    if (name === 'Bonus Bet Converter') { setBonusResults(null); setBonusError('') }
  }
  const toggleBookHidden = (id) => {
    const k = String(id).toLowerCase()
    setHiddenBooks((prev) => (prev.includes(k) ? prev.filter((x) => x !== k) : [...prev, k]))
  }
  const launchDash = () => {
    if (!user) { setLoginOpen(true); return }
    setView('dashboard'); setDashView('home')
  }

  const handleSignup = async () => {
    if (!signupEmail || !signupPassword) { alert('Please enter email and password'); return }
    try {
      if (loginTab === 'signup') {
        const { error } = await supabase.auth.signUp({ email: signupEmail, password: signupPassword })
        if (error) throw error
        alert('Account created! Check your email to confirm.'); setLoginOpen(false)
      } else {
        const { data, error } = await supabase.auth.signInWithPassword({ email: signupEmail, password: signupPassword })
        if (error) throw error
        setUser(data.user); setLoginOpen(false); setView('dashboard'); setDashView('home')
      }
    } catch (e) { alert(e.message) }
  }

  const handleForgotPassword = async () => {
    if (!signupEmail) { alert('Enter your email first then click Forgot password'); return }
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(signupEmail, {
        redirectTo: 'https://fluxodds.com/reset-password',
      })
      if (error) throw error
      alert('Password reset email sent!'); setLoginOpen(false)
    } catch (e) { alert(e.message) }
  }

  const handleCheckout = async () => {
    try {
      const res = await fetch('/api/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          priceId: 'price_1TSNXCHCUgRq1HVGov0nnMQc',
          email: user?.email || '', userId: user?.id || '',
        })
      })
      const { url } = await res.json()
      if (url) window.location.href = url
    } catch (e) { alert('Something went wrong.') }
  }

  const handleSignout = async () => {
    await supabase.auth.signOut()
    setUser(null); setUserPlan('free'); setView('marketing')
  }

  const runBonusConversion = async () => {
    setBonusLoading(true); setBonusError(''); setBonusResults(null)
    try {
      const res = await fetch('/api/bonus-converter', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ bonusBookID: bonusBook, bonusAmount }),
      })
      let data = {}
      try {
        data = await res.json()
      } catch {
        setBonusError(res.ok ? 'Invalid response from server.' : `Server error (${res.status}). Try again.`)
        return
      }
      if (!res.ok) {
        setBonusError(data.message || data.error || `Request failed (${res.status}). Try again.`)
        return
      }
      if (data.error) setBonusError(data.error)
      else setBonusResults(data)
    } catch (e) { setBonusError('Failed to run scan.') }
    finally { setBonusLoading(false) }
  }

  const faqs = [
    {q:'Is arbitrage betting legal?', a:"Yes — arbitrage betting is completely legal. You're simply placing bets at different sportsbooks to guarantee profit from odds discrepancies."},
    {q:"What's the difference between Prematch and Live arbs?", a:"Prematch arbs are for upcoming games — more time to place bets, lower limit risk. Live arbs are for in-progress games — more frequent opportunities but they disappear in seconds and books limit live arbers fast. Most pros focus on prematch."},
    {q:"What's the difference between arbs and +EV?", a:"Arbitrage = guaranteed profit on every bet (smaller, more frequent wins). +EV = bets where the math says you'll profit long-term. We use Pinnacle's de-vigged sharp lines as the fair value reference."},
    {q:"What's a bonus bet converter?", a:"Sportsbooks give out bonus bets where you only keep the winnings, not the stake. Our converter finds the optimal way to convert that bonus into guaranteed real cash by hedging at a different book — typically 65–80% conversion."},
    {q:'How fast are arbs detected?', a:'Our engine scans odds continuously across 40+ books. Most arbs surface within 1 second.'},
    {q:'Can I cancel anytime?', a:'Absolutely. No contracts. Cancel from your dashboard with one click.'},
  ]

  const tools = [
    {id:'live', icon:'⚡', name:'Live Arbitrage', desc:'In-progress games', badge:'LIVE'},
    {id:'prematch', icon:'🗓', name:'Prematch Arbitrage', desc:'Plan ahead, less time pressure'},
    {id:'ev', icon:'📈', name:'Positive EV Bets', desc:'Long-term mathematical edge', badge:'NEW'},
    {id:'middles', icon:'🎯', name:'Middles Finder', desc:'Win both sides on line moves'},
    {id:'freebets', icon:'🎁', name:'Bonus Bet Converter', desc:'Turn promos into real cash', badge:'PRO'},
    {id:'calculator', icon:'🧮', name:'Bet Calculator', desc:'Perfect stakes, any bankroll'},
  ]

  const net = ((bankroll * (selectedArb?.profit || 0)) / 100).toFixed(2)
  const payout = (parseFloat(bankroll) + parseFloat(net)).toFixed(2)
  const stakeA = selectedArb ? ((bankroll * selectedArb.sA) / 100).toFixed(2) : 0
  const stakeB = selectedArb ? ((bankroll * selectedArb.sB) / 100).toFixed(2) : 0

  const renderRowAge = (a) => {
    if (!a.firstSeenAt) return null
    const ageSec = liveAgeSeconds(a.firstSeenAt)
    if (ageSec == null) return null
    if (ageSec < 30) {
      return (
        <div className="flex items-center gap-1 mt-[3px]">
          <span className="w-[5px] h-[5px] rounded-full bg-emerald-400 animate-pulse inline-block"></span>
          <span className="text-[10px] font-bold text-emerald-400">NEW</span>
        </div>
      )
    }
    const _t = secs
    return <div className="text-[10px] text-[#a1a1aa] font-medium mt-[3px] tabular-nums">{fmtAge(ageSec)}</div>
  }

  // Renderer for an arb row — handles BOTH prematch and live arbs.
  // The only difference visually: live arbs show liveStatus tag instead of fmtTime.
  const renderArbRow = (a, i, { live = false } = {}) => {
    const blurred = shouldBlurArb(a)
    return [
      <div key={a.fingerprint || i}
        onClick={() => !blurred ? setSelectedArb(a) : (user ? handleCheckout() : (setLoginTab('signup'), setLoginOpen(true)))}
        className={`arb-row border-b border-[#27272a] items-center transition-colors ${blurred ? 'cursor-pointer hover:bg-orange-950/5' : 'cursor-pointer hover:bg-[#0c0c0e]'} hidden md:grid px-5 py-[12px]`}
        style={{gridTemplateColumns:'1.6fr 1.4fr 1.4fr 90px 100px'}}>
        <div>
          <div className="text-[13px] font-semibold mb-[4px]">{a.game}</div>
          <div className="flex items-center gap-[6px] flex-wrap">
            <span className={SPORT_TAG}>{(a.sport || '').toUpperCase()}</span>
            {a.market && <span className={MARKET_TAG}>{a.market}</span>}
            {live ? (
              <span className={LIVE_TAG}>● {a.liveStatus || 'LIVE'}</span>
            ) : (
              <span className="text-[11px] text-[#a1a1aa] font-medium">{fmtTime(a.time)}</span>
            )}
          </div>
        </div>
        <div className={blurred ? 'relative' : ''}>
          <BookLink bookId={a.bA} className="text-[10px] text-[#71717a] font-semibold uppercase tracking-wide mb-[2px]" />
          <div className={`text-[13px] font-semibold leading-tight ${blurred ? 'blur-sm select-none' : ''}`}>{cleanBet(a.betA, a.bA)}</div>
          <div className={`text-[12px] text-[#e87028] font-semibold mt-[2px] ${blurred ? 'blur-sm select-none' : ''}`}>{a.oA}</div>
        </div>
        <div className={blurred ? 'relative' : ''}>
          <BookLink bookId={a.bB} className="text-[10px] text-[#71717a] font-semibold uppercase tracking-wide mb-[2px]" />
          <div className={`text-[13px] font-semibold leading-tight ${blurred ? 'blur-sm select-none' : ''}`}>{cleanBet(a.betB, a.bB)}</div>
          <div className={`text-[12px] text-[#e87028] font-semibold mt-[2px] ${blurred ? 'blur-sm select-none' : ''}`}>{a.oB}</div>
        </div>
        <div>
          <div className="text-[18px] font-black text-emerald-400 leading-none">+{a.profit}%</div>
          {renderRowAge(a)}
        </div>
        {blurred ? (
          <div className="flex items-center justify-end">
            <span className="inline-flex items-center gap-1 text-[10px] font-bold text-[#e87028] bg-orange-950/10 border border-orange-900/30 px-2 py-[3px] rounded-full">🔒 Pro</span>
          </div>
        ) : (
          <div className="text-[12px] text-[#71717a] font-medium">${a.sA} / ${a.sB}</div>
        )}
      </div>,
      <div key={`m-${a.fingerprint || i}`}
        onClick={() => !blurred ? setSelectedArb(a) : (user ? handleCheckout() : (setLoginTab('signup'), setLoginOpen(true)))}
        className={`md:hidden flex flex-col gap-2 px-4 py-3 border-b border-[#27272a] transition-colors ${blurred ? 'cursor-pointer hover:bg-orange-950/5' : 'cursor-pointer hover:bg-[#0c0c0e]'}`}>
        <div className="flex items-center justify-between">
          <div className="flex-1 min-w-0">
            <div className="text-[13px] font-semibold mb-1 truncate">{a.game}</div>
            <div className="flex items-center gap-[5px] flex-wrap">
              <span className={SPORT_TAG}>{(a.sport || '').toUpperCase()}</span>
              {a.market && <span className={MARKET_TAG}>{a.market}</span>}
              {live ? <span className={LIVE_TAG}>● {a.liveStatus || 'LIVE'}</span> : <span className="text-[10px] text-[#a1a1aa] font-medium">{fmtTime(a.time)}</span>}
            </div>
          </div>
          <div className="text-right flex-shrink-0 ml-3">
            <div className="text-[18px] font-black text-emerald-400 leading-none">+{a.profit}%</div>
            {renderRowAge(a)}
          </div>
        </div>
        <div className="flex gap-2">
          <div className={`flex-1 bg-[#0c0c0e] rounded-lg p-2 ${blurred ? 'relative' : ''}`}>
            <BookLink bookId={a.bA} className="text-[9px] text-[#71717a] font-semibold uppercase tracking-wide mb-[2px]" />
            <div className={`text-[12px] font-semibold leading-tight ${blurred ? 'blur-sm select-none' : ''}`}>{cleanBet(a.betA, a.bA)}</div>
            <div className={`text-[11px] text-[#e87028] font-semibold mt-[2px] ${blurred ? 'blur-sm select-none' : ''}`}>{a.oA}</div>
          </div>
          <div className={`flex-1 bg-[#0c0c0e] rounded-lg p-2 ${blurred ? 'relative' : ''}`}>
            <BookLink bookId={a.bB} className="text-[9px] text-[#71717a] font-semibold uppercase tracking-wide mb-[2px]" />
            <div className={`text-[12px] font-semibold leading-tight ${blurred ? 'blur-sm select-none' : ''}`}>{cleanBet(a.betB, a.bB)}</div>
            <div className={`text-[11px] text-[#e87028] font-semibold mt-[2px] ${blurred ? 'blur-sm select-none' : ''}`}>{a.oB}</div>
          </div>
        </div>
        {blurred ? (
          <div className="flex justify-center">
            <span className="inline-flex items-center gap-1 text-[10px] font-bold text-[#e87028] bg-orange-950/10 border border-orange-900/30 px-2 py-[3px] rounded-full">🔒 Pro</span>
          </div>
        ) : (
          <div className="text-[11px] text-[#a1a1aa] font-medium">Stakes: ${a.sA} / ${a.sB}</div>
        )}
      </div>
    ]
  }

  const renderEvRow = (e, i) => {
    const blurred = shouldBlurEv(e)
    return [
      <div key={e.fingerprint || i}
        onClick={() => !blurred ? null : (user ? handleCheckout() : (setLoginTab('signup'), setLoginOpen(true)))}
        className={`hidden md:grid px-5 py-[12px] border-b border-[#27272a] items-center transition-colors ${blurred ? 'cursor-pointer hover:bg-orange-950/5' : 'hover:bg-[#0c0c0e]'}`}
        style={{gridTemplateColumns:'1.6fr 1.8fr 1fr 80px 80px 80px'}}>
        <div>
          <div className="text-[13px] font-semibold mb-[4px]">{e.game}</div>
          <div className="flex items-center gap-[6px] flex-wrap">
            <span className={SPORT_TAG}>{(e.sport || '').toUpperCase()}</span>
            {e.market && <span className={MARKET_TAG}>{e.market}</span>}
            <span className="text-[11px] text-[#a1a1aa] font-medium">{fmtTime(e.time)}</span>
          </div>
        </div>
        <div className={blurred ? 'relative' : ''}>
          <div className={`text-[13px] font-semibold leading-tight ${blurred ? 'blur-sm select-none' : ''}`}>{e.bet}</div>
          <BookLink bookId={e.bookmaker} className={`text-[10px] text-[#71717a] font-semibold uppercase tracking-wide mt-[2px] ${blurred ? 'blur-sm select-none' : ''}`} />
        </div>
        <div className={blurred ? 'blur-sm select-none' : ''}>
          <div className="text-[14px] font-bold text-[#e87028]">{e.odds}</div>
          <div className="text-[10px] text-[#a1a1aa] font-medium mt-[1px]">Fair: {e.fairOdds}</div>
        </div>
        <div className="text-[18px] font-black text-emerald-400">+{e.ev}%</div>
        <div className="text-[12px] text-[#fafafa] font-medium">{e.winProb}%</div>
        {blurred ? (
          <div className="flex items-center justify-end">
            <span className="inline-flex items-center gap-1 text-[10px] font-bold text-[#e87028] bg-orange-950/10 border border-orange-900/30 px-2 py-[3px] rounded-full">🔒 Pro</span>
          </div>
        ) : (
          renderRowAge(e)
        )}
      </div>,
      <div key={`m-${e.fingerprint || i}`}
        onClick={() => !blurred ? null : (user ? handleCheckout() : (setLoginTab('signup'), setLoginOpen(true)))}
        className={`md:hidden flex flex-col gap-2 px-4 py-3 border-b border-[#27272a] transition-colors ${blurred ? 'cursor-pointer hover:bg-orange-950/5' : 'hover:bg-[#0c0c0e]'}`}>
        <div className="flex items-center justify-between">
          <div className="flex-1 min-w-0">
            <div className="text-[13px] font-semibold mb-1 truncate">{e.game}</div>
            <div className="flex items-center gap-[5px] flex-wrap">
              <span className={SPORT_TAG}>{(e.sport || '').toUpperCase()}</span>
              {e.market && <span className={MARKET_TAG}>{e.market}</span>}
              <span className="text-[10px] text-[#a1a1aa] font-medium">{fmtTime(e.time)}</span>
            </div>
          </div>
          <div className="text-right flex-shrink-0 ml-3">
            <div className="text-[18px] font-black text-emerald-400 leading-none">+{e.ev}%</div>
            {renderRowAge(e)}
          </div>
        </div>
        <div className={`bg-[#0c0c0e] rounded-lg p-2 ${blurred ? 'relative' : ''}`}>
          <div className={`text-[12px] font-semibold leading-tight ${blurred ? 'blur-sm select-none' : ''}`}>{e.bet}</div>
          <div className="flex items-center gap-3 mt-1">
            <BookLink bookId={e.bookmaker} className={`text-[10px] text-[#71717a] font-semibold uppercase tracking-wide ${blurred ? 'blur-sm select-none' : ''}`} />
            <div className={`text-[12px] text-[#e87028] font-bold ${blurred ? 'blur-sm select-none' : ''}`}>{e.odds}</div>
            <div className={`text-[10px] text-[#a1a1aa] font-medium ${blurred ? 'blur-sm select-none' : ''}`}>Fair: {e.fairOdds}</div>
            <div className="text-[10px] text-[#fafafa] font-medium">Win: {e.winProb}%</div>
          </div>
        </div>
        {blurred && (
          <div className="flex justify-center">
            <span className="inline-flex items-center gap-1 text-[10px] font-bold text-[#e87028] bg-orange-950/10 border border-orange-900/30 px-2 py-[3px] rounded-full">🔒 Pro</span>
          </div>
        )}
      </div>
    ]
  }

  // ---------- P&L TRACKER ----------

  const pnlLocked = userPlan === 'free'

  const savePnlBet = async () => {
    if (!user) return
    const row = {
      user_id: user.id,
      game: pnlForm.game,
      bookmaker: pnlForm.bookmaker,
      bet_type: pnlForm.betType,
      odds: pnlForm.odds ? Number(pnlForm.odds) : null,
      stake: pnlForm.stake ? Number(pnlForm.stake) : 0,
      result: pnlForm.result,
      profit: pnlForm.profit ? Number(pnlForm.profit) : null,
      sport: pnlForm.sport,
      notes: pnlForm.notes,
    }
    try {
      if (pnlEditId) {
        await supabase.from('bet_logs').update(row).eq('id', pnlEditId).eq('user_id', user.id)
      } else {
        await supabase.from('bet_logs').insert(row)
      }
      setPnlFormOpen(false)
      setPnlEditId(null)
      setPnlForm({ game: '', bookmaker: '', betType: 'arb', odds: '', stake: '', result: 'pending', profit: '', sport: 'nba', notes: '' })
      refreshPnlBets()
    } catch (e) { console.error('save bet:', e) }
  }

  const deletePnlBet = async (id) => {
    if (!user) return
    await supabase.from('bet_logs').delete().eq('id', id).eq('user_id', user.id)
    refreshPnlBets()
  }

  const editPnlBet = (bet) => {
    setPnlEditId(bet.id)
    setPnlForm({
      game: bet.game || '',
      bookmaker: bet.bookmaker || '',
      betType: bet.bet_type || 'arb',
      odds: bet.odds != null ? String(bet.odds) : '',
      stake: bet.stake != null ? String(bet.stake) : '',
      result: bet.result || 'pending',
      profit: bet.profit != null ? String(bet.profit) : '',
      sport: bet.sport || 'nba',
      notes: bet.notes || '',
    })
    setPnlFormOpen(true)
  }

  const pnlFiltered = pnlBets.filter(b => {
    if (pnlFilter !== 'all' && b.result !== pnlFilter) return false
    if (pnlSportFilter !== 'all' && b.sport !== pnlSportFilter) return false
    return true
  })

  const pnlStats = (() => {
    const settled = pnlBets.filter(b => b.result === 'won' || b.result === 'lost')
    const totalProfit = settled.reduce((s, b) => s + (b.profit || 0), 0)
    const totalStaked = settled.reduce((s, b) => s + (b.stake || 0), 0)
    const wins = settled.filter(b => b.result === 'won').length
    const losses = settled.filter(b => b.result === 'lost').length
    const pending = pnlBets.filter(b => b.result === 'pending').length
    const roi = totalStaked > 0 ? ((totalProfit / totalStaked) * 100).toFixed(2) : '0.00'
    const byBook = {}
    settled.forEach(b => {
      const k = b.bookmaker || 'Unknown'
      if (!byBook[k]) byBook[k] = 0
      byBook[k] += (b.profit || 0)
    })
    const bySport = {}
    settled.forEach(b => {
      const k = (b.sport || 'other').toUpperCase()
      if (!bySport[k]) bySport[k] = 0
      bySport[k] += (b.profit || 0)
    })
    return { totalProfit, totalStaked, wins, losses, pending, roi, byBook, bySport, total: pnlBets.length }
  })()

  const pnlInputClass = "bg-[#121214] border border-[#27272a] rounded-md text-[#fafafa] px-3 py-2 text-[13px] font-medium outline-none focus:border-[#e87028] w-full"
  const pnlLabelClass = "block text-[11px] font-semibold tracking-wider uppercase text-[#a1a1aa] mb-2"

  const renderPnlView = () => {
    if (pnlLocked) {
      return (
        <div className="flex-1 flex flex-col items-center justify-center text-center px-6">
          <div className="text-5xl mb-4">🔒</div>
          <div className="text-[24px] font-black mb-2">P&amp;L Tracker is Pro</div>
          <p className="text-[14px] text-[#a1a1aa] max-w-[420px] mb-6 font-medium leading-relaxed">
            Log every bet and track your running profit across books, sports, and time. Available exclusively on the Pro plan.
          </p>
          <button onClick={handleCheckout} className="px-8 py-3 rounded-xl bg-[#e87028] text-black text-[14px] font-black hover:bg-[#ff9a4d] transition-all border-none cursor-pointer">
            Get Pro — $75/mo →
          </button>
        </div>
      )
    }
    return (
      <div className="flex flex-col flex-1 overflow-hidden">
        <div className="px-3 md:px-5 pt-3 pb-3 bg-[#0c0c0e] border-b border-[#27272a] flex-shrink-0">
          <div className="flex items-center justify-between mb-3">
            <div className="text-[18px] md:text-[22px] font-black tracking-tight">P&amp;L Tracker</div>
            <div className="flex items-center gap-2">
              <button onClick={() => { setPnlEditId(null); setPnlForm({ game: '', bookmaker: '', betType: 'arb', odds: '', stake: '', result: 'pending', profit: '', sport: 'nba', notes: '' }); setPnlFormOpen(!pnlFormOpen) }}
                className="px-3 md:px-4 py-[6px] rounded-md bg-[#e87028] text-black text-[11px] md:text-[12px] font-black hover:bg-[#ff9a4d] transition-all border-none cursor-pointer">
                {pnlFormOpen ? 'Cancel' : '+ Log bet'}
              </button>
              <button onClick={() => setDashView('home')} className="border border-[#27272a] text-[#a1a1aa] px-2 md:px-3 py-[6px] rounded-md text-[11px] md:text-[12px] font-medium hover:text-[#fafafa] transition-all bg-transparent cursor-pointer">← Home</button>
            </div>
          </div>

          {/* Summary cards */}
          <div className="grid grid-cols-3 md:grid-cols-5 gap-2 mb-3">
            {[
              [pnlStats.totalProfit >= 0 ? `+$${pnlStats.totalProfit.toFixed(2)}` : `-$${Math.abs(pnlStats.totalProfit).toFixed(2)}`, 'Net P&L', pnlStats.totalProfit >= 0 ? 'text-emerald-400' : 'text-red-400'],
              [`${pnlStats.roi}%`, 'ROI', parseFloat(pnlStats.roi) >= 0 ? 'text-emerald-400' : 'text-[#fafafa]'],
              [`${pnlStats.wins}W / ${pnlStats.losses}L`, 'Record', 'text-[#fafafa]'],
              [`$${pnlStats.totalStaked.toFixed(2)}`, 'Total staked', 'text-[#fafafa]'],
              [`${pnlStats.pending}`, 'Pending', 'text-[#e87028]'],
            ].map(([val, label, color], i) => (
              <div key={i} className="bg-[#121214] border border-[#27272a] rounded-lg p-3 text-center">
                <div className={`text-[16px] font-black leading-none ${color}`}>{val}</div>
                <div className="text-[10px] text-[#a1a1aa] font-semibold uppercase tracking-wider mt-1">{label}</div>
              </div>
            ))}
          </div>

          {/* Breakdown by book & sport */}
          {pnlStats.total > 0 && (
            <div className="flex flex-col sm:flex-row gap-2 sm:gap-4 mb-3">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-[10px] text-[#a1a1aa] font-semibold uppercase tracking-wider">By book:</span>
                {Object.entries(pnlStats.byBook).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([book, profit]) => (
                  <span key={book} className={`text-[11px] font-semibold px-2 py-[2px] rounded-full border ${profit >= 0 ? 'border-emerald-800/25 text-emerald-400 bg-emerald-900/10' : 'border-red-800/25 text-red-400 bg-red-900/10'}`}>
                    {book} {profit >= 0 ? '+' : ''}{profit.toFixed(0)}
                  </span>
                ))}
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-[10px] text-[#a1a1aa] font-semibold uppercase tracking-wider">By sport:</span>
                {Object.entries(pnlStats.bySport).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([sp, profit]) => (
                  <span key={sp} className={`text-[11px] font-semibold px-2 py-[2px] rounded-full border ${profit >= 0 ? 'border-emerald-800/25 text-emerald-400 bg-emerald-900/10' : 'border-red-800/25 text-red-400 bg-red-900/10'}`}>
                    {sp} {profit >= 0 ? '+' : ''}{profit.toFixed(0)}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Filters */}
          <div className="flex items-center gap-[4px] md:gap-[5px] flex-wrap">
            {['all', 'won', 'lost', 'pending', 'void'].map(f => (
              <button key={f} onClick={() => setPnlFilter(f)}
                className={`px-[7px] md:px-[10px] py-[4px] md:py-[5px] rounded-md text-[11px] md:text-[12px] font-medium transition-all cursor-pointer border ${pnlFilter === f ? 'bg-orange-950/10 border-orange-900/25 text-[#e87028]' : 'bg-[#121214] border-[#27272a] text-[#a1a1aa] hover:text-[#fafafa]'}`}
                style={{fontFamily:"'Inter',sans-serif"}}>
                {f === 'all' ? 'All' : f.charAt(0).toUpperCase() + f.slice(1)}
              </button>
            ))}
            <div className="w-px h-4 bg-[#27272a] mx-[2px] md:mx-1 hidden sm:block"></div>
            {['all', 'nba', 'nfl', 'mlb', 'nhl', 'epl', 'mls', 'atp'].map(s => (
              <button key={s} onClick={() => setPnlSportFilter(s)}
                className={`px-[7px] md:px-[10px] py-[4px] md:py-[5px] rounded-md text-[11px] md:text-[12px] font-medium transition-all cursor-pointer border ${pnlSportFilter === s ? 'bg-orange-950/10 border-orange-900/25 text-[#e87028]' : 'bg-[#121214] border-[#27272a] text-[#a1a1aa] hover:text-[#fafafa]'}`}
                style={{fontFamily:"'Inter',sans-serif"}}>
                {s === 'all' ? 'All' : s.toUpperCase()}
              </button>
            ))}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto">
          {/* Add/edit bet form */}
          {pnlFormOpen && (
            <div className="mx-3 md:mx-5 mt-4 mb-2 bg-[#121214] border border-[#27272a] rounded-xl p-4 md:p-5">
              <div className="text-[14px] font-bold mb-4">{pnlEditId ? 'Edit bet' : 'Log a bet'}</div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-3">
                <div>
                  <label className={pnlLabelClass}>Game / Event</label>
                  <input type="text" value={pnlForm.game} onChange={e => setPnlForm({ ...pnlForm, game: e.target.value })} placeholder="Lakers vs Celtics" className={pnlInputClass} style={{fontFamily:"'Inter',sans-serif"}}/>
                </div>
                <div>
                  <label className={pnlLabelClass}>Bookmaker</label>
                  <input type="text" value={pnlForm.bookmaker} onChange={e => setPnlForm({ ...pnlForm, bookmaker: e.target.value })} placeholder="DraftKings" className={pnlInputClass} style={{fontFamily:"'Inter',sans-serif"}}/>
                </div>
                <div>
                  <label className={pnlLabelClass}>Sport</label>
                  <select value={pnlForm.sport} onChange={e => setPnlForm({ ...pnlForm, sport: e.target.value })} className={pnlInputClass} style={{fontFamily:"'Inter',sans-serif"}}>
                    {['nba','nfl','mlb','nhl','epl','mls','atp','other'].map(s => <option key={s} value={s}>{s.toUpperCase()}</option>)}
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-3">
                <div>
                  <label className={pnlLabelClass}>Bet type</label>
                  <select value={pnlForm.betType} onChange={e => setPnlForm({ ...pnlForm, betType: e.target.value })} className={pnlInputClass} style={{fontFamily:"'Inter',sans-serif"}}>
                    <option value="arb">Arb</option>
                    <option value="ev">+EV</option>
                    <option value="middle">Middle</option>
                    <option value="bonus">Bonus convert</option>
                    <option value="other">Other</option>
                  </select>
                </div>
                <div>
                  <label className={pnlLabelClass}>Odds (American)</label>
                  <input type="number" value={pnlForm.odds} onChange={e => setPnlForm({ ...pnlForm, odds: e.target.value })} placeholder="-110" className={pnlInputClass} style={{fontFamily:"'Inter',sans-serif"}}/>
                </div>
                <div>
                  <label className={pnlLabelClass}>Stake $</label>
                  <input type="number" value={pnlForm.stake} onChange={e => setPnlForm({ ...pnlForm, stake: e.target.value })} placeholder="100" className={pnlInputClass} style={{fontFamily:"'Inter',sans-serif"}}/>
                </div>
                <div>
                  <label className={pnlLabelClass}>Profit / Loss $</label>
                  <input type="number" value={pnlForm.profit} onChange={e => setPnlForm({ ...pnlForm, profit: e.target.value })} placeholder="4.50" className={pnlInputClass} style={{fontFamily:"'Inter',sans-serif"}}/>
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-4">
                <div>
                  <label className={pnlLabelClass}>Result</label>
                  <select value={pnlForm.result} onChange={e => setPnlForm({ ...pnlForm, result: e.target.value })} className={pnlInputClass} style={{fontFamily:"'Inter',sans-serif"}}>
                    <option value="pending">Pending</option>
                    <option value="won">Won</option>
                    <option value="lost">Lost</option>
                    <option value="void">Void</option>
                  </select>
                </div>
                <div className="col-span-2">
                  <label className={pnlLabelClass}>Notes (optional)</label>
                  <input type="text" value={pnlForm.notes} onChange={e => setPnlForm({ ...pnlForm, notes: e.target.value })} placeholder="Any notes..." className={pnlInputClass} style={{fontFamily:"'Inter',sans-serif"}}/>
                </div>
              </div>
              <div className="flex gap-2">
                <button onClick={savePnlBet} className="px-5 py-2 rounded-md bg-[#e87028] text-black text-[13px] font-black hover:bg-[#ff9a4d] transition-all border-none cursor-pointer">
                  {pnlEditId ? 'Update bet' : 'Save bet'}
                </button>
                <button onClick={() => { setPnlFormOpen(false); setPnlEditId(null) }} className="px-5 py-2 rounded-md bg-transparent border border-[#27272a] text-[#a1a1aa] text-[13px] font-medium hover:text-[#fafafa] transition-all cursor-pointer">Cancel</button>
              </div>
            </div>
          )}

          {/* Bet log table */}
          <div className="hidden md:grid text-[11px] font-semibold uppercase text-[#a1a1aa] px-5 py-[7px] border-b border-[#27272a] bg-[#0c0c0e] sticky top-0 z-10 tracking-wide" style={{gridTemplateColumns:'1.3fr 0.8fr 0.7fr 0.6fr 0.6fr 0.7fr 0.6fr 60px'}}>
            <span>Game</span><span>Book</span><span>Type</span><span>Odds</span><span>Stake</span><span>P&amp;L</span><span>Result</span><span></span>
          </div>

          {pnlLoading ? (
            <div className="flex flex-col items-center justify-center py-16">
              <div className="w-8 h-8 border-2 border-[#e87028] border-t-transparent rounded-full animate-spin mb-3"></div>
              <div className="text-[13px] text-[#a1a1aa] font-medium">Loading bets...</div>
            </div>
          ) : pnlFiltered.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-64 text-[#a1a1aa]">
              <div className="text-3xl opacity-30 mb-3">📊</div>
              <div className="text-[15px] font-bold text-[#fafafa]">{pnlBets.length === 0 ? 'No bets logged yet' : 'No bets match filters'}</div>
              <div className="text-[12px] mt-1 max-w-[400px] text-center">
                {pnlBets.length === 0 ? 'Click "+ Log bet" to start tracking your P&L' : 'Try changing the filters above'}
              </div>
            </div>
          ) : pnlFiltered.map((b, i) => {
            const resultColors = { won: 'text-emerald-400 bg-emerald-900/10 border-emerald-800/25', lost: 'text-red-400 bg-red-900/10 border-red-800/25', pending: 'text-[#e87028] bg-orange-950/10 border-orange-900/25', void: 'text-[#a1a1aa] bg-[#121214] border-[#27272a]' }
            const profitColor = (b.profit || 0) > 0 ? 'text-emerald-400' : (b.profit || 0) < 0 ? 'text-red-400' : 'text-[#a1a1aa]'
            return [
              <div key={b.id || i} className="hidden md:grid px-5 py-[10px] border-b border-[#27272a] items-center hover:bg-[#0c0c0e] transition-colors" style={{gridTemplateColumns:'1.3fr 0.8fr 0.7fr 0.6fr 0.6fr 0.7fr 0.6fr 60px'}}>
                <div>
                  <div className="text-[13px] font-semibold leading-tight">{b.game || '—'}</div>
                  <div className="flex items-center gap-[6px] mt-[3px]">
                    <span className={SPORT_TAG}>{(b.sport || '').toUpperCase()}</span>
                    <span className="text-[10px] text-[#a1a1aa] font-medium">{b.created_at ? new Date(b.created_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) : ''}</span>
                  </div>
                </div>
                <div className="text-[12px] text-[#71717a] font-medium">{b.bookmaker || '—'}</div>
                <div><span className="text-[10px] font-semibold px-[6px] py-[2px] rounded bg-[#121214] border border-[#27272a] text-[#71717a] uppercase">{b.bet_type || '—'}</span></div>
                <div className="text-[12px] text-[#e87028] font-semibold">{b.odds != null ? (b.odds > 0 ? `+${b.odds}` : b.odds) : '—'}</div>
                <div className="text-[12px] font-medium">${b.stake || 0}</div>
                <div className={`text-[14px] font-bold ${profitColor}`}>
                  {b.profit != null ? (b.profit >= 0 ? `+$${Number(b.profit).toFixed(2)}` : `-$${Math.abs(b.profit).toFixed(2)}`) : '—'}
                </div>
                <div>
                  <span className={`text-[10px] font-bold px-[6px] py-[2px] rounded-full border uppercase ${resultColors[b.result] || resultColors.pending}`}>
                    {b.result || 'pending'}
                  </span>
                </div>
                <div className="flex items-center gap-1 justify-end">
                  <button onClick={() => editPnlBet(b)} className="w-6 h-6 rounded flex items-center justify-center bg-transparent border border-[#27272a] text-[#a1a1aa] text-[11px] hover:text-[#fafafa] hover:border-[#3f3f46] transition-all cursor-pointer">✎</button>
                  <button onClick={() => deletePnlBet(b.id)} className="w-6 h-6 rounded flex items-center justify-center bg-transparent border border-[#27272a] text-[#a1a1aa] text-[11px] hover:text-red-400 hover:border-red-900 transition-all cursor-pointer">×</button>
                </div>
              </div>,
              <div key={`m-${b.id || i}`} className="md:hidden flex flex-col gap-1 px-4 py-3 border-b border-[#27272a] hover:bg-[#0c0c0e] transition-colors">
                <div className="flex items-center justify-between">
                  <div className="flex-1 min-w-0">
                    <div className="text-[13px] font-semibold leading-tight truncate">{b.game || '—'}</div>
                    <div className="flex items-center gap-[5px] mt-1 flex-wrap">
                      <span className={SPORT_TAG}>{(b.sport || '').toUpperCase()}</span>
                      <span className="text-[10px] font-semibold px-[6px] py-[2px] rounded bg-[#121214] border border-[#27272a] text-[#71717a] uppercase">{b.bet_type || '—'}</span>
                      <span className="text-[10px] text-[#a1a1aa] font-medium">{b.created_at ? new Date(b.created_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) : ''}</span>
                    </div>
                  </div>
                  <div className="text-right flex-shrink-0 ml-3">
                    <div className={`text-[16px] font-bold ${profitColor}`}>
                      {b.profit != null ? (b.profit >= 0 ? `+$${Number(b.profit).toFixed(2)}` : `-$${Math.abs(b.profit).toFixed(2)}`) : '—'}
                    </div>
                    <span className={`text-[9px] font-bold px-[5px] py-[2px] rounded-full border uppercase ${resultColors[b.result] || resultColors.pending}`}>
                      {b.result || 'pending'}
                    </span>
                  </div>
                </div>
                <div className="flex items-center justify-between mt-1">
                  <div className="flex items-center gap-3 text-[11px] text-[#a1a1aa] font-medium">
                    <span>{b.bookmaker || '—'}</span>
                    <span className="text-[#e87028] font-semibold">{b.odds != null ? (b.odds > 0 ? `+${b.odds}` : b.odds) : '—'}</span>
                    <span>${b.stake || 0}</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <button onClick={() => editPnlBet(b)} className="w-6 h-6 rounded flex items-center justify-center bg-transparent border border-[#27272a] text-[#a1a1aa] text-[11px] hover:text-[#fafafa] hover:border-[#3f3f46] transition-all cursor-pointer">✎</button>
                    <button onClick={() => deletePnlBet(b.id)} className="w-6 h-6 rounded flex items-center justify-center bg-transparent border border-[#27272a] text-[#a1a1aa] text-[11px] hover:text-red-400 hover:border-red-900 transition-all cursor-pointer">×</button>
                  </div>
                </div>
              </div>
            ]
          })}
        </div>

        <div className="h-[26px] flex-shrink-0 flex items-center gap-2 md:gap-4 px-3 md:px-5 bg-[#0c0c0e] border-t border-[#27272a] text-[10px] md:text-[11px] text-[#a1a1aa] font-medium overflow-hidden">
          <span className="flex-shrink-0">{pnlBets.length} bets</span>
          <span className="text-[#27272a]">|</span>
          <span className="truncate">{pnlStats.wins}W {pnlStats.losses}L {pnlStats.pending}P</span>
          <span className="ml-auto flex-shrink-0">P&amp;L · Pro</span>
        </div>
      </div>
    )
  }

  // ---------- BET CALCULATOR HELPERS ----------

  const amToDecCalc = (am) => {
    const n = Number(am)
    if (!Number.isFinite(n) || n === 0) return null
    return n > 0 ? 1 + n / 100 : 1 + 100 / Math.abs(n)
  }

  const decToAmCalc = (dec) => {
    if (!dec || dec <= 1) return null
    return dec >= 2 ? Math.round((dec - 1) * 100) : Math.round(-100 / (dec - 1))
  }

  const fmtAmCalc = (n) => {
    if (n == null || !Number.isFinite(n)) return '—'
    return n > 0 ? `+${n}` : `${n}`
  }

  const calcArbResult = () => {
    const dA = amToDecCalc(calcOddsA)
    const dB = amToDecCalc(calcOddsB)
    if (!dA || !dB) return null
    const iA = 1 / dA
    const iB = 1 / dB
    const sum = iA + iB
    if (sum >= 1) return { isArb: false, hold: ((sum - 1) * 100).toFixed(2) }
    const profit = ((1 - sum) * 100).toFixed(2)
    const stakeA = ((iA / sum) * calcBankroll).toFixed(2)
    const stakeB = ((iB / sum) * calcBankroll).toFixed(2)
    const payout = (calcBankroll / sum).toFixed(2)
    const net = (payout - calcBankroll).toFixed(2)
    return { isArb: true, profit, stakeA, stakeB, payout, net }
  }

  const calcConversion = () => {
    const v = Number(convertInput)
    if (!Number.isFinite(v) || v === 0) return null
    let decimal, american, implied
    if (convertFormat === 'american') {
      decimal = amToDecCalc(v)
      if (!decimal) return null
      american = v
      implied = (1 / decimal) * 100
    } else if (convertFormat === 'decimal') {
      if (v <= 1) return null
      decimal = v
      american = decToAmCalc(v)
      implied = (1 / v) * 100
    } else {
      if (v <= 0 || v >= 100) return null
      implied = v
      decimal = 100 / v
      american = decToAmCalc(decimal)
    }
    return {
      american: fmtAmCalc(american),
      decimal: decimal?.toFixed(4),
      implied: implied?.toFixed(2),
    }
  }

  const calcParlay = () => {
    const decimals = parlayLegs
      .map(l => amToDecCalc(l.odds))
      .filter(d => d != null)
    if (decimals.length < 2) return null
    const combined = decimals.reduce((a, b) => a * b, 1)
    const am = decToAmCalc(combined)
    const payout = (parlayStake * combined).toFixed(2)
    const net = (parlayStake * combined - parlayStake).toFixed(2)
    const impliedProb = ((1 / combined) * 100).toFixed(2)
    return { combined: combined.toFixed(2), american: fmtAmCalc(am), payout, net, impliedProb, legs: decimals.length }
  }

  const calcHold = () => {
    const dA = amToDecCalc(holdOddsA)
    const dB = amToDecCalc(holdOddsB)
    if (!dA || !dB) return null
    const iA = 1 / dA
    const iB = 1 / dB
    const sum = iA + iB
    const hold = ((sum - 1) * 100).toFixed(2)
    const noVigA = decToAmCalc(1 / (iA / (iA + iB - (sum - 1) * iA / sum)))
    const noVigB = decToAmCalc(1 / (iB / (iB + iA - (sum - 1) * iB / sum)))
    const fairProbA = ((iA / sum) * 100).toFixed(1)
    const fairProbB = ((iB / sum) * 100).toFixed(1)
    return { hold, impliedA: (iA * 100).toFixed(1), impliedB: (iB * 100).toFixed(1), fairProbA, fairProbB, isArb: sum < 1 }
  }

  const updateParlayLeg = (index, value) => {
    const updated = [...parlayLegs]
    updated[index] = { odds: value }
    setParlayLegs(updated)
  }
  const addParlayLeg = () => setParlayLegs([...parlayLegs, { odds: '' }])
  const removeParlayLeg = (index) => {
    if (parlayLegs.length <= 2) return
    setParlayLegs(parlayLegs.filter((_, i) => i !== index))
  }

  const calcInputClass = "bg-[#121214] border border-[#27272a] rounded-md text-[#fafafa] px-3 py-2 text-[13px] font-medium outline-none focus:border-[#e87028] w-full"
  const calcLabelClass = "block text-[11px] font-semibold tracking-wider uppercase text-[#a1a1aa] mb-2"

  const renderCalcView = () => {
    const arbResult = calcArbResult()
    const convResult = calcConversion()
    const parlayResult = calcParlay()
    const holdResult = calcHold()

    const tabs = [
      { id: 'arb', label: 'Arb Calculator', icon: '⚡' },
      { id: 'convert', label: 'Odds Converter', icon: '🔄' },
      { id: 'parlay', label: 'Parlay Calculator', icon: '🔗' },
      { id: 'hold', label: 'Hold %', icon: '🏦' },
    ]

    return (
      <div className="flex flex-col flex-1 overflow-hidden">
        <div className="px-3 md:px-5 pt-3 pb-3 bg-[#0c0c0e] border-b border-[#27272a] flex-shrink-0">
          <div className="flex items-center justify-between mb-3">
            <div className="text-[18px] md:text-[22px] font-black tracking-tight">Bet Calculator</div>
            <button onClick={() => setDashView('home')} className="border border-[#27272a] text-[#a1a1aa] px-2 md:px-3 py-1 rounded-md text-[11px] md:text-[12px] font-medium hover:text-[#fafafa] transition-all bg-transparent cursor-pointer">← Home</button>
          </div>
          <div className="flex items-center gap-[4px] md:gap-[5px] flex-wrap">
            {tabs.map(t => (
              <button key={t.id} onClick={() => setCalcTab(t.id)}
                className={`flex items-center gap-1 md:gap-2 px-2 md:px-3 py-[5px] md:py-[6px] rounded-md text-[11px] md:text-[12px] font-medium transition-all cursor-pointer border ${calcTab === t.id ? 'bg-orange-950/10 border-orange-900/25 text-[#e87028]' : 'bg-[#121214] border-[#27272a] text-[#a1a1aa] hover:text-[#fafafa]'}`}
                style={{fontFamily:"'Inter',sans-serif"}}>
                <span>{t.icon}</span><span className="hidden sm:inline">{t.label}</span><span className="sm:hidden">{t.id === 'arb' ? 'Arb' : t.id === 'convert' ? 'Convert' : t.id === 'parlay' ? 'Parlay' : 'Hold'}</span>
              </button>
            ))}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-3 md:p-5">
          <div className="max-w-[600px] mx-auto">

            {calcTab === 'arb' && (
              <div>
                <p className="text-[12px] text-[#a1a1aa] mb-5 leading-relaxed font-medium">Enter American odds for both sides and your total bankroll. If it&apos;s an arb, we&apos;ll show exact stakes and guaranteed profit.</p>
                <div className="grid grid-cols-2 gap-3 mb-3">
                  <div>
                    <label className={calcLabelClass}>Odds A (American)</label>
                    <input type="number" value={calcOddsA} onChange={e => setCalcOddsA(e.target.value)} placeholder="+150" className={calcInputClass} style={{fontFamily:"'Inter',sans-serif"}}/>
                  </div>
                  <div>
                    <label className={calcLabelClass}>Odds B (American)</label>
                    <input type="number" value={calcOddsB} onChange={e => setCalcOddsB(e.target.value)} placeholder="-130" className={calcInputClass} style={{fontFamily:"'Inter',sans-serif"}}/>
                  </div>
                </div>
                <div className="mb-5">
                  <label className={calcLabelClass}>Total Bankroll $</label>
                  <input type="number" value={calcBankroll} onChange={e => setCalcBankroll(parseFloat(e.target.value) || 0)} className={calcInputClass} style={{fontFamily:"'Inter',sans-serif"}}/>
                </div>

                {arbResult && (
                  <div className={`rounded-xl border p-5 ${arbResult.isArb ? 'bg-emerald-900/5 border-emerald-800/20' : 'bg-[#121214] border-[#27272a]'}`}>
                    {arbResult.isArb ? (
                      <>
                        <div className="text-center mb-4">
                          <div className="text-[42px] font-black text-emerald-400 leading-none">+{arbResult.profit}%</div>
                          <div className="text-[11px] text-[#a1a1aa] mt-1 uppercase tracking-wider font-medium">Guaranteed profit</div>
                        </div>
                        <div className="grid grid-cols-2 gap-3 mb-3">
                          <div className="bg-[#0c0c0e] border border-[#27272a] rounded-lg p-3">
                            <div className="text-[10px] text-[#71717a] font-semibold uppercase tracking-wide mb-1">Stake A</div>
                            <div className="text-[20px] font-black text-[#fafafa]">${arbResult.stakeA}</div>
                            <div className="text-[11px] text-[#e87028] font-semibold mt-1">{fmtAmCalc(Number(calcOddsA))}</div>
                          </div>
                          <div className="bg-[#0c0c0e] border border-[#27272a] rounded-lg p-3">
                            <div className="text-[10px] text-[#71717a] font-semibold uppercase tracking-wide mb-1">Stake B</div>
                            <div className="text-[20px] font-black text-[#fafafa]">${arbResult.stakeB}</div>
                            <div className="text-[11px] text-[#e87028] font-semibold mt-1">{fmtAmCalc(Number(calcOddsB))}</div>
                          </div>
                        </div>
                        <div className="flex justify-between py-2 border-t border-[#27272a]">
                          <span className="text-[12px] text-[#a1a1aa] font-medium">Payout</span>
                          <span className="text-[12px] font-semibold">${arbResult.payout}</span>
                        </div>
                        <div className="flex justify-between py-2 border-t border-[#27272a]">
                          <span className="text-[12px] text-[#a1a1aa] font-medium">Net profit</span>
                          <span className="text-[12px] font-bold text-emerald-400">+${arbResult.net}</span>
                        </div>
                      </>
                    ) : (
                      <div className="text-center py-4">
                        <div className="text-[28px] font-black text-red-400 leading-none">No arb</div>
                        <div className="text-[12px] text-[#a1a1aa] mt-2 font-medium">Book hold: <span className="text-[#fafafa] font-semibold">{arbResult.hold}%</span></div>
                      </div>
                    )}
                  </div>
                )}

                {!arbResult && calcOddsA === '' && calcOddsB === '' && (
                  <div className="text-center py-8 text-[#a1a1aa]">
                    <div className="text-3xl opacity-30 mb-3">⚡</div>
                    <div className="text-[13px] font-medium">Enter odds for both sides above</div>
                  </div>
                )}
              </div>
            )}

            {calcTab === 'convert' && (
              <div>
                <p className="text-[12px] text-[#a1a1aa] mb-5 leading-relaxed font-medium">Convert between American odds, decimal odds, and implied probability.</p>
                <div className="grid grid-cols-2 gap-3 mb-4">
                  <div>
                    <label className={calcLabelClass}>Format</label>
                    <select value={convertFormat} onChange={e => setConvertFormat(e.target.value)}
                      className={calcInputClass} style={{fontFamily:"'Inter',sans-serif"}}>
                      <option value="american">American (+150, -110)</option>
                      <option value="decimal">Decimal (2.50, 1.91)</option>
                      <option value="implied">Implied Prob % (40, 52.4)</option>
                    </select>
                  </div>
                  <div>
                    <label className={calcLabelClass}>Value</label>
                    <input type="number" value={convertInput} onChange={e => setConvertInput(e.target.value)}
                      placeholder={convertFormat === 'american' ? '-110' : convertFormat === 'decimal' ? '1.91' : '52.4'}
                      className={calcInputClass} style={{fontFamily:"'Inter',sans-serif"}}/>
                  </div>
                </div>

                {convResult && (
                  <div className="rounded-xl border border-[#27272a] bg-[#121214] overflow-hidden">
                    {[
                      ['American', convResult.american],
                      ['Decimal', convResult.decimal],
                      ['Implied Probability', `${convResult.implied}%`],
                    ].map(([label, val], i) => (
                      <div key={label} className={`flex justify-between px-5 py-3 ${i < 2 ? 'border-b border-[#27272a]' : ''}`}>
                        <span className="text-[13px] text-[#a1a1aa] font-medium">{label}</span>
                        <span className={`text-[15px] font-bold ${label === 'Implied Probability' ? 'text-emerald-400' : 'text-[#e87028]'}`}>{val}</span>
                      </div>
                    ))}
                  </div>
                )}

                {!convResult && convertInput === '' && (
                  <div className="text-center py-8 text-[#a1a1aa]">
                    <div className="text-3xl opacity-30 mb-3">🔄</div>
                    <div className="text-[13px] font-medium">Enter a value above to convert</div>
                  </div>
                )}
              </div>
            )}

            {calcTab === 'parlay' && (
              <div>
                <p className="text-[12px] text-[#a1a1aa] mb-5 leading-relaxed font-medium">Add legs to calculate combined parlay odds, payout, and implied probability. Enter American odds for each leg.</p>
                <div className="mb-3">
                  <label className={calcLabelClass}>Stake $</label>
                  <input type="number" value={parlayStake} onChange={e => setParlayStake(parseFloat(e.target.value) || 0)}
                    className={calcInputClass} style={{fontFamily:"'Inter',sans-serif"}}/>
                </div>
                <div className="mb-2">
                  <label className={calcLabelClass}>Legs (American odds)</label>
                </div>
                {parlayLegs.map((leg, i) => (
                  <div key={i} className="flex items-center gap-2 mb-2">
                    <span className="text-[11px] text-[#a1a1aa] font-bold w-5 text-right">{i + 1}.</span>
                    <input type="number" value={leg.odds} onChange={e => updateParlayLeg(i, e.target.value)}
                      placeholder={i === 0 ? '-110' : '+150'} className={`${calcInputClass} flex-1`} style={{fontFamily:"'Inter',sans-serif"}}/>
                    {parlayLegs.length > 2 && (
                      <button onClick={() => removeParlayLeg(i)} className="w-7 h-7 rounded-md bg-[#121214] border border-[#27272a] text-[#a1a1aa] text-[14px] hover:text-red-400 hover:border-red-900 transition-all cursor-pointer flex items-center justify-center">×</button>
                    )}
                  </div>
                ))}
                <button onClick={addParlayLeg}
                  className="mt-1 mb-5 text-[12px] font-semibold text-[#e87028] hover:text-[#ff9a4d] transition-colors bg-transparent border-none cursor-pointer"
                  style={{fontFamily:"'Inter',sans-serif"}}>
                  + Add leg
                </button>

                {parlayResult && (
                  <div className="rounded-xl border border-orange-900/20 bg-orange-950/5 p-5">
                    <div className="text-center mb-4">
                      <div className="text-[36px] font-black text-[#e87028] leading-none">{parlayResult.american}</div>
                      <div className="text-[11px] text-[#a1a1aa] mt-1 uppercase tracking-wider font-medium">{parlayResult.legs}-leg parlay</div>
                    </div>
                    {[
                      ['Combined decimal', `${parlayResult.combined}x`],
                      ['Payout', `$${parlayResult.payout}`],
                      ['Net profit', `+$${parlayResult.net}`],
                      ['Implied probability', `${parlayResult.impliedProb}%`],
                    ].map(([label, val], i) => (
                      <div key={label} className={`flex justify-between py-2 ${i < 3 ? 'border-b border-[#27272a]' : ''}`}>
                        <span className="text-[12px] text-[#a1a1aa] font-medium">{label}</span>
                        <span className={`text-[12px] font-semibold ${label === 'Net profit' ? 'text-emerald-400' : label === 'Implied probability' ? 'text-emerald-400' : ''}`}>{val}</span>
                      </div>
                    ))}
                  </div>
                )}

                {!parlayResult && (
                  <div className="text-center py-8 text-[#a1a1aa]">
                    <div className="text-3xl opacity-30 mb-3">🔗</div>
                    <div className="text-[13px] font-medium">Enter odds for at least 2 legs</div>
                  </div>
                )}
              </div>
            )}

            {calcTab === 'hold' && (
              <div>
                <p className="text-[12px] text-[#a1a1aa] mb-5 leading-relaxed font-medium">Enter both sides of a two-way market to see the book&apos;s hold (vig/juice) and the true fair probabilities with the juice removed.</p>
                <div className="grid grid-cols-2 gap-3 mb-5">
                  <div>
                    <label className={calcLabelClass}>Side A odds (American)</label>
                    <input type="number" value={holdOddsA} onChange={e => setHoldOddsA(e.target.value)} placeholder="-110" className={calcInputClass} style={{fontFamily:"'Inter',sans-serif"}}/>
                  </div>
                  <div>
                    <label className={calcLabelClass}>Side B odds (American)</label>
                    <input type="number" value={holdOddsB} onChange={e => setHoldOddsB(e.target.value)} placeholder="-110" className={calcInputClass} style={{fontFamily:"'Inter',sans-serif"}}/>
                  </div>
                </div>

                {holdResult && (
                  <div className={`rounded-xl border p-5 ${holdResult.isArb ? 'bg-emerald-900/5 border-emerald-800/20' : 'bg-[#121214] border-[#27272a]'}`}>
                    <div className="text-center mb-4">
                      <div className={`text-[36px] font-black leading-none ${holdResult.isArb ? 'text-emerald-400' : parseFloat(holdResult.hold) > 5 ? 'text-red-400' : 'text-[#fafafa]'}`}>
                        {holdResult.isArb ? 'ARB!' : `${holdResult.hold}%`}
                      </div>
                      <div className="text-[11px] text-[#a1a1aa] mt-1 uppercase tracking-wider font-medium">
                        {holdResult.isArb ? 'Negative hold — arbitrage opportunity' : 'Book hold (vig)'}
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="bg-[#0c0c0e] border border-[#27272a] rounded-lg p-3">
                        <div className="text-[10px] text-[#71717a] font-semibold uppercase tracking-wide mb-1">Side A</div>
                        <div className="text-[13px] font-semibold text-[#fafafa]">Implied: {holdResult.impliedA}%</div>
                        <div className="text-[13px] font-semibold text-emerald-400 mt-1">Fair: {holdResult.fairProbA}%</div>
                      </div>
                      <div className="bg-[#0c0c0e] border border-[#27272a] rounded-lg p-3">
                        <div className="text-[10px] text-[#71717a] font-semibold uppercase tracking-wide mb-1">Side B</div>
                        <div className="text-[13px] font-semibold text-[#fafafa]">Implied: {holdResult.impliedB}%</div>
                        <div className="text-[13px] font-semibold text-emerald-400 mt-1">Fair: {holdResult.fairProbB}%</div>
                      </div>
                    </div>
                  </div>
                )}

                {!holdResult && holdOddsA === '' && holdOddsB === '' && (
                  <div className="text-center py-8 text-[#a1a1aa]">
                    <div className="text-3xl opacity-30 mb-3">🏦</div>
                    <div className="text-[13px] font-medium">Enter odds for both sides of a market</div>
                  </div>
                )}
              </div>
            )}

          </div>
        </div>

        <div className="h-[26px] flex-shrink-0 flex items-center gap-2 md:gap-4 px-3 md:px-5 bg-[#0c0c0e] border-t border-[#27272a] text-[10px] md:text-[11px] text-[#a1a1aa] font-medium overflow-hidden">
          <span className="truncate">Calculator · American format</span>
          <span className="ml-auto flex-shrink-0">FluxOdds v1.0</span>
        </div>
      </div>
    )
  }

  const renderMiddleRow = (m, i) => {
    return [
      <div key={m.fingerprint || i}
        className="hidden md:grid px-5 py-[12px] border-b border-[#27272a] items-center transition-colors hover:bg-[#0c0c0e]"
        style={{gridTemplateColumns:'1.5fr 1.3fr 1.3fr 100px 90px 90px'}}>
        <div>
          <div className="text-[13px] font-semibold mb-[4px]">{m.game}</div>
          <div className="flex items-center gap-[6px] flex-wrap">
            <span className={SPORT_TAG}>{(m.sport || '').toUpperCase()}</span>
            {m.market && <span className={MARKET_TAG}>{m.market}</span>}
            <span className="text-[11px] text-[#a1a1aa] font-medium">{fmtTime(m.time)}</span>
          </div>
        </div>
        <div>
          <BookLink bookId={m.bA} className="text-[10px] text-[#71717a] font-semibold uppercase tracking-wide mb-[2px]" />
          <div className="text-[13px] font-semibold leading-tight">{m.betA}</div>
          <div className="text-[12px] text-[#e87028] font-semibold mt-[2px]">{m.oA}</div>
        </div>
        <div>
          <BookLink bookId={m.bB} className="text-[10px] text-[#71717a] font-semibold uppercase tracking-wide mb-[2px]" />
          <div className="text-[13px] font-semibold leading-tight">{m.betB}</div>
          <div className="text-[12px] text-[#e87028] font-semibold mt-[2px]">{m.oB}</div>
        </div>
        <div>
          <div className="text-[18px] font-black text-emerald-400 leading-none">{m.gap}</div>
          <div className="text-[10px] text-[#a1a1aa] font-medium mt-[2px]">{m.unit || 'pts'} window</div>
        </div>
        <div>
          <div className="text-[14px] font-bold text-[#fafafa]">{m.lowLine}–{m.highLine}</div>
          <div className="text-[10px] text-[#a1a1aa] font-medium mt-[1px]">{m.type === 'spread' ? 'Spread' : 'Total'}</div>
        </div>
        <div>
          <div className={`text-[14px] font-bold ${m.juice <= 0 ? 'text-emerald-400' : 'text-[#fafafa]'}`}>{m.juice <= 0 ? 'FREE' : `${m.juice}%`}</div>
          <div className="text-[10px] text-[#a1a1aa] font-medium mt-[1px]">juice</div>
        </div>
      </div>,
      <div key={`m-${m.fingerprint || i}`}
        className="md:hidden flex flex-col gap-2 px-4 py-3 border-b border-[#27272a] transition-colors hover:bg-[#0c0c0e]">
        <div className="flex items-center justify-between">
          <div className="flex-1 min-w-0">
            <div className="text-[13px] font-semibold mb-1 truncate">{m.game}</div>
            <div className="flex items-center gap-[5px] flex-wrap">
              <span className={SPORT_TAG}>{(m.sport || '').toUpperCase()}</span>
              {m.market && <span className={MARKET_TAG}>{m.market}</span>}
              <span className="text-[10px] text-[#a1a1aa] font-medium">{fmtTime(m.time)}</span>
            </div>
          </div>
          <div className="text-right flex-shrink-0 ml-3">
            <div className="text-[18px] font-black text-emerald-400 leading-none">{m.gap}</div>
            <div className="text-[9px] text-[#a1a1aa] font-medium">{m.unit || 'pts'} window</div>
          </div>
        </div>
        <div className="flex gap-2">
          <div className="flex-1 bg-[#0c0c0e] rounded-lg p-2">
            <BookLink bookId={m.bA} className="text-[9px] text-[#71717a] font-semibold uppercase tracking-wide mb-[2px]" />
            <div className="text-[12px] font-semibold leading-tight">{m.betA}</div>
            <div className="text-[11px] text-[#e87028] font-semibold mt-[2px]">{m.oA}</div>
          </div>
          <div className="flex-1 bg-[#0c0c0e] rounded-lg p-2">
            <BookLink bookId={m.bB} className="text-[9px] text-[#71717a] font-semibold uppercase tracking-wide mb-[2px]" />
            <div className="text-[12px] font-semibold leading-tight">{m.betB}</div>
            <div className="text-[11px] text-[#e87028] font-semibold mt-[2px]">{m.oB}</div>
          </div>
        </div>
        <div className="flex items-center gap-4 text-[11px]">
          <span className="text-[#fafafa] font-semibold">{m.lowLine}–{m.highLine} <span className="text-[#a1a1aa] font-medium">{m.type === 'spread' ? 'Spread' : 'Total'}</span></span>
          <span className={`font-bold ${m.juice <= 0 ? 'text-emerald-400' : 'text-[#fafafa]'}`}>{m.juice <= 0 ? 'FREE' : `${m.juice}% juice`}</span>
        </div>
      </div>
    ]
  }

  const renderMiddlesView = () => {
    if (middlesLocked) {
      return (
        <div className="flex-1 flex flex-col items-center justify-center text-center px-6">
          <div className="text-5xl mb-4">🔒</div>
          <div className="text-[24px] font-black mb-2">Middles Finder is Pro</div>
          <p className="text-[14px] text-[#a1a1aa] max-w-[420px] mb-6 font-medium leading-relaxed">
            Find overlapping lines across sportsbooks where both sides can win. Available exclusively on the Pro plan.
          </p>
          <button onClick={handleCheckout} className="px-8 py-3 rounded-xl bg-[#e87028] text-black text-[14px] font-black hover:bg-[#ff9a4d] transition-all border-none cursor-pointer">
            Get Pro — $75/mo →
          </button>
        </div>
      )
    }
    return (
      <div className="flex flex-col flex-1 overflow-hidden">
        <div className="px-3 md:px-5 pt-3 pb-3 bg-[#0c0c0e] border-b border-[#27272a] flex-shrink-0">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2 min-w-0">
              <div className="text-[18px] md:text-[22px] font-black tracking-tight">Middles Finder</div>
            </div>
            <div className="flex items-center gap-2 md:gap-3 flex-shrink-0">
              <span className="text-[11px] md:text-[12px] text-[#a1a1aa] font-medium">{filteredMiddles.length} middles</span>
              <button onClick={() => setDashView('home')} className="border border-[#27272a] text-[#a1a1aa] px-2 md:px-3 py-1 rounded-md text-[11px] md:text-[12px] font-medium hover:text-[#fafafa] transition-all bg-transparent cursor-pointer">← Home</button>
            </div>
          </div>
          <div className="flex items-center gap-[4px] md:gap-[5px] flex-wrap">
            {['all','nba','nfl','mlb','nhl','epl','mls','atp'].map(s => (
              <button key={s} onClick={() => setSport(s)}
                className={`px-[7px] md:px-[10px] py-[4px] md:py-[5px] rounded-md text-[11px] md:text-[12px] font-medium transition-all cursor-pointer border ${sport===s?'bg-orange-950/10 border-orange-900/25 text-[#e87028]':'bg-[#121214] border-[#27272a] text-[#a1a1aa] hover:text-[#fafafa]'}`}
                style={{fontFamily:"'Inter',sans-serif"}}>
                {s === 'all' ? 'All' : s.toUpperCase()}
              </button>
            ))}
            <div className="w-full sm:w-auto sm:ml-auto flex items-center gap-2 bg-[#121214] border border-[#27272a] rounded-md px-3 py-[5px] mt-2 sm:mt-0">
              <span className="text-[#a1a1aa] text-[12px]">⌕</span>
              <input type="text" placeholder="Search..." onChange={e => setQuery(e.target.value.toLowerCase())}
                className="bg-transparent border-none text-[12px] text-[#fafafa] outline-none w-full sm:w-[110px] font-medium"
                style={{fontFamily:"'Inter',sans-serif"}}/>
            </div>
          </div>
          <div className="mt-3 bg-emerald-900/10 border border-emerald-800/25 rounded-md px-3 py-[6px] flex items-center gap-2">
            <span className="text-[14px]">🎯</span>
            <span className="text-[12px] text-[#a8a18b] font-medium leading-tight">Middles are overlapping lines across books where both bets can win. The &ldquo;window&rdquo; shows how many points/runs/goals the result can land in to hit the middle. Lower juice = cheaper to play.</span>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto">
          <div className="hidden md:grid text-[11px] font-semibold uppercase text-[#a1a1aa] px-5 py-[7px] border-b border-[#27272a] bg-[#0c0c0e] sticky top-0 z-10 tracking-wide" style={{gridTemplateColumns:'1.5fr 1.3fr 1.3fr 100px 90px 90px'}}>
            <span>Game</span><span>Side A</span><span>Side B</span><span>Window</span><span>Lines</span><span>Juice</span>
          </div>
          {filteredMiddles.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-64 text-[#a1a1aa]">
              <div className="text-3xl opacity-30 mb-3">🎯</div>
              <div className="text-[15px] font-bold text-[#fafafa]">No middles right now</div>
              <div className="text-[12px] mt-1 max-w-[400px] text-center">
                {middlesData.length > 0 && filteredMiddles.length === 0
                  ? `${middlesData.length} middle${middlesData.length === 1 ? '' : 's'} hidden by your filters${hiddenBooks.length > 0 ? ' or disabled sportsbooks' : ''}.`
                  : 'Scanning spread and total lines across 40+ books for overlapping opportunities'}
              </div>
              {middlesData.length > 0 && filteredMiddles.length === 0 && (
                <button type="button" onClick={() => { setHiddenBooks([]); setSport('all'); setMinP(0); setQuery('') }} className="mt-3 border border-[#e87028]/40 text-[#e87028] px-3 py-[5px] rounded-md text-[11px] font-semibold hover:bg-[#e87028]/10 transition-all bg-transparent cursor-pointer">
                  Reset all filters
                </button>
              )}
            </div>
          ) : filteredMiddles.map((m, i) => renderMiddleRow(m, i))}
        </div>

        <div className="h-[26px] flex-shrink-0 flex items-center gap-2 md:gap-4 px-3 md:px-5 bg-[#0c0c0e] border-t border-[#27272a] text-[10px] md:text-[11px] text-[#a1a1aa] font-medium overflow-hidden">
          <span className="flex-shrink-0"><span className="inline-block w-[5px] h-[5px] rounded-full bg-emerald-400 mr-1 animate-pulse"></span>Connected</span>
          <span className="text-[#27272a] hidden sm:inline">|</span>
          <span className="hidden sm:inline truncate">Spreads + Totals</span>
          <span className="ml-auto flex-shrink-0">Middles · Pro</span>
        </div>
      </div>
    )
  }

  const renderBonusView = () => {
    if (bonusLocked) {
      return (
        <div className="flex-1 flex flex-col items-center justify-center text-center px-6">
          <div className="text-5xl mb-4">🔒</div>
          <div className="text-[24px] font-black mb-2">Bonus Bet Converter is Pro</div>
          <p className="text-[14px] text-[#a1a1aa] max-w-[420px] mb-6 font-medium leading-relaxed">
            Turn $100 of bonus bets into ~$70-80 of guaranteed real cash. Available exclusively on the Pro plan.
          </p>
          <button onClick={handleCheckout} className="px-8 py-3 rounded-xl bg-[#e87028] text-black text-[14px] font-black hover:bg-[#ff9a4d] transition-all border-none cursor-pointer">
            Get Pro — $75/mo →
          </button>
        </div>
      )
    }
    return (
      <div className="flex flex-col flex-1 overflow-hidden">
        <div className="px-3 md:px-5 pt-4 md:pt-5 pb-4 bg-[#0c0c0e] border-b border-[#27272a]">
          <div className="max-w-[760px]">
            <div className="text-[18px] md:text-[22px] font-black tracking-tight mb-2">Bonus Bet Converter</div>
            <p className="text-[12px] text-[#a1a1aa] mb-4 leading-relaxed font-medium">
              Place the bonus on a longshot, hedge at another book. Walk away with ~70-80% as guaranteed profit.
            </p>
            <div className="flex items-end gap-3 flex-wrap">
              <div>
                <label className="block text-[11px] font-semibold tracking-wider uppercase text-[#a1a1aa] mb-2">Bonus from</label>
                <select value={bonusBook} onChange={e => setBonusBook(e.target.value)}
                  className="bg-[#121214] border border-[#27272a] rounded-md text-[#fafafa] px-3 py-2 text-[13px] font-medium outline-none focus:border-[#e87028] min-w-[180px]"
                  style={{fontFamily:"'Inter',sans-serif"}}>
                  {BONUS_DROPDOWN_BOOKS.map(b => <option key={b.id} value={b.id}>{b.label}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-[11px] font-semibold tracking-wider uppercase text-[#a1a1aa] mb-2">Bonus amount $</label>
                <input type="number" min="1" max="5000" value={bonusAmount}
                  onChange={e => setBonusAmount(parseFloat(e.target.value) || 0)}
                  className="bg-[#121214] border border-[#27272a] rounded-md text-[#fafafa] px-3 py-2 text-[13px] font-medium outline-none focus:border-[#e87028] w-[140px]"
                  style={{fontFamily:"'Inter',sans-serif"}}/>
              </div>
              <button onClick={runBonusConversion} disabled={bonusLoading || !bonusAmount}
                className="px-5 py-2 rounded-md bg-[#e87028] text-black text-[13px] font-black hover:bg-[#ff9a4d] transition-all border-none cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed">
                {bonusLoading ? 'Scanning...' : 'Find conversions →'}
              </button>
              <button onClick={() => setDashView('home')}
                className="ml-auto border border-[#27272a] text-[#a1a1aa] px-3 py-2 rounded-md text-[12px] font-medium hover:text-[#fafafa] transition-all bg-transparent cursor-pointer">
                ← Home
              </button>
            </div>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto">
          {bonusError && (
            <div className="m-5 p-4 bg-red-900/10 border border-red-800/30 rounded-md text-red-400 text-[13px]">{bonusError}</div>
          )}
          {bonusLoading && (
            <div className="flex flex-col items-center justify-center py-16">
              <div className="w-8 h-8 border-2 border-[#e87028] border-t-transparent rounded-full animate-spin mb-3"></div>
              <div className="text-[13px] text-[#a1a1aa] font-medium">Scanning longshots and hedge prices...</div>
            </div>
          )}
          {!bonusLoading && bonusResults && bonusResults.conversions && (
            <>
              {bonusResults.conversions.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 text-[#a1a1aa]">
                  <div className="text-3xl opacity-30 mb-3">🎁</div>
                  <div className="text-[15px] font-bold text-[#fafafa]">No viable conversions right now</div>
                  <div className="text-[12px] mt-1 max-w-[400px] text-center">
                    {bonusResults.scanned} events scanned. Try a different bonus book, or check back when more games are upcoming.
                  </div>
                </div>
              ) : filteredBonusConversions.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 text-[#a1a1aa] px-4 text-center">
                  <div className="text-3xl opacity-30 mb-3">📚</div>
                  <div className="text-[15px] font-bold text-[#fafafa]">No conversions match your books</div>
                  <div className="text-[12px] mt-1 max-w-[400px]">
                    {bookAllowed(bonusBook)
                      ? 'Enable more sportsbooks in the Books panel on the right, or clear your hidden list.'
                      : 'Your bonus book is hidden — pick another bonus book or re-enable that book in Books.'}
                  </div>
                </div>
              ) : (
                <>
                  <div className="px-5 pt-4 pb-2 text-[11px] text-[#a1a1aa] font-medium">
                    Found <span className="text-[#e87028] font-bold">{filteredBonusConversions.length}</span> conversions across <span className="text-[#fafafa] font-bold">{bonusResults.scanned}</span> upcoming games. Sorted by best conversion rate.
                  </div>
                  <div className="hidden md:grid text-[11px] font-semibold uppercase text-[#a1a1aa] px-5 py-[7px] border-b border-[#27272a] bg-[#0c0c0e] sticky top-0 z-10 tracking-wide" style={{gridTemplateColumns:'1.5fr 1.5fr 1.5fr 100px 100px'}}>
                    <span>Game</span><span>Bonus bet (longshot)</span><span>Hedge bet</span><span>Hedge cost</span><span>Locked profit</span>
                  </div>
                  {filteredBonusConversions.map((c, i) => [
                    <div key={`${c.eventID}-${i}`} className="hidden md:grid px-5 py-[14px] border-b border-[#27272a] items-center hover:bg-[#0c0c0e] transition-colors" style={{gridTemplateColumns:'1.5fr 1.5fr 1.5fr 100px 100px'}}>
                      <div>
                        <div className="text-[13px] font-semibold mb-[4px]">{c.game}</div>
                        <div className="flex items-center gap-[6px] flex-wrap">
                          <span className={SPORT_TAG}>{(c.sport || '').toUpperCase()}</span>
                          {c.market && <span className={MARKET_TAG}>{c.market}</span>}
                          <span className="text-[11px] text-[#a1a1aa] font-medium">{fmtTime(c.time)}</span>
                        </div>
                      </div>
                      <div>
                        <div className="text-[10px] text-[#71717a] font-semibold uppercase tracking-wide mb-[2px]">{c.bonusBet.book}</div>
                        <div className="text-[13px] font-semibold leading-tight">{c.bonusBet.label}</div>
                        <div className="text-[12px] text-[#e87028] font-semibold mt-[2px]">{c.bonusBet.odds} · ${c.bonusBet.stake} bonus</div>
                      </div>
                      <div>
                        <div className="text-[10px] text-[#71717a] font-semibold uppercase tracking-wide mb-[2px]">{c.hedge.book}</div>
                        <div className="text-[13px] font-semibold leading-tight">{c.hedge.label}</div>
                        <div className="text-[12px] text-[#e87028] font-semibold mt-[2px]">{c.hedge.odds}</div>
                      </div>
                      <div>
                        <div className="text-[14px] font-bold text-[#fafafa]">${c.hedge.stake.toFixed(2)}</div>
                        <div className="text-[10px] text-[#a1a1aa] font-medium">real cash</div>
                      </div>
                      <div>
                        <div className="text-[18px] font-black text-emerald-400 leading-none">${c.lockedProfit.toFixed(2)}</div>
                        <div className="text-[11px] text-[#a1a1aa] font-medium mt-[2px]"><span className="text-[#fafafa] font-semibold">{c.conversionPct}%</span> rate</div>
                      </div>
                    </div>,
                    <div key={`m-${c.eventID}-${i}`} className="md:hidden flex flex-col gap-2 px-4 py-3 border-b border-[#27272a] hover:bg-[#0c0c0e] transition-colors">
                      <div className="flex items-center justify-between">
                        <div className="flex-1 min-w-0">
                          <div className="text-[13px] font-semibold mb-1 truncate">{c.game}</div>
                          <div className="flex items-center gap-[5px] flex-wrap">
                            <span className={SPORT_TAG}>{(c.sport || '').toUpperCase()}</span>
                            {c.market && <span className={MARKET_TAG}>{c.market}</span>}
                            <span className="text-[10px] text-[#a1a1aa] font-medium">{fmtTime(c.time)}</span>
                          </div>
                        </div>
                        <div className="text-right flex-shrink-0 ml-3">
                          <div className="text-[18px] font-black text-emerald-400 leading-none">${c.lockedProfit.toFixed(2)}</div>
                          <div className="text-[10px] text-[#a1a1aa] font-medium"><span className="text-[#fafafa] font-semibold">{c.conversionPct}%</span> rate</div>
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <div className="flex-1 bg-[#0c0c0e] rounded-lg p-2">
                          <div className="text-[9px] text-[#71717a] font-semibold uppercase tracking-wide mb-[2px]">{c.bonusBet.book}</div>
                          <div className="text-[12px] font-semibold leading-tight">{c.bonusBet.label}</div>
                          <div className="text-[11px] text-[#e87028] font-semibold mt-[2px]">{c.bonusBet.odds} · ${c.bonusBet.stake} bonus</div>
                        </div>
                        <div className="flex-1 bg-[#0c0c0e] rounded-lg p-2">
                          <div className="text-[9px] text-[#71717a] font-semibold uppercase tracking-wide mb-[2px]">{c.hedge.book}</div>
                          <div className="text-[12px] font-semibold leading-tight">{c.hedge.label}</div>
                          <div className="text-[11px] text-[#e87028] font-semibold mt-[2px]">{c.hedge.odds} · ${c.hedge.stake.toFixed(2)}</div>
                        </div>
                      </div>
                    </div>
                  ])}
                </>
              )}
            </>
          )}
          {!bonusLoading && !bonusResults && !bonusError && (
            <div className="flex flex-col items-center justify-center py-16 text-[#a1a1aa]">
              <div className="text-3xl opacity-30 mb-3">🎁</div>
              <div className="text-[15px] font-bold text-[#fafafa]">Pick your bonus book and amount above</div>
              <div className="text-[12px] mt-1">We'll find the best conversion options across 40+ books</div>
            </div>
          )}
        </div>

        <div className="h-[26px] flex-shrink-0 flex items-center gap-2 md:gap-4 px-3 md:px-5 bg-[#0c0c0e] border-t border-[#27272a] text-[10px] md:text-[11px] text-[#a1a1aa] font-medium overflow-hidden">
          <span className="flex-shrink-0"><span className="inline-block w-[5px] h-[5px] rounded-full bg-emerald-400 mr-1 animate-pulse"></span>Connected</span>
          <span className="text-[#27272a] hidden sm:inline">|</span>
          <span className="hidden sm:inline truncate">SNR lock conversion</span>
          <span className="ml-auto flex-shrink-0">Bonus · Pro</span>
        </div>
      </div>
    )
  }

  if (view === 'dashboard') {
    let filtered = []
    let unfilteredCount = 0
    if (isLiveView) { filtered = filteredLiveArbs; unfilteredCount = liveArbsData.length }
    else if (isEvView) { filtered = filteredEv; unfilteredCount = evData.length }
    else if (isMiddlesView) { filtered = filteredMiddles; unfilteredCount = middlesData.length }
    else { filtered = filteredArbs; unfilteredCount = liveData.length }
    const filtersHiding = unfilteredCount > 0 && filtered.length === 0
    const hasHiddenBooks = hiddenBooks.length > 0
    const hasActiveFilters = sport !== 'all' || minP > 0 || query !== '' || hasHiddenBooks

    return (
    <div style={{fontFamily:"'Inter',sans-serif"}} className="flex flex-col h-screen bg-[#09090b] text-[#fafafa] overflow-hidden">
      <div className="h-[52px] flex-shrink-0 flex items-center justify-between px-3 md:px-5 bg-[#0c0c0e] border-b border-[#27272a]">
        <div className="flex items-center gap-2 md:gap-3 min-w-0">
          <button onClick={() => setSidebarOpen(!sidebarOpen)} className="flex flex-col gap-[5px] justify-center w-8 h-8 border-none cursor-pointer p-1 rounded-md hover:bg-[#121214] bg-transparent flex-shrink-0">
            <span className="block h-[1.5px] bg-[#a1a1aa] rounded"></span>
            <span className="block h-[1.5px] bg-[#a1a1aa] rounded"></span>
            <span className="block h-[1.5px] bg-[#a1a1aa] rounded"></span>
          </button>
          <button type="button" onClick={() => setBooksPanelOpen(true)} className="lg:hidden border border-[#27272a] text-[#a1a1aa] px-2 py-[5px] rounded-md text-[11px] font-medium hover:text-[#fafafa] bg-transparent cursor-pointer">
            Books
          </button>
          <span onClick={() => setDashView('home')} className="text-lg md:text-xl font-black tracking-tight cursor-pointer flex-shrink-0">FLUX<span className="text-[#e87028]">ODDS</span></span>
          <span className="hidden sm:flex items-center gap-1 bg-emerald-900/10 border border-emerald-800/20 text-emerald-400 px-2 md:px-3 py-[3px] rounded-full text-[10px] md:text-[11px] font-semibold">
            <span className="w-[6px] h-[6px] rounded-full bg-emerald-400 animate-pulse inline-block"></span>LIVE
          </span>
          {isPro && <span className="bg-[#e87028] text-black px-2 py-[2px] rounded-full text-[10px] font-black tracking-wider flex-shrink-0">PRO</span>}
        </div>
        <div className="flex items-center gap-2 md:gap-5">
          {!isBonusView && !isMiddlesView && !isCalcView && !isPnlView && (
            <>
              <div className="text-right hidden sm:block">
                <div className="text-[15px] font-bold text-emerald-400">{filtered.length}</div>
                <div className="text-[10px] text-[#a1a1aa] uppercase tracking-wider font-medium">{isEvView ? 'EV bets' : (isLiveView ? 'Live arbs' : 'Arbs today')}</div>
              </div>
              <div className="w-px h-7 bg-[#27272a] hidden sm:block"></div>
              <div className="text-right hidden md:block">
                <div className="text-[15px] font-bold text-emerald-400">+{(isEvView ? (filtered[0]?.ev || 0) : (filtered[0]?.profit || 0))}%</div>
                <div className="text-[10px] text-[#a1a1aa] uppercase tracking-wider font-medium">{isEvView ? 'Best EV' : 'Best profit'}</div>
              </div>
              <div className="w-px h-7 bg-[#27272a] hidden md:block"></div>
            </>
          )}
          {isMiddlesView && !middlesLocked && (
            <>
              <div className="text-right hidden sm:block">
                <div className="text-[15px] font-bold text-emerald-400">{filteredMiddles.length}</div>
                <div className="text-[10px] text-[#a1a1aa] uppercase tracking-wider font-medium">Middles</div>
              </div>
              <div className="w-px h-7 bg-[#27272a] hidden sm:block"></div>
              <div className="text-right hidden md:block">
                <div className="text-[15px] font-bold text-[#e87028]">{filteredMiddles[0]?.gap || 0}</div>
                <div className="text-[10px] text-[#a1a1aa] uppercase tracking-wider font-medium">Widest gap</div>
              </div>
              <div className="w-px h-7 bg-[#27272a] hidden md:block"></div>
            </>
          )}
          <button type="button" onClick={() => setBooksPanelOpen((o) => !o)} className="hidden lg:inline-flex border border-[#27272a] text-[#a1a1aa] px-2 md:px-3 py-[5px] rounded-md text-[11px] md:text-[12px] font-medium hover:text-[#fafafa] hover:border-zinc-600 transition-all bg-transparent cursor-pointer" title="Toggle sportsbooks panel">
            Books
          </button>
          <button onClick={() => setView('marketing')} className="hidden md:inline-flex border border-[#27272a] text-[#a1a1aa] px-3 py-[5px] rounded-md text-[12px] font-medium hover:text-[#fafafa] hover:border-[#3f3f46] transition-all bg-transparent cursor-pointer">← Back</button>
          <button onClick={handleSignout} className="border border-[#27272a] text-[#a1a1aa] px-2 md:px-3 py-[5px] rounded-md text-[11px] md:text-[12px] font-medium hover:text-red-400 hover:border-red-900 transition-all bg-transparent cursor-pointer">Sign out</button>
          <div className="w-7 h-7 rounded-full bg-[#e87028] flex items-center justify-center text-[11px] font-black text-black cursor-pointer flex-shrink-0">{user?.email?.[0]?.toUpperCase()||'U'}</div>
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden relative">
        {sidebarOpen && <div className="md:hidden dash-sidebar-overlay" onClick={() => setSidebarOpen(false)}></div>}
        {sidebarOpen && (
          <div className="dash-sidebar md:relative md:top-auto md:left-auto md:bottom-auto md:z-auto w-[240px] min-w-[240px] bg-[#0c0c0e] border-r border-[#27272a] flex flex-col overflow-y-auto flex-shrink-0">
            <div className="px-3 pt-5 pb-2">
              <div className="text-[10px] font-semibold tracking-widest uppercase text-[#a1a1aa] px-2 mb-2">Arb Tools</div>
              {[
                {name:'Live Arbitrage',icon:'⚡',badge:'LIVE'},
                {name:'Prematch Arbitrage',icon:'🗓'},
                {name:'Positive EV Bets',icon:'📈',badge:'NEW'},
                {name:'Middles Finder',icon:'🎯'},
                {name:'Bonus Bet Converter',icon:'🎁',badge:'PRO'},
              ].map(t => (
                <button key={t.name} onClick={() => openTool(t.name)}
                  className={`flex items-center gap-3 w-full px-2 py-[9px] rounded-lg text-[13px] font-medium transition-all mb-[2px] cursor-pointer ${toolName===t.name&&dashView==='arb'?'bg-orange-950/10 border border-orange-900/20 text-[#e87028]':'text-[#a1a1aa] hover:bg-[#121214] hover:text-[#fafafa] border border-transparent'}`}
                  style={{background:'none',fontFamily:"'Inter',sans-serif"}}>
                  <span className="w-[30px] h-[30px] rounded-lg flex items-center justify-center text-sm bg-[#121214] border border-[#3f3f46]">{t.icon}</span>
                  <span className="flex-1 text-left">{t.name}</span>
                  {t.badge && <span className="text-[9px] font-semibold px-[6px] py-[2px] rounded-full border border-[#3f3f46] text-[#a1a1aa]">{t.badge}</span>}
                </button>
              ))}
            </div>
            <div className="h-px bg-[#27272a] mx-3 my-1"></div>
            <div className="px-3 pt-3 pb-2">
              <div className="text-[10px] font-semibold tracking-widest uppercase text-[#a1a1aa] px-2 mb-2">Tools</div>
              {[{icon:'🧮',name:'Bet Calculator'},{icon:'📊',name:'P&L Tracker'},{icon:'🔔',name:'Alerts & Notifications'}].map(t => (
                <button key={t.name} onClick={() => openTool(t.name)}
                  className="flex items-center gap-3 w-full px-2 py-[9px] rounded-lg text-[13px] font-medium text-[#a1a1aa] hover:bg-[#121214] hover:text-[#fafafa] transition-all mb-[2px] border border-transparent cursor-pointer"
                  style={{background:'none',fontFamily:"'Inter',sans-serif"}}>
                  <span className="w-[30px] h-[30px] rounded-lg flex items-center justify-center text-sm bg-[#121214] border border-[#3f3f46]">{t.icon}</span>
                  <span>{t.name}</span>
                </button>
              ))}
            </div>
            {!isPro && (
              <div className="mt-auto p-3 border-t border-[#27272a]">
                <div className="bg-orange-950/5 border border-orange-900/15 rounded-xl p-3">
                  <div className="text-[13px] font-bold text-[#e87028]">Upgrade to Pro</div>
                  <div className="text-[11px] text-[#a1a1aa] mt-1">Unlimited arbs + EV + bonus converter</div>
                  <button onClick={handleCheckout} className="block w-full mt-2 py-2 rounded-lg bg-[#e87028] text-black text-[11px] font-black text-center border-none cursor-pointer hover:bg-[#ff9a4d]">Get Pro — $75/mo</button>
                </div>
              </div>
            )}
          </div>
        )}

        <div className="flex-1 flex flex-col overflow-hidden">
          {dashView === 'home' ? (
            <div className="flex-1 flex flex-col items-center justify-center text-center px-6 relative overflow-hidden">
              <div className="absolute inset-0 opacity-20" style={{backgroundImage:'linear-gradient(rgba(232,112,40,.04) 1px,transparent 1px),linear-gradient(90deg,rgba(232,112,40,.04) 1px,transparent 1px)',backgroundSize:'52px 52px'}}></div>
              <div className="absolute bottom-0 left-0 right-0 h-[200px] pointer-events-none" style={{background:'radial-gradient(ellipse 80% 100% at 50% 100%, rgba(232,112,40,.15) 0%, rgba(214,82,24,.06) 40%, transparent 70%)'}}></div>
              <div className="relative z-10 max-w-[560px]">
                <div className="inline-flex items-center gap-2 bg-orange-950/10 border border-orange-900/20 text-[#e87028] px-4 py-[5px] rounded-full text-[11px] font-semibold tracking-wider uppercase mb-6">
                  <span className="w-[6px] h-[6px] rounded-full bg-emerald-400 animate-pulse inline-block"></span>Scanning 40+ books live
                </div>
                <h2 className="text-[clamp(40px,6vw,80px)] font-black leading-[.95] tracking-tight mb-4">
                  FIND THE <span className="text-[#e87028]">EDGE.</span><br/>
                  <span className="text-[#3f3f46]">BEAT THE BOOKS.</span>
                </h2>
                <p className="text-[14px] text-[#a1a1aa] max-w-[380px] mx-auto mb-8 leading-relaxed font-medium">Real-time arbitrage, +EV detection, and bonus bet conversion across every major sportsbook.</p>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-2 max-w-[540px] mx-auto mb-7 px-2 md:px-0">
                  {tools.map(t => (
                    <div key={t.id} onClick={() => openTool(t.name)}
                      className={`bg-[#0c0c0e] border rounded-xl p-3 cursor-pointer text-left transition-all hover:-translate-y-[2px] relative overflow-hidden ${t.id==='live'||t.id==='ev'?'border-orange-900/25 bg-orange-950/5':'border-[#27272a] hover:border-[#3f3f46] hover:bg-[#121214]'}`}>
                      <div className="text-[18px] mb-2">{t.icon}</div>
                      <div className="text-[11px] md:text-[12px] font-bold text-[#fafafa] mb-[3px]">{t.name}</div>
                      <div className="text-[10px] md:text-[11px] text-[#a1a1aa] leading-snug font-medium">{t.desc}</div>
                      {t.badge && <span className="absolute top-2 right-2 text-[8px] font-semibold px-[5px] py-[2px] rounded-full bg-[#27272a] border border-[#3f3f46] text-[#a1a1aa]">{t.badge}</span>}
                    </div>
                  ))}
                </div>
                <button onClick={() => openTool('Prematch Arbitrage')} className="inline-flex items-center gap-2 px-8 py-3 rounded-xl bg-[#e87028] text-black text-[14px] font-black hover:bg-[#ff9a4d] transition-all hover:-translate-y-[2px] cursor-pointer border-none">
                  View Top Arbs <span className="text-[16px]">→</span>
                </button>
              </div>
              <div className="absolute bottom-0 left-0 right-0 h-[25px] flex items-center gap-2 md:gap-4 px-3 md:px-5 bg-[#0c0c0e] border-t border-[#27272a] text-[10px] md:text-[11px] text-[#a1a1aa] font-medium z-10 overflow-hidden">
                <span className="flex-shrink-0"><span className="inline-block w-[5px] h-[5px] rounded-full bg-emerald-400 mr-1 animate-pulse"></span>Connected</span>
                <span className="text-[#27272a] hidden sm:inline">|</span>
                <span className="hidden sm:inline">Polling every 1s</span>
                <span className="ml-auto flex-shrink-0">FluxOdds v1.0</span>
              </div>
            </div>
          ) : isPnlView ? (
            renderPnlView()
          ) : isCalcView ? (
            renderCalcView()
          ) : isMiddlesView ? (
            renderMiddlesView()
          ) : isBonusView ? (
            renderBonusView()
          ) : (
            <div className="flex flex-col flex-1 overflow-hidden">
              <div className="px-3 md:px-5 pt-3 pb-3 bg-[#0c0c0e] border-b border-[#27272a] flex-shrink-0">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2 min-w-0">
                    <div className="text-[18px] md:text-[22px] font-black tracking-tight truncate">{toolName}</div>
                    {isLiveView && <span className={LIVE_TAG}>● Live in-play</span>}
                  </div>
                  <div className="flex items-center gap-2 md:gap-3 flex-shrink-0">
                    <span className="text-[11px] md:text-[12px] text-[#a1a1aa] font-medium">{filtered.length} opps</span>
                    <button onClick={() => setDashView('home')} className="border border-[#27272a] text-[#a1a1aa] px-2 md:px-3 py-1 rounded-md text-[11px] md:text-[12px] font-medium hover:text-[#fafafa] transition-all bg-transparent cursor-pointer">← Home</button>
                  </div>
                </div>
                <div className="flex items-center gap-[4px] md:gap-[5px] flex-wrap">
                  {['all','nba','nfl','mlb','nhl','epl','mls','atp'].map(s => (
                    <button key={s} onClick={() => setSport(s)}
                      className={`px-[7px] md:px-[10px] py-[4px] md:py-[5px] rounded-md text-[11px] md:text-[12px] font-medium transition-all cursor-pointer border ${sport===s?'bg-orange-950/10 border-orange-900/25 text-[#e87028]':'bg-[#121214] border-[#27272a] text-[#a1a1aa] hover:text-[#fafafa]'}`}
                      style={{fontFamily:"'Inter',sans-serif"}}>
                      {s === 'all' ? 'All' : s.toUpperCase()}
                    </button>
                  ))}
                  <div className="w-px h-4 bg-[#27272a] mx-[2px] md:mx-1 hidden sm:block"></div>
                  {[0,1,2,3].map(m => (
                    <button key={m} onClick={() => setMinP(m)}
                      className={`px-[7px] md:px-[10px] py-[4px] md:py-[5px] rounded-md text-[11px] md:text-[12px] font-medium transition-all cursor-pointer border ${minP===m?'bg-orange-950/10 border-orange-900/25 text-[#e87028]':'bg-[#121214] border-[#27272a] text-[#a1a1aa] hover:text-[#fafafa]'}`}
                      style={{fontFamily:"'Inter',sans-serif"}}>
                      {m === 0 ? 'Any %' : <span className="text-[#fafafa]">{m}%+</span>}
                    </button>
                  ))}
                  <div className="w-full sm:w-auto sm:ml-auto flex items-center gap-2 bg-[#121214] border border-[#27272a] rounded-md px-3 py-[5px] mt-2 sm:mt-0">
                    <span className="text-[#a1a1aa] text-[12px]">⌕</span>
                    <input type="text" placeholder="Search..." onChange={e => setQuery(e.target.value.toLowerCase())}
                      className="bg-transparent border-none text-[12px] text-[#fafafa] outline-none w-full sm:w-[110px] font-medium"
                      style={{fontFamily:"'Inter',sans-serif"}}/>
                  </div>
                </div>
                {isLiveView && (
                  <div className="mt-3 bg-red-900/10 border border-red-800/30 rounded-md px-3 py-[6px] flex items-center gap-2">
                    <span className="text-[14px]">⚠️</span>
                    <span className="text-[12px] text-[#a8a18b] font-medium leading-tight">Live arbs disappear in seconds. Books often have 5-15s bet review delays. Use small stakes and expect to occasionally miss the hedge.</span>
                  </div>
                )}
                {userPlan === 'free' && !isLiveView && (
                  <div className="mt-3 bg-orange-950/5 border border-orange-900/15 rounded-md px-3 py-[6px] flex items-center justify-between">
                    <span className="text-[12px] text-[#a1a1aa] font-medium">Free plan: {isEvView ? <>EV bets above <span className="text-[#fafafa] font-semibold">{FREE_EV_CAP}%</span></> : <>arbs above <span className="text-[#fafafa] font-semibold">{FREE_PROFIT_CAP}%</span></>} are locked. <span className="text-[#e87028] font-semibold">Upgrade to see them.</span></span>
                    <button onClick={handleCheckout} className="text-[11px] font-black bg-[#e87028] text-black px-3 py-[5px] rounded-md cursor-pointer border-none hover:bg-[#ff9a4d]">Get Pro</button>
                  </div>
                )}
              </div>

              <div className="flex-1 overflow-y-auto">
                {isEvView ? (
                  <>
                    <div className="hidden md:grid text-[11px] font-semibold uppercase text-[#a1a1aa] px-5 py-[7px] border-b border-[#27272a] bg-[#0c0c0e] sticky top-0 z-10 tracking-wide" style={{gridTemplateColumns:'1.6fr 1.8fr 1fr 80px 80px 80px'}}>
                      <span>Game</span><span>Bet / Book</span><span>Odds / Fair</span><span>EV %</span><span>Win %</span><span>Age</span>
                    </div>
                    {filtered.length === 0 ? (
                      <div className="flex flex-col items-center justify-center h-64 text-[#a1a1aa]">
                        <div className="text-3xl opacity-30 mb-3">📈</div>
                        <div className="text-[15px] font-bold text-[#fafafa]">No +EV bets right now</div>
                        <div className="text-[12px] mt-1 max-w-[400px] text-center">
                          {filtersHiding
                            ? `${unfilteredCount} result${unfilteredCount === 1 ? '' : 's'} hidden by your filters${hasHiddenBooks ? ' or disabled sportsbooks' : ''}.`
                            : 'Comparing every book against Pinnacle\'s de-vigged sharp lines'}
                        </div>
                        {filtersHiding && (
                          <button type="button" onClick={() => { setHiddenBooks([]); setSport('all'); setMinP(0); setQuery('') }} className="mt-3 border border-[#e87028]/40 text-[#e87028] px-3 py-[5px] rounded-md text-[11px] font-semibold hover:bg-[#e87028]/10 transition-all bg-transparent cursor-pointer">
                            Reset all filters
                          </button>
                        )}
                      </div>
                    ) : filtered.map((e, i) => renderEvRow(e, i))}
                  </>
                ) : (
                  <>
                    <div className="hidden md:grid text-[11px] font-semibold uppercase text-[#a1a1aa] px-5 py-[7px] border-b border-[#27272a] bg-[#0c0c0e] sticky top-0 z-10 tracking-wide" style={{gridTemplateColumns:'1.6fr 1.4fr 1.4fr 90px 100px'}}>
                      <span>Game</span><span>Bet A</span><span>Bet B</span><span>Profit / Age</span><span>Stakes ($100)</span>
                    </div>
                    {filtered.length === 0 ? (
                      <div className="flex flex-col items-center justify-center h-64 text-[#a1a1aa]">
                        <div className="text-3xl opacity-30 mb-3">{isLiveView ? '⚡' : '◎'}</div>
                        <div className="text-[15px] font-bold text-[#fafafa]">{isLiveView ? 'No live arbs right now' : 'No arbitrage opportunities right now'}</div>
                        <div className="text-[12px] mt-1 max-w-[400px] text-center">
                          {filtersHiding
                            ? `${unfilteredCount} result${unfilteredCount === 1 ? '' : 's'} hidden by your filters${hasHiddenBooks ? ' or disabled sportsbooks' : ''}.`
                            : isLiveView ? 'Live arbs appear during in-progress games and disappear within seconds. Check back during peak game hours.' : 'Scanning every 5 seconds — check back soon'}
                        </div>
                        {filtersHiding && (
                          <button type="button" onClick={() => { setHiddenBooks([]); setSport('all'); setMinP(0); setQuery('') }} className="mt-3 border border-[#e87028]/40 text-[#e87028] px-3 py-[5px] rounded-md text-[11px] font-semibold hover:bg-[#e87028]/10 transition-all bg-transparent cursor-pointer">
                            Reset all filters
                          </button>
                        )}
                        {!filtersHiding && hasActiveFilters && unfilteredCount === 0 && (
                          <div className="text-[11px] mt-2 text-[#71717a]">Filters active — try broadening your search</div>
                        )}
                      </div>
                    ) : filtered.map((a, i) => renderArbRow(a, i, { live: isLiveView }))}
                  </>
                )}
              </div>

              <div className="h-[26px] flex-shrink-0 flex items-center gap-2 md:gap-4 px-3 md:px-5 bg-[#0c0c0e] border-t border-[#27272a] text-[10px] md:text-[11px] text-[#a1a1aa] font-medium overflow-hidden">
                <span className="flex-shrink-0"><span className="inline-block w-[5px] h-[5px] rounded-full bg-emerald-400 mr-1 animate-pulse"></span>Connected</span>
                <span className="text-[#27272a] hidden sm:inline">|</span>
                {isEvView ? <span className="hidden sm:inline truncate">Pinnacle de-vigged</span> : isLiveView ? <span className="hidden sm:inline truncate">In-play · every 5s</span> : <span className="hidden sm:inline truncate">Polling every 1s</span>}
                {unfilteredCount > filtered.length && <><span className="text-[#27272a] hidden sm:inline">|</span><span className="hidden sm:inline truncate text-[#e87028]">{unfilteredCount - filtered.length} hidden by filters</span></>}
                <span className="ml-auto flex-shrink-0 truncate">{toolName}</span>
              </div>
            </div>
          )}
        </div>

        {booksPanelOpen && (
          <div className="lg:hidden fixed inset-0 bg-black/50 z-30" onClick={() => setBooksPanelOpen(false)} aria-hidden="true" />
        )}
        <aside
          className={`${booksPanelOpen ? 'flex' : 'hidden'} flex-col w-[min(100vw,280px)] lg:w-[240px] flex-shrink-0 border-l border-[#27272a] bg-[#09090b] z-40 lg:z-0 fixed right-0 top-[52px] bottom-0 lg:static lg:border-l lg:border-r-0 overflow-hidden`}
          aria-label="Sportsbook visibility">
          <div className="px-3 py-3 border-b border-[#27272a] flex items-center justify-between gap-2 flex-shrink-0">
            <div>
              <div className="text-[11px] font-semibold text-[#fafafa]">Sportsbooks</div>
              <div className="text-[10px] text-[#71717a] mt-0.5">Tap to hide from feeds</div>
            </div>
            <button type="button" onClick={() => setBooksPanelOpen(false)} className="lg:hidden text-[#a1a1aa] text-lg leading-none px-1 hover:text-[#fafafa] bg-transparent border-none cursor-pointer" aria-label="Close books panel">×</button>
          </div>
          <div className="px-3 py-2 border-b border-[#27272a] flex-shrink-0">
            <input
              type="search"
              value={bookSearch}
              onChange={(e) => setBookSearch(e.target.value)}
              placeholder="Search books…"
              className="w-full bg-[#121214] border border-[#27272a] rounded-lg text-[#fafafa] placeholder:text-[#71717a] px-2.5 py-1.5 text-[12px] outline-none focus:border-orange-500/40"
            />
            <div className="flex gap-2 mt-2">
              <button type="button" onClick={() => setHiddenBooks([])} className="text-[10px] font-medium text-orange-400 hover:text-orange-300 bg-transparent border-none cursor-pointer p-0">Enable all</button>
              <span className="text-[#3f3f46]">|</span>
              <button type="button" onClick={() => setHiddenBooks(ALL_SPORTSBOOKS.map((b) => b.id))} className="text-[10px] font-medium text-[#a1a1aa] hover:text-[#fafafa] bg-transparent border-none cursor-pointer p-0">Disable all</button>
            </div>
          </div>
          <div className="flex-1 overflow-y-auto px-2 py-2 space-y-0.5">
            {booksPanelFiltered.map((b) => {
              const on = !hiddenBookSet.has(b.id)
              return (
                <button
                  key={b.id}
                  type="button"
                  onClick={() => toggleBookHidden(b.id)}
                  className={`w-full flex items-center justify-between gap-2 rounded-lg px-2 py-1.5 text-left text-[12px] transition-colors border cursor-pointer ${on ? 'bg-[#121214] border-[#27272a] text-[#fafafa]' : 'bg-transparent border-transparent text-[#71717a] line-through opacity-70'}`}>
                  <span className="truncate font-medium">{b.label}</span>
                  <span className={`text-[10px] font-semibold flex-shrink-0 px-1.5 py-0.5 rounded ${on ? 'text-emerald-400 bg-emerald-500/10' : 'text-[#71717a]'}`}>{on ? 'On' : 'Off'}</span>
                </button>
              )
            })}
          </div>
        </aside>
      </div>

      {selectedArb && (
        <>
          <div className="fixed inset-0 bg-black/50 z-40" onClick={() => setSelectedArb(null)}></div>
          <div className="arb-detail-panel fixed right-0 top-0 bottom-0 w-full sm:w-[360px] bg-[#0c0c0e] border-l border-[#27272a] z-50 flex flex-col" style={{fontFamily:"'Inter',sans-serif"}}>
            <div className="flex items-start justify-between p-4 border-b border-[#27272a]">
              <div>
                <div className="text-[14px] font-bold mb-1">{selectedArb.game}</div>
                <div className="flex items-center gap-[6px] flex-wrap">
                  <span className={SPORT_TAG}>{(selectedArb.sport || '').toUpperCase()}</span>
                  {selectedArb.market && <span className={MARKET_TAG}>{selectedArb.market}</span>}
                  {selectedArb.liveStatus
                    ? <span className={LIVE_TAG}>● {selectedArb.liveStatus}</span>
                    : <span className="text-[11px] text-[#a1a1aa] font-medium">{fmtTime(selectedArb.time)}</span>}
                </div>
              </div>
              <button onClick={() => setSelectedArb(null)} className="text-[#a1a1aa] text-lg hover:text-[#fafafa] transition-colors bg-transparent border-none cursor-pointer">×</button>
            </div>
            <div className="flex-1 overflow-y-auto p-4">
              <div className="text-center p-5 bg-orange-950/5 border border-orange-900/10 rounded-xl mb-4">
                <div className="text-[48px] font-black text-emerald-400 leading-none">+{selectedArb.profit}%</div>
                <div className="text-[10px] text-[#a1a1aa] mt-1 uppercase tracking-wider font-medium">Guaranteed profit</div>
              </div>
              <div className="flex items-center gap-2 mb-4">
                <label className="text-[12px] text-[#a1a1aa] font-medium whitespace-nowrap">Bankroll $</label>
                <input type="number" value={bankroll} onChange={e => setBankroll(parseFloat(e.target.value)||100)}
                  className="flex-1 bg-[#121214] border border-[#27272a] rounded-md text-[#fafafa] px-2 py-[6px] text-[13px] font-medium outline-none focus:border-[#e87028]"
                  style={{fontFamily:"'Inter',sans-serif"}}/>
              </div>
              <div className="text-[10px] font-semibold tracking-wider uppercase text-[#a1a1aa] mb-2">Your bets</div>
              {[
                {name:selectedArb.bA, odds:selectedArb.oA, stake:stakeA, bet:cleanBet(selectedArb.betA, selectedArb.bA)},
                {name:selectedArb.bB, odds:selectedArb.oB, stake:stakeB, bet:cleanBet(selectedArb.betB, selectedArb.bB)}
              ].map((b,i) => (
                <div key={i} className="flex items-start justify-between bg-[#121214] border border-[#27272a] rounded-xl px-3 py-[10px] mb-[5px]">
                  <div className="flex-1 min-w-0 pr-2">
                    <BookLink bookId={b.name} className="text-[10px] text-[#71717a] font-semibold uppercase tracking-wide mb-[2px]" />
                    <div className="text-[13px] font-semibold leading-tight">{b.bet}</div>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <div className="text-[12px] text-[#e87028] font-semibold">{b.odds}</div>
                    <div className="text-[13px] text-emerald-400 mt-[2px] font-semibold">${b.stake}</div>
                  </div>
                </div>
              ))}
              <div className="bg-[#121214] border border-[#27272a] rounded-xl p-3 mt-3">
                {[['Total stake',`$${parseFloat(bankroll).toFixed(2)}`],['Payout',`$${payout}`],['Net profit',`+$${net}`]].map(([l,v],i) => (
                  <div key={i} className={`flex justify-between py-[5px] ${i<2?'border-b border-[#27272a]':''} ${i===2?'pt-2':''}`}>
                    <span className="text-[12px] text-[#a1a1aa] font-medium">{l}</span>
                    <span className={`text-[12px] font-semibold ${i===2?'text-emerald-400':''}`}>{v}</span>
                  </div>
                ))}
              </div>
            </div>
            <div className="flex gap-2 p-4 border-t border-[#27272a]">
              <button className="flex-1 py-[10px] rounded-xl bg-[#e87028] text-black text-[12px] font-black hover:bg-[#ff9a4d] transition-colors border-none cursor-pointer">Place bets →</button>
              <button onClick={() => setSelectedArb(null)} className="flex-1 py-[10px] rounded-xl bg-[#121214] border border-[#27272a] text-[#a1a1aa] text-[12px] font-medium hover:text-[#fafafa] transition-colors cursor-pointer">Save</button>
            </div>
          </div>
        </>
      )}
    </div>
    )
  }

  // ─── MARKETING SITE ───
  return (
    <div style={{fontFamily:"'Inter',sans-serif"}} className="bg-[#09090b] text-[#fafafa] overflow-x-hidden">
      {sidebarOpen && <div className="fixed inset-0 bg-black/60 z-[90] backdrop-blur-sm" onClick={() => setSidebarOpen(false)}></div>}
      <div className={`fixed top-0 left-0 bottom-0 w-[256px] bg-[#0c0c0e] border-r border-[#27272a] z-[91] flex flex-col overflow-y-auto transition-transform duration-300 ${sidebarOpen?'translate-x-0':'-translate-x-full'}`}>
        <div className="h-[60px] flex items-center justify-between px-4 border-b border-[#27272a]">
          <div className="text-xl font-black tracking-tight">FLUX<span className="text-[#e87028]">ODDS</span></div>
          <button onClick={() => setSidebarOpen(false)} className="text-[#a1a1aa] text-lg hover:text-[#fafafa] bg-transparent border-none cursor-pointer">×</button>
        </div>
        <div className="p-3 pt-4">
          <div className="text-[10px] font-semibold tracking-widest uppercase text-[#a1a1aa] px-2 mb-2">Arb Tools</div>
          {[
            {name:'Live Arbitrage',icon:'⚡',badge:'LIVE'},
            {name:'Prematch Arbitrage',icon:'🗓'},
            {name:'Positive EV Bets',icon:'📈',badge:'NEW'},
            {name:'Middles Finder',icon:'🎯'},
            {name:'Bonus Bet Converter',icon:'🎁',badge:'PRO'},
          ].map(t => (
            <button key={t.name} onClick={() => openTool(t.name)}
              className="flex items-center gap-3 w-full px-2 py-[9px] rounded-lg text-[13px] font-medium text-[#a1a1aa] hover:bg-[#121214] hover:text-[#fafafa] transition-all mb-[2px] border border-transparent cursor-pointer"
              style={{background:'none',fontFamily:"'Inter',sans-serif"}}>
              <span className="w-[30px] h-[30px] rounded-lg flex items-center justify-center text-sm bg-[#121214] border border-[#27272a]">{t.icon}</span>
              <span className="flex-1 text-left">{t.name}</span>
              {t.badge && <span className="text-[9px] font-semibold px-[6px] py-[2px] rounded-full border border-[#3f3f46] text-[#a1a1aa]">{t.badge}</span>}
            </button>
          ))}
          <div className="h-px bg-[#27272a] my-3"></div>
          <div className="text-[10px] font-semibold tracking-widest uppercase text-[#a1a1aa] px-2 mb-2">Tools</div>
          {[{icon:'🧮',name:'Bet Calculator'},{icon:'📊',name:'P&L Tracker'},{icon:'🔔',name:'Alerts & Notifications'}].map(t => (
            <button key={t.name} onClick={() => openTool(t.name)}
              className="flex items-center gap-3 w-full px-2 py-[9px] rounded-lg text-[13px] font-medium text-[#a1a1aa] hover:bg-[#121214] hover:text-[#fafafa] transition-all mb-[2px] border border-transparent cursor-pointer"
              style={{background:'none',fontFamily:"'Inter',sans-serif"}}>
              <span className="w-[30px] h-[30px] rounded-lg flex items-center justify-center text-sm bg-[#121214] border border-[#27272a]">{t.icon}</span>
              <span>{t.name}</span>
            </button>
          ))}
        </div>
        <div className="mt-auto p-3 border-t border-[#27272a]">
          <div className="bg-orange-950/5 border border-orange-900/15 rounded-xl p-3 cursor-pointer hover:bg-orange-950/10 transition-colors">
            <div className="text-[13px] font-bold text-[#e87028]">Upgrade to Pro</div>
            <div className="text-[11px] text-[#a1a1aa] mt-1 font-medium">Unlimited arbs + EV + bonus converter</div>
            <span className="block mt-2 py-2 rounded-lg bg-[#e87028] text-black text-[11px] font-black text-center">Get Pro — $75/mo</span>
          </div>
        </div>
      </div>

      <nav className="fixed top-0 left-0 right-0 z-[100] flex items-center justify-between px-4 md:px-12 h-[60px] border-b border-[#27272a] backdrop-blur-md" style={{background:'rgba(8,8,6,0.92)'}}>
        <div className="flex items-center gap-3">
          <button onClick={() => setSidebarOpen(!sidebarOpen)} className="flex flex-col gap-[5px] justify-center w-8 h-8 bg-transparent border-none cursor-pointer p-1 rounded-md hover:bg-[#121214]">
            <span className="block h-[1.5px] bg-[#a1a1aa] rounded"></span>
            <span className="block h-[1.5px] bg-[#a1a1aa] rounded"></span>
            <span className="block h-[1.5px] bg-[#a1a1aa] rounded"></span>
          </button>
          <a href="#home" className="text-[20px] md:text-[22px] font-black tracking-tight no-underline text-[#fafafa]">FLUX<span className="text-[#e87028]">ODDS</span></a>
        </div>
        <div className="hidden md:flex items-center gap-7">
          {['#how','#features','#pricing','#faq','#contact'].map((h,i) => (
            <a key={h} href={h} className="text-[#a1a1aa] text-[13px] font-medium no-underline hover:text-[#fafafa] transition-colors">
              {['How it works','Features','Pricing','FAQ','Contact'][i]}
            </a>
          ))}
        </div>
        <div className="flex items-center gap-2">
          {user ? (
            <>
              <button onClick={launchDash} className="px-3 md:px-5 py-[8px] rounded-lg bg-[#e87028] text-black text-[12px] md:text-[13px] font-bold hover:bg-[#ff9a4d] transition-all border-none cursor-pointer">Dashboard →</button>
              <button onClick={handleSignout} className="hidden md:inline-flex px-4 py-[7px] rounded-lg border border-[#27272a] text-[#a1a1aa] text-[13px] font-medium hover:border-red-800 hover:text-red-400 transition-all bg-transparent cursor-pointer">Sign out</button>
            </>
          ) : (
            <>
              <button onClick={() => { setLoginTab('login'); setLoginOpen(true) }} className="hidden md:inline-flex px-4 py-[7px] rounded-lg border border-[#27272a] text-[#a1a1aa] text-[13px] font-medium hover:border-[#e87028] hover:text-[#e87028] transition-all bg-transparent cursor-pointer">Log in</button>
              <button onClick={launchDash} className="px-3 md:px-5 py-[8px] rounded-lg bg-[#e87028] text-black text-[12px] md:text-[13px] font-bold hover:bg-[#ff9a4d] transition-all border-none cursor-pointer">Launch App →</button>
            </>
          )}
        </div>
      </nav>

      <section id="home" className="min-h-screen flex flex-col items-center justify-center text-center px-5 md:px-12 pt-[90px] md:pt-[110px] pb-16 md:pb-20 relative overflow-hidden">
        <div className="absolute inset-0" style={{backgroundImage:'linear-gradient(rgba(232,112,40,.03) 1px,transparent 1px),linear-gradient(90deg,rgba(232,112,40,.03) 1px,transparent 1px)',backgroundSize:'58px 58px',maskImage:'radial-gradient(ellipse 80% 70% at 50% 50%,black 20%,transparent 100%)'}}></div>
        <div className="absolute bottom-0 left-0 right-0 h-[280px] pointer-events-none" style={{background:'radial-gradient(ellipse 80% 100% at 50% 100%, rgba(232,112,40,.18) 0%, rgba(214,82,24,.08) 40%, transparent 70%)'}}></div>
        <div className="relative z-10">
          <div className="inline-flex items-center gap-2 bg-orange-950/10 border border-orange-900/20 text-[#e87028] px-4 py-[5px] rounded-full text-[11px] font-semibold tracking-wider uppercase mb-7">
            <span className="w-[6px] h-[6px] rounded-full bg-emerald-400 animate-pulse inline-block"></span>Live · Prematch · +EV · Bonus
          </div>
          <h1 className="font-black leading-[.95] tracking-tight mb-2" style={{fontSize:'clamp(48px,7vw,100px)'}}>
            FIND THE <span className="text-[#e87028]">EDGE.</span><br/>
            <span className="text-[#3f3f46]">BEAT THE BOOKS.</span>
          </h1>
          <p className="text-[#a1a1aa] font-medium max-w-[500px] mx-auto mt-5 mb-11 leading-relaxed" style={{fontSize:'clamp(15px,1.6vw,18px)'}}>
            Live arbs during in-game action, prematch arbs for upcoming games, +EV bets against Pinnacle de-vigged sharp lines, and a bonus bet converter — all in one dashboard.
          </p>
          <div className="flex flex-col sm:flex-row items-center gap-3 justify-center">
            <button onClick={launchDash} className="w-full sm:w-auto px-9 py-4 rounded-xl bg-[#e87028] text-black text-[15px] font-black hover:bg-[#ff9a4d] transition-all hover:-translate-y-[2px] border-none cursor-pointer">Launch FluxOdds →</button>
            <a href="#how" className="w-full sm:w-auto px-9 py-4 rounded-xl border border-[#27272a] text-[#fafafa] text-[15px] font-semibold hover:border-[#e87028] hover:text-[#e87028] transition-all no-underline text-center">How it works</a>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6 md:gap-11 mt-12 md:mt-16 justify-center">
            {[['40+','Sportsbooks'],['+5.1%','Best live arb'],['<1s','Detection'],['24/7','Always on']].map(([n,l],i) => (
              <div key={i} className="text-center">
                <div className={`text-[28px] md:text-[36px] font-black leading-none ${n.includes('%') ? 'text-emerald-400' : 'text-[#fafafa]'}`}>{n}</div>
                <div className="text-[10px] md:text-[11px] text-[#a1a1aa] font-semibold tracking-wider uppercase mt-1">{l}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <div className="border-t border-b border-[#27272a] bg-[#0c0c0e] py-[9px] overflow-hidden">
        <div className="flex gap-11 whitespace-nowrap" style={{animation:'ticker 28s linear infinite',width:'max-content'}}>
          {[...TICKS,...TICKS].map((t,i) => (
            <span key={i} className="flex items-center gap-2 text-[12px] text-[#a1a1aa] font-medium">
              <span className="text-[#27272a]">◆</span>
              <span className="text-[#fafafa] font-semibold">{t.game}</span>
              <span>{t.sport}</span>
              <span className="text-emerald-400 font-bold">{t.profit}</span>
              <span>{t.books}</span>
            </span>
          ))}
        </div>
      </div>

      <section id="how" className="py-16 md:py-[90px] px-5 md:px-12 bg-[#0c0c0e] border-t border-b border-[#27272a]">
        <div className="text-[11px] font-semibold tracking-widest uppercase text-[#e87028] mb-3">How it works</div>
        <h2 className="font-black leading-none tracking-tight mb-4" style={{fontSize:'clamp(32px,4vw,56px)'}}>THREE STEPS.<br/>PURE PROFIT.</h2>
        <p className="text-[#a1a1aa] text-[17px] max-w-[500px] leading-relaxed font-medium">No spreadsheets. No manual odds checking. FluxOdds does the heavy lifting so you can focus on placing bets.</p>
        <div className="grid grid-cols-1 md:grid-cols-3 mt-14 border border-[#27272a] rounded-xl overflow-hidden" style={{gap:'2px'}}>
          {[
            {n:'01',t:'We scan the books',d:'40+ sportsbooks, every odd refreshed every second across every major sport — both upcoming AND in-play.'},
            {n:'02',t:'We find the edge',d:'Live arbs, prematch arbs, +EV against Pinnacle de-vigged lines, and optimal bonus bet conversions — all real-time.'},
            {n:'03',t:'You place the bets',d:'Place stakes at each book, lock in guaranteed profit, build long-term EV, or convert promos into cash.'},
          ].map((s,i) => (
            <div key={i} className="p-9 bg-[#09090b] hover:bg-[#0c0c0e] transition-colors group">
              <div className="text-[60px] font-black text-[#3f3f46] group-hover:text-[#e87028] leading-none mb-5 transition-colors">{s.n}</div>
              <h3 className="text-[18px] font-bold mb-3">{s.t}</h3>
              <p className="text-[#a1a1aa] text-[14px] leading-[1.7] font-medium">{s.d}</p>
            </div>
          ))}
        </div>
      </section>

      <section id="features" className="py-16 md:py-[90px] px-5 md:px-12 bg-[#09090b]">
        <div className="text-[11px] font-semibold tracking-widest uppercase text-[#e87028] mb-3">Features</div>
        <h2 className="font-black leading-none tracking-tight mb-4" style={{fontSize:'clamp(32px,4vw,56px)'}}>EVERYTHING YOU<br/>NEED TO WIN.</h2>
        <p className="text-[#a1a1aa] text-[17px] max-w-[500px] leading-relaxed font-medium">Built for beginners and pros. All in one dashboard.</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 mt-10 md:mt-14 border border-[#27272a] rounded-xl overflow-hidden" style={{gap:'1px',background:'#27272a'}}>
          {[
            {icon:'⚡',t:'Live arb finder',d:'In-progress games scanned every 5s. Surface arbs the moment they appear with current period/score context.'},
            {icon:'🗓',t:'Prematch arbs',d:'Pre-game arbs across 40+ books with profit %, exact stakes, and direct links.'},
            {icon:'📈',t:'+EV bet finder',d:'Pinnacle de-vigged sharp lines. Find positive expected value bets where the math is in your favor.'},
            {icon:'🎁',t:'Bonus bet converter',d:'Got a $100 bonus bet? Turn it into ~$70-80 of guaranteed real cash.'},
            {icon:'🔔',t:'Instant alerts',d:'Set a minimum profit/EV threshold and get notified the instant a bet hits.'},
            {icon:'📊',t:'P&L tracker',d:'Log every bet and track your running profit across books, sports, and time.'},
          ].map((f,i) => (
            <div key={i} className="bg-[#09090b] p-6 md:p-8 hover:bg-[#0c0c0e] transition-colors">
              <div className="w-[42px] h-[42px] rounded-xl bg-orange-950/10 border border-orange-900/15 flex items-center justify-center text-[18px] mb-5">{f.icon}</div>
              <h3 className="text-[17px] font-bold mb-2">{f.t}</h3>
              <p className="text-[#a1a1aa] text-[13px] leading-[1.7] font-medium">{f.d}</p>
            </div>
          ))}
        </div>
      </section>

      <section id="pricing" className="py-16 md:py-[90px] px-5 md:px-12 bg-[#09090b]">
        <div className="text-[11px] font-semibold tracking-widest uppercase text-[#e87028] mb-3">Pricing</div>
        <h2 className="font-black leading-none tracking-tight mb-4" style={{fontSize:'clamp(32px,4vw,56px)'}}>PAY FOR WHAT<br/>YOU WIN WITH.</h2>
        <p className="text-[#a1a1aa] text-[17px] max-w-[500px] leading-relaxed font-medium">Start free. Scale when you're profitable. No contracts, cancel anytime.</p>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5 mt-10 md:mt-14">
          {[
            {name:'Free',price:'0',desc:'Discover FluxOdds and start finding arbs at no cost.',btn:'Get started free',btnStyle:'border border-[#27272a] text-[#fafafa] hover:border-[#e87028] hover:text-[#e87028]',featured:false,
              feats:['Prematch arbs capped at 2%','+EV bets capped at 1.5%','Live arb access','All sports access','Basic bet calculator'],
              off:['No bonus bet converter','No instant alerts','No middles finder','No P&L tracker']},
            {name:'Pro',price:'75',desc:'Full access for serious arbers ready to build real profit.',btn:'Try Pro Free For 3 Days',btnStyle:'bg-[#e87028] text-black hover:bg-[#ff9a4d]',featured:true,badge:'Most popular',
              feats:['Unlimited prematch + live arbs','Unlimited +EV bets','Bonus bet converter','40+ sportsbooks','Instant alerts','Middles finder','Full P&L tracker','3 device limit','Cancel anytime'],off:[]},
            {name:'Pro Day Pass',price:'15',desc:'All Pro features for 24 hours. Perfect for occasional arbers.',btn:'Coming Soon',btnStyle:'border border-[#27272a] text-[#a1a1aa]',featured:false,badge:'Coming soon',
              feats:['All Pro features','24 hour access','One-time purchase','No subscription needed'],off:[]},
          ].map((p,i) => (
            <div key={i} className={`relative rounded-xl p-6 md:p-9 transition-all hover:-translate-y-[3px] ${p.featured?'border border-[#e87028] bg-[#0c0c0e]':'border border-[#27272a] bg-[#0c0c0e] hover:border-[#3f3f46]'}`}>
              {p.badge && <div className="absolute -top-[13px] left-1/2 -translate-x-1/2 bg-[#e87028] text-black px-4 py-[3px] rounded-full text-[10px] font-black tracking-wider uppercase whitespace-nowrap">{p.badge}</div>}
              <div className="text-[13px] font-semibold text-[#a1a1aa] tracking-wider uppercase mb-3">{p.name}</div>
              <div className="text-[58px] font-black leading-none mb-1"><sup className="text-[24px]">$</sup>{p.price}<span className="text-[16px] text-[#a1a1aa] font-medium">/mo</span></div>
              <p className="text-[#a1a1aa] text-[13px] mb-7 leading-relaxed font-medium">{p.desc}</p>
              <button onClick={() => { p.featured ? (user ? handleCheckout() : (setLoginTab('signup'), setLoginOpen(true))) : (setLoginTab('signup'), setLoginOpen(true)) }} className={`block w-full py-3 rounded-xl text-[13px] font-black mb-7 transition-all cursor-pointer border-none ${p.btnStyle}`}>{p.btn}</button>
              <ul className="flex flex-col gap-[10px]" style={{listStyle:'none'}}>
                {p.feats.map((f,j) => <li key={j} className="flex items-center gap-2 text-[13px] text-[#a1a1aa] font-medium"><span className="w-[15px] h-[15px] rounded-full bg-emerald-900/15 border border-emerald-800/25 flex items-center justify-center text-emerald-400 text-[9px] flex-shrink-0">✓</span>{f}</li>)}
                {p.off.map((f,j) => <li key={j} className="flex items-center gap-2 text-[13px] text-[#3f3f46] font-medium"><span className="w-[15px] h-[15px] rounded-full bg-[#121214] border border-[#27272a] flex items-center justify-center text-[#3f3f46] text-[9px] flex-shrink-0">✕</span>{f}</li>)}
              </ul>
            </div>
          ))}
        </div>
      </section>

      <section id="faq" className="py-16 md:py-[90px] px-5 md:px-12 bg-[#0c0c0e] border-t border-b border-[#27272a]">
        <div className="max-w-[720px] mx-auto">
          <div className="text-[11px] font-semibold tracking-widest uppercase text-[#e87028] mb-3">FAQ</div>
          <h2 className="font-black leading-none tracking-tight mb-14" style={{fontSize:'clamp(32px,4vw,56px)'}}>GOT QUESTIONS?</h2>
          <div className="flex flex-col gap-[2px]">
            {faqs.map((f,i) => (
              <div key={i} className="border border-[#27272a] rounded-xl overflow-hidden mb-[2px]">
                <button onClick={() => setFaqOpen(faqOpen===i?null:i)}
                  className="w-full bg-[#09090b] px-7 py-5 text-left text-[15px] font-semibold flex justify-between items-center hover:bg-[#0c0c0e] transition-colors border-none cursor-pointer text-[#fafafa]"
                  style={{fontFamily:"'Inter',sans-serif"}}>
                  {f.q}
                  <span className={`w-[22px] h-[22px] rounded-full bg-[#121214] border border-[#27272a] flex items-center justify-center text-[15px] text-[#e87028] flex-shrink-0 ml-4 transition-transform ${faqOpen===i?'rotate-45':''}`}>+</span>
                </button>
                {faqOpen===i && <div className="bg-[#09090b] px-7 pb-5 text-[14px] text-[#a1a1aa] leading-[1.75] font-medium">{f.a}</div>}
              </div>
            ))}
          </div>
        </div>
      </section>

      <div className="py-16 md:py-[90px] px-5 md:px-12 text-center bg-[#09090b] border-t border-[#27272a] relative overflow-hidden">
        <div className="absolute inset-0" style={{background:'radial-gradient(ellipse 55% 80% at 50% 50%,rgba(232,112,40,.06) 0%,transparent 70%)'}}></div>
        <div className="relative z-10">
          <div className="text-[11px] font-semibold tracking-widest uppercase text-[#e87028] mb-3">Ready?</div>
          <h2 className="font-black leading-none tracking-tight mb-4" style={{fontSize:'clamp(36px,6vw,80px)'}}>STOP GAMBLING.<br/><span className="text-[#e87028]">START WINNING.</span></h2>
          <p className="text-[#a1a1aa] text-[17px] max-w-[480px] mx-auto mb-10 leading-relaxed font-medium">Join thousands of bettors using FluxOdds to find guaranteed profit every day.</p>
          <div className="flex flex-col sm:flex-row items-center gap-3 justify-center">
            <button onClick={launchDash} className="w-full sm:w-auto px-9 py-4 rounded-xl bg-[#e87028] text-black text-[15px] font-black hover:bg-[#ff9a4d] transition-all hover:-translate-y-[2px] border-none cursor-pointer">Launch FluxOdds →</button>
            <a href="#pricing" className="w-full sm:w-auto px-9 py-4 rounded-xl border border-[#27272a] text-[#fafafa] text-[15px] font-semibold hover:border-[#e87028] hover:text-[#e87028] transition-all no-underline text-center">View pricing</a>
          </div>
        </div>
      </div>

      <section id="contact" className="py-16 md:py-[90px] px-5 md:px-12 bg-[#09090b]">
        <div className="text-center mb-14">
          <div className="text-[11px] font-semibold tracking-widest uppercase text-[#e87028] mb-3">Contact</div>
          <h2 className="font-black leading-none tracking-tight" style={{fontSize:'clamp(32px,4vw,56px)'}}>GET IN TOUCH.</h2>
        </div>
        <div className="max-w-[500px] mx-auto bg-[#0c0c0e] border border-[#27272a] rounded-xl p-6 md:p-11">
          {contactSent ? (
            <div className="text-center py-8">
              <div className="text-[32px] mb-3">✓</div>
              <div className="text-[18px] font-black mb-2">Message sent!</div>
              <div className="text-[#a1a1aa] font-medium">We'll get back to you soon.</div>
            </div>
          ) : (
            <>
              {[{l:'Name',t:'text',p:'Your name'},{l:'Email',t:'email',p:'you@example.com'}].map(f => (
                <div key={f.l} className="mb-4">
                  <label className="block text-[11px] font-semibold tracking-wider uppercase text-[#a1a1aa] mb-2">{f.l}</label>
                  <input type={f.t} placeholder={f.p} className="w-full bg-[#09090b] border border-[#27272a] rounded-lg text-[#fafafa] px-4 py-3 text-[14px] outline-none focus:border-[#e87028] transition-colors font-medium" style={{fontFamily:"'Inter',sans-serif"}}/>
                </div>
              ))}
              <div className="mb-5">
                <label className="block text-[11px] font-semibold tracking-wider uppercase text-[#a1a1aa] mb-2">Message</label>
                <textarea placeholder="What's on your mind?" rows={4} className="w-full bg-[#09090b] border border-[#27272a] rounded-lg text-[#fafafa] px-4 py-3 text-[14px] outline-none focus:border-[#e87028] transition-colors resize-none font-medium" style={{fontFamily:"'Inter',sans-serif"}}></textarea>
              </div>
              <button onClick={() => setContactSent(true)} className="w-full py-4 rounded-xl bg-[#e87028] text-black text-[14px] font-black hover:bg-[#ff9a4d] transition-all border-none cursor-pointer">Send message</button>
            </>
          )}
        </div>
      </section>

      <footer className="bg-[#0c0c0e] border-t border-[#27272a] px-5 md:px-12 py-8 md:py-10 flex flex-col md:flex-row items-center justify-between gap-5">
        <div className="text-[22px] font-black tracking-tight">FLUX<span className="text-[#e87028]">ODDS</span></div>
        <div className="flex flex-wrap justify-center gap-4 md:gap-6">
          {[['#how','How it works'],['#features','Features'],['#pricing','Pricing'],['#faq','FAQ'],['#contact','Contact']].map(([h,l]) => (
            <a key={h} href={h} className="text-[#a1a1aa] text-[13px] no-underline hover:text-[#fafafa] transition-colors font-medium">{l}</a>
          ))}
        </div>
        <div className="text-[#3f3f46] text-[13px] font-medium">© 2025 FluxOdds. All rights reserved.</div>
      </footer>

      {loginOpen && (
        <>
          <div className="fixed inset-0 z-[200] backdrop-blur-sm" style={{background:'rgba(0,0,0,0.8)'}} onClick={() => setLoginOpen(false)}></div>
          <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-[201] w-[400px] max-w-[90vw] bg-[#0c0c0e] border border-[#27272a] rounded-xl p-11" style={{fontFamily:"'Inter',sans-serif"}}>
            <button onClick={() => setLoginOpen(false)} className="absolute top-4 right-4 text-[#a1a1aa] text-[18px] hover:text-[#fafafa] bg-none border-none cursor-pointer">×</button>
            <div className="text-[28px] font-black tracking-tight mb-1">{loginTab === 'login' ? 'Welcome back.' : 'Get started.'}</div>
            <p className="text-[#a1a1aa] text-[13px] mb-6 font-medium">{loginTab === 'login' ? 'Log in to access your FluxOdds dashboard.' : 'Create your account to start finding arbs.'}</p>
            <div className="flex border border-[#27272a] rounded-lg overflow-hidden mb-6">
              {['login','signup'].map(t => (
                <button key={t} onClick={() => setLoginTab(t)}
                  className={`flex-1 py-[9px] text-[13px] font-bold border-none cursor-pointer transition-all ${loginTab===t?'bg-[#e87028] text-black':'bg-transparent text-[#a1a1aa]'}`}
                  style={{fontFamily:"'Inter',sans-serif"}}>
                  {t === 'login' ? 'Log in' : 'Sign up'}
                </button>
              ))}
            </div>
            <div className="mb-4">
              <label className="block text-[11px] font-semibold tracking-wider uppercase text-[#a1a1aa] mb-2">Email</label>
              <input type="email" placeholder="you@example.com" value={signupEmail} onChange={e => setSignupEmail(e.target.value)}
                className="w-full bg-[#09090b] border border-[#27272a] rounded-lg text-[#fafafa] px-4 py-3 text-[14px] outline-none focus:border-[#e87028] transition-colors font-medium" style={{fontFamily:"'Inter',sans-serif"}}/>
            </div>
            <div className="mb-4">
              <label className="block text-[11px] font-semibold tracking-wider uppercase text-[#a1a1aa] mb-2">Password</label>
              <input type="password" placeholder="••••••••" value={signupPassword} onChange={e => setSignupPassword(e.target.value)}
                className="w-full bg-[#09090b] border border-[#27272a] rounded-lg text-[#fafafa] px-4 py-3 text-[14px] outline-none focus:border-[#e87028] transition-colors font-medium" style={{fontFamily:"'Inter',sans-serif"}}/>
            </div>
            <button onClick={handleSignup} className="w-full mt-1 py-[14px] rounded-xl bg-[#e87028] text-black text-[14px] font-black hover:bg-[#ff9a4d] transition-all border-none cursor-pointer">
              {loginTab === 'login' ? 'Log in →' : 'Create account →'}
            </button>
            {loginTab === 'login' && <div className="text-center mt-3"><button onClick={handleForgotPassword} className="text-[12px] text-[#a1a1aa] hover:text-[#e87028] transition-colors bg-transparent border-none cursor-pointer font-medium" style={{fontFamily:"'Inter',sans-serif"}}>Forgot password?</button></div>}
          </div>
        </>
      )}

      <style>{`
        @keyframes ticker { from { transform: translateX(0) } to { transform: translateX(-50%) } }
      `}</style>
    </div>
  )
}