import { useEffect, useState } from "react";
import { Outlet } from "react-router-dom";
import { Sidebar } from "./Sidebar";
import { Header } from "./Header";
import { GlobalSearch } from "../common/GlobalSearch";
import { JobFormDialog } from "../jobs/JobFormDialog";
import { TooltipProvider } from "../ui/tooltip";

export function AppLayout() {
  const [searchOpen, setSearchOpen] = useState(false);
  const [jobFormOpen, setJobFormOpen] = useState(false);

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
          <main className="min-h-0 flex-1 overflow-y-auto scrollbar-thin">
            <Outlet />
          </main>
        </div>
      </div>
      <GlobalSearch open={searchOpen} onClose={() => setSearchOpen(false)} />
      <JobFormDialog open={jobFormOpen} onOpenChange={setJobFormOpen} />
    </TooltipProvider>
  );
}