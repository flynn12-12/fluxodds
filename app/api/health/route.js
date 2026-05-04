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
    sgoTest: null,
  };

  const apiKey = process.env.SPORTSGAMEODDS_API_KEY;
  if (apiKey) {
    try {
      const res = await fetch(
        'https://api.sportsgameodds.com/v2/events?leagueID=MLB&finalized=false&oddsAvailable=true&limit=1',
        { headers: { 'x-api-key': apiKey }, cache: 'no-store' }
      );
      if (res.ok) {
        const json = await res.json();
        checks.sgoTest = {
          ok: true,
          status: res.status,
          eventsReturned: Array.isArray(json?.data) ? json.data.length : 0,
        };
      } else {
        checks.sgoTest = { ok: false, status: res.status, statusText: res.statusText };
      }
    } catch (e) {
      checks.sgoTest = { ok: false, error: e.message };
    }
  }

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
  const sgoWorks = checks.sgoTest?.ok === true;
  const hasArbs = checks.tables.arb_sightings?.rows > 0;
  const tablesExist = !checks.tables.arb_sightings?.error?.includes('does not exist');

  const issues = [];
  if (!checks.env.SPORTSGAMEODDS_API_KEY) issues.push('SPORTSGAMEODDS_API_KEY not set in Vercel env vars');
  if (!checks.env.CRON_SECRET) issues.push('CRON_SECRET not set — Vercel cron cannot authenticate');
  if (!checks.env.NEXT_PUBLIC_SUPABASE_URL) issues.push('NEXT_PUBLIC_SUPABASE_URL not set');
  if (!checks.env.SUPABASE_SERVICE_ROLE_KEY) issues.push('SUPABASE_SERVICE_ROLE_KEY not set');
  if (checks.env.SPORTSGAMEODDS_API_KEY && !sgoWorks) issues.push('SGO API key is set but API call failed — key may be invalid or expired');
  if (!tablesExist) issues.push('Supabase tables do not exist — run the schema SQL to create arb_sightings, ev_sightings, etc.');
  if (allEnvOk && sgoWorks && tablesExist && !hasArbs) issues.push('All config looks good but no arbs in cache — the inline scan fallback should populate on next dashboard load (wait ~15s)');
  if (allEnvOk && sgoWorks && hasArbs) issues.push('Backend is healthy with arbs in cache — if dashboard is empty, check your browser sportsbook filters (open Books panel → Enable all)');

  checks.summary = {
    allEnvConfigured: allEnvOk,
    sgoApiWorking: sgoWorks,
    hasArbsInCache: hasArbs,
    tablesExist,
    issues,
    note: 'Vercel Hobby plan limits crons to once/day. The dashboard now auto-scans when cache is stale, so crons are optional.',
  };

  return Response.json(checks, { headers: { 'Cache-Control': 'no-store' } });
}
