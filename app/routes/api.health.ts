import type { Route } from "./+types/api.health";
import { db } from "~/utils/db.server";

/**
 * Health Check API Endpoint
 * GET /api/health
 * 
 * Returns the health status of the server and database connection.
 * Used by load balancers, monitoring tools, and deployment platforms.
 */
export async function loader({}: Route.LoaderArgs) {
  const health: {
    status: "healthy" | "unhealthy";
    timestamp: string;
    uptime: number;
    checks: {
      server: { status: "up" | "down" };
      database: { status: "up" | "down"; latency?: number; error?: string };
    };
  } = {
    status: "healthy",
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    checks: {
      server: { status: "up" },
      database: { status: "down" },
    },
  };

  // Check database connectivity
  try {
    const start = Date.now();
    await db.$queryRaw`SELECT 1`;
    const latency = Date.now() - start;
    
    health.checks.database = {
      status: "up",
      latency,
    };
  } catch (error) {
    health.status = "unhealthy";
    health.checks.database = {
      status: "down",
      error: error instanceof Error ? error.message : "Unknown database error",
    };
  }

  const statusCode = health.status === "healthy" ? 200 : 503;

  return new Response(JSON.stringify(health), {
    status: statusCode,
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "no-cache, no-store, must-revalidate",
    },
  });
}
