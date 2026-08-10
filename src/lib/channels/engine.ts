import {
  applyImportedReservations,
  getChannel,
  listChannels,
  recordSync,
  setChannelStatus,
  type Channel,
} from "../repo/channels";
import { addDays, getBusyPeriods, getCalendar, today } from "../repo/availability";
import { getAdapter } from "./registry";
import { ChannelError, type ChannelContext } from "./types";

/**
 * Runs the actual synchronisation.
 *
 * Two rules shape everything here:
 *
 * 1. **Import before export.** A channel's own reservations must land in our
 *    calendar before we tell anyone what is free, otherwise the first push
 *    after an inbound booking re-opens a room that was just sold.
 * 2. **Never let one channel break another.** Every step is wrapped, logged
 *    and isolated; a dead feed marks its own channel as failing and the run
 *    continues.
 *
 * The horizon is deliberately finite. Channels do not want an infinite
 * calendar and pushing one is how rate limits get hit.
 */

/** How far ahead we publish availability. Eighteen months covers OTA windows. */
const HORIZON_DAYS = 540;
/** How far back to ask for changes, covering a missed run or two. */
const LOOKBACK_DAYS = 7;

export type ChannelSyncOutcome = {
  channelId: string;
  channelName: string;
  ok: boolean;
  imported: number;
  cancelled: number;
  pushed: number;
  message: string;
};

function describe(error: unknown): string {
  if (error instanceof ChannelError) {
    return error.detail ? `${error.message} (${error.detail})` : error.message;
  }
  return error instanceof Error ? error.message : String(error);
}

function contextFor(channel: Awaited<ReturnType<typeof getChannel>>): ChannelContext {
  if (!channel) throw new Error("Channel not found");
  return {
    channelId: channel.id,
    credentials: channel.credentials,
    settings: channel.settings,
    roomMap: channel.roomMap,
  };
}

/** Credential check from the admin. Updates status but imports nothing. */
export async function testChannel(channelId: string): Promise<{ ok: boolean; message: string }> {
  const started = Date.now();
  const channel = await getChannel(channelId);
  if (!channel) return { ok: false, message: "Canal não encontrado." };

  try {
    const result = await getAdapter(channel.provider).test(contextFor(channel));
    await setChannelStatus(channelId, "ok");
    await recordSync({
      channelId,
      direction: "in",
      action: "test",
      status: "ok",
      items: result.items,
      message: result.message,
      durationMs: Date.now() - started,
    });
    return { ok: true, message: result.message };
  } catch (error) {
    const message = describe(error);
    await setChannelStatus(channelId, "error", message);
    await recordSync({
      channelId,
      direction: "in",
      action: "test",
      status: "error",
      message,
      durationMs: Date.now() - started,
    });
    return { ok: false, message };
  }
}

/** Full round trip for one channel: pull reservations, then push availability. */
export async function syncChannel(channelId: string): Promise<ChannelSyncOutcome> {
  const channel = await getChannel(channelId);
  if (!channel) {
    return {
      channelId,
      channelName: channelId,
      ok: false,
      imported: 0,
      cancelled: 0,
      pushed: 0,
      message: "Canal não encontrado.",
    };
  }

  const adapter = getAdapter(channel.provider);
  const ctx = contextFor(channel);
  const outcome: ChannelSyncOutcome = {
    channelId,
    channelName: channel.name,
    ok: true,
    imported: 0,
    cancelled: 0,
    pushed: 0,
    message: "",
  };
  const notes: string[] = [];

  // --- inbound ---
  if (adapter.pullReservations) {
    const started = Date.now();
    try {
      const since = addDays(today(), -LOOKBACK_DAYS);
      const reservations = await adapter.pullReservations(ctx, since);
      const applied = await applyImportedReservations(channelId, reservations);
      outcome.imported = applied.created;
      outcome.cancelled = applied.cancelled;

      const message =
        `${applied.created} novas, ${applied.updated} atualizadas, ` +
        `${applied.cancelled} canceladas.`;
      notes.push(message);
      await recordSync({
        channelId,
        direction: "in",
        action: "pull-reservations",
        status: "ok",
        items: reservations.length,
        message,
        durationMs: Date.now() - started,
      });
    } catch (error) {
      outcome.ok = false;
      const message = describe(error);
      notes.push(`Importação falhou: ${message}`);
      await recordSync({
        channelId,
        direction: "in",
        action: "pull-reservations",
        status: "error",
        message,
        durationMs: Date.now() - started,
      });
    }
  }

  // --- outbound ---
  // Skipped when the import failed: publishing availability computed from a
  // calendar we know is stale is exactly how a room gets sold twice.
  if (adapter.pushAvailability && outcome.ok) {
    const started = Date.now();
    try {
      const from = today();
      const to = addDays(from, HORIZON_DAYS);
      const days = await getCalendar(null, from, to);
      const relevant = days.filter((d) => channel.roomMap[d.roomId]);
      const busy = await getBusyPeriods(null, from, to);

      const result = await adapter.pushAvailability(ctx, relevant, busy);
      outcome.pushed = result.items;
      notes.push(result.message);
      await recordSync({
        channelId,
        direction: "out",
        action: "push-availability",
        status: "ok",
        items: result.items,
        message: result.message,
        durationMs: Date.now() - started,
      });
    } catch (error) {
      outcome.ok = false;
      const message = describe(error);
      notes.push(`Envio falhou: ${message}`);
      await recordSync({
        channelId,
        direction: "out",
        action: "push-availability",
        status: "error",
        message,
        durationMs: Date.now() - started,
      });
    }
  } else if (adapter.pushAvailability && !outcome.ok) {
    notes.push("Envio ignorado porque a importação falhou.");
    await recordSync({
      channelId,
      direction: "out",
      action: "push-availability",
      status: "skipped",
      message: "Importação falhou; disponibilidade não enviada para evitar overbooking.",
    });
  }

  outcome.message = notes.join(" · ");
  await setChannelStatus(channelId, outcome.ok ? "ok" : "error", outcome.ok ? "" : outcome.message);
  return outcome;
}

/** Sequential on purpose: OTA endpoints rate-limit aggressively. */
export async function syncAllChannels(): Promise<ChannelSyncOutcome[]> {
  const channels = await listChannels();
  const active = channels.filter((c: Channel) => c.enabled);
  const outcomes: ChannelSyncOutcome[] = [];
  for (const channel of active) outcomes.push(await syncChannel(channel.id));
  return outcomes;
}
