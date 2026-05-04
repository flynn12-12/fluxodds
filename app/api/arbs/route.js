// app/api/arbs/route.js
//
// Public endpoint your dashboard polls. Reads from the Supabase cache.
// If the cache is empty or stale (>90s since last scan), runs a live scan
// inline so arbs work even when Vercel cron isn't firing (Hobby plan = daily).

import { createClient } from '@supabase/supabase-js';
import { scanAllLeagues } from '@/lib/arbScanner';

export const dynamic = 'force-dynamic';
export const maxDuration = 30;

const STALE_THRESHOLD_MS = 90_000;

async function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key, { auth: { persistSession: false } });
}

async function readCache(supabase) {
  const { data, error } = await supabase
    .from('arb_sightings')
    .select('payload, first_seen_at, last_seen_at, profit')
    .order('profit', { ascending: false })
    .limit(200);
  if (error) throw error;
  return data || [];
}

function formatRows(data) {
  const now = Date.now();
  return data.map((row) => {
    const firstSeen = new Date(row.first_seen_at).getTime();
    const lastSeen = new Date(row.last_seen_at).getTime();
    return {
      ...row.payload,
      age: Math.max(0, Math.floor((now - firstSeen) / 1000)),
      staleness: Math.max(0, Math.floor((now - lastSeen) / 1000)),
      firstSeenAt: row.first_seen_at,
    };
  });
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
  if (!apiKey) return null;

  try {
    const { arbs, scanHealthy } = await scanAllLeagues(apiKey);
    const now = new Date().toISOString();

    if (arbs.length > 0) {
      const rows = arbs.map((arb) => ({
        fingerprint: arb.fingerprint,
        payload: arb,
        profit: arb.profit,
        last_seen_at: now,
      }));
      await supabase
        .from('arb_sightings')
        .upsert(rows, { onConflict: 'fingerprint', ignoreDuplicates: false });

      if (scanHealthy) {
        await supabase
          .from('arb_sightings')
          .delete()
          .lt('last_seen_at', new Date(Date.now() - 30_000).toISOString());
      }
    }

    return arbs;
  } catch (e) {
    console.error('inline arb scan failed:', e);
    return null;
  }
}

export async function GET() {
  try {
    const supabase = await getSupabase();
    if (!supabase) {
      return Response.json(
        { error: 'Supabase not configured', arbs: [], total: 0 },
        { status: 500, headers: { 'Cache-Control': 'no-store' } }
      );
    }

    let data = await readCache(supabase);

    if (cacheIsStale(data)) {
      const liveArbs = await inlineScan(supabase);
      if (liveArbs !== null) {
        data = await readCache(supabase);
      }
    }

    const arbs = formatRows(data);

    return Response.json(
      { arbs, total: arbs.length, eventCount: null },
      { headers: { 'Cache-Control': 'no-store' } }
    );
  } catch (err) {
    console.error('arbs route failed:', err);
    return Response.json(
      { error: 'Failed to load arbs', detail: String(err?.message || err) },
      { status: 500 }
    );
  }
}