"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { BuildingSearch } from "@/components/BuildingSearch";
import { BuildingDetail } from "@/components/BuildingDetail";
import { CinematicTimeline } from "@/components/CinematicTimeline";
import { Skyline } from "@/components/Skyline";
import { ViewpointSwitcher } from "@/components/ViewpointSwitcher";
import {
  findBuilding,
  isSkylineVisible,
  skylineNeighbors,
  yearRange,
} from "@/lib/buildings";
import { erasByIds } from "@/lib/eras";
import { selectLandingBuildings } from "@/lib/landingSet";
import { SKYLINE_MOBILE_MAX_WIDTH_PX } from "@/lib/skyline-layout";
import { getViewpoint, VIEWPOINTS, type ViewpointId } from "@/lib/viewpoints";
import type { Building } from "@/types/building";

type SkylineExplorerProps = {
  buildings: Building[];
};

/**
 * SSR + first client paint must share one width so landing N / tower text match.
 * Real viewport is applied only after mount (useEffect) — never in useState init.
 */
const LANDING_SSR_WIDTH_PX = 390;

/** Viewport width for landing density; hydrated value only after mount. */
function useViewportWidth(): number {
  const [width, setWidth] = useState(LANDING_SSR_WIDTH_PX);

  useEffect(() => {
    const sync = () => setWidth(window.innerWidth);
    sync();
    window.addEventListener("resize", sync);
    return () => window.removeEventListener("resize", sync);
  }, []);

  return width;
}

type TimeOfDay = "day" | "dusk" | "night";
const TIMES_OF_DAY: { id: TimeOfDay; label: string }[] = [
  { id: "day", label: "Day" },
  { id: "dusk", label: "Dusk" },
  { id: "night", label: "Night" },
];
/** Milliseconds per simulated year while "play history" runs. */
const PLAY_STEP_MS = 110;

export function SkylineExplorer({ buildings }: SkylineExplorerProps) {
  const { min, max } = useMemo(() => yearRange(buildings), [buildings]);
  const [scrubYear, setScrubYear] = useState(max);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [viewpointId, setViewpointId] = useState<ViewpointId>("jersey-city");
  const [prevScrubYear, setPrevScrubYear] = useState(max);
  const [eraFilterIds, setEraFilterIds] = useState<string[]>([]);
  const [hasInteracted, setHasInteracted] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [timeOfDay, setTimeOfDay] = useState<TimeOfDay>("day");
  const [urlReady, setUrlReady] = useState(false);
  const viewportWidth = useViewportWidth();

  const eraFilters = erasByIds(eraFilterIds);
  /** Landing set, or era filters active: lifespan scrub does not drive visibility. */
  const skipYearCheck = !hasInteracted || eraFilterIds.length > 0;
  /** Pre-interaction: tallest-by-height subset sized to viewport width. */
  const isLanding = !hasInteracted;

  const skylineBuildings = useMemo(
    () =>
      isLanding
        ? selectLandingBuildings(buildings, viewportWidth)
        : buildings,
    [buildings, isLanding, viewportWidth],
  );

  const viewpoint = getViewpoint(viewpointId);

  const selected = findBuilding(buildings, selectedId);
  const { prevId, nextId } = useMemo(
    () =>
      skylineNeighbors(
        skylineBuildings,
        selectedId,
        scrubYear,
        viewpoint.sortDirection,
        eraFilters,
        skipYearCheck,
      ),
    [
      skylineBuildings,
      selectedId,
      scrubYear,
      viewpoint.sortDirection,
      eraFilters,
      skipYearCheck,
    ],
  );

  // Track buildings that just completed this scrub year (for entrance flash)
  const newlyBuiltIds = useMemo(() => {
    const ids = new Set<string>();
    if (scrubYear > prevScrubYear) {
      for (const b of buildings) {
        if (b.yearCompleted > prevScrubYear && b.yearCompleted <= scrubYear) {
          ids.add(b.id);
        }
      }
    }
    return ids;
  }, [buildings, scrubYear, prevScrubYear]);

  useEffect(() => {
    if (
      selected &&
      !isSkylineVisible(selected, scrubYear, eraFilters, skipYearCheck)
    ) {
      setSelectedId(null);
      return;
    }
    if (
      selected &&
      isLanding &&
      !skylineBuildings.some((b) => b.id === selected.id)
    ) {
      setSelectedId(null);
    }
  }, [
    scrubYear,
    selected,
    eraFilters,
    skipYearCheck,
    isLanding,
    skylineBuildings,
  ]);

  const handleScrubChange = useCallback(
    (year: number) => {
      setPlaying(false);
      setHasInteracted(true);
      if (eraFilterIds.length > 0) {
        setEraFilterIds([]);
      }
      setScrubYear(Math.min(max, Math.max(min, year)));
    },
    [eraFilterIds.length, min, max],
  );

  /** Click timeline track while filtering → leave filter mode, restore scrubber. */
  const handleResumeTimeline = useCallback(() => {
    setHasInteracted(true);
    setEraFilterIds([]);
  }, []);

  useEffect(() => {
    setPrevScrubYear(scrubYear);
  }, [scrubYear]);

  // Restore shared state from the URL (after mount, so SSR markup matches).
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const year = Number(params.get("year"));
    const view = params.get("view");
    const building = params.get("b");
    const tod = params.get("time");
    /* eslint-disable react-hooks/set-state-in-effect */
    if (Number.isFinite(year) && year >= min && year <= max && params.has("year")) {
      setScrubYear(year);
      setHasInteracted(true);
    }
    if (VIEWPOINTS.some((v) => v.id === view)) setViewpointId(view as ViewpointId);
    if (tod === "dusk" || tod === "night") setTimeOfDay(tod);
    if (building && buildings.some((b) => b.id === building)) {
      setSelectedId(building);
      setHasInteracted(true);
    }
    setUrlReady(true);
    /* eslint-enable react-hooks/set-state-in-effect */
  }, [buildings, min, max]);

  // Keep the URL in sync so any view can be shared.
  useEffect(() => {
    if (!urlReady) return;
    const params = new URLSearchParams();
    if (hasInteracted && eraFilterIds.length === 0 && scrubYear !== max) {
      params.set("year", String(scrubYear));
    }
    if (viewpointId !== "jersey-city") params.set("view", viewpointId);
    if (timeOfDay !== "day") params.set("time", timeOfDay);
    if (selectedId) params.set("b", selectedId);
    const qs = params.toString();
    window.history.replaceState(
      null,
      "",
      qs ? `${window.location.pathname}?${qs}` : window.location.pathname,
    );
  }, [urlReady, hasInteracted, eraFilterIds, scrubYear, max, viewpointId, timeOfDay, selectedId]);

  // "Play history": advance one year per tick until the present.
  useEffect(() => {
    if (!playing) return;
    const id = window.setInterval(() => {
      setScrubYear((y) => {
        if (y >= max) {
          setPlaying(false);
          return max;
        }
        return y + 1;
      });
    }, PLAY_STEP_MS);
    return () => window.clearInterval(id);
  }, [playing, max]);

  const handleTogglePlay = useCallback(() => {
    if (playing) {
      setPlaying(false);
      return;
    }
    setHasInteracted(true);
    setEraFilterIds([]);
    setSelectedId(null);
    setScrubYear((y) => (y >= max ? min : y));
    setPlaying(true);
  }, [playing, min, max]);

  const handlePickBuilding = useCallback(
    (id: string) => {
      const b = findBuilding(buildings, id);
      if (!b) return;
      setPlaying(false);
      setHasInteracted(true);
      setEraFilterIds([]);
      setScrubYear((y) => Math.max(y, b.yearCompleted));
      setSelectedId(id);
    },
    [buildings],
  );

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.tagName === "SELECT" ||
          target.isContentEditable)
      ) {
        return;
      }

      if (event.key === "ArrowLeft" && prevId) {
        event.preventDefault();
        setSelectedId(prevId);
      } else if (event.key === "ArrowRight" && nextId) {
        event.preventDefault();
        setSelectedId(nextId);
      } else if (event.key === "Escape" && selectedId) {
        setSelectedId(null);
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [prevId, nextId, selectedId]);

  const handleViewpointChange = (id: ViewpointId) => {
    setViewpointId(id);
    setSelectedId(null);
  };

  const handleEraSelect = (eraId: string) => {
    setPlaying(false);
    setHasInteracted(true);
    setEraFilterIds((prev) =>
      prev.includes(eraId)
        ? prev.filter((id) => id !== eraId)
        : [...prev, eraId],
    );
  };

  return (
    <div className="flex min-h-dvh w-full flex-col">
      <nav className="relative z-20 shrink-0 border-b border-white/10 bg-[var(--sky-top)]/85 px-4 py-2.5 backdrop-blur-sm sm:px-6">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3">
          <h1 className="text-base font-semibold tracking-tight text-white sm:text-lg">
            Skyinfoline
          </h1>
          <div className="flex flex-wrap items-center justify-end gap-2">
            <BuildingSearch buildings={buildings} onPick={handlePickBuilding} />
            <div className="flex gap-1" role="group" aria-label="Time of day">
              {TIMES_OF_DAY.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  className="pill"
                  aria-pressed={timeOfDay === t.id}
                  onClick={() => setTimeOfDay(t.id)}
                >
                  {t.label}
                </button>
              ))}
            </div>
            <ViewpointSwitcher
              value={viewpointId}
              onChange={handleViewpointChange}
            />
          </div>
        </div>
      </nav>

      <div className={`skyline-hero skyline-hero--${timeOfDay} flex min-h-0 flex-1 flex-col`}>
        <div className="skyline-hero__bg" aria-hidden />

        <div
          className={[
            "viewpoint-atmosphere relative z-10 flex min-h-0 flex-1 flex-col transition-[filter] duration-700",
            viewpoint.atmosphereClass,
          ].join(" ")}
        >
          <div className="mb-1 flex shrink-0 justify-between px-4 text-[10px] tracking-[0.2em] text-white/70 uppercase drop-shadow-sm sm:mb-2 sm:px-8">
            <span>← {viewpoint.leftLabel}</span>
            <span>{viewpoint.rightLabel} →</span>
          </div>

          {/* Spacer pushes skyline to the platform shelf at the bottom */}
          <div className="min-h-0 flex-1" aria-hidden />

          <div className="relative z-10 w-full shrink-0">
            <Skyline
              buildings={skylineBuildings}
              selectedId={selectedId}
              hoveredId={hoveredId}
              scrubYear={scrubYear}
              eraFilters={eraFilters}
              skipYearCheck={skipYearCheck}
              sortDirection={viewpoint.sortDirection}
              viewpointLabel={`${viewpoint.label}, ${viewpoint.heading}`}
              newlyBuiltIds={newlyBuiltIds}
              forceFitWidth={
                isLanding || viewportWidth < SKYLINE_MOBILE_MAX_WIDTH_PX
              }
              onSelect={setSelectedId}
              onHover={setHoveredId}
            />
          </div>
        </div>

        <div className="skyline-platform relative z-10 w-full shrink-0" aria-hidden />
      </div>

      <div className="operator-dock shrink-0">
        <div className="operator-deck px-4 py-4 sm:px-6 sm:py-5">
          <CinematicTimeline
            min={min}
            max={max}
            value={scrubYear}
            eraFilterIds={eraFilterIds}
            onChange={handleScrubChange}
            onResumeTimeline={handleResumeTimeline}
            onEraSelect={handleEraSelect}
            playing={playing}
            onTogglePlay={handleTogglePlay}
          />
        </div>

        <BuildingDetail
          building={selected}
          onClose={() => setSelectedId(null)}
          canPrevious={Boolean(prevId)}
          canNext={Boolean(nextId)}
          onPrevious={
            prevId
              ? () => {
                  setSelectedId(prevId);
                }
              : undefined
          }
          onNext={
            nextId
              ? () => {
                  setSelectedId(nextId);
                }
              : undefined
          }
        />
      </div>
    </div>
  );
}
