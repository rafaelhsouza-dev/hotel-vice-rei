import { NextResponse } from "next/server";
import { handleNotification } from "@/lib/payments/service";
import { PaymentError, type ProviderId } from "@/lib/payments/types";
import { notifyPaymentReceived } from "@/lib/email/notify";

/**
 * Payment provider notifications: Stripe webhooks (POST, signed) and
 * ifthenpay callbacks (GET with the anti-phishing key, or POST for MB WAY).
 *
 * The body is read as raw text because signatures are computed over the
 * exact bytes. Authentication failures answer 401; anything we could not
 * process answers 500 so the provider retries later.
 */

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const PROVIDERS: ProviderId[] = ["stripe", "ifthenpay"];

async function handle(request: Request, provider: string) {
  if (!PROVIDERS.includes(provider as ProviderId)) {
    return NextResponse.json({ error: "Unknown provider" }, { status: 404 });
  }
  const rawBody = request.method === "GET" ? "" : await request.text();
  try {
    const applied = await handleNotification(provider as ProviderId, {
      rawBody,
      headers: request.headers,
      url: new URL(request.url),
      method: request.method,
    });
    for (const a of applied) {
      if (a.changed && a.bookingId && a.status === "succeeded") await notifyPaymentReceived(a.bookingId);
    }
    return NextResponse.json({ received: true, applied: applied.filter((a) => a.changed).length });
  } catch (err) {
    if (err instanceof PaymentError && (err.code === "invalid_signature" || err.code === "disabled")) {
      return NextResponse.json({ error: err.code }, { status: err.code === "disabled" ? 404 : 401 });
    }
    console.error(`[payments] ${provider} notification failed:`, (err as Error).message);
    return NextResponse.json({ error: "processing_failed" }, { status: 500 });
  }
}

export async function POST(request: Request, ctx: { params: Promise<{ provider: string }> }) {
  return handle(request, (await ctx.params).provider);
}

export async function GET(request: Request, ctx: { params: Promise<{ provider: string }> }) {
  return handle(request, (await ctx.params).provider);
}
