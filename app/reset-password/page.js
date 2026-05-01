'use client'
import { useState, useEffect } from 'react'
import { supabase } from '../supabase'

export default function ResetPassword() {
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [done, setDone] = useState(false)
  const [error, setError] = useState('')

  const handleReset = async () => {
    if (!password || password !== confirm) {
      setError('Passwords do not match')
      return
    }
    if (password.length < 6) {
      setError('Password must be at least 6 characters')
      return
    }
    const { error } = await supabase.auth.updateUser({ password })
    if (error) { setError(error.message); return }
    setDone(true)
  }

  if (done) return (
    <div style={{fontFamily:"'Inter',sans-serif"}} className="min-h-screen bg-[#080806] flex items-center justify-center">
      <div className="text-center">
        <div className="text-[48px] mb-4">✓</div>
        <div className="text-[24px] font-black text-[#eef1f5] mb-2">Password updated!</div>
        <div className="text-[#5a6a78] mb-6 font-medium">You can now log in with your new password.</div>
        <a href="/" className="px-8 py-3 rounded-xl bg-[#ff6b1a] text-black text-[14px] font-black hover:bg-[#ff8c42] transition-all no-underline">Go to FluxOdds →</a>
      </div>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap');`}</style>
    </div>
  )

  return (
    <div style={{fontFamily:"'Inter',sans-serif"}} className="min-h-screen bg-[#080806] flex items-center justify-center px-6">
      <div className="w-full max-w-[400px] bg-[#0f0e0b] border border-[#1e1c16] rounded-xl p-10">
        <div className="text-[28px] font-black text-[#eef1f5] mb-1">Reset password.</div>
        <p className="text-[#5a6a78] text-[13px] mb-8 font-medium">Enter your new password below.</p>
        {error && <div className="bg-red-900/20 border border-red-800/30 text-red-400 text-[13px] px-4 py-3 rounded-lg mb-4 font-medium">{error}</div>}
        <div className="mb-4">
          <label className="block text-[11px] font-semibold tracking-wider uppercase text-[#5a6a78] mb-2">New password</label>
          <input type="password" placeholder="••••••••" value={password} onChange={e => setPassword(e.target.value)}
            className="w-full bg-[#080806] border border-[#1e1c16] rounded-lg text-[#eef1f5] px-4 py-3 text-[14px] outline-none focus:border-[#ff6b1a] transition-colors font-medium"
            style={{fontFamily:"'Inter',sans-serif"}} />
        </div>
        <div className="mb-6">
          <label className="block text-[11px] font-semibold tracking-wider uppercase text-[#5a6a78] mb-2">Confirm password</label>
          <input type="password" placeholder="••••••••" value={confirm} onChange={e => setConfirm(e.target.value)}
            className="w-full bg-[#080806] border border-[#1e1c16] rounded-lg text-[#eef1f5] px-4 py-3 text-[14px] outline-none focus:border-[#ff6b1a] transition-colors font-medium"
            style={{fontFamily:"'Inter',sans-serif"}} />
        </div>
        <button onClick={handleReset} className="w-full py-[14px] rounded-xl bg-[#ff6b1a] text-black text-[14px] font-black hover:bg-[#ff8c42] transition-all border-none cursor-pointer">
          Update password →
        </button>
      </div>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap');`}</style>
    </div>
  )
}