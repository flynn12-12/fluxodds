'use client'
import { useState, useEffect } from 'react'
import { supabase } from './supabase'
 
const DATA = [
  {sport:'soccer',game:'PSG vs Bayern',time:'Wed 3:00 PM ET',bA:'Unibet',oA:'+290',bB:'DraftKings',oB:'-335',profit:5.1,sA:54,sB:46,market:'Moneyline'},
  {sport:'soccer',game:'Man City vs Arsenal',time:'Tomorrow 3:00 PM ET',bA:'FanDuel',oA:'+320',bB:'Unibet',oB:'-375',profit:4.7,sA:54,sB:46,market:'Moneyline'},
  {sport:'soccer',game:'Liverpool vs Chelsea',time:'Sat 12:30 PM ET',bA:'BetRivers',oA:'+260',bB:'FanDuel',oB:'-310',profit:3.8,sA:55,sB:45,market:'Moneyline'},
  {sport:'nba',game:'Lakers vs Celtics',time:'Tomorrow 7:30 PM ET',bA:'DraftKings',oA:'+185',bB:'FanDuel',oB:'-198',profit:3.2,sA:52,sB:48,market:'Moneyline'},
  {sport:'nba',game:'Warriors vs Nuggets',time:'Tomorrow 9:00 PM ET',bA:'Caesars',oA:'+210',bB:'PointsBet',oB:'-238',profit:2.9,sA:53,sB:47,market:'Moneyline'},
  {sport:'tennis',game:'Djokovic vs Alcaraz',time:'Tomorrow 11:00 AM ET',bA:'Unibet',oA:'+175',bB:'BetMGM',oB:'-192',profit:2.4,sA:54,sB:46,market:'Match Winner'},
  {sport:'nba',game:'Bucks vs 76ers',time:'Sat 8:00 PM ET',bA:'PointsBet',oA:'+165',bB:'BetMGM',oB:'-180',profit:2.2,sA:55,sB:45,market:'Moneyline'},
  {sport:'nfl',game:'Chiefs vs Ravens',time:'Sun 4:25 PM ET',bA:'PointsBet',oA:'-108',bB:'BetRivers',oB:'-105',profit:2.1,sA:51,sB:49,market:'Spread -3.5'},
  {sport:'tennis',game:'Sinner vs Medvedev',time:'Sat 10:00 AM ET',bA:'BetMGM',oA:'+145',bB:'BetRivers',oB:'-158',profit:1.9,sA:61,sB:39,market:'Match Winner'},
  {sport:'mlb',game:'Yankees vs Red Sox',time:'Tomorrow 1:05 PM ET',bA:'BetMGM',oA:'+145',bB:'Caesars',oB:'-162',profit:1.8,sA:62,sB:38,market:'Moneyline'},
  {sport:'nfl',game:'Bills vs Dolphins',time:'Sun 1:00 PM ET',bA:'DraftKings',oA:'-112',bB:'Caesars',oB:'-106',profit:1.6,sA:51,sB:49,market:'Spread -2.5'},
  {sport:'mlb',game:'Dodgers vs Padres',time:'Tomorrow 10:10 PM ET',bA:'BetRivers',oA:'-118',bB:'FanDuel',oB:'-108',profit:1.4,sA:52,sB:48,market:'Runline'},
  {sport:'nhl',game:'Bruins vs Leafs',time:'Tomorrow 7:00 PM ET',bA:'BetMGM',oA:'+135',bB:'DraftKings',oB:'-148',profit:1.2,sA:60,sB:40,market:'Moneyline'},
  {sport:'nhl',game:'Rangers vs Penguins',time:'Tomorrow 7:30 PM ET',bA:'FanDuel',oA:'+120',bB:'Caesars',oB:'-130',profit:1.1,sA:57,sB:43,market:'Moneyline'},
].sort((a,b) => b.profit - a.profit)
 
const TICKS = [
  {game:'PSG vs Bayern',sport:'Soccer',profit:'+5.1%',books:'Unibet / DraftKings'},
  {game:'Man City vs Arsenal',sport:'Soccer',profit:'+4.7%',books:'FanDuel / Unibet'},
  {game:'Liverpool vs Chelsea',sport:'Soccer',profit:'+3.8%',books:'BetRivers / FanDuel'},
  {game:'Lakers vs Celtics',sport:'NBA',profit:'+3.2%',books:'DraftKings / FanDuel'},
  {game:'Warriors vs Nuggets',sport:'NBA',profit:'+2.9%',books:'Caesars / PointsBet'},
  {game:'Chiefs vs Ravens',sport:'NFL',profit:'+2.1%',books:'PointsBet / BetRivers'},
]
 
// Single neutral style for all sport tags
const SPORT_TAG = 'bg-[#1e1c16] text-[#7a8a96] border border-[#2a2820] text-[9px] font-semibold px-[6px] py-[1px] rounded'
 
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
  const [userPlan, setUserPlan] = useState('free')
  const [user, setUser] = useState(null)
 
 useEffect(() => {
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (session) {
        setUser(session.user)
        const { data: profile } = await supabase
          .from('profiles')
          .select('plan')
          .eq('user_id', session.user.id)
          .single()
        if (profile) setUserPlan(profile.plan)
          if (profile) setUserPlan(profile.plan)
console.log('profile:', profile)
console.log('userPlan:', profile?.plan)
      }
    })
    supabase.auth.onAuthStateChange(async (_event, session) => {
      setUser(session?.user || null)
      if (session?.user) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('plan')
          if (profile) setUserPlan(profile.plan)
console.log('profile:', profile)
console.log('userPlan:', profile?.plan)
          .eq('user_id', session.user.id)
          .single()
        if (profile) setUserPlan(profile.plan)
      } else {
        setUserPlan('free')
      }
    })
  }, [])
 
  useEffect(() => {
    const t = setInterval(() => setSecs(s => s + 1), 1000)
    return () => clearInterval(t)
  }, [])
 
  const scanTime = secs < 60 ? `${secs}s ago` : `${Math.floor(secs/60)}m ago`
 
  const filtered = DATA.filter(a => {
    if (sport !== 'all' && a.sport !== sport) return false
    if (a.profit < minP) return false
    if (query && !a.game.toLowerCase().includes(query) && !a.bA.toLowerCase().includes(query) && !a.bB.toLowerCase().includes(query)) return false
    return true
  })
 
  const openTool = (name) => {
    if (!user) { setLoginOpen(true); return }
    setToolName(name)
    setDashView('arb')
    setView('dashboard')
    setSidebarOpen(false)
  }
 
  const launchDash = () => {
    if (!user) { setLoginOpen(true); return }
    setView('dashboard')
    setDashView('home')
  }
 
  const handleSignup = async () => {
    if (!signupEmail || !signupPassword) { alert('Please enter email and password'); return }
    try {
      if (loginTab === 'signup') {
        const { error } = await supabase.auth.signUp({ email: signupEmail, password: signupPassword })
        if (error) throw error
        alert('Account created! Check your email to confirm.')
        setLoginOpen(false)
      } else {
        const { data, error } = await supabase.auth.signInWithPassword({ email: signupEmail, password: signupPassword })
        if (error) throw error
        setUser(data.user)
        setLoginOpen(false)
        setView('dashboard')
        setDashView('home')
      }
    } catch (e) {
      alert(e.message)
    }
  }
const handleForgotPassword = async () => {
    if (!signupEmail) { alert('Enter your email first then click Forgot password'); return }
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(signupEmail, {
        redirectTo: 'https://fluxodds.com/reset-password',
      })
      if (error) throw error
      alert('Password reset email sent! Check your inbox.')
      setLoginOpen(false)
    } catch (e) {
      alert(e.message)
    }
  }
  const handleCheckout = async () => {
    try {
      const res = await fetch('/api/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          priceId: 'price_1TSNXCHCUgRq1HVGov0nnMQc',
          email: user?.email || '',
        })
      })
      const { url } = await res.json()
      if (url) window.location.href = url
    } catch (e) {
      alert('Something went wrong. Please try again.')
    }
  }
  const handleSignout = async () => {
    await supabase.auth.signOut()
    setUser(null)
    setView('marketing')
  }
 
  const faqs = [
    {q:'Is arbitrage betting legal?', a:"Yes — arbitrage betting is completely legal. You're simply placing bets at different sportsbooks to guarantee profit from odds discrepancies. FluxOdds is a data and analysis tool only."},
    {q:'How is profit actually guaranteed?', a:"When sportsbooks disagree on odds, the math can create a situation where betting on every outcome still results in profit. FluxOdds finds these windows and calculates exact stakes."},
    {q:'How fast are the arbs detected?', a:'Our engine scans odds continuously. Most arbs appear within 1 second. Pro and Sharp subscribers get priority queue access — crucial since many arbs disappear within minutes.'},
    {q:'Do I need a lot of money to start?', a:'Not at all. You can start with as little as $50 across two books. Our calculator scales to any bankroll. Most users start small, verify the system, then scale up.'},
    {q:'Which sportsbooks do you cover?', a:'40+ sportsbooks including DraftKings, FanDuel, BetMGM, Caesars, PointsBet, BetRivers, Unibet, and many more. We continuously add new books.'},
    {q:'Can I cancel anytime?', a:'Absolutely. No contracts. Cancel from your dashboard with one click. You keep access until the end of your billing period.'},
  ]
 
  const tools = [
    {id:'live', icon:'⚡', name:'Live Arbitrage', desc:'Real-time arbs as they appear', badge:'LIVE'},
    {id:'prematch', icon:'🗓', name:'Prematch Arbitrage', desc:'Plan ahead, less time pressure'},
    {id:'ev', icon:'📈', name:'Positive EV Bets', desc:'Long-term mathematical edge', badge:'HOT'},
    {id:'middles', icon:'🎯', name:'Middles Finder', desc:'Win both sides on line moves'},
    {id:'freebets', icon:'🎁', name:'Free Bet Converter', desc:'Turn promos into real cash', badge:'PRO'},
    {id:'calculator', icon:'🧮', name:'Bet Calculator', desc:'Perfect stakes, any bankroll'},
  ]
 
  const net = ((bankroll * (selectedArb?.profit || 0)) / 100).toFixed(2)
  const payout = (parseFloat(bankroll) + parseFloat(net)).toFixed(2)
  const stakeA = selectedArb ? ((bankroll * selectedArb.sA) / 100).toFixed(2) : 0
  const stakeB = selectedArb ? ((bankroll * selectedArb.sB) / 100).toFixed(2) : 0
 
  // ─── DASHBOARD ───────────────────────────────────────────────────────────────
  if (view === 'dashboard') return (
    <div style={{fontFamily:"'Inter',sans-serif"}} className="flex flex-col h-screen bg-[#080806] text-[#eef1f5] overflow-hidden">
      {/* Topbar */}
      <div className="h-[52px] flex-shrink-0 flex items-center justify-between px-5 bg-[#0f0e0b] border-b border-[#1e1c16]">
        <div className="flex items-center gap-3">
          <button onClick={() => setSidebarOpen(!sidebarOpen)} className="flex flex-col gap-[5px] justify-center w-8 h-8 border-none cursor-pointer p-1 rounded-md hover:bg-[#1a1812] bg-transparent">
            <span className="block h-[1.5px] bg-[#5a6a78] rounded"></span>
            <span className="block h-[1.5px] bg-[#5a6a78] rounded"></span>
            <span className="block h-[1.5px] bg-[#5a6a78] rounded"></span>
          </button>
          <span onClick={() => setDashView('home')} className="text-xl font-black tracking-tight cursor-pointer">FLUX<span className="text-[#ff6b1a]">ODDS</span></span>
          <span className="flex items-center gap-1 bg-emerald-900/10 border border-emerald-800/20 text-emerald-400 px-3 py-[3px] rounded-full text-[11px] font-semibold">
            <span className="w-[6px] h-[6px] rounded-full bg-emerald-400 animate-pulse inline-block"></span>LIVE
          </span>
        </div>
        <div className="flex items-center gap-5">
          <div className="text-right">
            <div className="text-[15px] font-bold text-emerald-400">{filtered.length}</div>
            <div className="text-[10px] text-[#5a6a78] uppercase tracking-wider font-medium">Arbs today</div>
          </div>
          <div className="w-px h-7 bg-[#1e1c16]"></div>
          <div className="text-right">
            <div className="text-[15px] font-bold text-[#ff6b1a]">+{DATA[0].profit}%</div>
            <div className="text-[10px] text-[#5a6a78] uppercase tracking-wider font-medium">Best profit</div>
          </div>
          <div className="w-px h-7 bg-[#1e1c16]"></div>
          <button onClick={() => setView('marketing')} className="border border-[#1e1c16] text-[#5a6a78] px-3 py-[5px] rounded-md text-[12px] font-medium hover:text-[#eef1f5] hover:border-[#2a2820] transition-all bg-transparent cursor-pointer">← Back to site</button>
          <button onClick={handleSignout} className="border border-[#1e1c16] text-[#5a6a78] px-3 py-[5px] rounded-md text-[12px] font-medium hover:text-red-400 hover:border-red-900 transition-all bg-transparent cursor-pointer">Sign out</button>
          <div className="w-7 h-7 rounded-full bg-[#ff6b1a] flex items-center justify-center text-[11px] font-black text-black cursor-pointer">{user?.email?.[0]?.toUpperCase()||'U'}</div>
        </div>
      </div>
 
      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar */}
        {sidebarOpen && (
          <div className="w-[240px] min-w-[240px] bg-[#0f0e0b] border-r border-[#1e1c16] flex flex-col overflow-y-auto flex-shrink-0">
            <div className="px-3 pt-5 pb-2">
              <div className="text-[10px] font-semibold tracking-widest uppercase text-[#5a6a78] px-2 mb-2">Arb Tools</div>
              {[
                {name:'Live Arbitrage',icon:'⚡',badge:'LIVE'},
                {name:'Prematch Arbitrage',icon:'🗓'},
                {name:'Positive EV Bets',icon:'📈',badge:'HOT'},
                {name:'Middles Finder',icon:'🎯'},
                {name:'Free Bet Converter',icon:'🎁',badge:'PRO'},
              ].map(t => (
                <button key={t.name} onClick={() => openTool(t.name)}
                  className={`flex items-center gap-3 w-full px-2 py-[9px] rounded-lg text-[13px] font-medium transition-all mb-[2px] cursor-pointer ${toolName===t.name&&dashView==='arb'?'bg-orange-900/10 border border-orange-800/20 text-[#ff6b1a]':'text-[#5a6a78] hover:bg-[#1a1812] hover:text-[#eef1f5] border border-transparent'}`}
                  style={{background:'none',fontFamily:"'Inter',sans-serif"}}>
                  <span className="w-[30px] h-[30px] rounded-lg flex items-center justify-center text-sm bg-[#1a1812] border border-[#2a2820]">{t.icon}</span>
                  <span className="flex-1 text-left">{t.name}</span>
                  {t.badge && <span className="text-[9px] font-semibold px-[6px] py-[2px] rounded-full border border-[#2a2820] text-[#5a6a78]">{t.badge}</span>}
                </button>
              ))}
            </div>
            <div className="h-px bg-[#1e1c16] mx-3 my-1"></div>
            <div className="px-3 pt-3 pb-2">
              <div className="text-[10px] font-semibold tracking-widest uppercase text-[#5a6a78] px-2 mb-2">Tools</div>
              {[{icon:'🧮',name:'Bet Calculator'},{icon:'📊',name:'P&L Tracker'},{icon:'🔔',name:'Alerts & Notifications'}].map(t => (
                <button key={t.name} onClick={() => openTool(t.name)}
                  className="flex items-center gap-3 w-full px-2 py-[9px] rounded-lg text-[13px] font-medium text-[#5a6a78] hover:bg-[#1a1812] hover:text-[#eef1f5] transition-all mb-[2px] border border-transparent cursor-pointer"
                  style={{background:'none',fontFamily:"'Inter',sans-serif"}}>
                  <span className="w-[30px] h-[30px] rounded-lg flex items-center justify-center text-sm bg-[#1a1812] border border-[#2a2820]">{t.icon}</span>
                  <span>{t.name}</span>
                </button>
              ))}
            </div>
            <div className="mt-auto p-3 border-t border-[#1e1c16]">
              <div className="bg-orange-900/5 border border-orange-800/15 rounded-xl p-3">
                <div className="text-[13px] font-bold text-[#ff6b1a]">Upgrade to Pro</div>
                <div className="text-[11px] text-[#5a6a78] mt-1">Unlimited arbs, all sports & alerts</div>
                <span className="block mt-2 py-2 rounded-lg bg-[#ff6b1a] text-black text-[11px] font-black text-center">Get Pro — $49/mo</span>
              </div>
            </div>
          </div>
        )}
 
        {/* Main */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {dashView === 'home' ? (
            <div className="flex-1 flex flex-col items-center justify-center text-center px-6 relative overflow-hidden">
              <div className="absolute inset-0 opacity-20" style={{backgroundImage:'linear-gradient(rgba(255,107,26,.04) 1px,transparent 1px),linear-gradient(90deg,rgba(255,107,26,.04) 1px,transparent 1px)',backgroundSize:'52px 52px'}}></div>
              <div className="absolute bottom-0 left-0 right-0 h-[200px] pointer-events-none" style={{background:'radial-gradient(ellipse 80% 100% at 50% 100%, rgba(255,107,26,.15) 0%, rgba(255,80,0,.06) 40%, transparent 70%)'}}></div>
              <div className="relative z-10 max-w-[560px]">
                <div className="inline-flex items-center gap-2 bg-orange-900/10 border border-orange-800/20 text-[#ff6b1a] px-4 py-[5px] rounded-full text-[11px] font-semibold tracking-wider uppercase mb-6">
                  <span className="w-[6px] h-[6px] rounded-full bg-emerald-400 animate-pulse inline-block"></span>Scanning 40+ books live
                </div>
                <h2 className="text-[clamp(40px,6vw,80px)] font-black leading-[.95] tracking-tight mb-4">
                  FIND THE <span className="text-[#ff6b1a]">EDGE.</span><br/>
                  <span className="text-[#2a2820]">BEAT THE BOOKS.</span>
                </h2>
                <p className="text-[14px] text-[#5a6a78] max-w-[380px] mx-auto mb-8 leading-relaxed font-medium">Real-time arbitrage detection across every major sportsbook. Guaranteed profit, zero guesswork.</p>
                <div className="grid grid-cols-3 gap-2 max-w-[540px] mx-auto mb-7">
                  {tools.map(t => (
                    <div key={t.id} onClick={() => openTool(t.name)}
                      className={`bg-[#0f0e0b] border rounded-xl p-3 cursor-pointer text-left transition-all hover:-translate-y-[2px] relative overflow-hidden ${t.id==='live'?'border-orange-800/25 bg-orange-900/5':'border-[#1e1c16] hover:border-[#2a2820] hover:bg-[#1a1812]'}`}>
                      <div className="text-[18px] mb-2">{t.icon}</div>
                      <div className="text-[12px] font-bold text-[#eef1f5] mb-[3px]">{t.name}</div>
                      <div className="text-[11px] text-[#5a6a78] leading-snug font-medium">{t.desc}</div>
                      {t.badge && <span className="absolute top-2 right-2 text-[8px] font-semibold px-[5px] py-[2px] rounded-full bg-[#1e1c16] border border-[#2a2820] text-[#5a6a78]">{t.badge}</span>}
                    </div>
                  ))}
                </div>
                <button onClick={() => openTool('Prematch Arbitrage')} className="inline-flex items-center gap-2 px-8 py-3 rounded-xl bg-[#ff6b1a] text-black text-[14px] font-black hover:bg-[#ff8c42] transition-all hover:-translate-y-[2px] cursor-pointer border-none">
                  View Top Arbs <span className="text-[16px]">→</span>
                </button>
              </div>
              <div className="absolute bottom-0 left-0 right-0 h-[25px] flex items-center gap-4 px-5 bg-[#0f0e0b] border-t border-[#1e1c16] text-[11px] text-[#5a6a78] font-medium z-10">
                <span><span className="inline-block w-[5px] h-[5px] rounded-full bg-emerald-400 mr-1 animate-pulse"></span>Connected · 40 books</span>
                <span className="text-[#1e1c16]">|</span>
                <span>Last scan: {scanTime}</span>
                <span className="ml-auto">FluxOdds v1.0</span>
              </div>
            </div>
          ) : (
            <div className="flex flex-col flex-1 overflow-hidden">
              {/* Tool bar */}
              <div className="px-5 pt-3 pb-3 bg-[#0f0e0b] border-b border-[#1e1c16] flex-shrink-0">
                <div className="flex items-center justify-between mb-3">
                  <div className="text-[22px] font-black tracking-tight">{toolName}</div>
                  <div className="flex items-center gap-3">
                    <span className="text-[12px] text-[#5a6a78] font-medium">{filtered.length} opportunities</span>
                    <button onClick={() => setDashView('home')} className="border border-[#1e1c16] text-[#5a6a78] px-3 py-1 rounded-md text-[12px] font-medium hover:text-[#eef1f5] transition-all bg-transparent cursor-pointer">← Home</button>
                  </div>
                </div>
                <div className="flex items-center gap-[5px] flex-wrap">
                  {['all','nba','nfl','mlb','nhl','soccer','tennis'].map(s => (
                    <button key={s} onClick={() => setSport(s)}
                      className={`px-[10px] py-[5px] rounded-md text-[12px] font-medium transition-all cursor-pointer border ${sport===s?'bg-orange-900/10 border-orange-800/25 text-[#ff6b1a]':'bg-[#1a1812] border-[#1e1c16] text-[#5a6a78] hover:text-[#eef1f5]'}`}
                      style={{fontFamily:"'Inter',sans-serif"}}>
                      {s === 'all' ? 'All Sports' : s.toUpperCase()}
                    </button>
                  ))}
                  <div className="w-px h-4 bg-[#1e1c16] mx-1"></div>
                  {[0,1,2,3].map(m => (
                    <button key={m} onClick={() => setMinP(m)}
                      className={`px-[10px] py-[5px] rounded-md text-[12px] font-medium transition-all cursor-pointer border ${minP===m?'bg-orange-900/10 border-orange-800/25 text-[#ff6b1a]':'bg-[#1a1812] border-[#1e1c16] text-[#5a6a78] hover:text-[#eef1f5]'}`}
                      style={{fontFamily:"'Inter',sans-serif"}}>
                      {m === 0 ? 'Any %' : `${m}%+`}
                    </button>
                  ))}
                  <div className="ml-auto flex items-center gap-2 bg-[#1a1812] border border-[#1e1c16] rounded-md px-3 py-[5px]">
                    <span className="text-[#5a6a78] text-[12px]">⌕</span>
                    <input type="text" placeholder="Search..." onChange={e => setQuery(e.target.value.toLowerCase())}
                      className="bg-transparent border-none text-[12px] text-[#eef1f5] outline-none w-[110px] font-medium"
                      style={{fontFamily:"'Inter',sans-serif"}}/>
                  </div>
                </div>
              </div>
 
              {/* Table */}
              <div className="flex-1 overflow-y-auto">
                <div className="grid text-[11px] font-semibold uppercase text-[#5a6a78] px-5 py-[7px] border-b border-[#1e1c16] bg-[#0f0e0b] sticky top-0 z-10 tracking-wide" style={{gridTemplateColumns:'2fr 1fr 1fr 90px 100px'}}>
                  <span>Game</span><span>Book A</span><span>Book B</span><span>Profit</span><span>Stakes ($100)</span>
                </div>
                {filtered.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-64 text-[#5a6a78]">
                    <div className="text-3xl opacity-30 mb-3">◎</div>
                    <div className="text-[15px] font-bold text-[#eef1f5]">No arbs match your filters</div>
                  </div>
                ) : filtered.map((a, i) => (
                  <div key={i} onClick={() => userPlan !== 'free' || a.profit <= 2 ? setSelectedArb(a) : null}
                    className={`grid px-5 py-[12px] border-b border-[#1e1c16] items-center transition-colors ${userPlan === 'free' && a.profit > 2 ? 'relative cursor-default select-none' : 'cursor-pointer hover:bg-[#0f0e0b]'}`}
                    style={{gridTemplateColumns:'2fr 1fr 1fr 90px 100px'}}>
                    <div>
                      <div className="text-[13px] font-semibold mb-[4px]">{a.game}</div>
                      <div className="flex items-center gap-[6px]">
                        <span className={SPORT_TAG}>{a.sport.toUpperCase()}</span>
                        <span className="text-[11px] text-[#5a6a78] font-medium">{a.time}</span>
                      </div>
                    </div>
                    <div>
                      <div className="text-[13px] font-semibold mb-[2px]">{a.bA}</div>
                      <div className="text-[12px] text-[#7a8a96] font-medium">{a.oA}</div>
                    </div>
                    <div>
                      <div className="text-[13px] font-semibold mb-[2px]">{a.bB}</div>
                      <div className="text-[12px] text-[#7a8a96] font-medium">{a.oB}</div>
                    </div>
                    <div className="text-[18px] font-black text-[#ff6b1a]">+{a.profit}%</div>
                    <div className="text-[12px] text-[#7a8a96] font-medium">${a.sA} / ${a.sB}</div>
                    {userPlan === 'free' && a.profit > 2 && <div className="absolute inset-0 backdrop-blur-sm bg-[#080806]/60 flex items-center justify-center"><span className="text-[12px] font-bold text-[#ff6b1a] bg-[#0f0e0b] border border-[#ff6b1a]/30 px-3 py-1 rounded-full">🔒 Pro only</span></div>}
                  </div>
                ))}
              </div>
 
              <div className="h-[26px] flex-shrink-0 flex items-center gap-4 px-5 bg-[#0f0e0b] border-t border-[#1e1c16] text-[11px] text-[#5a6a78] font-medium">
                <span><span className="inline-block w-[5px] h-[5px] rounded-full bg-emerald-400 mr-1 animate-pulse"></span>Connected · 40 books</span>
                <span className="text-[#1e1c16]">|</span>
                <span>Last scan: {scanTime}</span>
                <span className="ml-auto">{toolName} · Highest profit first</span>
              </div>
            </div>
          )}
        </div>
      </div>
 
      {/* Detail panel */}
      {selectedArb && (
        <>
          <div className="fixed inset-0 bg-black/50 z-40" onClick={() => setSelectedArb(null)}></div>
          <div className="fixed right-0 top-0 bottom-0 w-[330px] bg-[#0f0e0b] border-l border-[#1e1c16] z-50 flex flex-col" style={{fontFamily:"'Inter',sans-serif"}}>
            <div className="flex items-start justify-between p-4 border-b border-[#1e1c16]">
              <div>
                <div className="text-[14px] font-bold mb-1">{selectedArb.game}</div>
                <div className="text-[11px] text-[#5a6a78] font-medium">{selectedArb.sport.toUpperCase()} · {selectedArb.time} · {selectedArb.market}</div>
              </div>
              <button onClick={() => setSelectedArb(null)} className="text-[#5a6a78] text-lg hover:text-[#eef1f5] transition-colors bg-transparent border-none cursor-pointer">×</button>
            </div>
            <div className="flex-1 overflow-y-auto p-4">
              <div className="text-center p-5 bg-orange-900/5 border border-orange-800/10 rounded-xl mb-4">
                <div className="text-[48px] font-black text-[#ff6b1a] leading-none">+{selectedArb.profit}%</div>
                <div className="text-[10px] text-[#5a6a78] mt-1 uppercase tracking-wider font-medium">Guaranteed profit</div>
              </div>
              <div className="flex items-center gap-2 mb-4">
                <label className="text-[12px] text-[#5a6a78] font-medium whitespace-nowrap">Bankroll $</label>
                <input type="number" value={bankroll} onChange={e => setBankroll(parseFloat(e.target.value)||100)}
                  className="flex-1 bg-[#1a1812] border border-[#1e1c16] rounded-md text-[#eef1f5] px-2 py-[6px] text-[13px] font-medium outline-none focus:border-[#ff6b1a]"
                  style={{fontFamily:"'Inter',sans-serif"}}/>
              </div>
              <div className="text-[10px] font-semibold tracking-wider uppercase text-[#5a6a78] mb-2">Your bets</div>
              {[{name:selectedArb.bA,odds:selectedArb.oA,stake:stakeA},{name:selectedArb.bB,odds:selectedArb.oB,stake:stakeB}].map((b,i) => (
                <div key={i} className="flex items-center justify-between bg-[#1a1812] border border-[#1e1c16] rounded-xl px-3 py-[10px] mb-[5px]">
                  <div className="text-[13px] font-semibold">{b.name}</div>
                  <div className="text-right">
                    <div className="text-[12px] text-[#ff6b1a] font-semibold">{b.odds}</div>
                    <div className="text-[13px] text-emerald-400 mt-[2px] font-semibold">${b.stake}</div>
                  </div>
                </div>
              ))}
              <div className="bg-[#1a1812] border border-[#1e1c16] rounded-xl p-3 mt-3">
                {[['Total stake',`$${parseFloat(bankroll).toFixed(2)}`],['Payout',`$${payout}`],['Net profit',`+$${net}`]].map(([l,v],i) => (
                  <div key={i} className={`flex justify-between py-[5px] ${i<2?'border-b border-[#1e1c16]':''} ${i===2?'pt-2':''}`}>
                    <span className="text-[12px] text-[#5a6a78] font-medium">{l}</span>
                    <span className={`text-[12px] font-semibold ${i===2?'text-emerald-400':''}`}>{v}</span>
                  </div>
                ))}
              </div>
            </div>
            <div className="flex gap-2 p-4 border-t border-[#1e1c16]">
              <button className="flex-1 py-[10px] rounded-xl bg-[#ff6b1a] text-black text-[12px] font-black hover:bg-[#ff8c42] transition-colors border-none cursor-pointer">Place bets →</button>
              <button onClick={() => setSelectedArb(null)} className="flex-1 py-[10px] rounded-xl bg-[#1a1812] border border-[#1e1c16] text-[#5a6a78] text-[12px] font-medium hover:text-[#eef1f5] transition-colors cursor-pointer">Save</button>
            </div>
          </div>
        </>
      )}
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap');`}</style>
    </div>
  )
 
  // ─── MARKETING SITE ──────────────────────────────────────────────────────────
  return (
    <div style={{fontFamily:"'Inter',sans-serif"}} className="bg-[#080806] text-[#eef1f5] overflow-x-hidden">
      {/* Sidebar overlay */}
      {sidebarOpen && <div className="fixed inset-0 bg-black/60 z-[90] backdrop-blur-sm" onClick={() => setSidebarOpen(false)}></div>}
      <div className={`fixed top-0 left-0 bottom-0 w-[256px] bg-[#0f0e0b] border-r border-[#1e1c16] z-[91] flex flex-col overflow-y-auto transition-transform duration-300 ${sidebarOpen?'translate-x-0':'-translate-x-full'}`}>
        <div className="h-[60px] flex items-center justify-between px-4 border-b border-[#1e1c16]">
          <div className="text-xl font-black tracking-tight">FLUX<span className="text-[#ff6b1a]">ODDS</span></div>
          <button onClick={() => setSidebarOpen(false)} className="text-[#5a6a78] text-lg hover:text-[#eef1f5] bg-transparent border-none cursor-pointer">×</button>
        </div>
        <div className="p-3 pt-4">
          <div className="text-[10px] font-semibold tracking-widest uppercase text-[#5a6a78] px-2 mb-2">Arb Tools</div>
          {[
            {name:'Live Arbitrage',icon:'⚡',badge:'LIVE'},
            {name:'Prematch Arbitrage',icon:'🗓'},
            {name:'Positive EV Bets',icon:'📈',badge:'HOT'},
            {name:'Middles Finder',icon:'🎯'},
            {name:'Free Bet Converter',icon:'🎁',badge:'PRO'},
          ].map(t => (
            <button key={t.name} onClick={() => openTool(t.name)}
              className="flex items-center gap-3 w-full px-2 py-[9px] rounded-lg text-[13px] font-medium text-[#5a6a78] hover:bg-[#1a1812] hover:text-[#eef1f5] transition-all mb-[2px] border border-transparent cursor-pointer"
              style={{background:'none',fontFamily:"'Inter',sans-serif"}}>
              <span className="w-[30px] h-[30px] rounded-lg flex items-center justify-center text-sm bg-[#1a1812] border border-[#1e1c16]">{t.icon}</span>
              <span className="flex-1 text-left">{t.name}</span>
              {t.badge && <span className="text-[9px] font-semibold px-[6px] py-[2px] rounded-full border border-[#2a2820] text-[#5a6a78]">{t.badge}</span>}
            </button>
          ))}
          <div className="h-px bg-[#1e1c16] my-3"></div>
          <div className="text-[10px] font-semibold tracking-widest uppercase text-[#5a6a78] px-2 mb-2">Tools</div>
          {[{icon:'🧮',name:'Bet Calculator'},{icon:'📊',name:'P&L Tracker'},{icon:'🔔',name:'Alerts & Notifications'}].map(t => (
            <button key={t.name} onClick={() => openTool(t.name)}
              className="flex items-center gap-3 w-full px-2 py-[9px] rounded-lg text-[13px] font-medium text-[#5a6a78] hover:bg-[#1a1812] hover:text-[#eef1f5] transition-all mb-[2px] border border-transparent cursor-pointer"
              style={{background:'none',fontFamily:"'Inter',sans-serif"}}>
              <span className="w-[30px] h-[30px] rounded-lg flex items-center justify-center text-sm bg-[#1a1812] border border-[#1e1c16]">{t.icon}</span>
              <span>{t.name}</span>
            </button>
          ))}
        </div>
        <div className="mt-auto p-3 border-t border-[#1e1c16]">
          <div className="bg-orange-900/5 border border-orange-800/15 rounded-xl p-3 cursor-pointer hover:bg-orange-900/10 transition-colors">
            <div className="text-[13px] font-bold text-[#ff6b1a]">Upgrade to Pro</div>
            <div className="text-[11px] text-[#5a6a78] mt-1 font-medium">Unlimited arbs, all sports & alerts</div>
            <span className="block mt-2 py-2 rounded-lg bg-[#ff6b1a] text-black text-[11px] font-black text-center">Get Pro — $49/mo</span>
          </div>
        </div>
      </div>
 
      {/* Nav */}
      <nav className="fixed top-0 left-0 right-0 z-[100] flex items-center justify-between px-12 h-[60px] border-b border-[#1e1c16] backdrop-blur-md" style={{background:'rgba(8,8,6,0.92)'}}>
        <div className="flex items-center gap-3">
          <button onClick={() => setSidebarOpen(!sidebarOpen)} className="flex flex-col gap-[5px] justify-center w-8 h-8 bg-transparent border-none cursor-pointer p-1 rounded-md hover:bg-[#1a1812]">
            <span className="block h-[1.5px] bg-[#5a6a78] rounded"></span>
            <span className="block h-[1.5px] bg-[#5a6a78] rounded"></span>
            <span className="block h-[1.5px] bg-[#5a6a78] rounded"></span>
          </button>
          <a href="#home" className="text-[22px] font-black tracking-tight no-underline text-[#eef1f5]">FLUX<span className="text-[#ff6b1a]">ODDS</span></a>
        </div>
        <div className="hidden md:flex items-center gap-7">
          {['#how','#features','#pricing','#faq','#contact'].map((h,i) => (
            <a key={h} href={h} className="text-[#5a6a78] text-[13px] font-medium no-underline hover:text-[#eef1f5] transition-colors">
              {['How it works','Features','Pricing','FAQ','Contact'][i]}
            </a>
          ))}
        </div>
        <div className="flex items-center gap-2">
          {user ? (
            <>
              <button onClick={launchDash} className="px-5 py-[8px] rounded-lg bg-[#ff6b1a] text-black text-[13px] font-bold hover:bg-[#ff8c42] transition-all border-none cursor-pointer">Dashboard →</button>
              <button onClick={handleSignout} className="px-4 py-[7px] rounded-lg border border-[#1e1c16] text-[#5a6a78] text-[13px] font-medium hover:border-red-800 hover:text-red-400 transition-all bg-transparent cursor-pointer">Sign out</button>
            </>
          ) : (
            <>
              <button onClick={() => { setLoginTab('login'); setLoginOpen(true) }} className="px-4 py-[7px] rounded-lg border border-[#1e1c16] text-[#5a6a78] text-[13px] font-medium hover:border-[#ff6b1a] hover:text-[#ff6b1a] transition-all bg-transparent cursor-pointer">Log in</button>
              <button onClick={launchDash} className="px-5 py-[8px] rounded-lg bg-[#ff6b1a] text-black text-[13px] font-bold hover:bg-[#ff8c42] transition-all border-none cursor-pointer">Launch App →</button>
            </>
          )}
        </div>
      </nav>
 
      {/* Hero */}
      <section id="home" className="min-h-screen flex flex-col items-center justify-center text-center px-12 pt-[110px] pb-20 relative overflow-hidden">
        <div className="absolute inset-0" style={{backgroundImage:'linear-gradient(rgba(255,107,26,.03) 1px,transparent 1px),linear-gradient(90deg,rgba(255,107,26,.03) 1px,transparent 1px)',backgroundSize:'58px 58px',maskImage:'radial-gradient(ellipse 80% 70% at 50% 50%,black 20%,transparent 100%)'}}></div>
        <div className="absolute bottom-0 left-0 right-0 h-[280px] pointer-events-none" style={{background:'radial-gradient(ellipse 80% 100% at 50% 100%, rgba(255,107,26,.18) 0%, rgba(255,80,0,.08) 40%, transparent 70%)'}}></div>
        <div className="relative z-10">
          <div className="inline-flex items-center gap-2 bg-orange-900/10 border border-orange-800/20 text-[#ff6b1a] px-4 py-[5px] rounded-full text-[11px] font-semibold tracking-wider uppercase mb-7">
            <span className="w-[6px] h-[6px] rounded-full bg-emerald-400 animate-pulse inline-block"></span>Live arb detection — 40+ sportsbooks
          </div>
          <h1 className="font-black leading-[.95] tracking-tight mb-2" style={{fontSize:'clamp(48px,7vw,100px)'}}>
            FIND THE <span className="text-[#ff6b1a]">EDGE.</span><br/>
            <span className="text-[#2a2820]">BEAT THE BOOKS.</span>
          </h1>
          <p className="text-[#5a6a78] font-medium max-w-[500px] mx-auto mt-5 mb-11 leading-relaxed" style={{fontSize:'clamp(15px,1.6vw,18px)'}}>
            FluxOdds scans every major sportsbook in real time and surfaces arbitrage opportunities before they disappear. Guaranteed profit. Zero guesswork.
          </p>
          <div className="flex items-center gap-3 justify-center">
            <button onClick={launchDash} className="px-9 py-4 rounded-xl bg-[#ff6b1a] text-black text-[15px] font-black hover:bg-[#ff8c42] transition-all hover:-translate-y-[2px] border-none cursor-pointer">Launch FluxOdds →</button>
            <a href="#how" className="px-9 py-4 rounded-xl border border-[#1e1c16] text-[#eef1f5] text-[15px] font-semibold hover:border-[#ff6b1a] hover:text-[#ff6b1a] transition-all no-underline">How it works</a>
          </div>
          <div className="flex items-center gap-11 mt-16 justify-center">
            {[['40+','Sportsbooks'],['+5.1%','Best live arb'],['<1s','Detection'],['24/7','Always on']].map(([n,l],i) => (
              <div key={i} className="text-center">
                <div className="text-[36px] font-black text-[#ff6b1a] leading-none">{n}</div>
                <div className="text-[11px] text-[#5a6a78] font-semibold tracking-wider uppercase mt-1">{l}</div>
              </div>
            ))}
          </div>
        </div>
      </section>
 
      {/* Ticker */}
      <div className="border-t border-b border-[#1e1c16] bg-[#0f0e0b] py-[9px] overflow-hidden">
        <div className="flex gap-11 whitespace-nowrap" style={{animation:'ticker 28s linear infinite',width:'max-content'}}>
          {[...TICKS,...TICKS].map((t,i) => (
            <span key={i} className="flex items-center gap-2 text-[12px] text-[#5a6a78] font-medium">
              <span className="text-[#1e1c16]">◆</span>
              <span className="text-[#eef1f5] font-semibold">{t.game}</span>
              <span>{t.sport}</span>
              <span className="text-[#ff6b1a] font-bold">{t.profit}</span>
              <span>{t.books}</span>
            </span>
          ))}
        </div>
      </div>
 
      {/* How it works */}
      <section id="how" className="py-[90px] px-12 bg-[#0f0e0b] border-t border-b border-[#1e1c16]">
        <div className="text-[11px] font-semibold tracking-widest uppercase text-[#ff6b1a] mb-3">How it works</div>
        <h2 className="font-black leading-none tracking-tight mb-4" style={{fontSize:'clamp(32px,4vw,56px)'}}>THREE STEPS.<br/>PURE PROFIT.</h2>
        <p className="text-[#5a6a78] text-[17px] max-w-[500px] leading-relaxed font-medium">No spreadsheets. No manual odds checking. FluxOdds does the heavy lifting so you can focus on placing bets.</p>
        <div className="grid grid-cols-1 md:grid-cols-3 mt-14 border border-[#1e1c16] rounded-xl overflow-hidden" style={{gap:'2px'}}>
          {[
            {n:'01',t:'We scan the books',d:'FluxOdds monitors DraftKings, FanDuel, BetMGM, Caesars, and 40+ more — refreshing odds every second across all major sports.'},
            {n:'02',t:'We find the arb',d:'Our engine calculates implied probability across every outcome. When the math guarantees profit, we surface it instantly with exact bet amounts.'},
            {n:'03',t:'You place the bets',d:'Get alerted in real time via email or push. Place your stakes at each sportsbook and lock in guaranteed profit regardless of the outcome.'},
          ].map((s,i) => (
            <div key={i} className="p-9 bg-[#080806] hover:bg-[#0f0e0b] transition-colors group">
              <div className="text-[60px] font-black text-[#2a2820] group-hover:text-[#ff6b1a] leading-none mb-5 transition-colors">{s.n}</div>
              <h3 className="text-[18px] font-bold mb-3">{s.t}</h3>
              <p className="text-[#5a6a78] text-[14px] leading-[1.7] font-medium">{s.d}</p>
            </div>
          ))}
        </div>
      </section>
 
      {/* Features */}
      <section id="features" className="py-[90px] px-12 bg-[#080806]">
        <div className="text-[11px] font-semibold tracking-widest uppercase text-[#ff6b1a] mb-3">Features</div>
        <h2 className="font-black leading-none tracking-tight mb-4" style={{fontSize:'clamp(32px,4vw,56px)'}}>EVERYTHING YOU<br/>NEED TO WIN.</h2>
        <p className="text-[#5a6a78] text-[17px] max-w-[500px] leading-relaxed font-medium">Built for beginners who want to start and pros who need every edge. All in one dashboard.</p>
        <div className="grid grid-cols-1 md:grid-cols-3 mt-14 border border-[#1e1c16] rounded-xl overflow-hidden" style={{gap:'1px',background:'#1e1c16'}}>
          {[
            {icon:'⚡',t:'Live arb finder',d:'Real-time scanning across 40+ books. Arbs are surfaced the moment they appear — with profit %, exact stakes, and direct links to each book.'},
            {icon:'🔔',t:'Instant alerts',d:'Set a minimum profit threshold and get notified via email or push the instant an arb hits your criteria. Never miss a window again.'},
            {icon:'🧮',t:'Bet size calculator',d:'Enter your bankroll and FluxOdds tells you exactly how much to place on each side to guarantee the same profit no matter what.'},
            {icon:'📈',t:'+EV bet finder',d:'Beyond arbs — find positive expected value bets where the odds are in your favor long-term. The strategy the pros use daily.'},
            {icon:'🎯',t:'Middles finder',d:'Spot middle opportunities where line movement creates a chance to win both sides. Higher risk, massive upside when they hit.'},
            {icon:'📊',t:'P&L tracker',d:'Log every bet and track your running profit across books, sports, and time periods. Know your edge. Grow your bankroll.'},
          ].map((f,i) => (
            <div key={i} className="bg-[#080806] p-8 hover:bg-[#0f0e0b] transition-colors">
              <div className="w-[42px] h-[42px] rounded-xl bg-orange-900/10 border border-orange-800/15 flex items-center justify-center text-[18px] mb-5">{f.icon}</div>
              <h3 className="text-[17px] font-bold mb-2">{f.t}</h3>
              <p className="text-[#5a6a78] text-[13px] leading-[1.7] font-medium">{f.d}</p>
            </div>
          ))}
        </div>
      </section>
 
      {/* Live preview */}
      <section id="preview" className="py-[90px] px-12 bg-[#0f0e0b] border-t border-b border-[#1e1c16]">
        <div className="text-[11px] font-semibold tracking-widest uppercase text-[#ff6b1a] mb-3">Live preview</div>
        <h2 className="font-black leading-none tracking-tight mb-4" style={{fontSize:'clamp(32px,4vw,56px)'}}>THIS IS WHAT<br/>PROFIT LOOKS LIKE.</h2>
        <p className="text-[#5a6a78] text-[17px] max-w-[500px] leading-relaxed mb-14 font-medium">Sorted by highest profit first. Every arb, every book, every stake — laid out clearly so you can act fast.</p>
        <div className="border border-[#1e1c16] rounded-xl overflow-hidden bg-[#080806]">
          <div className="flex items-center gap-2 px-4 py-3 bg-[#1a1812] border-b border-[#1e1c16]">
            <div className="w-[10px] h-[10px] rounded-full bg-[#ff5f57]"></div>
            <div className="w-[10px] h-[10px] rounded-full bg-[#febc2e]"></div>
            <div className="w-[10px] h-[10px] rounded-full bg-[#28c840]"></div>
            <div className="flex-1 bg-[#080806] border border-[#1e1c16] rounded px-3 py-[3px] text-[11px] text-[#5a6a78] mx-2 font-medium">app.fluxodds.com/dashboard</div>
            <span className="w-[6px] h-[6px] rounded-full bg-emerald-400 animate-pulse ml-auto inline-block"></span>
            <span className="text-[11px] text-[#ff6b1a] ml-1 font-semibold">LIVE</span>
          </div>
          <div className="grid text-[11px] font-semibold uppercase text-[#3a4a56] px-5 py-2 border-b border-[#1e1c16] tracking-wide" style={{gridTemplateColumns:'2fr 1fr 1fr 90px 100px'}}>
            <span>Game</span><span>Book A</span><span>Book B</span><span>Profit</span><span>Stakes ($100)</span>
          </div>
          {DATA.slice(0,5).map((a,i) => (
            <div key={i} className="grid px-5 py-[12px] border-b border-[#1e1c16] items-center hover:bg-[#0f0e0b] transition-colors cursor-pointer last:border-none" style={{gridTemplateColumns:'2fr 1fr 1fr 90px 100px'}}>
              <div>
                <div className="font-semibold text-[13px] mb-[4px]">{a.game}</div>
                <div className="flex items-center gap-2">
                  <span className={SPORT_TAG}>{a.sport.toUpperCase()}</span>
                  <span className="text-[11px] text-[#5a6a78] font-medium">{a.time}</span>
                </div>
              </div>
              <div>
                <div className="text-[13px] font-semibold mb-[2px]">{a.bA}</div>
                <div className="text-[12px] text-[#7a8a96] font-medium">{a.oA}</div>
              </div>
              <div>
                <div className="text-[13px] font-semibold mb-[2px]">{a.bB}</div>
                <div className="text-[12px] text-[#7a8a96] font-medium">{a.oB}</div>
              </div>
              <div className="text-[18px] font-black text-[#ff6b1a]">+{a.profit}%</div>
              <div className="text-[12px] text-[#7a8a96] font-medium">${a.sA} / ${a.sB}</div>
            </div>
          ))}
        </div>
      </section>
 
      {/* Pricing */}
      <section id="pricing" className="py-[90px] px-12 bg-[#080806]">
        <div className="text-[11px] font-semibold tracking-widest uppercase text-[#ff6b1a] mb-3">Pricing</div>
        <h2 className="font-black leading-none tracking-tight mb-4" style={{fontSize:'clamp(32px,4vw,56px)'}}>PAY FOR WHAT<br/>YOU WIN WITH.</h2>
        <p className="text-[#5a6a78] text-[17px] max-w-[500px] leading-relaxed font-medium">Start free. Scale when you're profitable. No contracts, cancel anytime.</p>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5 mt-14">
          {[
          {name:'Free',price:'0',desc:'Discover FluxOdds and start finding arbs at no cost.',btn:'Get started free',btnStyle:'border border-[#1e1c16] text-[#eef1f5] hover:border-[#ff6b1a] hover:text-[#ff6b1a]',featured:false,
              feats:['Unlimited arbs capped at 2%','All sports access','10 sportsbooks scanned','Basic bet calculator','Priority support','Early feature access'],
              off:['No instant alerts','No +EV bets','No P&L tracker']},
            {name:'Pro',price:'75',desc:'Full access for serious arbers ready to build real profit.',btn:'Try Pro Free For 3 Days',btnStyle:'bg-[#ff6b1a] text-black hover:bg-[#ff8c42]',featured:true,badge:'Most popular',
              feats:['Unlimited arbs','All sports covered','40+ sportsbooks','Instant alerts','Full +EV bet finder','Middles finder','Full P&L tracker','3 device limit','Cancel anytime'],off:[]},
            {name:'Pro Day Pass',price:'15',desc:'All Pro features for 24 hours. Perfect for occasional arbers.',btn:'Coming Soon',btnStyle:'border border-[#1e1c16] text-[#5a6a78]',featured:false,badge:'Coming soon',
              feats:['All Pro features','24 hour access','One-time purchase','No subscription needed'],off:[]},  
          ].map((p,i) => (
            <div key={i} className={`relative rounded-xl p-9 transition-all hover:-translate-y-[3px] ${p.featured?'border border-[#ff6b1a] bg-[#0f0e0b]':'border border-[#1e1c16] bg-[#0f0e0b] hover:border-[#2a2820]'}`}>
              {p.badge && <div className="absolute -top-[13px] left-1/2 -translate-x-1/2 bg-[#ff6b1a] text-black px-4 py-[3px] rounded-full text-[10px] font-black tracking-wider uppercase whitespace-nowrap">{p.badge}</div>}
              <div className="text-[13px] font-semibold text-[#5a6a78] tracking-wider uppercase mb-3">{p.name}</div>
              <div className="text-[58px] font-black leading-none mb-1"><sup className="text-[24px]">$</sup>{p.price}<span className="text-[16px] text-[#5a6a78] font-medium">/mo</span></div>
              <p className="text-[#5a6a78] text-[13px] mb-7 leading-relaxed font-medium">{p.desc}</p>
              <button onClick={() => { p.featured ? (user ? handleCheckout() : (setLoginTab('signup'), setLoginOpen(true))) : (setLoginTab('signup'), setLoginOpen(true)) }} className={`block w-full py-3 rounded-xl text-[13px] font-black mb-7 transition-all cursor-pointer border-none ${p.btnStyle}`}>{p.btn}</button>
              <ul className="flex flex-col gap-[10px]" style={{listStyle:'none'}}>
                {p.feats.map((f,j) => <li key={j} className="flex items-center gap-2 text-[13px] text-[#5a6a78] font-medium"><span className="w-[15px] h-[15px] rounded-full bg-emerald-900/15 border border-emerald-800/25 flex items-center justify-center text-emerald-400 text-[9px] flex-shrink-0">✓</span>{f}</li>)}
                {p.off.map((f,j) => <li key={j} className="flex items-center gap-2 text-[13px] text-[#2a2820] font-medium"><span className="w-[15px] h-[15px] rounded-full bg-[#1a1812] border border-[#1e1c16] flex items-center justify-center text-[#2a2820] text-[9px] flex-shrink-0">✕</span>{f}</li>)}
              </ul>
            </div>
          ))}
        </div>
      </section>
 
      {/* FAQ */}
      <section id="faq" className="py-[90px] px-12 bg-[#0f0e0b] border-t border-b border-[#1e1c16]">
        <div className="max-w-[720px] mx-auto">
          <div className="text-[11px] font-semibold tracking-widest uppercase text-[#ff6b1a] mb-3">FAQ</div>
          <h2 className="font-black leading-none tracking-tight mb-14" style={{fontSize:'clamp(32px,4vw,56px)'}}>GOT QUESTIONS?</h2>
          <div className="flex flex-col gap-[2px]">
            {faqs.map((f,i) => (
              <div key={i} className="border border-[#1e1c16] rounded-xl overflow-hidden mb-[2px]">
                <button onClick={() => setFaqOpen(faqOpen===i?null:i)}
                  className="w-full bg-[#080806] px-7 py-5 text-left text-[15px] font-semibold flex justify-between items-center hover:bg-[#0f0e0b] transition-colors border-none cursor-pointer text-[#eef1f5]"
                  style={{fontFamily:"'Inter',sans-serif"}}>
                  {f.q}
                  <span className={`w-[22px] h-[22px] rounded-full bg-[#1a1812] border border-[#1e1c16] flex items-center justify-center text-[15px] text-[#ff6b1a] flex-shrink-0 ml-4 transition-transform ${faqOpen===i?'rotate-45':''}`}>+</span>
                </button>
                {faqOpen===i && <div className="bg-[#080806] px-7 pb-5 text-[14px] text-[#5a6a78] leading-[1.75] font-medium">{f.a}</div>}
              </div>
            ))}
          </div>
        </div>
      </section>
 
      {/* CTA */}
      <div className="py-[90px] px-12 text-center bg-[#080806] border-t border-[#1e1c16] relative overflow-hidden">
        <div className="absolute inset-0" style={{background:'radial-gradient(ellipse 55% 80% at 50% 50%,rgba(255,107,26,.06) 0%,transparent 70%)'}}></div>
        <div className="relative z-10">
          <div className="text-[11px] font-semibold tracking-widest uppercase text-[#ff6b1a] mb-3">Ready?</div>
          <h2 className="font-black leading-none tracking-tight mb-4" style={{fontSize:'clamp(36px,6vw,80px)'}}>STOP GAMBLING.<br/><span className="text-[#ff6b1a]">START WINNING.</span></h2>
          <p className="text-[#5a6a78] text-[17px] max-w-[480px] mx-auto mb-10 leading-relaxed font-medium">Join thousands of bettors already using FluxOdds to find guaranteed profit every single day.</p>
          <div className="flex items-center gap-3 justify-center">
            <button onClick={launchDash} className="px-9 py-4 rounded-xl bg-[#ff6b1a] text-black text-[15px] font-black hover:bg-[#ff8c42] transition-all hover:-translate-y-[2px] border-none cursor-pointer">Launch FluxOdds →</button>
            <a href="#pricing" className="px-9 py-4 rounded-xl border border-[#1e1c16] text-[#eef1f5] text-[15px] font-semibold hover:border-[#ff6b1a] hover:text-[#ff6b1a] transition-all no-underline">View pricing</a>
          </div>
        </div>
      </div>
 
      {/* Contact */}
      <section id="contact" className="py-[90px] px-12 bg-[#080806]">
        <div className="text-center mb-14">
          <div className="text-[11px] font-semibold tracking-widest uppercase text-[#ff6b1a] mb-3">Contact</div>
          <h2 className="font-black leading-none tracking-tight" style={{fontSize:'clamp(32px,4vw,56px)'}}>GET IN TOUCH.</h2>
        </div>
        <div className="max-w-[500px] mx-auto bg-[#0f0e0b] border border-[#1e1c16] rounded-xl p-11">
          {contactSent ? (
            <div className="text-center py-8">
              <div className="text-[32px] mb-3">✓</div>
              <div className="text-[18px] font-black mb-2">Message sent!</div>
              <div className="text-[#5a6a78] font-medium">We'll get back to you soon.</div>
            </div>
          ) : (
            <>
              {[{l:'Name',t:'text',p:'Your name'},{l:'Email',t:'email',p:'you@example.com'}].map(f => (
                <div key={f.l} className="mb-4">
                  <label className="block text-[11px] font-semibold tracking-wider uppercase text-[#5a6a78] mb-2">{f.l}</label>
                  <input type={f.t} placeholder={f.p} className="w-full bg-[#080806] border border-[#1e1c16] rounded-lg text-[#eef1f5] px-4 py-3 text-[14px] outline-none focus:border-[#ff6b1a] transition-colors font-medium" style={{fontFamily:"'Inter',sans-serif"}}/>
                </div>
              ))}
              <div className="mb-5">
                <label className="block text-[11px] font-semibold tracking-wider uppercase text-[#5a6a78] mb-2">Message</label>
                <textarea placeholder="What's on your mind?" rows={4} className="w-full bg-[#080806] border border-[#1e1c16] rounded-lg text-[#eef1f5] px-4 py-3 text-[14px] outline-none focus:border-[#ff6b1a] transition-colors resize-none font-medium" style={{fontFamily:"'Inter',sans-serif"}}></textarea>
              </div>
              <button onClick={() => setContactSent(true)} className="w-full py-4 rounded-xl bg-[#ff6b1a] text-black text-[14px] font-black hover:bg-[#ff8c42] transition-all border-none cursor-pointer">Send message</button>
            </>
          )}
        </div>
      </section>
 
      {/* Footer */}
      <footer className="bg-[#0f0e0b] border-t border-[#1e1c16] px-12 py-10 flex items-center justify-between flex-wrap gap-5">
        <div className="text-[22px] font-black tracking-tight">FLUX<span className="text-[#ff6b1a]">ODDS</span></div>
        <div className="flex gap-6">
          {[['#how','How it works'],['#features','Features'],['#pricing','Pricing'],['#faq','FAQ'],['#contact','Contact']].map(([h,l]) => (
            <a key={h} href={h} className="text-[#5a6a78] text-[13px] no-underline hover:text-[#eef1f5] transition-colors font-medium">{l}</a>
          ))}
        </div>
        <div className="text-[#2a2820] text-[13px] font-medium">© 2025 FluxOdds. All rights reserved.</div>
      </footer>
 
      {/* Login modal */}
      {loginOpen && (
        <>
          <div className="fixed inset-0 z-[200] backdrop-blur-sm" style={{background:'rgba(0,0,0,0.8)'}} onClick={() => setLoginOpen(false)}></div>
          <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-[201] w-[400px] max-w-[90vw] bg-[#0f0e0b] border border-[#1e1c16] rounded-xl p-11" style={{fontFamily:"'Inter',sans-serif"}}>
            <button onClick={() => setLoginOpen(false)} className="absolute top-4 right-4 text-[#5a6a78] text-[18px] hover:text-[#eef1f5] bg-none border-none cursor-pointer">×</button>
            <div className="text-[28px] font-black tracking-tight mb-1">{loginTab === 'login' ? 'Welcome back.' : 'Get started.'}</div>
            <p className="text-[#5a6a78] text-[13px] mb-6 font-medium">{loginTab === 'login' ? 'Log in to access your FluxOdds dashboard.' : 'Create your account to start finding arbs.'}</p>
            <div className="flex border border-[#1e1c16] rounded-lg overflow-hidden mb-6">
              {['login','signup'].map(t => (
                <button key={t} onClick={() => setLoginTab(t)}
                  className={`flex-1 py-[9px] text-[13px] font-bold border-none cursor-pointer transition-all ${loginTab===t?'bg-[#ff6b1a] text-black':'bg-transparent text-[#5a6a78]'}`}
                  style={{fontFamily:"'Inter',sans-serif"}}>
                  {t === 'login' ? 'Log in' : 'Sign up'}
                </button>
              ))}
            </div>
            <div className="mb-4">
              <label className="block text-[11px] font-semibold tracking-wider uppercase text-[#5a6a78] mb-2">Email</label>
              <input type="email" placeholder="you@example.com" value={signupEmail} onChange={e => setSignupEmail(e.target.value)}
                className="w-full bg-[#080806] border border-[#1e1c16] rounded-lg text-[#eef1f5] px-4 py-3 text-[14px] outline-none focus:border-[#ff6b1a] transition-colors font-medium" style={{fontFamily:"'Inter',sans-serif"}}/>
            </div>
            <div className="mb-4">
              <label className="block text-[11px] font-semibold tracking-wider uppercase text-[#5a6a78] mb-2">Password</label>
              <input type="password" placeholder="••••••••" value={signupPassword} onChange={e => setSignupPassword(e.target.value)}
                className="w-full bg-[#080806] border border-[#1e1c16] rounded-lg text-[#eef1f5] px-4 py-3 text-[14px] outline-none focus:border-[#ff6b1a] transition-colors font-medium" style={{fontFamily:"'Inter',sans-serif"}}/>
            </div>
            <button onClick={handleSignup} className="w-full mt-1 py-[14px] rounded-xl bg-[#ff6b1a] text-black text-[14px] font-black hover:bg-[#ff8c42] transition-all border-none cursor-pointer">
              {loginTab === 'login' ? 'Log in →' : 'Create account →'}
              
            </button>
            {loginTab === 'login' && <div className="text-center mt-3"><button onClick={handleForgotPassword} className="text-[12px] text-[#5a6a78] hover:text-[#ff6b1a] transition-colors bg-transparent border-none cursor-pointer font-medium" style={{fontFamily:"'Inter',sans-serif"}}>Forgot password?</button></div>}
          </div>
        </>
      )}
 
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap');
        @keyframes ticker { from { transform: translateX(0) } to { transform: translateX(-50%) } }
      `}</style>
    </div>
  )
}