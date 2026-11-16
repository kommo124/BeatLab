import { z } from "zod";

const envSchema = z.object({
  BOT_TOKEN: z.string().min(1, "BOT_TOKEN is required"),
  WEB_APP_URL: z
    .string()
    .url("WEB_APP_URL must be a valid URL")
    .default("https://example.com"),
  BOT_USERNAME: z.string().optional().default(""),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error("❌ Invalid environment configuration:");
  for (const issue of parsed.error.issues) {
    console.error(`   • ${issue.path.join(".")}: ${issue.message}`);
  }
  process.exit(1);
}

export const config = {
  ...parsed.data,
  /**
   * The tunnel URL changes at runtime (domain rotation) — re-read
   * process.env on every access so the button never bakes a dead address.
   */
  get WEB_APP_URL(): string {
    return process.env.WEB_APP_URL ?? parsed.data.WEB_APP_URL;
  },
};
