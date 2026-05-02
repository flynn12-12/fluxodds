// app/api/arbs/route.js
//
// Public endpoint your dashboard polls. Reads from the Supabase cache —
// never hits SGO directly. Adds an `age` field (seconds the arb has been live)
// computed from first_seen_at.

import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY,
      { auth: { persistSession: false } }
    );

    const { data, error } = await supabase
      .from('arb_sightings')
      .select('payload, first_seen_at, last_seen_at, profit')
      .order('profit', { ascending: false })
      .limit(200);

    if (error) throw error;

    const now = Date.now();
    const arbs = (data || []).map((row) => {
      const firstSeen = new Date(row.first_seen_at).getTime();
      const lastSeen = new Date(row.last_seen_at).getTime();
      return {
        ...row.payload,
        age: Math.max(0, Math.floor((now - firstSeen) / 1000)),
        staleness: Math.max(0, Math.floor((now - lastSeen) / 1000)),
        firstSeenAt: row.first_seen_at,
      };
    });

    return Response.json(
      {
        arbs,
        total: arbs.length,
        // eventCount is informational — we don't store it in cache, so just
        // omit or read from a separate metadata table later if needed.
        eventCount: null,
      },
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