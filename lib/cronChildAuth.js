import { timingSafeEqual } from 'node:crypto';

/** Header set only by `run-all-scans` when chaining to child cron routes. */
export const CRON_CHAIN_HEADER = 'x-fluxodds-cron-chain';

function timingSafeStringEqual(a, b) {
  try {
    const ba = Buffer.from(String(a), 'utf8');
    const bb = Buffer.from(String(b), 'utf8');
    if (ba.length !== bb.length) return false;
    return timingSafeEqual(ba, bb);
  } catch {
    return false;
  }
}

/**
 * In production, reject direct hits to /api/cron/scan* so duplicate schedulers
 * (e.g. Supabase pg_cron) cannot parallelize with Vercel and cause SGO 429s.
 * Set ALLOW_DIRECT_CRON_SCAN_PATHS=1 to allow direct calls (debug only).
 */
export function assertProductionCronChild(request) {
  if (process.env.ALLOW_DIRECT_CRON_SCAN_PATHS === '1') return null;
  if (process.env.VERCEL_ENV !== 'production') return null;

  const secret = process.env.CRON_SECRET;
  if (!secret) return null;

  const chain = request.headers.get(CRON_CHAIN_HEADER);
  if (!chain || !timingSafeStringEqual(chain.trim(), secret)) {
    return Response.json(
      {
        error: 'use_run_all_scans',
        message:
          'This URL is not callable directly in production. Use /api/cron/run-all-scans only. Remove duplicate jobs (Supabase pg_cron, extra Vercel crons) that still call this path. For temporary debugging, set ALLOW_DIRECT_CRON_SCAN_PATHS=1 in Vercel.',
      },
      { status: 403 }
    );
  }
  return null;
}
