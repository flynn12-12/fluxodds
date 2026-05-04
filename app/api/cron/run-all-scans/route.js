// app/api/cron/run-all-scans/route.js
//
// Runs prematch arbs, live arbs, EV, and middles one after another so we never
// burst 4×7 parallel SportsGameOdds requests (which triggers 429 rate limits).

import { CRON_CHAIN_HEADER } from '@/lib/cronChildAuth';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

function unauthorized(msg = 'unauthorized') {
  return Response.json({ error: msg }, { status: 401 });
}

export async function GET(request) {
  const authHeader = request.headers.get('authorization') || '';
  const url = new URL(request.url);
  const querySecret = url.searchParams.get('secret');
  const secret = process.env.CRON_SECRET;

  if (!secret) return unauthorized('CRON_SECRET not configured');
  const ok = authHeader === `Bearer ${secret}` || querySecret === secret;
  if (!ok) return unauthorized();

  const configuredBase = process.env.PUBLIC_BASE_URL;
  const proto = request.headers.get('x-forwarded-proto') || 'https';
  const host = request.headers.get('host');
  const fallbackOrigin = host ? `${proto}://${host}` : null;
  const origin = configuredBase || fallbackOrigin;
  if (!origin) {
    return Response.json({ error: 'no base URL available' }, { status: 400 });
  }
  const chainHeaders = {
    Authorization: `Bearer ${secret}`,
    [CRON_CHAIN_HEADER]: secret,
  };

  const paths = ['/api/cron/scan', '/api/cron/scan-live', '/api/cron/scan-ev', '/api/cron/scan-middles'];
  const results = [];
  const startedAt = Date.now();

  for (const path of paths) {
    const t0 = Date.now();
    try {
      const res = await fetch(`${origin}${path}`, {
        headers: chainHeaders,
        cache: 'no-store',
      });
      let body = null;
      try {
        body = await res.json();
      } catch {
        body = { parseError: true };
      }
      results.push({
        path,
        status: res.status,
        durationMs: Date.now() - t0,
        body,
      });
    } catch (e) {
      results.push({
        path,
        error: String(e?.message || e),
        durationMs: Date.now() - t0,
      });
    }
  }

  return Response.json(
    {
      ok: true,
      totalDurationMs: Date.now() - startedAt,
      steps: results,
    },
    { headers: { 'Cache-Control': 'no-store' } }
  );
}
