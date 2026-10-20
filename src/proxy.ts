import { NextRequest, NextResponse } from "next/server";
import { defaultLocale, locales } from "./i18n/config";
import { SESSION_COOKIE, verifySession } from "./lib/auth/jwt";
import { can, permissionForPath } from "./lib/auth/permissions";

const PUBLIC_FILE = /\.(.*)$/;

/** Paths that live outside the /[locale] tree and must not be prefixed. */
const UNLOCALISED = ["/admin", "/uploads", "/api"];

function pickLocale(request: NextRequest) {
  const cookieLocale = request.cookies.get("NEXT_LOCALE")?.value;
  if (cookieLocale && (locales as readonly string[]).includes(cookieLocale)) {
    return cookieLocale;
  }
  const header = request.headers.get("accept-language") ?? "";
  for (const part of header.split(",")) {
    const code = part.split(";")[0].trim().toLowerCase().split("-")[0];
    if ((locales as readonly string[]).includes(code)) {
      return code;
    }
  }
  return defaultLocale;
}

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (
    pathname.startsWith("/_next") ||
    pathname === "/favicon.ico" ||
    pathname === "/robots.txt" ||
    pathname === "/sitemap.xml" ||
    pathname === "/llms.txt" ||
    pathname === "/manifest.webmanifest" ||
    pathname.startsWith("/images") ||
    PUBLIC_FILE.test(pathname)
  ) {
    return NextResponse.next();
  }

  // --- backoffice ---------------------------------------------------------
  if (UNLOCALISED.some((p) => pathname === p || pathname.startsWith(`${p}/`))) {
    if (pathname === "/admin/login" || !pathname.startsWith("/admin")) {
      return NextResponse.next();
    }
    const session = await verifySession(request.cookies.get(SESSION_COOKIE)?.value);
    if (session) {
      // Early, cookie-based role check for a friendlier redirect. Pages and
      // actions re-check against the database; this is not the barrier.
      const needed = permissionForPath(pathname);
      if (needed && pathname !== "/admin/sem-acesso" && !can(session.role, needed)) {
        const denied = request.nextUrl.clone();
        denied.pathname = "/admin/sem-acesso";
        denied.search = "";
        return NextResponse.redirect(denied);
      }
      return NextResponse.next();
    }

    const login = request.nextUrl.clone();
    login.pathname = "/admin/login";
    login.search = pathname === "/admin" ? "" : `?next=${encodeURIComponent(pathname)}`;
    return NextResponse.redirect(login);
  }

  // --- locale prefix ------------------------------------------------------
  const pathnameHasLocale = locales.some(
    (l) => pathname.startsWith(`/${l}/`) || pathname === `/${l}`,
  );
  if (pathnameHasLocale) return NextResponse.next();

  const locale = pickLocale(request);
  const url = request.nextUrl.clone();
  url.pathname = `/${locale}${pathname === "/" ? "" : pathname}`;
  return NextResponse.redirect(url);
}

export const config = {
  matcher: ["/((?!_next|images|favicon.ico|robots.txt|sitemap.xml).*)"],
};
