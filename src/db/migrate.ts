import type { PgliteDatabase } from 'drizzle-orm/pglite';
import { migrate as migratePglite } from 'drizzle-orm/pglite/migrator';
import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import { migrate as migratePostgres } from 'drizzle-orm/postgres-js/migrator';
import { closeDb, db, dbKind, type schema } from './index';

const migrationsFolder = './drizzle';

async function main() {
  if (dbKind === 'postgres') {
    await migratePostgres(db as PostgresJsDatabase<typeof schema>, { migrationsFolder });
  } else {
    await migratePglite(db as PgliteDatabase<typeof schema>, { migrationsFolder });
  }
  console.log(`Migrations applied (${dbKind}).`);
  await closeDb();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
