'use client'
import { useState, useEffect } from 'react'
 
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
 
const SPORT_COLORS = {
  nba: 'bg-orange-900/20 text-orange-400 border border-orange-800/30',
  nfl: 'bg-green-900/20 text-green-400 border border-green-800/30',
  mlb: 'bg-sky-900/20 text-sky-400 border border-sky-800/30',
  soccer: 'bg-purple-900/20 text-purple-400 border border-purple-800/30',
  nhl: 'bg-yellow-900/20 text-yellow-400 border border-yellow-800/30',
  tennis: 'bg-emerald-900/20 text-emerald-400 border border-emerald-800/30',
}
 
export default function Home() {
  const [view, setView] = useState('marketing') // marketing | dashboard
  const [dashView, setDashView] = useState('home') // home | arb
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
    setToolName(name)
    setDashView('arb')
    setView('dashboard')
    setSidebarOpen(false)
  }
 
  const faqs = [
    {q:'Is arbitrage betting legal?', a:'Yes — arbitrage betting is completely legal. You\'re simply placing bets at different sportsbooks to guarantee a profit based on odds discrepancies. FluxOdds is a data and analysis tool only.'},
    {q:'How is profit actually guaranteed?', a:'When sportsbooks disagree on odds for the same event, the math creates a situation where betting on every outcome still results in profit. FluxOdds finds these windows and calculates exact stakes.'},
    {q:'How fast are the arbs detected?', a:'Our engine scans odds continuously. Most arbs are surfaced within 1 second of appearing. Pro and Sharp subscribers get priority queue access.'},
    {q:'Do I need a lot of money to start?', a:'Not at all. You can start with as little as $50 across two books. Our calculator scales to any bankroll size.'},
    {q:'Which sportsbooks do you cover?', a:'We cover 40+ sportsbooks including DraftKings, FanDuel, BetMGM, Caesars, PointsBet, BetRivers, Unibet, and many more.'},
    {q:'Can I cancel anytime?', a:'Absolutely. No contracts. Cancel from your dashboard with one click and you keep access until the end of your billing period.'},
  ]
 
  const tools = [
    {id:'live', icon:'⚡', name:'Live Arbitrage', desc:'Real-time arbs as they appear', badge:'LIVE', badgeStyle:'bg-emerald-900/20 text-emerald-400 border border-emerald-800/30'},
    {id:'prematch', icon:'🗓', name:'Prematch Arbitrage', desc:'Plan ahead, less time pressure', badge:null},
    {id:'ev', icon:'📈', name:'Positive EV Bets', desc:'Long-term mathematical edge', badge:'HOT', badgeStyle:'bg-yellow-900/20 text-yellow-400 border border-yellow-800/30'},
    {id:'middles', icon:'🎯', name:'Middles Finder', desc:'Win both sides on line moves', badge:null},
    {id:'freebets', icon:'🎁', name:'Free Bet Converter', desc:'Turn promos into real cash', badge:'PRO', badgeStyle:'bg-sky-900/20 text-sky-400 border border-sky-800/30'},
    {id:'calculator', icon:'🧮', name:'Bet Calculator', desc:'Perfect stakes, any bankroll', badge:null},
  ]
 
  const net = ((bankroll * (selectedArb?.profit || 0)) / 100).toFixed(2)
  const payout = (parseFloat(bankroll) + parseFloat(net)).toFixed(2)
  const stakeA = selectedArb ? ((bankroll * selectedArb.sA) / 100).toFixed(2) : 0
  const stakeB = selectedArb ? ((bankroll * selectedArb.sB) / 100).toFixed(2) : 0
 
  if (view === 'dashboard') return (
    <div className="flex flex-col h-screen bg-[#07090c] text-[#eef1f5] font-sans overflow-hidden">
      {/* Dash topbar */}
      <div className="h-[54px] flex-shrink-0 flex items-center justify-between px-5 bg-[#0e1318] border-b border-[#1a222c]">
        <div className="flex items-center gap-3">
          <button onClick={() => setSidebarOpen(!sidebarOpen)} className="flex flex-col gap-[5px] justify-center w-8 h-8 bg-none border-none cursor-pointer p-1 rounded-md hover:bg-[#141b23]">
            <span className="block h-[1.5px] bg-[#4e6070] rounded"></span>
            <span className="block h-[1.5px] bg-[#4e6070] rounded"></span>
            <span className="block h-[1.5px] bg-[#4e6070] rounded"></span>
          </button>
          <span onClick={() => setDashView('home')} className="font-['Bebas_Neue'] text-xl tracking-widest cursor-pointer">FLUX<span className="text-[#00c2ff]">ODDS</span></span>
          <span className="flex items-center gap-1 bg-emerald-900/10 border border-emerald-800/20 text-emerald-400 px-3 py-[3px] rounded-full text-[11px] font-bold tracking-widest">
            <span className="w-[6px] h-[6px] rounded-full bg-emerald-400 animate-pulse"></span>LIVE
          </span>
        </div>
        <div className="flex items-center gap-4">
          <div className="text-right">
            <div className="font-mono text-sm text-emerald-400">{filtered.length}</div>
            <div className="text-[10px] text-[#4e6070] uppercase tracking-wider">Arbs today</div>
          </div>
          <div className="w-px h-7 bg-[#222d3a]"></div>
          <div className="text-right">
            <div className="font-mono text-sm text-emerald-400">+{DATA[0].profit}%</div>
            <div className="text-[10px] text-[#4e6070] uppercase tracking-wider">Best profit</div>
          </div>
          <div className="w-px h-7 bg-[#222d3a]"></div>
          <button onClick={() => setView('marketing')} className="flex items-center gap-1 border border-[#222d3a] text-[#4e6070] px-3 py-[5px] rounded-md text-xs font-semibold hover:text-[#eef1f5] hover:border-[#2a3a4a] transition-all">← Back to site</button>
          <div className="w-7 h-7 rounded-full bg-[#00c2ff] flex items-center justify-center text-[10px] font-black text-black">JD</div>
        </div>
      </div>
 
      <div className="flex flex-1 overflow-hidden">
        {/* Dash sidebar */}
        {sidebarOpen && (
          <div className="w-[248px] min-w-[248px] bg-[#0e1318] border-r border-[#1a222c] flex flex-col overflow-y-auto flex-shrink-0">
            <div className="px-3 pt-5 pb-2">
              <div className="text-[10px] font-bold tracking-[.14em] uppercase text-[#4e6070] px-2 mb-2">Arb Tools</div>
              {[
                {id:'live',icon:'⚡',name:'Live Arbitrage',badge:'LIVE',bs:'text-emerald-400'},
                {id:'prematch',icon:'🗓',name:'Prematch Arbitrage'},
                {id:'ev',icon:'📈',name:'Positive EV Bets',badge:'HOT',bs:'text-yellow-400'},
                {id:'middles',icon:'🎯',name:'Middles Finder'},
                {id:'freebets',icon:'🎁',name:'Free Bet Converter',badge:'PRO',bs:'text-sky-400'},
              ].map(t => (
                <button key={t.id} onClick={() => openTool(t.name)}
                  className={`flex items-center gap-3 w-full px-2 py-[9px] rounded-lg text-[13px] font-semibold transition-all mb-[2px] ${toolName===t.name&&dashView==='arb'?'bg-sky-900/10 border border-sky-800/20 text-[#00c2ff]':'text-[#4e6070] hover:bg-[#141b23] hover:text-[#eef1f5] border border-transparent'}`}>
                  <span className="w-[30px] h-[30px] rounded-lg flex items-center justify-center text-sm bg-[#141b23] border border-[#222d3a]">{t.icon}</span>
                  <span className="flex-1 text-left">{t.name}</span>
                  {t.badge && <span className={`text-[9px] font-bold px-[6px] py-[2px] rounded-full border ${t.bs} border-current/20 bg-current/5`}>{t.badge}</span>}
                </button>
              ))}
            </div>
            <div className="h-px bg-[#1a222c] mx-3 my-1"></div>
            <div className="px-3 pt-3 pb-2">
              <div className="text-[10px] font-bold tracking-[.14em] uppercase text-[#4e6070] px-2 mb-2">Tools</div>
              {[{icon:'🧮',name:'Bet Calculator'},{icon:'📊',name:'P&L Tracker'},{icon:'🔔',name:'Alerts & Notifications'}].map(t => (
                <button key={t.name} onClick={() => openTool(t.name)}
                  className="flex items-center gap-3 w-full px-2 py-[9px] rounded-lg text-[13px] font-semibold text-[#4e6070] hover:bg-[#141b23] hover:text-[#eef1f5] transition-all mb-[2px] border border-transparent">
                  <span className="w-[30px] h-[30px] rounded-lg flex items-center justify-center text-sm bg-[#141b23] border border-[#222d3a]">{t.icon}</span>
                  <span>{t.name}</span>
                </button>
              ))}
            </div>
            <div className="mt-auto p-3 border-t border-[#1a222c]">
              <div className="bg-sky-900/5 border border-sky-800/15 rounded-xl p-3">
                <div className="text-[13px] font-bold text-[#00c2ff]">Upgrade to Pro</div>
                <div className="text-[11px] text-[#4e6070] mt-1">Unlimited arbs, all sports & alerts</div>
                <span className="block mt-2 py-2 rounded-lg bg-[#00c2ff] text-black text-[11px] font-black text-center">Get Pro — $49/mo</span>
              </div>
            </div>
          </div>
        )}
 
        {/* Main content */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {dashView === 'home' ? (
            <div className="flex-1 flex flex-col items-center justify-center text-center px-6 relative overflow-hidden">
              <div className="absolute inset-0 opacity-20" style={{backgroundImage:'linear-gradient(rgba(0,194,255,.04) 1px,transparent 1px),linear-gradient(90deg,rgba(0,194,255,.04) 1px,transparent 1px)',backgroundSize:'52px 52px'}}></div>
              <div className="relative z-10 max-w-[560px]">
                <div className="inline-flex items-center gap-2 bg-sky-900/10 border border-sky-800/20 text-[#00c2ff] px-4 py-[5px] rounded-full text-[10px] font-bold tracking-[.12em] uppercase mb-6">
                  <span className="w-[6px] h-[6px] rounded-full bg-emerald-400 animate-pulse"></span>Scanning 40+ books live
                </div>
                <h2 className="font-['Bebas_Neue'] text-[clamp(48px,7vw,84px)] leading-[.94] tracking-widest mb-4">
                  FIND THE <span className="text-[#00c2ff]">EDGE.</span><br/>
                  <span className="text-[#1a222c]">BEAT THE BOOKS.</span>
                </h2>
                <p className="text-[14px] text-[#4e6070] max-w-[380px] mx-auto mb-8 leading-relaxed">Real-time arbitrage detection across every major sportsbook. Guaranteed profit, zero guesswork.</p>
                <div className="grid grid-cols-3 gap-2 max-w-[540px] mx-auto mb-7">
                  {tools.map(t => (
                    <div key={t.id} onClick={() => openTool(t.name)}
                      className={`bg-[#0e1318] border rounded-xl p-3 cursor-pointer text-left transition-all hover:-translate-y-[2px] relative overflow-hidden ${t.id==='live'?'border-sky-800/25 bg-sky-900/5':'border-[#222d3a] hover:border-[#2a3a4a] hover:bg-[#141b23]'}`}>
                      <div className="text-[18px] mb-2">{t.icon}</div>
                      <div className="text-[12px] font-black text-[#eef1f5] mb-[3px]">{t.name}</div>
                      <div className="text-[11px] text-[#4e6070] leading-snug">{t.desc}</div>
                      {t.badge && <span className={`absolute top-2 right-2 text-[8px] font-bold px-[5px] py-[2px] rounded-full ${t.badgeStyle}`}>{t.badge}</span>}
                    </div>
                  ))}
                </div>
                <button onClick={() => openTool('Prematch Arbitrage')} className="inline-flex items-center gap-2 px-8 py-3 rounded-xl bg-[#00c2ff] text-black text-[14px] font-black hover:bg-[#22cfff] transition-all hover:-translate-y-[2px]">
                  View Top Arbs <span className="text-[16px]">→</span>
                </button>
              </div>
              <div className="absolute bottom-0 left-0 right-0 h-[25px] flex items-center gap-4 px-5 bg-[#0e1318] border-t border-[#1a222c] text-[10px] font-mono text-[#4e6070]">
                <span><span className="inline-block w-[5px] h-[5px] rounded-full bg-emerald-400 mr-1 animate-pulse"></span>Connected · 40 books</span>
                <span className="text-[#1a222c]">|</span>
                <span>Last scan: {scanTime}</span>
                <span className="ml-auto">FluxOdds v1.0</span>
              </div>
            </div>
          ) : (
            <div className="flex flex-col flex-1 overflow-hidden">
              {/* Tool bar */}
              <div className="px-5 pt-3 pb-3 bg-[#0e1318] border-b border-[#1a222c] flex-shrink-0">
                <div className="flex items-center justify-between mb-3">
                  <div className="font-['Bebas_Neue'] text-2xl tracking-wide">{toolName}</div>
                  <div className="flex items-center gap-3">
                    <span className="font-mono text-[11px] text-[#4e6070]">{filtered.length} opportunities</span>
                    <button onClick={() => setDashView('home')} className="border border-[#222d3a] text-[#4e6070] px-3 py-1 rounded-md text-[11px] font-semibold hover:text-[#eef1f5] transition-all">← Home</button>
                  </div>
                </div>
                <div className="flex items-center gap-[5px] flex-wrap">
                  {['all','nba','nfl','mlb','nhl','soccer','tennis'].map(s => (
                    <button key={s} onClick={() => setSport(s)}
                      className={`px-[10px] py-1 rounded-md text-[11px] font-semibold transition-all ${sport===s?'bg-sky-900/10 border border-sky-700/30 text-[#00c2ff]':'bg-[#141b23] border border-[#222d3a] text-[#4e6070] hover:text-[#eef1f5]'}`}>
                      {s === 'all' ? 'All Sports' : s.toUpperCase()}
                    </button>
                  ))}
                  <div className="w-px h-4 bg-[#222d3a] mx-1"></div>
                  {[0,1,2,3].map(m => (
                    <button key={m} onClick={() => setMinP(m)}
                      className={`px-[10px] py-1 rounded-md text-[11px] font-semibold transition-all ${minP===m?'bg-sky-900/10 border border-sky-700/30 text-[#00c2ff]':'bg-[#141b23] border border-[#222d3a] text-[#4e6070] hover:text-[#eef1f5]'}`}>
                      {m === 0 ? 'Any %' : `${m}%+`}
                    </button>
                  ))}
                  <div className="ml-auto flex items-center gap-1 bg-[#141b23] border border-[#222d3a] rounded-md px-2 py-1">
                    <span className="text-[#4e6070] text-xs">⌕</span>
                    <input type="text" placeholder="Search..." onChange={e => setQuery(e.target.value.toLowerCase())}
                      className="bg-transparent border-none text-[11px] text-[#eef1f5] outline-none w-[110px] placeholder-[#4e6070]" />
                  </div>
                </div>
              </div>
 
              {/* Table */}
              <div className="flex-1 overflow-y-auto">
                <div className="grid text-[10px] font-bold tracking-[.1em] uppercase text-[#4e6070] px-5 py-[6px] border-b border-[#222d3a] bg-[#0e1318] sticky top-0 z-10" style={{gridTemplateColumns:'2fr 1fr 1fr 80px 90px'}}>
                  <span>Game</span><span>Book A</span><span>Book B</span><span>Profit</span><span>Stakes ($100)</span>
                </div>
                {filtered.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-64 text-[#4e6070]">
                    <div className="text-3xl opacity-30 mb-3">◎</div>
                    <div className="text-[15px] font-bold text-[#eef1f5]">No arbs match your filters</div>
                  </div>
                ) : filtered.map((a, i) => (
                  <div key={i} onClick={() => setSelectedArb(a)}
                    className="grid px-5 py-[11px] border-b border-[#1a222c] items-center cursor-pointer hover:bg-[#0e1318] transition-colors"
                    style={{gridTemplateColumns:'2fr 1fr 1fr 80px 90px', animationDelay:`${i*0.025}s`}}>
                    <div>
                      <div className="text-[13px] font-bold mb-[3px]">{a.game}</div>
                      <div className="flex items-center gap-[5px]">
                        <span className={`text-[9px] font-bold px-[5px] py-[1px] rounded-sm ${SPORT_COLORS[a.sport]}`}>{a.sport.toUpperCase()}</span>
                        <span className="text-[10px] text-[#4e6070] font-mono">{a.time}</span>
                      </div>
                    </div>
                    <div><div className="text-[12px] font-semibold mb-[1px]">{a.bA}</div><div className="text-[10px] text-[#4e6070] font-mono">{a.oA}</div></div>
                    <div><div className="text-[12px] font-semibold mb-[1px]">{a.bB}</div><div className="text-[10px] text-[#4e6070] font-mono">{a.oB}</div></div>
                    <div className="font-['Bebas_Neue'] text-[22px] tracking-wide text-[#00c2ff]">+{a.profit}%</div>
                    <div className="font-mono text-[10px] text-[#4e6070] leading-loose">${a.sA} / ${a.sB}</div>
                  </div>
                ))}
              </div>
 
              {/* Status bar */}
              <div className="h-[25px] flex-shrink-0 flex items-center gap-4 px-5 bg-[#0e1318] border-t border-[#1a222c] text-[10px] font-mono text-[#4e6070]">
                <span><span className="inline-block w-[5px] h-[5px] rounded-full bg-emerald-400 mr-1 animate-pulse"></span>Connected · 40 books</span>
                <span className="text-[#1a222c]">|</span>
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
          <div className="fixed right-0 top-0 bottom-0 w-[330px] bg-[#0e1318] border-l border-[#222d3a] z-50 flex flex-col">
            <div className="flex items-start justify-between p-4 border-b border-[#1a222c]">
              <div>
                <div className="text-[14px] font-black mb-1">{selectedArb.game}</div>
                <div className="text-[11px] text-[#4e6070]">{selectedArb.sport.toUpperCase()} · {selectedArb.time} · {selectedArb.market}</div>
              </div>
              <button onClick={() => setSelectedArb(null)} className="text-[#4e6070] text-lg hover:text-[#eef1f5] transition-colors">×</button>
            </div>
            <div className="flex-1 overflow-y-auto p-4">
              <div className="text-center p-5 bg-emerald-900/5 border border-emerald-800/10 rounded-xl mb-4">
                <div className="font-['Bebas_Neue'] text-[48px] text-[#00c2ff] leading-none tracking-wide">+{selectedArb.profit}%</div>
                <div className="text-[10px] text-[#4e6070] mt-1 uppercase tracking-wider">Guaranteed profit</div>
              </div>
              <div className="flex items-center gap-2 mb-4">
                <label className="text-[11px] text-[#4e6070] font-semibold whitespace-nowrap">Bankroll $</label>
                <input type="number" value={bankroll} onChange={e => setBankroll(parseFloat(e.target.value)||100)}
                  className="flex-1 bg-[#141b23] border border-[#222d3a] rounded-md text-[#eef1f5] px-2 py-[6px] text-[12px] font-mono outline-none focus:border-[#00c2ff]" />
              </div>
              <div className="text-[10px] font-bold tracking-wider uppercase text-[#4e6070] mb-2">Your bets</div>
              {[{name:selectedArb.bA,odds:selectedArb.oA,stake:stakeA},{name:selectedArb.bB,odds:selectedArb.oB,stake:stakeB}].map((b,i) => (
                <div key={i} className="flex items-center justify-between bg-[#141b23] border border-[#222d3a] rounded-xl px-3 py-[10px] mb-[5px]">
                  <div className="text-[12px] font-bold">{b.name}</div>
                  <div className="text-right">
                    <div className="font-mono text-[11px] text-[#00c2ff]">{b.odds}</div>
                    <div className="font-mono text-[12px] text-emerald-400 mt-[2px]">${b.stake}</div>
                  </div>
                </div>
              ))}
              <div className="bg-[#141b23] border border-[#222d3a] rounded-xl p-3 mt-3">
                {[['Total stake',`$${parseFloat(bankroll).toFixed(2)}`],['Payout',`$${payout}`],['Net profit',`+$${net}`]].map(([l,v],i) => (
                  <div key={i} className={`flex justify-between py-[5px] ${i<2?'border-b border-[#1a222c]':''} ${i===2?'pt-2':''}`}>
                    <span className="text-[11px] text-[#4e6070]">{l}</span>
                    <span className={`font-mono text-[11px] ${i===2?'text-emerald-400 font-bold':''}`}>{v}</span>
                  </div>
                ))}
              </div>
            </div>
            <div className="flex gap-2 p-4 border-t border-[#1a222c]">
              <button className="flex-1 py-[10px] rounded-xl bg-[#00c2ff] text-black text-[12px] font-black hover:bg-[#22cfff] transition-colors">Place bets →</button>
              <button onClick={() => setSelectedArb(null)} className="flex-1 py-[10px] rounded-xl bg-[#141b23] border border-[#222d3a] text-[#4e6070] text-[12px] font-bold hover:text-[#eef1f5] transition-colors">Save</button>
            </div>
          </div>
        </>
      )}
    </div>
  )
 
  return (
    <div className="bg-[#07090c] text-[#eef1f5] font-sans overflow-x-hidden">
      {/* Sidebar overlay */}
      {sidebarOpen && <div className="fixed inset-0 bg-black/60 z-[90] backdrop-blur-sm" onClick={() => setSidebarOpen(false)}></div>}
      <div className={`fixed top-0 left-0 bottom-0 w-[256px] bg-[#0e1318] border-r border-[#222d3a] z-[91] flex flex-col overflow-y-auto transition-transform duration-300 ${sidebarOpen?'translate-x-0':'-translate-x-full'}`}>
        <div className="h-[60px] flex items-center justify-between px-4 border-b border-[#1a222c]">
          <div className="font-['Bebas_Neue'] text-xl tracking-widest">FLUX<span className="text-[#00c2ff]">ODDS</span></div>
          <button onClick={() => setSidebarOpen(false)} className="text-[#4e6070] text-lg hover:text-[#eef1f5]">×</button>
        </div>
        <div className="p-3 pt-4">
          <div className="text-[10px] font-bold tracking-[.14em] uppercase text-[#4e6070] px-2 mb-2">Arb Tools</div>
          {[
            {name:'Live Arbitrage',icon:'⚡',badge:'LIVE',bs:'text-emerald-400'},
            {name:'Prematch Arbitrage',icon:'🗓'},
            {name:'Positive EV Bets',icon:'📈',badge:'HOT',bs:'text-yellow-400'},
            {name:'Middles Finder',icon:'🎯'},
            {name:'Free Bet Converter',icon:'🎁',badge:'PRO',bs:'text-sky-400'},
          ].map(t => (
            <button key={t.name} onClick={() => openTool(t.name)}
              className="flex items-center gap-3 w-full px-2 py-[9px] rounded-lg text-[13px] font-semibold text-[#4e6070] hover:bg-[#141b23] hover:text-[#eef1f5] transition-all mb-[2px] border border-transparent">
              <span className="w-[30px] h-[30px] rounded-lg flex items-center justify-center text-sm bg-[#141b23] border border-[#222d3a]">{t.icon}</span>
              <span className="flex-1 text-left">{t.name}</span>
              {t.badge && <span className={`text-[9px] font-bold px-[6px] py-[2px] rounded-full border border-current/20 ${t.bs}`}>{t.badge}</span>}
            </button>
          ))}
          <div className="h-px bg-[#1a222c] my-3"></div>
          <div className="text-[10px] font-bold tracking-[.14em] uppercase text-[#4e6070] px-2 mb-2">Tools</div>
          {[{icon:'🧮',name:'Bet Calculator'},{icon:'📊',name:'P&L Tracker'},{icon:'🔔',name:'Alerts & Notifications'}].map(t => (
            <button key={t.name} onClick={() => openTool(t.name)}
              className="flex items-center gap-3 w-full px-2 py-[9px] rounded-lg text-[13px] font-semibold text-[#4e6070] hover:bg-[#141b23] hover:text-[#eef1f5] transition-all mb-[2px] border border-transparent">
              <span className="w-[30px] h-[30px] rounded-lg flex items-center justify-center text-sm bg-[#141b23] border border-[#222d3a]">{t.icon}</span>
              <span>{t.name}</span>
            </button>
          ))}
        </div>
        <div className="mt-auto p-3 border-t border-[#1a222c]">
          <div className="bg-sky-900/5 border border-sky-800/15 rounded-xl p-3 cursor-pointer hover:bg-sky-900/10 transition-colors">
            <div className="text-[13px] font-bold text-[#00c2ff]">Upgrade to Pro</div>
            <div className="text-[11px] text-[#4e6070] mt-1">Unlimited arbs, all sports & alerts</div>
            <span className="block mt-2 py-2 rounded-lg bg-[#00c2ff] text-black text-[11px] font-black text-center">Get Pro — $49/mo</span>
          </div>
        </div>
      </div>
 
      {/* Nav */}
      <nav className="fixed top-0 left-0 right-0 z-[100] flex items-center justify-between px-12 h-[60px] bg-[#07090c]/93 border-b border-[#1a222c] backdrop-blur-md">
        <div className="flex items-center gap-3">
          <button onClick={() => setSidebarOpen(!sidebarOpen)} className="flex flex-col gap-[5px] justify-center w-8 h-8 bg-transparent border-none cursor-pointer p-1 rounded-md hover:bg-[#141b23]">
            <span className="block h-[1.5px] bg-[#4e6070] rounded"></span>
            <span className="block h-[1.5px] bg-[#4e6070] rounded"></span>
            <span className="block h-[1.5px] bg-[#4e6070] rounded"></span>
          </button>
          <a href="#home" className="font-['Bebas_Neue'] text-[26px] tracking-widest no-underline text-[#eef1f5]">FLUX<span className="text-[#00c2ff]">ODDS</span></a>
        </div>
        <div className="hidden md:flex items-center gap-7">
          {['#how','#features','#pricing','#faq','#contact'].map((h,i) => (
            <a key={h} href={h} className="text-[#4e6070] text-[13px] font-semibold no-underline hover:text-[#eef1f5] transition-colors">
              {['How it works','Features','Pricing','FAQ','Contact'][i]}
            </a>
          ))}
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => setLoginOpen(true)} className="px-4 py-[7px] rounded-lg border border-[#222d3a] text-[#4e6070] text-[13px] font-semibold hover:border-[#00c2ff] hover:text-[#00c2ff] transition-all">Log in</button>
          <button onClick={() => { setView('dashboard'); setDashView('home') }} className="px-5 py-[8px] rounded-lg bg-[#00c2ff] text-black text-[13px] font-bold hover:bg-[#22cfff] transition-all">Launch App →</button>
        </div>
      </nav>
 
      {/* Hero */}
      <section id="home" className="min-h-screen flex flex-col items-center justify-center text-center px-12 pt-[110px] pb-20 relative overflow-hidden">
        <div className="absolute inset-0 opacity-100" style={{backgroundImage:'linear-gradient(rgba(0,194,255,.035) 1px,transparent 1px),linear-gradient(90deg,rgba(0,194,255,.035) 1px,transparent 1px)',backgroundSize:'58px 58px',maskImage:'radial-gradient(ellipse 80% 70% at 50% 50%,black 20%,transparent 100%)'}}></div>
        <div className="absolute w-[640px] h-[280px] top-[32%] left-1/2 -translate-x-1/2 pointer-events-none" style={{background:'radial-gradient(ellipse,rgba(0,194,255,.1) 0%,transparent 70%)'}}></div>
        <div className="relative z-10">
          <div className="inline-flex items-center gap-2 bg-sky-900/10 border border-sky-800/20 text-[#00c2ff] px-4 py-[5px] rounded-full text-[11px] font-bold tracking-[.12em] uppercase mb-7">
            <span className="w-[6px] h-[6px] rounded-full bg-emerald-400 animate-pulse"></span>Live arb detection — 40+ sportsbooks
          </div>
          <h1 className="font-['Bebas_Neue'] leading-[.94] tracking-widest mb-2" style={{fontSize:'clamp(60px,9vw,130px)'}}>
            FIND THE <span className="text-[#00c2ff]">EDGE.</span><br/>
            <span className="text-[#1a222c]">BEAT THE BOOKS.</span>
          </h1>
          <p className="text-[#4e6070] font-medium max-w-[500px] mx-auto mt-5 mb-11 leading-relaxed" style={{fontSize:'clamp(15px,1.8vw,20px)'}}>
            FluxOdds scans every major sportsbook in real time and surfaces arbitrage opportunities before they disappear. Guaranteed profit. Zero guesswork.
          </p>
          <div className="flex items-center gap-3 justify-center">
            <button onClick={() => { setView('dashboard'); setDashView('home') }} className="px-9 py-4 rounded-xl bg-[#00c2ff] text-black text-[15px] font-black hover:bg-[#22cfff] transition-all hover:-translate-y-[2px]">Launch FluxOdds →</button>
            <a href="#how" className="px-9 py-4 rounded-xl border border-[#222d3a] text-[#eef1f5] text-[15px] font-bold hover:border-[#00c2ff] hover:text-[#00c2ff] transition-all no-underline">How it works</a>
          </div>
          <div className="flex items-center gap-11 mt-16 justify-center">
            {[['40+','Sportsbooks'],['+5.1%','Best live arb'],['<1s','Detection'],['24/7','Always on']].map(([n,l],i) => (
              <div key={i} className="text-center">
                <div className="font-['Bebas_Neue'] text-[40px] text-[#00c2ff] tracking-wide leading-none">{n}</div>
                <div className="text-[11px] text-[#4e6070] font-semibold tracking-wider uppercase mt-1">{l}</div>
              </div>
            ))}
          </div>
        </div>
      </section>
 
      {/* Ticker */}
      <div className="border-t border-b border-[#1a222c] bg-[#0e1318] py-[9px] overflow-hidden">
        <div className="flex gap-11 whitespace-nowrap" style={{animation:'ticker 28s linear infinite',width:'max-content'}}>
          {[...TICKS,...TICKS].map((t,i) => (
            <span key={i} className="flex items-center gap-2 font-mono text-[12px] text-[#4e6070]">
              <span className="text-[#1a222c]">◆</span>
              <span className="text-[#eef1f5] font-medium">{t.game}</span>
              <span className="text-[11px]">{t.sport}</span>
              <span className="text-emerald-400 font-bold">{t.profit}</span>
              <span>{t.books}</span>
            </span>
          ))}
        </div>
      </div>
 
      {/* How it works */}
      <section id="how" className="py-[90px] px-12 bg-[#0e1318] border-t border-b border-[#1a222c]">
        <div className="text-[11px] font-bold tracking-[.15em] uppercase text-[#00c2ff] mb-3">How it works</div>
        <h2 className="font-['Bebas_Neue'] leading-none tracking-wide mb-4" style={{fontSize:'clamp(38px,5vw,68px)'}}>THREE STEPS.<br/>PURE PROFIT.</h2>
        <p className="text-[#4e6070] text-[17px] max-w-[500px] leading-relaxed">No spreadsheets. No manual odds checking. FluxOdds does the heavy lifting so you can focus on placing bets.</p>
        <div className="grid grid-cols-1 md:grid-cols-3 mt-14 border border-[#1a222c] rounded-xl overflow-hidden" style={{gap:'2px'}}>
          {[
            {n:'01',t:'We scan the books',d:'FluxOdds monitors DraftKings, FanDuel, BetMGM, Caesars, and 40+ more — refreshing odds every second across all major sports.'},
            {n:'02',t:'We find the arb',d:'Our engine calculates implied probability across every outcome. When the math guarantees profit, we surface it instantly with exact bet amounts.'},
            {n:'03',t:'You place the bets',d:'Get alerted in real time via email or push. Place your stakes at each sportsbook and lock in guaranteed profit regardless of the outcome.'},
          ].map((s,i) => (
            <div key={i} className="p-9 bg-[#07090c] hover:bg-[#0e1318] transition-colors group">
              <div className="font-['Bebas_Neue'] text-[64px] text-[#1a222c] group-hover:text-[#00c2ff] leading-none mb-5 transition-colors">{s.n}</div>
              <h3 className="text-[20px] font-black mb-3">{s.t}</h3>
              <p className="text-[#4e6070] text-[14px] leading-[1.7]">{s.d}</p>
            </div>
          ))}
        </div>
      </section>
 
      {/* Features */}
      <section id="features" className="py-[90px] px-12 bg-[#07090c]">
        <div className="text-[11px] font-bold tracking-[.15em] uppercase text-[#00c2ff] mb-3">Features</div>
        <h2 className="font-['Bebas_Neue'] leading-none tracking-wide mb-4" style={{fontSize:'clamp(38px,5vw,68px)'}}>EVERYTHING YOU<br/>NEED TO WIN.</h2>
        <p className="text-[#4e6070] text-[17px] max-w-[500px] leading-relaxed">Built for beginners who want to start and pros who need every edge. All in one dashboard.</p>
        <div className="grid grid-cols-1 md:grid-cols-3 mt-14 border border-[#1a222c] rounded-xl overflow-hidden" style={{gap:'1px',background:'#1a222c'}}>
          {[
            {icon:'⚡',t:'Live arb finder',d:'Real-time scanning across 40+ books. Arbs are surfaced the moment they appear — with profit %, exact stakes, and direct links to each book.'},
            {icon:'🔔',t:'Instant alerts',d:'Set a minimum profit threshold and get notified via email or push the instant an arb hits your criteria. Never miss a window again.'},
            {icon:'🧮',t:'Bet size calculator',d:'Enter your bankroll and FluxOdds tells you exactly how much to place on each side to guarantee the same profit no matter what.'},
            {icon:'📈',t:'+EV bet finder',d:'Beyond arbs — find positive expected value bets where the odds are in your favor long-term. The strategy the pros use daily.'},
            {icon:'🎯',t:'Middles finder',d:'Spot middle opportunities where line movement creates a chance to win both sides. Higher risk, massive upside when they hit.'},
            {icon:'📊',t:'P&L tracker',d:'Log every bet and track your running profit across books, sports, and time periods. Know your edge. Grow your bankroll.'},
          ].map((f,i) => (
            <div key={i} className="bg-[#07090c] p-8 hover:bg-[#0e1318] transition-colors">
              <div className="w-[42px] h-[42px] rounded-xl bg-sky-900/10 border border-sky-800/15 flex items-center justify-center text-[18px] mb-5">{f.icon}</div>
              <h3 className="text-[17px] font-black mb-2">{f.t}</h3>
              <p className="text-[#4e6070] text-[13px] leading-[1.7]">{f.d}</p>
            </div>
          ))}
        </div>
      </section>
 
      {/* Live preview */}
      <section id="preview" className="py-[90px] px-12 bg-[#0e1318] border-t border-b border-[#1a222c]">
        <div className="text-[11px] font-bold tracking-[.15em] uppercase text-[#00c2ff] mb-3">Live preview</div>
        <h2 className="font-['Bebas_Neue'] leading-none tracking-wide mb-4" style={{fontSize:'clamp(38px,5vw,68px)'}}>THIS IS WHAT<br/>PROFIT LOOKS LIKE.</h2>
        <p className="text-[#4e6070] text-[17px] max-w-[500px] leading-relaxed mb-14">Sorted by highest profit first. Every arb, every book, every stake — laid out clearly so you can act fast.</p>
        <div className="border border-[#222d3a] rounded-xl overflow-hidden bg-[#07090c]">
          <div className="flex items-center gap-2 px-4 py-3 bg-[#141b23] border-b border-[#1a222c]">
            <div className="w-[10px] h-[10px] rounded-full bg-[#ff5f57]"></div>
            <div className="w-[10px] h-[10px] rounded-full bg-[#febc2e]"></div>
            <div className="w-[10px] h-[10px] rounded-full bg-[#28c840]"></div>
            <div className="flex-1 bg-[#07090c] border border-[#1a222c] rounded px-3 py-[3px] text-[11px] font-mono text-[#4e6070] mx-2">app.fluxodds.com/dashboard</div>
            <span className="w-[6px] h-[6px] rounded-full bg-emerald-400 animate-pulse ml-auto"></span>
            <span className="text-[11px] font-mono text-[#00c2ff] ml-1">LIVE</span>
          </div>
          <div className="grid text-[10px] font-bold tracking-[.1em] uppercase text-[#2e3d4a] px-5 py-2 border-b border-[#1a222c]" style={{gridTemplateColumns:'2fr 1fr 1fr 80px 90px'}}>
            <span>Game</span><span>Book A</span><span>Book B</span><span>Profit</span><span>Stakes ($100)</span>
          </div>
          {DATA.slice(0,5).map((a,i) => (
            <div key={i} className="grid px-5 py-3 border-b border-[#1a222c] items-center hover:bg-[#0e1318] transition-colors cursor-pointer" style={{gridTemplateColumns:'2fr 1fr 1fr 80px 90px'}}>
              <div><div className="font-bold text-[13px] mb-[2px]">{a.game}</div><div className="text-[11px] text-[#4e6070] font-mono">{a.sport.toUpperCase()} · {a.time}</div></div>
              <div><div className="text-[12px] font-semibold mb-[1px]">{a.bA}</div><div className="text-[10px] text-[#4e6070] font-mono">{a.oA}</div></div>
              <div><div className="text-[12px] font-semibold mb-[1px]">{a.bB}</div><div className="text-[10px] text-[#4e6070] font-mono">{a.oB}</div></div>
              <div className="font-['Bebas_Neue'] text-[22px] text-[#00c2ff] tracking-wide">+{a.profit}%</div>
              <div className="font-mono text-[11px] text-[#4e6070] leading-loose">${a.sA} / ${a.sB}</div>
            </div>
          ))}
        </div>
      </section>
 
      {/* Pricing */}
      <section id="pricing" className="py-[90px] px-12 bg-[#07090c]">
        <div className="text-[11px] font-bold tracking-[.15em] uppercase text-[#00c2ff] mb-3">Pricing</div>
        <h2 className="font-['Bebas_Neue'] leading-none tracking-wide mb-4" style={{fontSize:'clamp(38px,5vw,68px)'}}>PAY FOR WHAT<br/>YOU WIN WITH.</h2>
        <p className="text-[#4e6070] text-[17px] max-w-[500px] leading-relaxed">Start free. Scale when you're profitable. No contracts, cancel anytime.</p>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5 mt-14">
          {[
            {name:'Starter',price:'0',desc:'For curious bettors wanting to see what arbing is all about.',btn:'Get started free',btnStyle:'border border-[#222d3a] text-[#eef1f5] hover:border-[#00c2ff] hover:text-[#00c2ff]',featured:false,
              feats:['Up to 5 arbs per day','NBA + NFL only','10 sportsbooks scanned','Basic bet calculator'],
              off:['No email alerts','No EV bets','No P&L tracker']},
            {name:'Pro',price:'49',desc:'For serious arbers ready to build real, consistent profit.',btn:'Start 7-day free trial',btnStyle:'bg-[#00c2ff] text-black hover:bg-[#22cfff]',featured:true,badge:'Most popular',
              feats:['Unlimited arbs','All sports covered','40+ sportsbooks','Email + push alerts','+EV bet finder','Middles finder','Full P&L tracker'],off:[]},
            {name:'Sharp',price:'99',desc:'For high-volume pros who need every edge, no limits.',btn:'Start 7-day free trial',btnStyle:'border border-[#222d3a] text-[#eef1f5] hover:border-[#00c2ff] hover:text-[#00c2ff]',featured:false,
              feats:['Everything in Pro','API access','Custom alert rules','Advanced filters','Priority speed queue','Dedicated support','Early feature access'],off:[]},
          ].map((p,i) => (
            <div key={i} className={`relative rounded-xl p-9 transition-all hover:-translate-y-[3px] ${p.featured?'border border-[#00c2ff] bg-[#0e1318]':'border border-[#1a222c] bg-[#0e1318] hover:border-[#222d3a]'}`}>
              {p.badge && <div className="absolute -top-[13px] left-1/2 -translate-x-1/2 bg-[#00c2ff] text-black px-4 py-[3px] rounded-full text-[10px] font-black tracking-[.1em] uppercase whitespace-nowrap">{p.badge}</div>}
              <div className="text-[13px] font-bold text-[#4e6070] tracking-[.08em] uppercase mb-3">{p.name}</div>
              <div className="font-['Bebas_Neue'] text-[58px] leading-none tracking-wide mb-1"><sup className="text-[24px]">$</sup>{p.price}<span className="text-[16px] text-[#4e6070] font-sans font-medium">/mo</span></div>
              <p className="text-[#4e6070] text-[13px] mb-7 leading-relaxed">{p.desc}</p>
              <button onClick={() => setLoginOpen(true)} className={`block w-full py-3 rounded-xl text-[13px] font-black mb-7 transition-all ${p.btnStyle}`}>{p.btn}</button>
              <ul className="flex flex-col gap-[10px]">
                {p.feats.map((f,j) => <li key={j} className="flex items-center gap-2 text-[13px] text-[#4e6070]"><span className="w-[15px] h-[15px] rounded-full bg-emerald-900/15 border border-emerald-800/25 flex items-center justify-center text-emerald-400 text-[9px] flex-shrink-0">✓</span>{f}</li>)}
                {p.off.map((f,j) => <li key={j} className="flex items-center gap-2 text-[13px] text-[#2e3d4a]"><span className="w-[15px] h-[15px] rounded-full bg-[#141b23] border border-[#222d3a] flex items-center justify-center text-[#2e3d4a] text-[9px] flex-shrink-0">✕</span>{f}</li>)}
              </ul>
            </div>
          ))}
        </div>
      </section>
 
      {/* FAQ */}
      <section id="faq" className="py-[90px] px-12 bg-[#0e1318] border-t border-b border-[#1a222c]">
        <div className="max-w-[720px] mx-auto">
          <div className="text-[11px] font-bold tracking-[.15em] uppercase text-[#00c2ff] mb-3">FAQ</div>
          <h2 className="font-['Bebas_Neue'] leading-none tracking-wide mb-14" style={{fontSize:'clamp(38px,5vw,68px)'}}>GOT QUESTIONS?</h2>
          <div className="flex flex-col gap-[2px]">
            {faqs.map((f,i) => (
              <div key={i} className="border border-[#1a222c] rounded-xl overflow-hidden mb-[2px]">
                <button onClick={() => setFaqOpen(faqOpen===i?null:i)}
                  className="w-full bg-[#07090c] px-7 py-5 text-left text-[15px] font-bold flex justify-between items-center hover:bg-[#0e1318] transition-colors border-none cursor-pointer text-[#eef1f5]">
                  {f.q}
                  <span className={`w-[22px] h-[22px] rounded-full bg-[#141b23] border border-[#222d3a] flex items-center justify-center text-[15px] text-[#00c2ff] flex-shrink-0 ml-4 transition-transform ${faqOpen===i?'rotate-45':''}`}>+</span>
                </button>
                {faqOpen===i && <div className="bg-[#07090c] px-7 pb-5 text-[14px] text-[#4e6070] leading-[1.75]">{f.a}</div>}
              </div>
            ))}
          </div>
        </div>
      </section>
 
      {/* CTA */}
      <div className="py-[90px] px-12 text-center bg-[#07090c] border-t border-[#1a222c] relative overflow-hidden">
        <div className="absolute inset-0" style={{background:'radial-gradient(ellipse 55% 80% at 50% 50%,rgba(0,194,255,.05) 0%,transparent 70%)'}}></div>
        <div className="relative z-10">
          <div className="text-[11px] font-bold tracking-[.15em] uppercase text-[#00c2ff] mb-3">Ready?</div>
          <h2 className="font-['Bebas_Neue'] leading-none tracking-wide mb-4" style={{fontSize:'clamp(44px,7vw,90px)'}}>STOP GAMBLING.<br/><span className="text-[#00c2ff]">START WINNING.</span></h2>
          <p className="text-[#4e6070] text-[17px] max-w-[480px] mx-auto mb-10 leading-relaxed">Join thousands of bettors already using FluxOdds to find guaranteed profit every single day.</p>
          <div className="flex items-center gap-3 justify-center">
            <button onClick={() => { setView('dashboard'); setDashView('home') }} className="px-9 py-4 rounded-xl bg-[#00c2ff] text-black text-[15px] font-black hover:bg-[#22cfff] transition-all hover:-translate-y-[2px]">Launch FluxOdds →</button>
            <a href="#pricing" className="px-9 py-4 rounded-xl border border-[#222d3a] text-[#eef1f5] text-[15px] font-bold hover:border-[#00c2ff] hover:text-[#00c2ff] transition-all no-underline">View pricing</a>
          </div>
        </div>
      </div>
 
      {/* Contact */}
      <section id="contact" className="py-[90px] px-12 bg-[#07090c]">
        <div className="text-center mb-14">
          <div className="text-[11px] font-bold tracking-[.15em] uppercase text-[#00c2ff] mb-3">Contact</div>
          <h2 className="font-['Bebas_Neue'] leading-none tracking-wide" style={{fontSize:'clamp(38px,5vw,68px)'}}>GET IN TOUCH.</h2>
        </div>
        <div className="max-w-[500px] mx-auto bg-[#0e1318] border border-[#222d3a] rounded-xl p-11">
          {contactSent ? (
            <div className="text-center py-8">
              <div className="text-[32px] mb-3">✓</div>
              <div className="text-[18px] font-black mb-2">Message sent!</div>
              <div className="text-[#4e6070]">We'll get back to you soon.</div>
            </div>
          ) : (
            <>
              {[{l:'Name',t:'text',p:'Your name'},{l:'Email',t:'email',p:'you@example.com'}].map(f => (
                <div key={f.l} className="mb-4">
                  <label className="block text-[11px] font-bold tracking-[.08em] uppercase text-[#4e6070] mb-2">{f.l}</label>
                  <input type={f.t} placeholder={f.p} className="w-full bg-[#07090c] border border-[#222d3a] rounded-lg text-[#eef1f5] px-4 py-3 text-[14px] outline-none focus:border-[#00c2ff] transition-colors" />
                </div>
              ))}
              <div className="mb-5">
                <label className="block text-[11px] font-bold tracking-[.08em] uppercase text-[#4e6070] mb-2">Message</label>
                <textarea placeholder="What's on your mind?" rows={4} className="w-full bg-[#07090c] border border-[#222d3a] rounded-lg text-[#eef1f5] px-4 py-3 text-[14px] outline-none focus:border-[#00c2ff] transition-colors resize-none"></textarea>
              </div>
              <button onClick={() => setContactSent(true)} className="w-full py-4 rounded-xl bg-[#00c2ff] text-black text-[14px] font-black hover:bg-[#22cfff] transition-all">Send message</button>
            </>
          )}
        </div>
      </section>
 
      {/* Footer */}
      <footer className="bg-[#0e1318] border-t border-[#1a222c] px-12 py-10 flex items-center justify-between flex-wrap gap-5">
        <div className="font-['Bebas_Neue'] text-[22px] tracking-widest">FLUX<span className="text-[#00c2ff]">ODDS</span></div>
        <div className="flex gap-6">
          {[['#how','How it works'],['#features','Features'],['#pricing','Pricing'],['#faq','FAQ'],['#contact','Contact']].map(([h,l]) => (
            <a key={h} href={h} className="text-[#4e6070] text-[13px] no-underline hover:text-[#eef1f5] transition-colors">{l}</a>
          ))}
        </div>
        <div className="text-[#2e3d4a] text-[13px]">© 2025 FluxOdds. All rights reserved.</div>
      </footer>
 
      {/* Login modal */}
      {loginOpen && (
        <>
          <div className="fixed inset-0 bg-black/82 z-[200] backdrop-blur-sm" onClick={() => setLoginOpen(false)}></div>
          <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-[201] w-[400px] max-w-[90vw] bg-[#0e1318] border border-[#222d3a] rounded-xl p-11">
            <button onClick={() => setLoginOpen(false)} className="absolute top-4 right-4 text-[#4e6070] text-[18px] hover:text-[#eef1f5] bg-none border-none cursor-pointer">×</button>
            <div className="font-['Bebas_Neue'] text-[32px] tracking-wide mb-1">WELCOME BACK.</div>
            <p className="text-[#4e6070] text-[13px] mb-6">Log in or create your account to start finding arbs.</p>
            <div className="flex border border-[#222d3a] rounded-lg overflow-hidden mb-6">
              {['login','signup'].map(t => (
                <button key={t} onClick={() => setLoginTab(t)}
                  className={`flex-1 py-[9px] text-[13px] font-bold border-none cursor-pointer transition-all ${loginTab===t?'bg-[#00c2ff] text-black':'bg-transparent text-[#4e6070]'}`}>
                  {t === 'login' ? 'Log in' : 'Sign up'}
                </button>
              ))}
            </div>
            {[{l:'Email',t:'email',p:'you@example.com'},{l:'Password',t:'password',p:'••••••••'}].map(f => (
              <div key={f.l} className="mb-4">
                <label className="block text-[11px] font-bold tracking-[.08em] uppercase text-[#4e6070] mb-2">{f.l}</label>
                <input type={f.t} placeholder={f.p} className="w-full bg-[#07090c] border border-[#222d3a] rounded-lg text-[#eef1f5] px-4 py-3 text-[14px] outline-none focus:border-[#00c2ff] transition-colors" />
              </div>
            ))}
            <button className="w-full mt-1 py-[14px] rounded-xl bg-[#00c2ff] text-black text-[14px] font-black hover:bg-[#22cfff] transition-all">Continue →</button>
          </div>
        </>
      )}
 
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Bebas+Neue&family=DM+Mono:wght@400;500&display=swap');
        @keyframes ticker { from { transform: translateX(0) } to { transform: translateX(-50%) } }
      `}</style>
    </div>
  )
}