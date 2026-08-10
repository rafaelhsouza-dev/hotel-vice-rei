import { ChannelError, type ChannelAdapter, type ImportedReservation } from "../types";

/**
 * Beds24 API v2 — the realistic route to Booking.com, Airbnb, Expedia and
 * Vrbo for a property this size.
 *
 * Booking.com's own Connectivity API is open only to certified partners and
 * new registrations are closed; its free iCal fallback requires at most one
 * unit per room type, which a 55-unit hotel does not satisfy. A channel
 * manager sits in that gap: it holds the certified connections, and we hold a
 * single documented REST integration with it.
 *
 * Auth is a three-step ladder: an invite code (SETTINGS → ACCOUNT → ACCESS in
 * Beds24) is exchanged once for a long-lived refresh token, which mints
 * short-lived access tokens. We only ever persist the refresh token.
 *
 * @see https://beds24.com/api/v2/
 * @see https://wiki.beds24.com/index.php/Category:API_V2
 */

const BASE = "https://api.beds24.com/v2";
const TIMEOUT_MS = 20_000;

/** Access tokens live ~24h; cached per process and refreshed a minute early. */
const tokenCache = new Map<string, { token: string; expiresAt: number }>();

type Beds24Response<T> = {
  success?: boolean;
  data?: T;
  error?: string;
  errors?: { field?: string; message?: string }[];
};

async function call<T>(
  path: string,
  { headers = {}, method = "GET", body }: {
    headers?: Record<string, string>;
    method?: string;
    body?: unknown;
  } = {},
): Promise<Beds24Response<T>> {
  const response = await fetch(`${BASE}${path}`, {
    method,
    headers: {
      Accept: "application/json",
      ...(body ? { "Content-Type": "application/json" } : {}),
      ...headers,
    },
    body: body ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(TIMEOUT_MS),
    cache: "no-store",
  }).catch((error: unknown) => {
    throw new ChannelError(
      "Não foi possível contactar o Beds24.",
      error instanceof Error ? error.message : String(error),
    );
  });

  const payload = (await response.json().catch(() => ({}))) as Beds24Response<T>;

  if (!response.ok || payload.success === false) {
    const detail =
      payload.error ??
      payload.errors?.map((e) => [e.field, e.message].filter(Boolean).join(": ")).join(" · ");
    // 401 here almost always means the refresh token was revoked in Beds24.
    if (response.status === 401) {
      throw new ChannelError(
        "O Beds24 recusou as credenciais. Gere um novo código de convite.",
        detail,
      );
    }
    if (response.status === 429) {
      throw new ChannelError("Limite de pedidos do Beds24 atingido. Tente daqui a pouco.", detail);
    }
    throw new ChannelError(`Beds24 respondeu ${response.status}.`, detail);
  }
  return payload;
}

/** Exchanges an invite code for the long-lived refresh token, once. */
export async function redeemInviteCode(code: string): Promise<string> {
  const payload = await call<never>("/authentication/setup", {
    headers: { code, deviceName: "Hotel Vice-Rei" },
  });
  const refreshToken = (payload as { refreshToken?: string }).refreshToken;
  if (!refreshToken) {
    throw new ChannelError("O Beds24 não devolveu um refresh token.");
  }
  return refreshToken;
}

async function accessToken(channelId: string, refreshToken: string): Promise<string> {
  const cached = tokenCache.get(channelId);
  if (cached && cached.expiresAt > Date.now()) return cached.token;

  const payload = await call<never>("/authentication/token", { headers: { refreshToken } });
  const { token, expiresIn } = payload as unknown as { token?: string; expiresIn?: number };
  if (!token) throw new ChannelError("O Beds24 não devolveu um token de acesso.");

  tokenCache.set(channelId, {
    token,
    expiresAt: Date.now() + Math.max(60, (expiresIn ?? 86_400) - 60) * 1000,
  });
  return token;
}

type Beds24Booking = {
  id: number;
  roomId?: number;
  propertyId?: number;
  status?: string;
  firstName?: string;
  lastName?: string;
  arrival?: string;
  departure?: string;
};

/** Beds24 uses `black` for owner blocks and `request` for unconfirmed enquiries. */
const OCCUPYING = new Set(["confirmed", "new", "request", "black"]);

export const beds24Adapter: ChannelAdapter = {
  id: "beds24",
  name: "Beds24 (channel manager)",
  selfServe: true,
  docsUrl: "https://beds24.com/api/v2/",
  availabilityNote:
    "API REST pública e documentada. É por aqui que se alcança o Booking.com, Airbnb, Expedia e Vrbo sem ser parceiro certificado de cada um. Requer conta Beds24 e as tipologias mapeadas.",
  capabilities: {
    importReservations: true,
    exportAvailability: true,
    exportRates: true,
    exportRestrictions: true,
    webhooks: true,
  },
  credentialFields: [
    {
      key: "inviteCode",
      label: "Código de convite",
      hint: "Beds24 → SETTINGS → ACCOUNT → ACCESS. Usado uma só vez e depois descartado.",
      secret: true,
    },
    {
      key: "refreshToken",
      label: "Refresh token",
      hint: "Preenchido automaticamente ao validar o código de convite.",
      secret: true,
    },
    {
      key: "propertyId",
      label: "ID da propriedade",
      hint: "Opcional. Limita a sincronização a uma propriedade da conta.",
    },
  ],

  async test(ctx) {
    const token = await accessToken(ctx.channelId, requireRefreshToken(ctx.credentials));
    const payload = await call<{ id: number; name?: string }[]>("/properties", {
      headers: { token },
    });
    const properties = payload.data ?? [];
    return {
      items: properties.length,
      message:
        properties.length === 0
          ? "Ligação estabelecida, mas a conta não tem propriedades."
          : `Ligado a ${properties.map((p) => p.name ?? p.id).join(", ")}.`,
    };
  },

  async pullReservations(ctx, since) {
    const token = await accessToken(ctx.channelId, requireRefreshToken(ctx.credentials));
    const propertyId = ctx.credentials.propertyId?.trim();

    // Reverse the room map once: Beds24 speaks its own room ids.
    const byExternal = new Map<string, string>();
    for (const [roomId, map] of Object.entries(ctx.roomMap)) {
      if (map.externalRoomId) byExternal.set(map.externalRoomId, roomId);
    }

    const reservations: ImportedReservation[] = [];
    // The endpoint pages; 100 per page is its documented maximum.
    for (let page = 1; page <= 20; page++) {
      const params = new URLSearchParams({
        modifiedFrom: since,
        includeInvoiceItems: "false",
        page: String(page),
      });
      if (propertyId) params.set("propertyId", propertyId);

      const payload = await call<Beds24Booking[]>(`/bookings?${params}`, {
        headers: { token },
      });
      const batch = payload.data ?? [];
      if (batch.length === 0) break;

      for (const booking of batch) {
        if (!booking.arrival || !booking.departure) continue;
        const status = (booking.status ?? "").toLowerCase();
        reservations.push({
          externalId: String(booking.id),
          roomId: byExternal.get(String(booking.roomId ?? "")) ?? null,
          guestName: [booking.firstName, booking.lastName].filter(Boolean).join(" ").trim(),
          checkIn: booking.arrival.slice(0, 10),
          checkOut: booking.departure.slice(0, 10),
          status: OCCUPYING.has(status) ? "confirmed" : "cancelled",
          raw: booking as unknown as Record<string, unknown>,
        });
      }
      if (batch.length < 100) break;
    }
    return reservations;
  },

  async pushAvailability(ctx, days) {
    const token = await accessToken(ctx.channelId, requireRefreshToken(ctx.credentials));

    // One entry per room type, each carrying its own day list. Beds24 accepts
    // a single day per calendar entry, which keeps the payload unambiguous at
    // the cost of size — availability is not a hot path.
    const payload = Object.entries(ctx.roomMap)
      .filter(([, map]) => map.externalRoomId)
      .map(([roomId, map]) => ({
        roomId: Number(map.externalRoomId),
        calendar: days
          .filter((d) => d.roomId === roomId)
          .map((d) => ({
            from: d.date,
            to: d.date,
            numAvail: d.closed ? 0 : d.free,
            minStay: d.minStay,
            ...(d.rate > 0 ? { price1: d.rate } : {}),
          })),
      }))
      .filter((entry) => entry.calendar.length > 0);

    if (payload.length === 0) {
      throw new ChannelError("Nenhuma tipologia está mapeada para um quarto do Beds24.");
    }

    await call("/inventory/rooms/calendar", {
      method: "POST",
      headers: { token },
      body: payload,
    });

    const nights = payload.reduce((sum, entry) => sum + entry.calendar.length, 0);
    return {
      items: nights,
      message: `${nights} noites enviadas em ${payload.length} tipologia(s).`,
    };
  },
};

function requireRefreshToken(credentials: Record<string, string>): string {
  const token = credentials.refreshToken?.trim();
  if (!token) {
    throw new ChannelError(
      "Falta o refresh token. Introduza o código de convite e valide a ligação.",
    );
  }
  return token;
}
