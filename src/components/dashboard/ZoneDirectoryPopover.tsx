import { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { createPortal } from "react-dom";
import {
  MagnifyingGlass,
  X,
  Compass,
  Buildings,
  MapPin,
  Sparkle,
  Info,
} from "@phosphor-icons/react";
import {
  US_STATES_AZ,
  US_CITIES,
  fuzzySearchGeo,
} from "../../lib/geoTimezones";
import { formatZoneTime, cn } from "../../lib/utils";
import { Tooltip, TooltipContent, TooltipTrigger } from "../ui/tooltip";

const ALPHABET = [
  "ALL",
  "A", "B", "C", "D", "E", "F", "G", "H", "I", "J",
  "K", "L", "M", "N", "O", "P", "R", "S", "T", "U",
  "V", "W"
] as const;

export function ZoneDirectoryPopover() {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [selectedLetter, setSelectedLetter] = useState<string>("ALL");
  const [now, setNow] = useState(() => new Date());
  const [coords, setCoords] = useState<{ top: number; right: number }>({ top: 0, right: 0 });

  const containerRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Sync live clock boundary
  useEffect(() => {
    let id: number;
    const schedule = () => {
      const current = new Date();
      const delay = 60_000 - (current.getSeconds() * 1000 + current.getMilliseconds()) + 250;
      id = window.setTimeout(() => {
        setNow(new Date());
        schedule();
      }, delay);
    };
    schedule();
    return () => clearTimeout(id);
  }, []);

  // Update floating popover coordinates based on trigger button
  const updateCoords = useCallback(() => {
    if (!triggerRef.current) return;
    const rect = triggerRef.current.getBoundingClientRect();
    const top = rect.bottom + 8;
    // Align with trigger button's right edge, clamped to prevent overflowing the screen
    const right = Math.max(16, window.innerWidth - rect.right);
    setCoords({ top, right });
  }, []);

  // Position updates and outside click / escape handling
  useEffect(() => {
    if (!isOpen) return;

    updateCoords();

    const handlePointerDown = (e: MouseEvent) => {
      const target = e.target as Node;
      if (
        containerRef.current &&
        !containerRef.current.contains(target) &&
        triggerRef.current &&
        !triggerRef.current.contains(target)
      ) {
        setIsOpen(false);
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setIsOpen(false);
        triggerRef.current?.focus();
      }
    };

    const handleReposition = () => {
      updateCoords();
    };

    window.addEventListener("resize", handleReposition);
    window.addEventListener("scroll", handleReposition, true);
    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      window.removeEventListener("resize", handleReposition);
      window.removeEventListener("scroll", handleReposition, true);
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen, updateCoords]);

  // Focus search input when popover opens
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => {
        inputRef.current?.focus();
      }, 50);
    } else {
      setQuery("");
      setSelectedLetter("ALL");
    }
  }, [isOpen]);

  // Fuzzy search results
  const searchResults = useMemo(() => {
    if (!query.trim()) return [];
    return fuzzySearchGeo(query, now);
  }, [query, now]);

  // Filtered states for selected letter
  const statesForLetter = useMemo(() => {
    if (selectedLetter === "ALL") return US_STATES_AZ;
    return US_STATES_AZ.filter((s) =>
      s.name.toUpperCase().startsWith(selectedLetter)
    );
  }, [selectedLetter]);

  // Filtered major cities for selected letter
  const citiesForLetter = useMemo(() => {
    if (selectedLetter === "ALL") return [];
    return US_CITIES.filter((c) =>
      c.city.toUpperCase().startsWith(selectedLetter)
    ).slice(0, 16);
  }, [selectedLetter]);

  const toggleOpen = () => {
    if (!isOpen) {
      updateCoords();
    }
    setIsOpen((prev) => !prev);
  };

  return (
    <div className="relative inline-flex items-center">
      {/* Trigger Button with Tooltip (suppressed when popover is open) */}
      <Tooltip delayDuration={150} open={isOpen ? false : undefined}>
        <TooltipTrigger asChild>
          <button
            ref={triggerRef}
            type="button"
            onClick={toggleOpen}
            aria-expanded={isOpen}
            aria-haspopup="dialog"
            aria-label="Search city or browse timezones A-Z"
            className={cn(
              "group flex h-6 w-6 items-center justify-center rounded-md border text-fg-muted transition-all duration-150 cursor-pointer active:scale-95",
              isOpen
                ? "border-primary/50 bg-primary/15 text-primary shadow-2xs"
                : "border-border/60 bg-surface/50 hover:border-primary/40 hover:bg-primary/10 hover:text-fg",
            )}
          >
            <MagnifyingGlass
              className={cn(
                "h-3.5 w-3.5 transition-transform duration-150",
                isOpen ? "text-primary scale-110" : "text-fg-subtle group-hover:text-primary",
              )}
            />
          </button>
        </TooltipTrigger>
        <TooltipContent side="bottom" align="end" sideOffset={6} className="text-xs">
          <span>Search city or browse timezones (A-Z)</span>
        </TooltipContent>
      </Tooltip>

      {/* Floating Anchored Directory Popover via Portal */}
      {isOpen &&
        createPortal(
          <div
            ref={containerRef}
            role="dialog"
            aria-modal="false"
            aria-label="US Timezone & City Directory"
            style={{
              top: `${coords.top}px`,
              right: `${coords.right}px`,
            }}
            className="fixed z-[9999] w-[500px] max-w-[calc(100vw-32px)] rounded-2xl border border-border bg-surface shadow-2xl shadow-black/30 backdrop-blur-xl animate-scale-in overflow-hidden select-none"
          >
          {/* Header & Search Bar */}
          <div className="border-b border-border/80 bg-surface-hover/30 p-3 space-y-2.5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <Compass className="h-4 w-4 text-primary" weight="duotone" />
                <h3 className="font-display text-[13.5px] font-semibold text-fg tracking-tight">
                  Timezone &amp; City Lookup
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="rounded-md p-1 text-fg-subtle transition-colors hover:bg-surface-hover hover:text-fg cursor-pointer"
                title="Close (Esc)"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>

            {/* Typo-Tolerant Search Input */}
            <div className="relative flex items-center">
              <MagnifyingGlass className="absolute left-2.5 h-3.5 w-3.5 text-fg-subtle pointer-events-none" />
              <input
                ref={inputRef}
                type="text"
                value={query}
                onChange={(e) => {
                  setQuery(e.target.value);
                  if (e.target.value) {
                    setSelectedLetter("ALL");
                  }
                }}
                placeholder="Search city or state (e.g. Austin, taxes, Arezone)..."
                className="w-full rounded-lg border border-border/80 bg-surface pl-8 pr-7 py-1.5 text-xs text-fg placeholder:text-fg-subtle/70 outline-none transition-all focus:border-primary focus:ring-2 focus:ring-primary/20"
              />
              {query && (
                <button
                  type="button"
                  onClick={() => {
                    setQuery("");
                    inputRef.current?.focus();
                  }}
                  className="absolute right-2 rounded-full p-0.5 text-fg-subtle hover:bg-surface-active hover:text-fg cursor-pointer"
                  title="Clear search"
                >
                  <X className="h-3 w-3" />
                </button>
              )}
            </div>

            {/* Search Match Status (only when query is active) */}
            {query.trim() && (
              <div className="flex items-center justify-between text-[11px] text-fg-subtle px-0.5 pt-0.5">
                <span className="flex items-center gap-1 font-medium">
                  <Sparkle className="h-3 w-3 text-primary shrink-0" weight="fill" />
                  <span>
                    Found {searchResults.length} {searchResults.length === 1 ? "match" : "matches"}
                  </span>
                </span>
                <span className="text-[10px] text-fg-subtle/70">Live local time</span>
              </div>
            )}
          </div>

          {/* Main Content Area */}
          {query.trim() ? (
            /* ================= SEARCH RESULTS MODE ================= */
            <div className="max-h-[350px] overflow-y-auto p-2 [scrollbar-width:thin]">
              {searchResults.length > 0 ? (
                <div className="space-y-1">
                  {searchResults.map((item, idx) => (
                    <div
                      key={`${item.type}-${item.title}-${idx}`}
                      className="group flex items-center justify-between gap-3 rounded-lg border border-border/50 bg-surface-hover/30 px-2.5 py-1.5 transition-all hover:border-primary/40 hover:bg-primary/5 hover:shadow-2xs"
                    >
                      {/* Left: Icon & Name details */}
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-surface-active text-fg-subtle group-hover:bg-primary/10 group-hover:text-primary transition-colors">
                          {item.type === "city" ? (
                            <Buildings className="h-3.5 w-3.5" weight="duotone" />
                          ) : (
                            <MapPin className="h-3.5 w-3.5 text-primary" weight="fill" />
                          )}
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5">
                            <span className="text-xs font-semibold text-fg truncate">
                              {item.title}
                            </span>
                            {item.type === "state" && (
                              <span className="rounded bg-primary/10 px-1 py-0.2 text-[9px] font-bold text-primary">
                                State
                              </span>
                            )}
                          </div>
                          <p className="text-[10.5px] text-fg-subtle truncate">
                            {item.subtitle}
                          </p>
                        </div>
                      </div>

                      {/* Right: Badge, Time & Details */}
                      <div className="flex flex-col items-end shrink-0 pl-2 text-right">
                        <div className="flex items-center gap-1.5">
                          <span className="rounded bg-primary/10 border border-primary/20 px-1.5 py-0.2 text-[9.5px] font-bold text-primary font-mono tracking-tight">
                            {item.badge}
                          </span>
                          <span className="font-mono text-xs font-semibold tabular-nums text-fg">
                            {item.timeString}
                          </span>
                        </div>
                        {item.splitInfo ? (
                          <span className="text-[9.5px] font-mono text-amber-600 dark:text-amber-400 font-medium">
                            {item.splitInfo}
                          </span>
                        ) : item.note ? (
                          <span className="text-[9.5px] text-fg-subtle truncate max-w-[140px]">
                            {item.note}
                          </span>
                        ) : null}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                /* Empty state when no matches found */
                <div className="flex flex-col items-center justify-center py-8 text-center px-4">
                  <div className="flex h-9 w-9 items-center justify-center rounded-full bg-surface-active text-fg-subtle mb-2">
                    <MagnifyingGlass className="h-4 w-4" />
                  </div>
                  <p className="text-xs font-semibold text-fg">No matching city or state found</p>
                  <p className="text-[11px] text-fg-subtle mt-0.5 max-w-xs">
                    Try typing the city name, full state, or 2-letter state code (e.g. Austin, Texas, TX, Seattle).
                  </p>
                </div>
              )}
            </div>
          ) : (
            /* ================= DUAL PANE: LEFT A-Z RAIL + MAIN BROWSE PANE ================= */
            <div className="flex min-h-0 overflow-hidden">
              {/* Left A-Z Navigation Rail */}
              <div className="w-8 shrink-0 border-r border-border/70 bg-surface-hover/20 py-1.5 px-0.5 flex flex-col items-center gap-0.5 max-h-[350px] overflow-y-auto [scrollbar-width:none] select-none">
                {ALPHABET.map((letter) => {
                  const isSelected = selectedLetter === letter;
                  return (
                    <button
                      key={letter}
                      type="button"
                      onClick={() => {
                        setSelectedLetter((prev) => (prev === letter ? "ALL" : letter));
                      }}
                      className={cn(
                        "flex items-center justify-center rounded transition-all cursor-pointer select-none font-mono",
                        letter === "ALL"
                          ? "w-6 h-4.5 text-[8.5px] font-bold tracking-tight mb-1"
                          : "w-6 h-3.5 text-[10px] font-medium",
                        isSelected
                          ? "bg-primary text-primary-foreground font-bold shadow-2xs"
                          : "text-fg-subtle hover:text-fg hover:bg-surface-active",
                      )}
                      title={letter === "ALL" ? "View all states" : `Jump to ${letter}`}
                    >
                      {letter}
                    </button>
                  );
                })}
              </div>

              {/* Right Content Area */}
              <div className="flex-1 min-w-0 max-h-[350px] overflow-y-auto p-2 [scrollbar-width:thin]">
                {selectedLetter === "ALL" ? (
                  /* --- All 51 States Grid --- */
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between px-1 text-[10px] font-semibold text-fg-subtle uppercase tracking-wider">
                      <span>All 50 US States + DC</span>
                      <span className="font-mono text-[9.5px] normal-case text-fg-subtle/80">Click state to view cities</span>
                    </div>
                    <div className="grid grid-cols-2 gap-1.5">
                      {US_STATES_AZ.map((state) => {
                        const stateTime = formatZoneTime(state.zone, false, now);

                        return (
                          <div
                            key={state.code}
                            onClick={() => {
                              setQuery(state.name);
                              inputRef.current?.focus();
                            }}
                            className="group flex items-center justify-between gap-1.5 rounded-lg border border-border/50 bg-surface-hover/20 px-2 py-1.5 transition-all hover:border-primary/40 hover:bg-primary/5 hover:shadow-2xs cursor-pointer active:scale-[0.98]"
                            title={state.split ? `${state.name}: ${state.split.details} · Click to view cities & zones` : `${state.name} · Click to view`}
                          >
                            {/* Left: Code badge (Neutral theme text) & Name */}
                            <div className="flex items-center gap-1.5 min-w-0">
                              <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded bg-surface-active border border-border/70 font-mono text-[9.5px] font-bold text-fg group-hover:border-primary/40 transition-colors">
                                {state.code}
                              </span>
                              <span className="text-[11px] font-medium text-fg truncate group-hover:text-primary transition-colors">
                                {state.name}
                              </span>
                            </div>

                            {/* Right: Zone badge & Live Time */}
                            <div className="flex items-center gap-1 shrink-0 font-mono text-[10px]">
                              <span className="rounded bg-primary/10 border border-primary/20 px-1 py-0.2 font-bold text-primary text-[9.5px]">
                                {state.badge}
                                {state.split && <span className="text-amber-500 ml-0.5">*</span>}
                              </span>
                              <span className="text-fg-muted group-hover:text-fg font-semibold tabular-nums text-[10.5px]">
                                {stateTime}
                              </span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ) : (
                  /* --- Filtered by Selected Letter (States + Major Cities) --- */
                  <div className="space-y-3">
                    {/* States Starting with Letter */}
                    {statesForLetter.length > 0 && (
                      <div className="space-y-1">
                        <div className="flex items-center justify-between px-1 text-[10px] font-semibold text-fg-subtle uppercase tracking-wider">
                          <span>States ({statesForLetter.length})</span>
                          <span className="font-mono text-[9.5px] normal-case text-fg-subtle/80">Starting with {selectedLetter}</span>
                        </div>
                        <div className="grid grid-cols-2 gap-1.5">
                          {statesForLetter.map((state) => {
                            const stateTime = formatZoneTime(state.zone, false, now);

                            return (
                              <div
                                key={state.code}
                                onClick={() => {
                                  setQuery(state.name);
                                  inputRef.current?.focus();
                                }}
                                className="group flex items-center justify-between gap-1.5 rounded-lg border border-border/50 bg-surface-hover/20 px-2.5 py-1.5 transition-all hover:border-primary/40 hover:bg-primary/5 hover:shadow-2xs cursor-pointer active:scale-[0.98]"
                                title={state.split ? `${state.name}: ${state.split.details} · Click to view cities & zones` : `${state.name} · Click to view`}
                              >
                                <div className="flex items-center gap-1.5 min-w-0">
                                  <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded bg-surface-active border border-border/70 font-mono text-[9.5px] font-bold text-fg group-hover:border-primary/40 transition-colors">
                                    {state.code}
                                  </span>
                                  <span className="text-[11.5px] font-medium text-fg truncate group-hover:text-primary transition-colors">
                                    {state.name}
                                  </span>
                                </div>
                                <div className="flex items-center gap-1 shrink-0 font-mono text-[10px]">
                                  <span className="rounded bg-primary/10 border border-primary/20 px-1 py-0.2 font-bold text-primary text-[9.5px]">
                                    {state.badge}
                                    {state.split && <span className="text-amber-500 ml-0.5">*</span>}
                                  </span>
                                  <span className="text-fg-muted group-hover:text-fg font-semibold tabular-nums text-[10.5px]">
                                    {stateTime}
                                  </span>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {/* Major Cities Starting with Letter */}
                    {citiesForLetter.length > 0 && (
                      <div className="space-y-1">
                        <div className="flex items-center justify-between px-1 text-[10px] font-semibold text-fg-subtle uppercase tracking-wider">
                          <span>Major Cities ({citiesForLetter.length})</span>
                          <span className="font-mono text-[9.5px] normal-case text-fg-subtle/80">Starting with {selectedLetter}</span>
                        </div>
                        <div className="grid grid-cols-2 gap-1.5">
                          {citiesForLetter.map((city) => {
                            const cityTime = formatZoneTime(city.zone, false, now);

                            return (
                              <div
                                key={`${city.city}-${city.stateCode}`}
                                onClick={() => {
                                  setQuery(city.city);
                                  inputRef.current?.focus();
                                }}
                                className="group flex items-center justify-between gap-1.5 rounded-lg border border-border/50 bg-surface-hover/20 px-2.5 py-1.5 transition-all hover:border-primary/40 hover:bg-primary/5 hover:shadow-2xs cursor-pointer active:scale-[0.98]"
                                title={`${city.city}, ${city.stateCode} (${city.stateName}) · Click to inspect`}
                              >
                                <div className="flex items-center gap-1.5 min-w-0">
                                  <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded bg-surface-active border border-border/70 font-mono text-[9px] font-semibold text-fg-subtle group-hover:text-fg group-hover:border-primary/30 transition-colors">
                                    {city.stateCode}
                                  </span>
                                  <span className="text-[11px] font-medium text-fg truncate group-hover:text-primary transition-colors">
                                    {city.city}
                                  </span>
                                </div>
                                <div className="flex items-center gap-1 shrink-0 font-mono text-[10px]">
                                  <span className="rounded bg-primary/10 border border-primary/20 px-1 py-0.2 font-bold text-primary text-[9.5px]">
                                    {city.badge}
                                  </span>
                                  <span className="text-fg-muted group-hover:text-fg font-semibold tabular-nums text-[10.5px]">
                                    {cityTime}
                                  </span>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {statesForLetter.length === 0 && citiesForLetter.length === 0 && (
                      <div className="py-8 text-center text-xs text-fg-subtle">
                        No states or major cities found starting with {selectedLetter}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Footer Note */}
          <div className="border-t border-border/80 bg-surface-hover/20 px-3 py-1.5 flex items-center justify-between text-[10px] text-fg-subtle">
            <span className="flex items-center gap-1">
              <Info className="h-3 w-3 text-fg-subtle/80 shrink-0" />
              <span>*Spans multiple time zones</span>
            </span>
            <span className="font-mono text-fg-subtle/70">
              {selectedLetter === "ALL" ? "50 States + DC" : `Filter: ${selectedLetter}`}
            </span>
          </div>
        </div>,
        document.body,
      )}
    </div>
  );
}
