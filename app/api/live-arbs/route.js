// app/api/live-arbs/route.js
// Public endpoint — dashboard polls this every 1s for live arbs.

import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';

export async function GET() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceKey) {
    return Response.json({ arbs: [], error: 'supabase env missing' }, { status: 500 });
  }

  const supabase = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });

  const { data, error } = await supabase
    .from('live_arb_sightings')
    .select('payload, first_seen_at, last_seen_at, profit')
    .order('profit', { ascending: false })
    .limit(300);

  if (error) {
    console.error('Failed to load live_arb_sightings:', error);
    return Response.json({ arbs: [], error: error.message }, { status: 500 });
  }

  const arbs = (data || []).map((row) => ({
    ...row.payload,
    firstSeenAt: row.first_seen_at,
    lastSeenAt: row.last_seen_at,
  }));

  return Response.json({ arbs, count: arbs.length }, {
    headers: { 'Cache-Control': 'no-store' },
  });
}