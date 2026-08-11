"use client";

import { useEffect } from "react";

/**
 * Recovers a page left holding a previous build's assets.
 *
 * Chunk filenames are content-hashed, so a deploy removes the old ones. A tab
 * that was already open — or one restored from the back/forward cache — still
 * has the old HTML, and the first lazily-loaded chunk it asks for returns 404.
 * The visitor sees a route that silently fails to render, which looks like a
 * broken site rather than a stale one.
 *
 * Reloading fetches the new HTML and everything works. The guard below makes
 * that happen at most once per tab: if the reload does not fix it, the cause
 * is not a stale build and looping would only hide the real error.
 */

const ATTEMPTS_KEY = "vicerei-stale-build-reload";
/** One recovery reload per window; a second failure inside it is not staleness. */
const WINDOW_MS = 60_000;

function isStaleAsset(url: string): boolean {
  return url.includes("/_next/static/");
}

/**
 * Reloads at most once per {@link WINDOW_MS}.
 *
 * The budget is time-boxed rather than cleared on a successful load: clearing
 * it on mount would let a genuinely broken asset reload the page forever,
 * since every fresh document would believe it was the first attempt. Waiting
 * out the window instead means a stale build recovers immediately, a broken
 * one gives up after a single try, and a later deploy still gets its own.
 */
function recover(reason: string) {
  const now = Date.now();
  try {
    const [count, at] = (sessionStorage.getItem(ATTEMPTS_KEY) ?? "0:0")
      .split(":")
      .map(Number);
    const recent = now - at < WINDOW_MS;
    if (recent && count >= 1) {
      console.warn(`[vicerei] recarregar não resolveu (${reason}); a desistir`);
      return;
    }
    sessionStorage.setItem(ATTEMPTS_KEY, `${recent ? count + 1 : 1}:${now}`);
  } catch {
    return; // storage blocked — without a counter a reload could loop
  }
  console.warn(`[vicerei] recursos de uma versão anterior (${reason}); a recarregar`);
  window.location.reload();
}

export function StaleBuildRecovery() {
  useEffect(() => {
    // Resource errors do not bubble, so this listener has to be in the
    // capture phase to see a <script> or <link> that failed to load.
    function onResourceError(event: Event) {
      const target = event.target as HTMLElement | null;
      const url =
        (target as HTMLScriptElement | null)?.src ??
        (target as HTMLLinkElement | null)?.href ??
        "";
      if (url && isStaleAsset(url)) recover("recurso em falta");
    }

    function onRejection(event: PromiseRejectionEvent) {
      const reason = event.reason as { name?: string; message?: string } | undefined;
      const message = `${reason?.name ?? ""} ${reason?.message ?? ""}`;
      if (/ChunkLoadError|Loading chunk|Failed to fetch dynamically imported/i.test(message)) {
        recover("chunk indisponível");
      }
    }

    window.addEventListener("error", onResourceError, true);
    window.addEventListener("unhandledrejection", onRejection);
    return () => {
      window.removeEventListener("error", onResourceError, true);
      window.removeEventListener("unhandledrejection", onRejection);
    };
  }, []);

  return null;
}
