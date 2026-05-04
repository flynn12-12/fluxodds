// app/api/cron/scan-ev/route.js
//
// Called every 5s by pg_cron. Scans all leagues for +EV bets and writes them
// to the ev_sightings cache table in Supabase.

import { scanAllLeaguesForEv } from '@/lib/evScanner';
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
  if (!apiKey) {
    return Response.json({ error: 'no api key' }, { status: 500 });
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceKey) {
    return Response.json({ error: 'supabase env missing' }, { status: 500 });
  }

  const supabase = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false },
  });

  const startedAt = Date.now();
  let evBets = [];
  let eventCount = 0;
  let scanHealthy = false;
  try {
    const out = await scanAllLeaguesForEv(apiKey);
    evBets = out.evBets || [];
    eventCount = out.eventCount || 0;
    scanHealthy = out.scanHealthy === true;
  } catch (e) {
    console.error('EV scan failed:', e);
    return Response.json({ error: 'scan failed', message: e.message }, { status: 500 });
  }

  const now = new Date().toISOString();
  const rows = evBets.slice(0, 500).map((b) => ({
    fingerprint: b.fingerprint,
    payload: b,
    ev: b.ev,
    last_seen_at: now,
  }));

  if (rows.length > 0) {
    const { error } = await supabase
      .from('ev_sightings')
      .upsert(rows, { onConflict: 'fingerprint', ignoreDuplicates: false });
    if (error) console.error('Supabase upsert error:', error);
  }

  // Only prune when every league fetch succeeded AND we found at least one row
  // this run. Without the rows guard a healthy zero-result scan never upserts,
  // so every cached row still has an old last_seen_at and the delete wipes the table.
  if (scanHealthy && rows.length > 0) {
    await supabase
      .from('ev_sightings')
      .delete()
      .lt('last_seen_at', new Date(Date.now() - 60_000).toISOString());
  }

  const elapsed = Date.now() - startedAt;
  return Response.json({
    ok: true,
    scanned: eventCount,
    found: evBets.length,
    written: rows.length,
    elapsedMs: elapsed,
    scanHealthy,
    stalePruned: scanHealthy && rows.length > 0,
  }, { headers: { 'Cache-Control': 'no-store' } });
}