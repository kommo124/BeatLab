import { drizzle } from "drizzle-orm/bun-sqlite";
import { Database } from "bun:sqlite";
import { mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import * as schema from "./schema.js";

const DB_PATH = process.env.DB_PATH ?? join(import.meta.dir, "..", "..", "beatlab.db");

mkdirSync(dirname(DB_PATH), { recursive: true });

const sqlite = new Database(DB_PATH, { create: true });

sqlite.exec("PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON;");

export const db = drizzle(sqlite, { schema });
