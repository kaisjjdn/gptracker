import { mkdirSync } from 'node:fs';
import { PGlite } from '@electric-sql/pglite';
import type { PgDatabase, PgQueryResultHKT } from 'drizzle-orm/pg-core';
import { drizzle as drizzlePglite } from 'drizzle-orm/pglite';
import { drizzle as drizzlePostgres } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema';

export type Db = PgDatabase<PgQueryResultHKT, typeof schema>;

type Connection = {
  db: Db;
  kind: 'postgres' | 'pglite';
  close: () => Promise<void>;
};

// With DATABASE_URL set, connect to that Postgres. Without it, use an embedded
// Postgres (PGlite) stored in .data/pglite so local development needs no setup.
function connect(): Connection {
  const url = process.env.DATABASE_URL;
  if (url) {
    // prepare:false suits connection poolers (Supabase, Neon); a small pool
    // keeps many short-lived server instances from using up the database's connections.
    const client = postgres(url, { prepare: false, max: 3, idle_timeout: 20 });
    return {
      db: drizzlePostgres(client, { schema }),
      kind: 'postgres',
      close: () => client.end(),
    };
  }
  if (process.env.VERCEL || process.env.CI) {
    // The embedded database lives on local disk, which hosted runs throw away.
    throw new Error('DATABASE_URL is not set. Hosted runs need a real Postgres database.');
  }
  mkdirSync('.data', { recursive: true });
  const client = new PGlite('.data/pglite');
  return {
    db: drizzlePglite(client, { schema }),
    kind: 'pglite',
    close: () => client.close(),
  };
}

// Reuse one connection across Next.js dev hot reloads.
const globalRef = globalThis as unknown as { __gptrackerDb?: Connection };
const connection = (globalRef.__gptrackerDb ??= connect());

export const db = connection.db;
export const dbKind = connection.kind;
export const closeDb = connection.close;
export { schema };
