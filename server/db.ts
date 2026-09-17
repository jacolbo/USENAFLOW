import { Pool as NeonPool, neonConfig } from '@neondatabase/serverless';
import { drizzle as drizzleNeon } from 'drizzle-orm/neon-serverless';
// pg is CommonJS, so a named ESM import compiles but fails at runtime.
import pg from 'pg';
import { drizzle as drizzleNode } from 'drizzle-orm/node-postgres';
import ws from "ws";
import * as schema from "@shared/schema";

neonConfig.webSocketConstructor = ws;

if (!process.env.DATABASE_URL) {
  throw new Error(
    "DATABASE_URL must be set. Did you forget to provision a database?",
  );
}

/**
 * Neon in production; plain Postgres when pointed at a local one.
 *
 * The Neon driver speaks the Postgres protocol over a WebSocket to Neon's own
 * proxy, so it cannot talk to a Postgres running on localhost at all. That made
 * it impossible to run this app against a local database — which is exactly
 * what you want for testing a change before it reaches a client.
 *
 * The default is unchanged: anything that is not an explicit localhost URL
 * still goes through Neon, so nothing about the deployed path moves. Set
 * DATABASE_DRIVER=pg to force the plain driver for any other host.
 */
const url = process.env.DATABASE_URL;
const isLocal = /@(localhost|127\.0\.0\.1|\[::1\])[:/]/.test(url);
const usePlainPostgres = process.env.DATABASE_DRIVER === "pg" || isLocal;

export const pool = usePlainPostgres
  ? new pg.Pool({ connectionString: url })
  : new NeonPool({ connectionString: url });

export const db = usePlainPostgres
  ? drizzleNode({ client: pool as pg.Pool, schema })
  : drizzleNeon({ client: pool as NeonPool, schema });
