import { db } from "./index.js";
import { users } from "./schema.js";
import { eq } from "drizzle-orm";
import type { NewUser, User } from "./schema.js";

/** Find a user by their Telegram id. */
export async function findUser(telegramId: number): Promise<User | undefined> {
  const rows = await db.select().from(users).where(eq(users.telegramId, telegramId)).limit(1);
  return rows[0];
}

/** Insert a user if it does not exist yet; returns the stored record. */
export async function upsertUser(data: NewUser): Promise<User> {
  const existing = await findUser(data.telegramId);
  if (existing) return existing;

  const inserted = await db.insert(users).values(data).returning();
  return inserted[0]!;
}
