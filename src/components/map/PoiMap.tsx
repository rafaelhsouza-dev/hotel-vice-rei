"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { Locale } from "@/i18n/config";
import type { Dictionary } from "@/i18n";
import type { Poi } from "@/lib/repo/content";
import { Icon } from "../Icon";

/**
 * Interactive map of the hotel and nearby points of interest.
 *
 * Privacy and performance: nothing third-party loads until the visitor clicks
 * "Show map". Then maplibre-gl (and its CSS) are imported on demand, its web
 * worker is fetched from jsDelivr at the exact bundled version (bundlers cannot
 * resolve maplibre v6's worker URL on their own), and tiles, fonts and sprites
 * come from OpenFreeMap (https://openfreemap.org — free, no API key, OSM data;
 * attribution is kept on the map).
 *
 * Accessibility: the POI list below is server-rendered with the page and is
 * the primary, keyboard-friendly alternative; markers are real buttons.
 */

export const OPENFREEMAP_STYLE = "https://tiles.openfreemap.org/styles/liberty";

export const POI_COLORS: Record<Poi["category"], string> = {
  sight: "#b4532a",
  museum: "#7b4fa0",
  food: "#c2410c",
  shopping: "#0f766e",
  transport: "#1d4ed8",
  nature: "#15803d",
  nightlife: "#be185d",
  other: "#57534e",
};

const HOTEL_COLOR = "#14110f";

type Status = "idle" | "loading" | "ready" | "error";
type Category = Poi["category"];

type MapLib = typeof import("maplibre-gl");
type MapInstance = InstanceType<MapLib["Map"]>;
type PopupInstance = InstanceType<MapLib["Popup"]>;
type MarkerInstance = InstanceType<MapLib["Marker"]>;

export function PoiMap({
  locale,
  dict,
  hotel,
  pois,
}: {
  locale: Locale;
  dict: Dictionary;
  hotel: { name: string; lat: number; lng: number; address: string };
  pois: Poi[];
}) {
  const t = dict.map;
  const [status, setStatus] = useState<Status>("idle");
  const [filter, setFilter] = useState<Category | "all">("all");
  const [pending, setPending] = useState<string | null>(null);
  /** 0 until the visitor asks for the map; bumped on each (re)try. */
  const [attempt, setAttempt] = useState(0);

  const container = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<MapInstance | null>(null);
  const libRef = useRef<MapLib | null>(null);
  const popupRef = useRef<PopupInstance | null>(null);
  const markers = useRef<Map<string, { marker: MarkerInstance; category: Category | "hotel" }>>(new Map());

  const categories = useMemo(
    () => Array.from(new Set(pois.map((p) => p.category))),
    [pois],
  );
  const visible = filter === "all" ? pois : pois.filter((p) => p.category === filter);

  const query = encodeURIComponent(hotel.address);
  const directions = `https://www.google.com/maps/dir/?api=1&destination=${query}`;
  const openInMaps = `https://www.google.com/maps/search/?api=1&query=${query}`;

  // Load the library and build the map once the visitor asked for it.
  useEffect(() => {
    if (attempt === 0 || !container.current) return;
    let cancelled = false;
    const markerStore = markers.current;

    (async () => {
      try {
        const [lib] = await Promise.all([
          import("maplibre-gl"),
          import("maplibre-gl/dist/maplibre-gl.css"),
        ]);
        if (cancelled || !container.current) return;
        lib.setWorkerUrl(
          `https://cdn.jsdelivr.net/npm/maplibre-gl@${lib.getVersion()}/dist/maplibre-gl-worker.mjs`,
        );
        libRef.current = lib;

        const map = new lib.Map({
          container: container.current,
          style: OPENFREEMAP_STYLE,
          center: [hotel.lng, hotel.lat],
          zoom: 15,
          cooperativeGestures: true,
          attributionControl: { compact: true },
        });
        mapRef.current = map;
        map.addControl(new lib.NavigationControl({ showCompass: false }), "top-right");
        popupRef.current = new lib.Popup({ offset: 18, maxWidth: "260px", closeButton: true });

        const add = (
          id: string,
          lng: number,
          lat: number,
          color: string,
          label: string,
          category: Category | "hotel",
          content: () => HTMLElement,
        ) => {
          const el = document.createElement("button");
          el.type = "button";
          el.setAttribute("aria-label", label);
          el.style.cssText = `width:${category === "hotel" ? 30 : 24}px;height:${category === "hotel" ? 30 : 24}px;border-radius:9999px;background:${color};border:3px solid #fff;box-shadow:0 2px 6px rgba(0,0,0,.35);cursor:pointer;padding:0`;
          el.addEventListener("click", (e) => {
            e.stopPropagation();
            popupRef.current?.setLngLat([lng, lat]).setDOMContent(content()).addTo(map);
          });
          const marker = new lib.Marker({ element: el }).setLngLat([lng, lat]).addTo(map);
          markerStore.set(id, { marker, category });
        };

        add("hotel", hotel.lng, hotel.lat, HOTEL_COLOR, t.hotel, "hotel", () =>
          popupContent(hotel.name, hotel.address, null, "", t),
        );
        for (const p of pois) {
          add(p.id, p.lng, p.lat, POI_COLORS[p.category] ?? POI_COLORS.other, p.name[locale] || p.name.pt, p.category, () =>
            popupContent(p.name[locale] || p.name.pt, p.description?.[locale] ?? "", p.walkMinutes, p.url, t),
          );
        }

        if (pois.length) {
          const bounds = new lib.LngLatBounds([hotel.lng, hotel.lat], [hotel.lng, hotel.lat]);
          for (const p of pois) bounds.extend([p.lng, p.lat]);
          map.fitBounds(bounds, { padding: 48, maxZoom: 16, duration: 0 });
        }

        map.once("load", () => !cancelled && setStatus("ready"));
        map.on("error", (e) => {
          // A missing tile is not fatal; only a style failure is.
          console.warn("[map]", e.error?.message);
          if (!cancelled && !map.loaded() && !map.isStyleLoaded()) setStatus("error");
        });
      } catch (err) {
        console.warn("[map] could not load", err);
        if (!cancelled) setStatus("error");
      }
    })();

    return () => {
      cancelled = true;
    };
    // Built once per attempt; later data changes do not rebuild the map.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [attempt]);

  // Tear down on unmount.
  useEffect(() => {
    const store = markers.current;
    return () => {
      popupRef.current?.remove();
      mapRef.current?.remove();
      mapRef.current = null;
      store.clear();
    };
  }, []);

  // Category filter on the markers.
  useEffect(() => {
    for (const { marker, category } of markers.current.values()) {
      const show = category === "hotel" || filter === "all" || category === filter;
      marker.getElement().style.display = show ? "" : "none";
    }
    popupRef.current?.remove();
  }, [filter, status]);

  // "Show on map" from the list, possibly before the map existed.
  useEffect(() => {
    if (!pending || status !== "ready" || !mapRef.current) return;
    const entry = markers.current.get(pending);
    if (entry) {
      const ll = entry.marker.getLngLat();
      mapRef.current.flyTo({ center: ll, zoom: Math.max(mapRef.current.getZoom(), 16) });
      (entry.marker.getElement() as HTMLButtonElement).click();
      container.current?.scrollIntoView({ behavior: "smooth", block: "center" });
    }
    setPending(null);
  }, [pending, status]);

  function activate() {
    if (status !== "idle" && status !== "error") return;
    mapRef.current?.remove();
    mapRef.current = null;
    markers.current.clear();
    setStatus("loading");
    setAttempt((n) => n + 1);
  }

  const chip = (active: boolean) =>
    `inline-flex min-h-10 items-center gap-2 rounded-full px-4 py-2 text-xs font-medium transition-colors ${
      active
        ? "bg-[var(--color-ink)] text-white"
        : "hairline bg-white text-[var(--color-ink-soft)] hover:bg-[var(--color-line-soft)]"
    }`;

  return (
    <div className="space-y-6">
      {categories.length > 1 && (
        <div role="group" aria-label={t.filter} className="flex flex-wrap gap-2">
          <button type="button" aria-pressed={filter === "all"} onClick={() => setFilter("all")} className={chip(filter === "all")}>
            {t.all}
          </button>
          {categories.map((c) => (
            <button
              key={c}
              type="button"
              aria-pressed={filter === c}
              onClick={() => setFilter(c)}
              className={chip(filter === c)}
            >
              <span aria-hidden className="h-2.5 w-2.5 rounded-full" style={{ background: POI_COLORS[c] }} />
              {t.categories[c]}
            </button>
          ))}
        </div>
      )}

      <div className="overflow-hidden rounded-3xl hairline bg-[var(--color-line-soft)]">
        <div className="relative aspect-[4/3] sm:aspect-[16/10]">
          {/* maplibre-gl.css sets .maplibregl-map { position: relative }, which
              would override `absolute` on the map node itself and collapse it to
              zero height — so the positioning lives on a wrapper. */}
          <div className={`absolute inset-0 ${status === "idle" ? "hidden" : ""}`}>
            <div ref={container} role="region" aria-label={t.mapLabel} className="h-full w-full" />
          </div>
          {status !== "ready" && (
            <button
              type="button"
              onClick={activate}
              disabled={status === "loading"}
              className="group absolute inset-0 flex h-full w-full flex-col items-center justify-center gap-3 bg-[var(--color-line-soft)] px-6 text-center disabled:cursor-wait"
            >
              {/* Drawn, not fetched: nothing leaves the page until the click. */}
              <span
                aria-hidden
                className="absolute inset-0 opacity-40"
                style={{
                  backgroundImage:
                    "repeating-linear-gradient(0deg, transparent 0 22px, rgba(20,17,15,0.06) 22px 23px), repeating-linear-gradient(90deg, transparent 0 22px, rgba(20,17,15,0.06) 22px 23px)",
                }}
              />
              <span className="relative grid h-14 w-14 place-items-center rounded-full bg-white text-[var(--color-accent-deep)] shadow-[var(--shadow-card)] transition-transform duration-500 group-hover:scale-110">
                <Icon name="map" width={22} height={22} />
              </span>
              <span className="relative font-display text-lg tracking-tight">
                {status === "loading" ? t.loading : t.show}
              </span>
              <span className="relative max-w-xs text-xs leading-relaxed text-[var(--color-ink-muted)]">
                {status === "error" ? t.error : t.hint}
              </span>
            </button>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2 border-t border-[var(--color-line)] bg-white px-4 py-3">
          <a
            href={directions}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex min-h-11 items-center gap-2 rounded-full bg-[var(--color-ink)] px-4 py-2 text-xs font-medium text-white transition-colors hover:bg-[var(--color-accent-deep)]"
          >
            <Icon name="map" width={13} height={13} />
            {dict.contact.directions}
          </a>
          <a
            href={openInMaps}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex min-h-11 items-center gap-2 rounded-full border border-[var(--color-line)] px-4 py-2 text-xs text-[var(--color-ink-soft)] transition-colors hover:bg-[var(--color-line-soft)]"
          >
            {dict.contact.openInMaps}
            <Icon name="arrow-right" width={12} height={12} />
          </a>
        </div>
      </div>

      {(pois.length > 0 || status !== "idle") && (
        <div aria-label={t.legend} className="flex flex-wrap gap-x-5 gap-y-2 text-xs text-[var(--color-ink-soft)]">
          <span className="inline-flex items-center gap-2">
            <span aria-hidden className="h-3 w-3 rounded-full border-2 border-white shadow" style={{ background: HOTEL_COLOR }} />
            {t.hotel}
          </span>
          {categories.map((c) => (
            <span key={c} className="inline-flex items-center gap-2">
              <span aria-hidden className="h-3 w-3 rounded-full border-2 border-white shadow" style={{ background: POI_COLORS[c] }} />
              {t.categories[c]}
            </span>
          ))}
        </div>
      )}

      {pois.length > 0 && (
        <div>
          <h3 className="font-display text-xl tracking-tight">{t.listTitle}</h3>
          <ul className="mt-4 grid gap-3 sm:grid-cols-2">
            {visible.map((p) => {
              const name = p.name[locale] || p.name.pt;
              const desc = p.description?.[locale] ?? "";
              return (
                <li key={p.id} className="rounded-2xl bg-white hairline p-4">
                  <p className="flex items-center gap-2 text-[10px] uppercase tracking-[0.2em] text-[var(--color-ink-muted)]">
                    <span aria-hidden className="h-2.5 w-2.5 rounded-full" style={{ background: POI_COLORS[p.category] ?? POI_COLORS.other }} />
                    {t.categories[p.category] ?? t.categories.other}
                    {p.walkMinutes != null && (
                      <>
                        <span aria-hidden>·</span>
                        <span className="normal-case tracking-normal">{t.walk.replace("{n}", String(p.walkMinutes))}</span>
                      </>
                    )}
                  </p>
                  <p className="mt-1 font-medium">{name}</p>
                  {desc && <p className="mt-1 text-sm leading-relaxed text-[var(--color-ink-soft)]">{desc}</p>}
                  <div className="mt-3 flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setPending(p.id);
                        activate();
                      }}
                      className="inline-flex min-h-10 items-center gap-1.5 rounded-full hairline px-3 py-1.5 text-xs text-[var(--color-ink-soft)] hover:bg-[var(--color-line-soft)]"
                    >
                      <Icon name="map" width={12} height={12} />
                      {t.showOnMap}
                      <span className="sr-only">: {name}</span>
                    </button>
                    {p.url && (
                      <a
                        href={p.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex min-h-10 items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium text-[var(--color-accent-deep)] hover:underline"
                      >
                        {t.website}
                        <span className="sr-only">: {name}</span>
                        <Icon name="arrow-right" width={12} height={12} />
                      </a>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}

/** Popup DOM built with textContent only — POI text comes from the admin. */
function popupContent(
  title: string,
  description: string,
  walk: number | null,
  url: string,
  t: Dictionary["map"],
): HTMLElement {
  const root = document.createElement("div");
  root.style.cssText = "font:14px/1.4 system-ui,sans-serif;color:#14110f;padding-right:12px";
  const h = document.createElement("p");
  h.style.cssText = "font-weight:600;margin:0";
  h.textContent = title;
  root.appendChild(h);
  if (description) {
    const d = document.createElement("p");
    d.style.cssText = "margin:4px 0 0;color:#57534e";
    d.textContent = description;
    root.appendChild(d);
  }
  if (walk != null) {
    const w = document.createElement("p");
    w.style.cssText = "margin:4px 0 0;font-size:12px;color:#57534e";
    w.textContent = t.walk.replace("{n}", String(walk));
    root.appendChild(w);
  }
  if (/^https?:\/\//.test(url)) {
    const a = document.createElement("a");
    a.href = url;
    a.target = "_blank";
    a.rel = "noopener noreferrer";
    a.style.cssText = "display:inline-block;margin-top:6px;font-size:12px;font-weight:600;color:#9a3412";
    a.textContent = t.website;
    root.appendChild(a);
  }
  return root;
}
