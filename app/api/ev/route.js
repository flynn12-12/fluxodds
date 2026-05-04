// app/api/ev/route.js
//
// Public endpoint: returns cached EV bets from Supabase.
// Falls back to an inline scan if the cache is empty/stale.

import { createClient } from '@supabase/supabase-js';
import { scanAllLeaguesForEv } from '@/lib/evScanner';

export const dynamic = 'force-dynamic';
export const maxDuration = 30;

const STALE_THRESHOLD_MS = 90_000;

export async function GET() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceKey) {
    return Response.json({ evBets: [], error: 'supabase env missing' }, { status: 500 });
  }

  const supabase = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false },
  });

  let data = await fetchCache(supabase);

  if (cacheIsStale(data)) {
    await inlineScan(supabase);
    data = await fetchCache(supabase);
  }

  const evBets = (data || []).map((row) => ({
    ...row.payload,
    firstSeenAt: row.first_seen_at,
    lastSeenAt: row.last_seen_at,
  }));

  return Response.json({ evBets, count: evBets.length }, {
    headers: { 'Cache-Control': 'no-store' },
  });
}

async function fetchCache(supabase) {
  const { data, error } = await supabase
    .from('ev_sightings')
    .select('payload, first_seen_at, last_seen_at, ev')
    .order('ev', { ascending: false })
    .limit(300);
  if (error) {
    console.error('Failed to load ev_sightings:', error);
    return [];
  }
  return data || [];
}

function cacheIsStale(data) {
  if (!data || data.length === 0) return true;
  const newest = data.reduce((best, row) => {
    const t = new Date(row.last_seen_at).getTime();
    return t > best ? t : best;
  }, 0);
  return Date.now() - newest > STALE_THRESHOLD_MS;
}

async function inlineScan(supabase) {
  const apiKey = process.env.SPORTSGAMEODDS_API_KEY;
  if (!apiKey) return;
  try {
    const { evBets, scanHealthy } = await scanAllLeaguesForEv(apiKey);
    const now = new Date().toISOString();
    if (evBets.length > 0) {
      const rows = evBets.slice(0, 500).map((b) => ({
        fingerprint: b.fingerprint,
        payload: b,
        ev: b.ev,
        last_seen_at: now,
      }));
      await supabase
        .from('ev_sightings')
        .upsert(rows, { onConflict: 'fingerprint', ignoreDuplicates: false });
      if (scanHealthy) {
        await supabase
          .from('ev_sightings')
          .delete()
          .lt('last_seen_at', new Date(Date.now() - 60_000).toISOString());
      }
    }
  } catch (e) {
    console.error('inline EV scan failed:', e);
  }
}