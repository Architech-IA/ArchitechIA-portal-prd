// =============================================================================
// EAIH — Metrics API Endpoint
// GET /api/metrics — Métricas básicas de la aplicación (Prometheus-compatible)
// =============================================================================

import { NextResponse } from "next/server";

export async function GET() {
  const mem = process.memoryUsage();
  const cpu = process.cpuUsage();

  // Formato Prometheus-compatible (text/plain)
  const metrics = `
# HELP eaih_uptime_seconds Seconds since the process started
# TYPE eaih_uptime_seconds gauge
eaih_uptime_seconds ${process.uptime().toFixed(2)}

# HELP eaih_memory_rss_bytes Resident Set Size in bytes
# TYPE eaih_memory_rss_bytes gauge
eaih_memory_rss_bytes ${mem.rss}

# HELP eaih_memory_heap_used_bytes Heap used in bytes
# TYPE eaih_memory_heap_used_bytes gauge
eaih_memory_heap_used_bytes ${mem.heapUsed}

# HELP eaih_memory_heap_total_bytes Heap total in bytes
# TYPE eaih_memory_heap_total_bytes gauge
eaih_memory_heap_total_bytes ${mem.heapTotal}

# HELP eaih_memory_external_bytes External memory in bytes
# TYPE eaih_memory_external_bytes gauge
eaih_memory_external_bytes ${mem.external}

# HELP eaih_cpu_user_seconds CPU user time in microseconds
# TYPE eaih_cpu_user_seconds gauge
eaih_cpu_user_seconds ${cpu.user}

# HELP eaih_cpu_system_seconds CPU system time in microseconds
# TYPE eaih_cpu_system_seconds gauge
eaih_cpu_system_seconds ${cpu.system}

# HELP eaih_nodejs_version Node.js version
# TYPE eaih_nodejs_version gauge
eaih_nodejs_version{version="${process.version}"} 1

# HELP eaih_env Environment identifier
# TYPE eaih_env gauge
eaih_env{env="${process.env.EAIH_ENV || "unknown"}"} 1
`.trim();

  return new NextResponse(metrics, {
    status: 200,
    headers: {
      "Content-Type": "text/plain; version=0.0.4; charset=utf-8",
    },
  });
}
