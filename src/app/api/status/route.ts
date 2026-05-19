export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';

const SERVICES = [
  { name: 'Vercel',  url: 'https://www.vercel-status.com/api/v2/status.json', type: 'json', field: 'status.indicator', ok: 'none' },
  { name: 'GitHub',  url: 'https://www.githubstatus.com/api/v2/status.json',   type: 'json', field: 'status.indicator', ok: 'none' },
  { name: 'Render',  url: 'https://status.render.com/api/v2/status.json',       type: 'json', field: 'status.indicator', ok: 'none' },
  { name: 'Supabase',url: 'https://status.supabase.com/api/v2/status.json',     type: 'json', field: 'status.indicator', ok: 'none' },
];

async function checkService(svc: typeof SERVICES[number]): Promise<{ name: string; status: 'ok' | 'degraded' | 'down'; latency: number }> {
  const start = Date.now();
  try {
    const res = await fetch(svc.url, { signal: AbortSignal.timeout(5000) });
    const latency = Date.now() - start;
    if (!res.ok) return { name: svc.name, status: 'down', latency };

    if (svc.type === 'json') {
      const data = await res.json();
      const keys = svc.field.split('.');
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      let val: any = data;
      for (const k of keys) val = val?.[k];
      const status = val === svc.ok ? 'ok' : val === 'major' ? 'down' : 'degraded';
      return { name: svc.name, status, latency };
    }

    return { name: svc.name, status: 'ok', latency };
  } catch {
    return { name: svc.name, status: 'down', latency: Date.now() - start };
  }
}

export async function GET() {
  const results = await Promise.all(SERVICES.map(checkService));
  return NextResponse.json(results);
}
