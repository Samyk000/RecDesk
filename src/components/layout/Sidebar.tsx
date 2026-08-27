import { NavLink } from "react-router-dom";
import { Building, Briefcase, CalendarBlank, IdentificationCard, SquaresFour, Gear } from "@phosphor-icons/react";
import { cn } from "../../lib/utils";
import { SidebarInterviews } from "./SidebarInterviews";
import { SidebarSubmissions } from "./SidebarSubmissions";

const navItems = [
  { to: "/", label: "Dashboard", icon: SquaresFour, end: true },
  { to: "/jobs", label: "Jobs", icon: Briefcase },
  { to: "/candidates", label: "Candidates", icon: IdentificationCard },
  { to: "/clients", label: "Clients", icon: Building },
  { to: "/calendar", label: "Calendar", icon: CalendarBlank },
];

export function Sidebar() {
  return (
    <aside className="flex h-full w-52 shrink-0 flex-col border-r border-border bg-bg-sidebar">
      {/* Brand Header */}
      <div className="flex h-12 shrink-0 items-center gap-2.5 border-b border-border px-4">
        <img src="/app-icon.png" alt="RecDesk Logo" className="h-7 w-7 rounded-lg shadow-sm object-cover" />
        <div className="leading-tight">
          <p className="font-display text-[14px] font-bold tracking-tight text-fg">RecDesk</p>
          <p className="text-[10px] font-medium uppercase tracking-wider text-fg-subtle">
            Recruiting
          </p>
        </div>
      </div>

      {/* Main Navigation */}
      <nav className="shrink-0 space-y-0.5 px-2 pt-3">
        {navItems.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.end}
            className={({ isActive }) =>
              cn(
                "group relative flex items-center gap-2.5 rounded-md px-3 py-2 text-[13.5px] font-medium transition-all duration-150 cursor-pointer",
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
                <item.icon className="h-[18px] w-[18px] shrink-0 transition-transform duration-150 group-hover:scale-110" />
                {item.label}
              </>
            )}
          </NavLink>
        ))}
      </nav>

      {/* Minimal Divider Line below Navigation */}
      <div className="mx-3 my-2.5 border-t border-border/60" />

      {/* Middle Section: Candidate Submissions & Upcoming Interviews */}
      <div className="flex-1 overflow-y-auto space-y-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {/* Candidate Submissions Section (Closed by default) */}
        <SidebarSubmissions />

        {/* Minimal Divider Line between Submissions & Interviews */}
        <div className="mx-3 border-t border-border/40" />

        {/* Upcoming Interviews Section */}
        <SidebarInterviews />
      </div>

      {/* Permanently Anchored Bottom Settings */}
      <div className="mt-auto shrink-0 border-t border-border/40 p-2">
        <NavLink
          to="/settings"
          className={({ isActive }) =>
            cn(
              "group relative flex items-center gap-2.5 rounded-md px-3 py-2 text-[13.5px] font-medium transition-all duration-150 cursor-pointer",
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
              <Gear className="h-[18px] w-[18px] shrink-0 transition-transform duration-150 group-hover:scale-110" />
              Settings
            </>
          )}
        </NavLink>
      </div>
    </aside>
  );
}