import { useEffect, useState } from "react";
import { Outlet, useLocation, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { Sidebar } from "./Sidebar";
import { Header } from "./Header";
import { GlobalSearch } from "../common/GlobalSearch";
import { JobFormDialog } from "../jobs/JobFormDialog";
import { TooltipProvider } from "../ui/tooltip";
import { ErrorBoundary } from "../common/ErrorBoundary";
import { apiJobs } from "../../lib/api";
import { cn } from "../../lib/utils";

export function AppLayout() {
  const [searchOpen, setSearchOpen] = useState(false);
  const [jobFormOpen, setJobFormOpen] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const isDashboard = location.pathname === "/";

  useEffect(() => {
    apiJobs
      .getStaleHeldCount()
      .then((count) => {
        if (count > 0) {
          toast.info(
            `${count} inactive job${count > 1 ? "s were" : " was"} automatically moved to On Hold (14+ days untouched).`,
            {
              action: {
                label: "View Jobs",
                onClick: () => navigate("/jobs?status=on_hold"),
              },
              duration: 7000,
            }
          );
        }
      })
      .catch(() => {});
  }, [navigate]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setSearchOpen(true);
      }
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "n") {
        e.preventDefault();
        setJobFormOpen(true);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <TooltipProvider delayDuration={250}>
      <div className="flex h-full overflow-hidden">
        <Sidebar />
        <div className="flex min-w-0 flex-1 flex-col">
          <Header onSearch={() => setSearchOpen(true)} />
          <main
            className={cn(
              "min-h-0 flex-1 pl-1",
              isDashboard ? "overflow-hidden" : "overflow-y-auto scrollbar-thin"
            )}
          >
            <div key={location.pathname} className="h-full animate-fade-in">
              <ErrorBoundary key={location.pathname} fallbackTitle="Error loading this page">
                <Outlet />
              </ErrorBoundary>
            </div>
          </main>
        </div>
      </div>
      <GlobalSearch open={searchOpen} onClose={() => setSearchOpen(false)} />
      {jobFormOpen && <JobFormDialog open={jobFormOpen} onOpenChange={setJobFormOpen} />}
    </TooltipProvider>
  );
}