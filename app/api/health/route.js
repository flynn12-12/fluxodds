import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';

export async function GET() {
  const checks = {
    env: {
      SPORTSGAMEODDS_API_KEY: !!process.env.SPORTSGAMEODDS_API_KEY,
      CRON_SECRET: !!process.env.CRON_SECRET,
      NEXT_PUBLIC_SUPABASE_URL: !!process.env.NEXT_PUBLIC_SUPABASE_URL,
      SUPABASE_SERVICE_ROLE_KEY: !!process.env.SUPABASE_SERVICE_ROLE_KEY,
    },
    tables: {},
  };

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (supabaseUrl && serviceKey) {
    const supabase = createClient(supabaseUrl, serviceKey, {
      auth: { persistSession: false },
    });

    const tables = ['arb_sightings', 'live_arb_sightings', 'ev_sightings', 'middle_sightings'];

    for (const table of tables) {
      try {
        const { count, error } = await supabase
          .from(table)
          .select('*', { count: 'exact', head: true });
        if (error) {
          checks.tables[table] = { error: error.message };
        } else {
          checks.tables[table] = { rows: count };

          const { data: newest } = await supabase
            .from(table)
            .select('last_seen_at')
            .order('last_seen_at', { ascending: false })
            .limit(1);
          if (newest?.[0]?.last_seen_at) {
            const ageSec = Math.floor((Date.now() - new Date(newest[0].last_seen_at).getTime()) / 1000);
            checks.tables[table].newestAgeSec = ageSec;
            checks.tables[table].lastSeen = newest[0].last_seen_at;
          }
        }
      } catch (e) {
        checks.tables[table] = { error: e.message };
      }
    }
  }

  const allEnvOk = Object.values(checks.env).every(Boolean);
  const hasArbs = checks.tables.arb_sightings?.rows > 0;

  checks.summary = {
    allEnvConfigured: allEnvOk,
    hasArbsInCache: hasArbs,
    diagnosis: !allEnvOk
      ? 'Missing environment variables — check Vercel env config'
      : !hasArbs
        ? 'No arbs in Supabase cache — cron may not be running or scanner finds zero arbs'
        : 'Backend looks healthy — if dashboard is empty, check client-side book filters',
  };

  return Response.json(checks, { headers: { 'Cache-Control': 'no-store' } });
}
