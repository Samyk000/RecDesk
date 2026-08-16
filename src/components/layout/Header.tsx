import { useEffect, useState } from "react";
import { Copy, Minus, Moon, MagnifyingGlass, Square, Sun, X } from "@phosphor-icons/react";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { useTheme } from "../../store/theme";
import { Button } from "../ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "../ui/tooltip";

interface Props {
  onSearch: () => void;
}

export function Header({ onSearch }: Props) {
  const { resolved, setMode } = useTheme();
  const isDark = resolved === "dark";

  return (
    <header
      data-tauri-drag-region
      className="flex h-12 shrink-0 items-center gap-3 border-b border-border bg-surface/80 px-4 backdrop-blur"
    >
      <button
        onClick={onSearch}
        data-tauri-drag-region={false}
        className="group flex h-8 w-full max-w-sm cursor-pointer items-center gap-2.5 rounded-md border border-border bg-surface px-3 text-left text-[13px] text-fg-subtle transition-all duration-150 hover:border-border-strong hover:text-fg hover:shadow-raise"
      >
        <MagnifyingGlass className="h-4 w-4 transition-colors group-hover:text-fg" />
        <span className="flex-1">Search everything…</span>
        <kbd className="rounded border border-border bg-surface-hover px-1.5 py-0.5 font-mono text-[10px] text-fg-muted transition-colors group-hover:bg-surface-active group-hover:text-fg-subtle">
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

        <div className="mx-1 h-4 w-px bg-border" />

        <WindowControls />
      </div>
    </header>
  );
}

function WindowControls() {
  const [maximized, setMaximized] = useState(false);

  useEffect(() => {
    const appWindow = getCurrentWindow();
    let unlisten: (() => void) | undefined;
    const setup = async () => {
      setMaximized(await appWindow.isMaximized());
      unlisten = await appWindow.onResized(() => {
        appWindow.isMaximized().then(setMaximized);
      });
    };
    setup();
    return () => unlisten?.();
  }, []);

  const appWindow = getCurrentWindow();

  return (
    <div className="flex items-center gap-0.5" data-tauri-drag-region={false}>
      <button
        onClick={() => appWindow.minimize()}
        aria-label="Minimize"
        className="flex h-7 w-9 items-center justify-center rounded-md text-fg-subtle transition-colors hover:bg-surface-hover hover:text-fg"
      >
        <Minus className="h-3.5 w-3.5" />
      </button>
      <button
        onClick={() => appWindow.toggleMaximize()}
        aria-label={maximized ? "Restore" : "Maximize"}
        className="flex h-7 w-9 items-center justify-center rounded-md text-fg-subtle transition-colors hover:bg-surface-hover hover:text-fg"
      >
        {maximized ? <Copy className="h-3 w-3" /> : <Square className="h-3 w-3" />}
      </button>
      <button
        onClick={() => appWindow.close()}
        aria-label="Close"
        className="ml-0.5 flex h-7 w-9 items-center justify-center rounded-md text-fg-subtle transition-colors hover:bg-red-500 hover:text-white"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}