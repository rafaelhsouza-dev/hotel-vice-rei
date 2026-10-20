/**
 * Runs once when a server instance boots — before the first request is served.
 * Creates the schema and seed content so a fresh EasyPanel deploy comes up
 * with a working database without any manual step, then starts the
 * background jobs (payment expiry, reminders, SIBA, channel sync).
 */
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;

  const { ensureDatabase } = await import("./lib/migrate");
  const ready = await ensureDatabase();
  if (ready) {
    const { startScheduler } = await import("./lib/jobs");
    startScheduler();
  }
}
