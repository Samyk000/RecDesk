import { useState, useEffect } from "react";
import { Clock } from "@phosphor-icons/react";
import { useProfile } from "../../store/profile";
import { formatZoneTime } from "../../lib/utils";
import { getZoneMeta } from "../../lib/timezones";
import { ZoneDirectoryPopover } from "./ZoneDirectoryPopover";

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
    <div className="flex w-full items-center justify-between rounded-xl border border-border/80 bg-surface/80 px-2 py-1 text-xs font-medium tabular-nums text-fg-muted shadow-2xs backdrop-blur-xs">
      {/* Active Timezones (Simple & glanceable in single line) */}
      <div className="flex flex-1 items-center divide-x divide-border/70 min-w-0">
        {timeZones.map((zone) => {
          const meta = getZoneMeta(zone);

          return (
            <div
              key={zone}
              className="flex-1 min-w-0 flex items-center justify-center gap-1.5 px-2 py-0.5 text-[11.5px] font-medium text-fg-muted whitespace-nowrap cursor-default"
              title={`${meta.shortLabel} Time · ${formatZoneTime(zone)}`}
            >
              <Clock className="h-3 w-3 shrink-0 text-primary/80" />
              <span className="font-semibold text-fg tracking-tight">{meta.badge}</span>
              <span className="text-fg-subtle/60 font-mono">-</span>
              <span className="tabular-nums font-mono text-[11px]">{formatZoneTime(zone)}</span>
            </div>
          );
        })}
      </div>

      {/* Subtle Divider & Right Directory Lookup Trigger */}
      <div className="flex items-center pl-2 ml-1 border-l border-border/70 shrink-0">
        <ZoneDirectoryPopover />
      </div>
    </div>
  );
}

