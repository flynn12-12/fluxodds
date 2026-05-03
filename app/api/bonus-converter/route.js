// app/api/bonus-converter/route.js
//
// POST endpoint that finds viable bonus-bet conversions given the user's
// bonus book + bonus amount. Computed on-demand (not cached) since each
// user has different bonus bet inputs.

import { findBonusConversions } from '@/lib/bonusBetConverter';

export const dynamic = 'force-dynamic';
export const maxDuration = 30;

export async function POST(request) {
  try {
    const { bonusBookID, bonusAmount } = await request.json();

    if (!bonusBookID || !bonusAmount) {
      return Response.json({ error: 'Missing bonusBookID or bonusAmount' }, { status: 400 });
    }
    const amt = Number(bonusAmount);
    if (!Number.isFinite(amt) || amt <= 0 || amt > 5000) {
      return Response.json({ error: 'Invalid bonusAmount (1-5000)' }, { status: 400 });
    }

    const apiKey = process.env.SPORTSGAMEODDS_API_KEY;
    if (!apiKey) {
      return Response.json({ error: 'API key missing' }, { status: 500 });
    }

    const result = await findBonusConversions(apiKey, {
      bonusBookID: String(bonusBookID).toLowerCase().trim(),
      bonusAmount: amt,
    });

    return Response.json(result, { headers: { 'Cache-Control': 'no-store' } });
  } catch (e) {
    console.error('bonus-converter error:', e);
    return Response.json({ error: 'Server error', message: e.message }, { status: 500 });
  }
}