import { NavLink } from "react-router-dom";
import { Building, Briefcase, IdentificationCard, SquaresFour, Gear } from "@phosphor-icons/react";
import { cn } from "../../lib/utils";

const navItems = [
  { to: "/", label: "Dashboard", icon: SquaresFour, end: true },
  { to: "/jobs", label: "Jobs", icon: Briefcase },
  { to: "/candidates", label: "Candidates", icon: IdentificationCard },
  { to: "/clients", label: "Clients", icon: Building },
];

export function Sidebar() {
  return (
    <aside className="flex w-50 shrink-0 flex-col border-r border-border bg-bg-sidebar">
      <div className="flex h-12 items-center gap-2.5 border-b border-border px-4">
        <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary text-primary-fg shadow-raise transition-transform duration-150">
          <IdentificationCard className="h-4 w-4" />
        </div>
        <div className="leading-tight">
          <p className="font-display text-[14px] font-bold tracking-tight text-fg">RecDesk</p>
          <p className="text-[10px] font-medium uppercase tracking-wider text-fg-subtle">
            Recruiting
          </p>
        </div>
      </div>

      <nav className="flex-1 space-y-0.5 overflow-y-auto p-2 scrollbar-thin">
        {navItems.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.end}
            className={({ isActive }) =>
              cn(
                "group relative flex items-center gap-2.5 rounded-md px-3 py-2 text-[14px] font-medium transition-all duration-150 cursor-pointer",
                isActive
                  ? "bg-surface-hover text-fg"
                  : "text-fg-muted hover:bg-surface-hover/60 hover:text-fg active:bg-surface-active",
              )
            }
          >
            {({ isActive }) => (
              <>
                {isActive && (
                  <span className="absolute left-0 top-1/2 h-5 w-[3px] -translate-y-1/2 rounded-r-full bg-primary" />
                )}
                <item.icon className="h-[18px] w-[18px] transition-transform duration-150 group-hover:scale-110" />
                {item.label}
              </>
            )}
          </NavLink>
        ))}
      </nav>

      <div className="p-2">
        <NavLink
          to="/settings"
          className={({ isActive }) =>
            cn(
              "group relative flex items-center gap-2.5 rounded-md px-3 py-2 text-[14px] font-medium transition-all duration-150 cursor-pointer",
              isActive
                ? "bg-surface-hover text-fg"
                : "text-fg-muted hover:bg-surface-hover/60 hover:text-fg active:bg-surface-active",
            )
          }
        >
          {({ isActive }) => (
            <>
              {isActive && (
                <span className="absolute left-0 top-1/2 h-5 w-[3px] -translate-y-1/2 rounded-r-full bg-primary" />
              )}
              <Gear className="h-[18px] w-[18px] transition-transform duration-150 group-hover:scale-110" />
              Settings
            </>
          )}
        </NavLink>
      </div>
    </aside>
  );
}