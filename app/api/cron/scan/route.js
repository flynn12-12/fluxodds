// app/api/cron/scan/route.js
//
// Scans SportsGameOdds and upserts current arbs to Supabase.
// Triggered by Vercel Cron and/or Supabase pg_cron.
// Protected by CRON_SECRET so randos can't burn your quota.

import { createClient } from '@supabase/supabase-js';
import { scanAllLeagues } from '@/lib/arbScanner';
import { assertProductionCronChild } from '@/lib/cronChildAuth';

// How long an arb can be missing from a scan before we evict it.
// 30s gives us breathing room for transient SGO blips.
const STALE_AFTER_MS = 30_000;

export const dynamic = 'force-dynamic';
export const maxDuration = 30;

function unauthorized(msg = 'unauthorized') {
  return Response.json({ error: msg }, { status: 401 });
}

export async function GET(request) {
  // Auth: accept either Vercel Cron's bearer token or our manual ?secret= for testing
  const authHeader = request.headers.get('authorization') || '';
  const url = new URL(request.url);
  const querySecret = url.searchParams.get('secret');
  const secret = process.env.CRON_SECRET;

  if (process.env.NODE_ENV !== 'development') {
    if (!secret) return unauthorized('CRON_SECRET not configured');
    const ok = authHeader === `Bearer ${secret}` || querySecret === secret;
    if (!ok) return unauthorized();
  }

  const chainBlock = assertProductionCronChild(request);
  if (chainBlock) return chainBlock;

  const apiKey = process.env.SPORTSGAMEODDS_API_KEY;
  if (!apiKey) {
    return Response.json({ error: 'SPORTSGAMEODDS_API_KEY not configured' }, { status: 500 });
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { persistSession: false } }
  );

  const startedAt = Date.now();

  try {
    const { arbs, eventCount, scanHealthy, leaguesOk, leaguesAttempted } =
      await scanAllLeagues(apiKey);
    const now = new Date().toISOString();

    if (arbs.length > 0) {
      // Upsert: insert new arbs, update last_seen_at on existing ones.
      // We don't touch first_seen_at on conflict — that's the whole point of
      // age tracking. Postgres `on conflict do update` only sets specified cols.
      const rows = arbs.map((arb) => ({
        fingerprint: arb.fingerprint,
        payload: arb,
        profit: arb.profit,
        last_seen_at: now,
      }));

      const { error: upsertErr } = await supabase
        .from('arb_sightings')
        .upsert(rows, {
          onConflict: 'fingerprint',
          // first_seen_at has a default of now() so new rows get it automatically;
          // existing rows keep their original first_seen_at because we don't list it here.
          ignoreDuplicates: false,
        });

      if (upsertErr) throw upsertErr;
    }

    // Only evict when every league fetch succeeded AND we saw at least one arb this
    // run. If the scan is "healthy" but returns zero rows, we did not upsert anything
    // — every cached row still has an old last_seen_at, so a time-based delete would
    // wipe the entire table (e.g. cron interval > STALE_AFTER_MS).
    if (scanHealthy && arbs.length > 0) {
      const staleCutoff = new Date(Date.now() - STALE_AFTER_MS).toISOString();
      const { error: deleteErr } = await supabase
        .from('arb_sightings')
        .delete()
        .lt('last_seen_at', staleCutoff);
      if (deleteErr) throw deleteErr;
    }

    return Response.json({
      ok: true,
      scanned: eventCount,
      arbsFound: arbs.length,
      scanHealthy,
      leaguesOk,
      leaguesAttempted,
      stalePruned: scanHealthy,
      durationMs: Date.now() - startedAt,
    });
  } catch (err) {
    console.error('cron scan failed:', err);
    return Response.json(
      { ok: false, error: String(err?.message || err), durationMs: Date.now() - startedAt },
      { status: 500 }
    );
  }
}