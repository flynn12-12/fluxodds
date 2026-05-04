// app/api/cron/scan-live/route.js
//
// Scans for LIVE arbs and writes to live_arb_sightings cache.
// Called every 5 seconds by pg_cron.

import { scanAllLeaguesForLiveArbs } from '@/lib/liveArbScanner';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';
export const maxDuration = 30;

export async function GET(request) {
  const url = new URL(request.url);
  const querySecret = url.searchParams.get('secret');
  const authHeader = request.headers.get('authorization') || '';
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) return Response.json({ error: 'CRON_SECRET not configured' }, { status: 401 });
  const authOk = authHeader === `Bearer ${cronSecret}` || querySecret === cronSecret;
  if (!authOk) {
    return Response.json({ error: 'unauthorized' }, { status: 401 });
  }

  const apiKey = process.env.SPORTSGAMEODDS_API_KEY;
  if (!apiKey) return Response.json({ error: 'no api key' }, { status: 500 });

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceKey) return Response.json({ error: 'supabase env missing' }, { status: 500 });

  const supabase = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });

  const startedAt = Date.now();
  let arbs = [];
  let eventCount = 0;
  try {
    const out = await scanAllLeaguesForLiveArbs(apiKey);
    arbs = out.arbs || [];
    eventCount = out.eventCount || 0;
  } catch (e) {
    console.error('Live scan failed:', e);
    return Response.json({ error: 'scan failed', message: e.message }, { status: 500 });
  }

  const now = new Date().toISOString();
  const rows = arbs.slice(0, 500).map((arb) => ({
    fingerprint: arb.fingerprint,
    payload: arb,
    profit: arb.profit,
    last_seen_at: now,
  }));

  if (rows.length > 0) {
    const { error } = await supabase
      .from('live_arb_sightings')
      .upsert(rows, { onConflict: 'fingerprint', ignoreDuplicates: false });
    if (error) console.error('Supabase upsert error:', error);
  }

  // Live arbs go stale fast — prune anything not seen in 30s
  await supabase
    .from('live_arb_sightings')
    .delete()
    .lt('last_seen_at', new Date(Date.now() - 30_000).toISOString());

  return Response.json({
    ok: true,
    scanned: eventCount,
    found: arbs.length,
    written: rows.length,
    elapsedMs: Date.now() - startedAt,
  }, { headers: { 'Cache-Control': 'no-store' } });
}