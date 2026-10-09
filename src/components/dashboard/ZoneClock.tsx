import { useState, useEffect } from "react";
import { Clock } from "@phosphor-icons/react";
import { useProfile } from "../../store/profile";
import { formatZoneTime } from "../../lib/utils";
import { getZoneMeta } from "../../lib/timezones";
import { Tooltip, TooltipContent, TooltipTrigger } from "../ui/tooltip";

export function ZoneClock() {
  const timeZones = useProfile((s) => s.timeZones);
  const [, setTick] = useState(0);

  useEffect(() => {
    if (timeZones.length === 0) return;
    let id: number;
    const schedule = () => {
      const now = new Date();
      // Tick exactly on the minute boundary + 250ms buffer
      const delay = 60_000 - (now.getSeconds() * 1000 + now.getMilliseconds()) + 250;
      id = window.setTimeout(() => {
        setTick((t) => t + 1);
        schedule();
      }, delay);
    };
    schedule();
    return () => clearTimeout(id);
  }, [timeZones.length]);

  if (timeZones.length === 0) return null;

  return (
    <div className="flex w-full items-center rounded-xl border border-border/80 bg-surface/80 px-2.5 py-1.5 text-xs font-medium tabular-nums text-fg-muted shadow-2xs divide-x divide-border/70 backdrop-blur-xs">
      {timeZones.map((zone) => {
        const meta = getZoneMeta(zone);
        const hasStates = meta.states.length > 0;

        return (
          <Tooltip key={zone} delayDuration={150}>
            <TooltipTrigger asChild>
              <button
                type="button"
                className="flex-1 min-w-0 flex items-center justify-center gap-1.5 px-2 py-0.5 text-[11.5px] font-medium text-fg-muted cursor-pointer hover:text-fg hover:bg-surface-hover/60 rounded-md transition-colors active:scale-98 whitespace-nowrap"
                aria-label={`Timezone: ${meta.shortLabel}, current time: ${formatZoneTime(zone)}`}
              >
                <Clock className="h-3 w-3 shrink-0 text-primary/80" />
                <span className="font-semibold text-fg tracking-tight">{meta.badge}</span>
                <span className="text-fg-subtle/60 font-mono">-</span>
                <span className="tabular-nums font-mono text-[11px]">{formatZoneTime(zone)}</span>
              </button>
            </TooltipTrigger>
            <TooltipContent
              side="bottom"
              align="center"
              sideOffset={8}
              className={
                hasStates
                  ? "w-[360px] max-w-[calc(100vw-32px)] p-3 rounded-xl border border-border bg-surface shadow-float backdrop-blur-md animate-scale-in text-fg"
                  : "p-2.5 rounded-lg border border-border bg-surface shadow-float text-xs text-fg"
              }
            >
              {hasStates ? (
                <div>
                  {/* Clean, minimal header */}
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-1.5">
                      <span className="inline-flex items-center px-1.5 py-0.5 rounded-md bg-primary/10 text-primary text-[11px] font-bold font-display">
                        {meta.shortLabel}
                      </span>
                      <span className="text-[11.5px] font-medium text-fg-muted font-mono">
                        {formatZoneTime(zone)}
                      </span>
                    </div>
                    <span className="rounded-full bg-surface-active px-2 py-0.5 text-[10.5px] font-medium text-fg-subtle">
                      {meta.summary}
                    </span>
                  </div>

                  {/* Subtle separator */}
                  <div className="my-2 border-t border-border/60" />

                  {/* Perfectly organized 3-column state grid */}
                  <div className="grid grid-cols-3 gap-1 max-h-[220px] overflow-y-auto [scrollbar-width:thin]">
                    {meta.states.map((state) => (
                      <div
                        key={state.code}
                        className="group flex items-center gap-1.5 rounded-md border border-border/40 bg-surface-hover/30 px-1.5 py-1 text-[11px] transition-all duration-150 hover:border-primary/40 hover:bg-primary/10 hover:shadow-2xs cursor-default"
                        title={state.split ? `${state.name} (spans multiple zones)` : state.name}
                      >
                        <span className="font-mono text-[10px] font-bold text-primary shrink-0">
                          {state.code}
                          {state.split && (
                            <span className="text-amber-500 font-bold ml-0.5" title="Spans multiple time zones">
                              *
                            </span>
                          )}
                        </span>
                        <span className="truncate text-fg-muted font-normal group-hover:text-fg transition-colors text-[11px]">
                          {state.name}
                        </span>
                      </div>
                    ))}
                  </div>

                  {/* Minimal footer note for split states */}
                  {meta.note && (
                    <div className="mt-2 pt-1.5 border-t border-border/40 flex items-center justify-between text-[10px] text-fg-subtle">
                      <span>{meta.note}</span>
                      <span className="font-mono tabular-nums opacity-70">
                        {meta.states.length} states
                      </span>
                    </div>
                  )}
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-fg">{meta.shortLabel}</span>
                  <span className="text-fg-subtle">·</span>
                  <span className="text-fg-muted font-mono">{formatZoneTime(zone)}</span>
                </div>
              )}
            </TooltipContent>
          </Tooltip>
        );
      })}
    </div>
  );
}
