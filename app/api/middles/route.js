// app/api/middles/route.js
//
// Public endpoint: returns cached middles from Supabase.
// Polled every 2s by the dashboard.

import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';

export async function GET() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceKey) {
    return Response.json({ middles: [], error: 'supabase env missing' }, { status: 500 });
  }

  const supabase = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false },
  });

  const { data, error } = await supabase
    .from('middle_sightings')
    .select('payload, first_seen_at, last_seen_at, gap')
    .order('gap', { ascending: false })
    .limit(300);

  if (error) {
    console.error('Failed to load middle_sightings:', error);
    return Response.json({ middles: [], error: error.message }, { status: 500 });
  }

  const middles = (data || []).map((row) => ({
    ...row.payload,
    firstSeenAt: row.first_seen_at,
    lastSeenAt: row.last_seen_at,
  }));

  return Response.json({ middles, count: middles.length }, {
    headers: { 'Cache-Control': 'no-store' },
  });
}
