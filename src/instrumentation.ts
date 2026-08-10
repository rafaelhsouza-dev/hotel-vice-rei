/**
 * Runs once when a server instance boots — before the first request is served.
 * Used to create the schema and seed content so a fresh EasyPanel deploy comes
 * up with a working database without any manual step.
 */
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;

  const { ensureDatabase } = await import("./lib/migrate");
  await ensureDatabase();
}
