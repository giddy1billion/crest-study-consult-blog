/**
 * Crest Study Consult Database Client
 * 
 * Singleton Prisma client with connection pooling awareness.
 * Uses PgBouncer/Supabase pooler for crawl-safe concurrency.
 */

import { PrismaClient } from "@prisma/client";

declare global {
  // eslint-disable-next-line no-var
  var __db: PrismaClient | undefined;
}

function createClient(): PrismaClient {
  const client = new PrismaClient({
    log: process.env.NODE_ENV === "development" 
      ? ["query", "error", "warn"] 
      : ["error"],
  });
  
  return client;
}

// In development, reuse the client across hot reloads
// In production, create a single instance
export const db = global.__db ?? createClient();

if (process.env.NODE_ENV !== "production") {
  global.__db = db;
}

// Re-export helpers for backward compatibility (use ~/utils/helpers directly for client-safe imports)
export { calculateReadingTime, generateSlug, isValidSlug } from "./helpers";
