import { createBot } from "./bot.js";

async function main() {
  const bot = createBot();

  const me = await bot.init();
  console.log(`🤖 @{me.username} is running (BeatLab)`);

  // Long polling — no webhook setup needed while developing.
  await bot.start({
    onStart: () => console.log("✅ Bot started, polling for updates..."),
  });
}

main().catch((err) => {
  console.error("❌ Failed to start bot:", err);
  process.exit(1);
});
