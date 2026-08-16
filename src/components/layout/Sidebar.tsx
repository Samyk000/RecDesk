import { NavLink } from "react-router-dom";
import { Building2, Briefcase, LayoutDashboard, Settings, Users } from "lucide-react";
import { cn } from "../../lib/utils";

const navItems = [
  { to: "/", label: "Dashboard", icon: LayoutDashboard, end: true },
  { to: "/jobs", label: "Jobs", icon: Briefcase },
  { to: "/clients", label: "Clients", icon: Building2 },
  { to: "/settings", label: "Settings", icon: Settings },
];

export function Sidebar() {
  return (
    <aside className="flex w-56 shrink-0 flex-col border-r border-border bg-bg-sidebar">
      <div className="flex h-14 items-center gap-2.5 border-b border-border px-4">
        <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary text-primary-fg">
          <Users className="h-4 w-4" />
        </div>
        <div className="leading-tight">
          <p className="text-[13px] font-semibold tracking-tight text-fg">Recruiting</p>
          <p className="text-[10px] font-medium uppercase tracking-wider text-fg-subtle">
            Workspace
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
                "group relative flex items-center gap-2.5 rounded-md px-2.5 py-2 text-[13px] font-medium transition-all duration-150",
                isActive
                  ? "bg-surface text-fg shadow-sm"
                  : "text-fg-muted hover:bg-surface-hover hover:text-fg",
              )
            }
          >
            {({ isActive }) => (
              <>
                {isActive && (
                  <span className="absolute left-0 top-1/2 h-5 w-[3px] -translate-y-1/2 rounded-r-full bg-primary" />
                )}
                <item.icon className="h-4 w-4" />
                {item.label}
              </>
            )}
          </NavLink>
        ))}
      </nav>

      <div className="border-t border-border p-3">
        <div className="rounded-lg bg-surface p-3">
          <p className="text-[11px] font-medium uppercase tracking-wider text-fg-subtle">
            Local workspace
          </p>
          <p className="mt-1 text-[11px] leading-relaxed text-fg-muted">
            Data stays on this device
          </p>
        </div>
      </div>
    </aside>
  );
}