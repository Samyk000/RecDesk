import { NavLink } from "react-router-dom";
import { Building2, Briefcase, FileUser, LayoutDashboard, Settings } from "lucide-react";
import { cn } from "../../lib/utils";

const navItems = [
  { to: "/", label: "Dashboard", icon: LayoutDashboard, end: true },
  { to: "/jobs", label: "Jobs", icon: Briefcase },
  { to: "/candidates", label: "Candidates", icon: FileUser },
  { to: "/clients", label: "Clients", icon: Building2 },
];

export function Sidebar() {
  return (
    <aside className="flex w-50 shrink-0 flex-col border-r border-border bg-bg-sidebar">
      <div className="flex h-12 items-center gap-2.5 border-b border-border px-4">
        <div className="flex h-7 w-7 items-center justify-center rounded-md bg-primary text-primary-fg">
          <FileUser className="h-4 w-4" />
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
                "group relative flex items-center gap-2.5 rounded-md px-3 py-2 text-[15px] font-medium transition-all duration-150",
                isActive
                  ? "text-fg"
                  : "text-fg-muted hover:bg-surface-hover hover:text-fg",
              )
            }
          >
            {({ isActive }) => (
              <>
                {isActive && (
                  <span className="absolute left-0 top-1/2 h-5 w-[3px] -translate-y-1/2 rounded-r-full bg-primary" />
                )}
                <item.icon className="h-[18px] w-[18px]" />
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
              "group relative flex items-center gap-2.5 rounded-md px-3 py-2 text-[15px] font-medium transition-all duration-150",
              isActive
                ? "text-fg"
                : "text-fg-muted hover:bg-surface-hover hover:text-fg",
            )
          }
        >
          {({ isActive }) => (
            <>
              {isActive && (
                <span className="absolute left-0 top-1/2 h-5 w-[3px] -translate-y-1/2 rounded-r-full bg-primary" />
              )}
              <Settings className="h-[18px] w-[18px]" />
              Settings
            </>
          )}
        </NavLink>
      </div>
    </aside>
  );
}