/**
 * Minimal SQL migration runner.
 * Statements live in src/db/migrations/*.sql and run once,
 * tracked in the `migrations` table.
 */
import { db } from "./index.js";
import { sql } from "drizzle-orm";

async function main() {
  db.run(sql`
    CREATE TABLE IF NOT EXISTS migrations (
      name TEXT PRIMARY KEY,
      applied_at INTEGER NOT NULL
    );
  `);

  const applied = new Set(
    db
      .all<{ name: string }>(sql`SELECT name FROM migrations`)
      .map((row) => row.name),
  );

  const files = new Bun.Glob("*.sql");
  const dir = import.meta.dir + "/migrations";
  const names = (await Array.fromAsync(files.scan({ cwd: dir }))).sort();

  for (const name of names) {
    if (applied.has(name)) continue;

    const body = await Bun.file(`${dir}/${name}`).text();
    db.run(sql.raw(body));
    db.run(
      sql`INSERT INTO migrations (name, applied_at) VALUES (${name}, ${Date.now()})`,
    );
    console.log(`✅ applied migration: ${name}`);
  }

  console.log("Database is up to date.");
}

main().catch((err) => {
  console.error("Migration failed:", err);
  process.exit(1);
});
