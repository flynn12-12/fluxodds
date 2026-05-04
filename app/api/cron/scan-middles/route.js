// app/api/cron/scan-middles/route.js
//
// Called by cron. Scans all leagues for middles and writes them
// to the middle_sightings cache table in Supabase.

import { scanAllLeaguesForMiddles } from '@/lib/middlesScanner';
import { createClient } from '@supabase/supabase-js';
import { assertProductionCronChild } from '@/lib/cronChildAuth';

export const dynamic = 'force-dynamic';
export const maxDuration = 30;

export async function GET(request) {
  const url = new URL(request.url);
  const secret = url.searchParams.get('secret');
  const authHeader = request.headers.get('authorization') || '';
  const cronSecret = process.env.CRON_SECRET;

  if (!cronSecret) {
    return Response.json({ error: 'CRON_SECRET not configured' }, { status: 401 });
  }
  const ok = authHeader === `Bearer ${cronSecret}` || secret === cronSecret;
  if (!ok) {
    return Response.json({ error: 'unauthorized' }, { status: 401 });
  }

  const chainBlock = assertProductionCronChild(request);
  if (chainBlock) return chainBlock;

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
  let middles = [];
  let eventCount = 0;
  let scanHealthy = false;

  try {
    const out = await scanAllLeaguesForMiddles(apiKey);
    middles = out.middles || [];
    eventCount = out.eventCount || 0;
    scanHealthy = out.scanHealthy === true;
  } catch (e) {
    console.error('Middles scan failed:', e);
    return Response.json({ error: 'scan failed', message: e.message }, { status: 500 });
  }

  const now = new Date().toISOString();
  const rows = middles.slice(0, 500).map((m) => ({
    fingerprint: m.fingerprint,
    payload: m,
    gap: m.gap,
    last_seen_at: now,
  }));

  if (rows.length > 0) {
    const { error } = await supabase
      .from('middle_sightings')
      .upsert(rows, { onConflict: 'fingerprint', ignoreDuplicates: false });
    if (error) console.error('Supabase middles upsert error:', error);
  }

  if (scanHealthy && rows.length > 0) {
    await supabase
      .from('middle_sightings')
      .delete()
      .lt('last_seen_at', new Date(Date.now() - 60_000).toISOString());
  }

  const elapsed = Date.now() - startedAt;
  return Response.json({
    ok: true,
    scanned: eventCount,
    found: middles.length,
    written: rows.length,
    elapsedMs: elapsed,
    scanHealthy,
    stalePruned: scanHealthy && rows.length > 0,
  }, { headers: { 'Cache-Control': 'no-store' } });
}
