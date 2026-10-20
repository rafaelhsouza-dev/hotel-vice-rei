import { int, oneOf, str } from "../form";
import type { GuestInput } from "../repo/bookings";

/**
 * Reads the repeated guest fieldsets (g0.firstName, g1.firstName…) posted by
 * the desk form and by online check-in. Empty rows are ignored.
 */
export function guestsFromForm(form: FormData): GuestInput[] {
  const count = Math.min(10, Math.max(0, int(form, "guestCount", 0)));
  const out: GuestInput[] = [];
  for (let i = 0; i < count; i++) {
    const g = (k: string, max = 120) => str(form, `g${i}.${k}`, "", max);
    const firstName = g("firstName", 80);
    const lastName = g("lastName", 80);
    if (!firstName && !lastName) continue;
    out.push({
      firstName,
      lastName,
      nationality: g("nationality", 3).toUpperCase(),
      birthDate: /^\d{4}-\d{2}-\d{2}$/.test(g("birthDate")) ? g("birthDate") : null,
      birthPlace: g("birthPlace", 60),
      documentType: oneOf(g("documentType", 1), ["P", "B", "O"] as const),
      documentNumber: g("documentNumber", 20).toUpperCase(),
      documentCountry: g("documentCountry", 3).toUpperCase(),
      residenceCountry: g("residenceCountry", 3).toUpperCase(),
      residenceCity: g("residenceCity", 60),
    });
  }
  return out;
}

