import { Moon, Plus, Search, Sun } from "lucide-react";
import { useTheme } from "../../store/theme";
import { Button } from "../ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "../ui/tooltip";

interface Props {
  onSearch: () => void;
  onNewJob: () => void;
}

export function Header({ onSearch, onNewJob }: Props) {
  const { mode, setMode } = useTheme();
  const isDark = mode === "dark" || (mode === "system" && window.matchMedia("(prefers-color-scheme: dark)").matches);

  return (
    <header className="flex h-14 shrink-0 items-center gap-3 border-b border-border bg-surface/80 px-4 backdrop-blur">
      <button
        onClick={onSearch}
        className="group flex h-9 w-full max-w-sm items-center gap-2.5 rounded-lg border border-border bg-surface-hover px-3 text-left text-[13px] text-fg-subtle transition-all duration-150 hover:border-border-strong hover:bg-surface-active hover:text-fg"
      >
        <Search className="h-4 w-4 transition-colors group-hover:text-fg" />
        <span className="flex-1">Search everything…</span>
        <kbd className="rounded border border-border bg-surface px-1.5 py-0.5 font-mono text-[10px] text-fg-muted transition-colors group-hover:bg-surface-hover group-hover:text-fg-subtle">
          ⌘K
        </kbd>
      </button>

      <div className="ml-auto flex items-center gap-1.5">
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              size="icon"
              variant="ghost"
              onClick={() => setMode(isDark ? "light" : "dark")}
              aria-label="Toggle theme"
              className="transition-colors"
            >
              {isDark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            </Button>
          </TooltipTrigger>
          <TooltipContent>Toggle theme</TooltipContent>
        </Tooltip>
        <Button variant="primary" size="sm" onClick={onNewJob} className="transition-all duration-150 hover:shadow-md">
          <Plus className="h-4 w-4" />
          New Job
        </Button>
      </div>
    </header>
  );
}