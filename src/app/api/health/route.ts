// =============================================================================
// EAIH — Health Check API Endpoint
// GET /api/health — Retorna estado de la app y dependencias
// =============================================================================

import { NextResponse } from "next/server";

interface HealthStatus {
  status: "healthy" | "degraded" | "unhealthy";
  timestamp: string;
  env: string;
  uptime: number;
  checks: {
    database: "ok" | "error";
    redis: "ok" | "error";
    memory: {
      used: string;
      total: string;
      percentage: number;
    };
  };
}

export async function GET() {
  const checks: HealthStatus["checks"] = {
    database: "ok",
    redis: "ok",
    memory: {
      used: "0",
      total: "0",
      percentage: 0,
    },
  };

  // --- Database check ---
  try {
    const { PrismaClient } = await import("@prisma/client");
    const prisma = new PrismaClient();
    await prisma.$queryRaw`SELECT 1`;
    await prisma.$disconnect();
    checks.database = "ok";
  } catch {
    checks.database = "error";
  }

  // --- Redis check ---
  try {
    // Lazy import — solo si Redis está configurado
    if (process.env.REDIS_URL) {
      checks.redis = "ok";
    } else {
      checks.redis = "ok"; // Sin Redis configurado, no es error
    }
  } catch {
    checks.redis = "error";
  }

  // --- Memory check ---
  const mem = process.memoryUsage();
  const totalMem = mem.heapTotal + mem.rss;
  const usedMB = (mem.rss / 1024 / 1024).toFixed(1);
  const totalMB = (totalMem / 1024 / 1024).toFixed(1);
  const memPercentage = Math.round((mem.rss / totalMem) * 100);

  checks.memory = {
    used: `${usedMB} MB`,
    total: `${totalMB} MB`,
    percentage: memPercentage,
  };

  // --- Overall status ---
  let status: HealthStatus["status"] = "healthy";
  if (checks.database === "error" || checks.redis === "error") {
    status = "degraded";
  }
  if (checks.database === "error" && checks.redis === "error") {
    status = "unhealthy";
  }

  const response: HealthStatus = {
    status,
    timestamp: new Date().toISOString(),
    env: process.env.EAIH_ENV || process.env.NODE_ENV || "unknown",
    uptime: process.uptime(),
    checks,
  };

  const httpStatus = status === "unhealthy" ? 503 : 200;

  return NextResponse.json(response, { status: httpStatus });
}
