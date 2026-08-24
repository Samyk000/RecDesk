import { useEffect, useState } from "react";
import { Copy, Minus, Moon, MagnifyingGlass, Square, Sun, X, ListChecks, FileDoc, CircleNotch } from "@phosphor-icons/react";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { useTheme } from "../../store/theme";
import { useResumeFormatterStore } from "../../store/resumeFormatterStore";
import { Button } from "../ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "../ui/tooltip";
import { QuickScreenDialog } from "../candidates/QuickScreenDialog";
import { ResumeFormatterModal } from "../candidates/ResumeFormatterModal";
import { AnimatedAvatar } from "../common/AnimatedAvatar";

interface Props {
  onSearch: () => void;
}

export function Header({ onSearch }: Props) {
  const { resolved, setMode } = useTheme();
  const isDark = resolved === "dark";
  const [quickScreenOpen, setQuickScreenOpen] = useState(false);
  const { isOpen, isProcessing, openModal, closeModal } = useResumeFormatterStore();

  return (
    <>
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
          <AnimatedAvatar />

          <Tooltip>
            <TooltipTrigger asChild>
              {isProcessing ? (
                <div className="relative inline-flex overflow-hidden rounded-md p-[1.5px] shadow-xs">
                  {/* Subtle circling border line trail animation */}
                  <span className="absolute inset-[-1000%] animate-[spin_2.5s_linear_infinite] bg-[conic-gradient(from_90deg_at_50%_50%,#3b82f6_0%,transparent_50%,#3b82f6_100%)]" />
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={openModal}
                    className="relative h-8 gap-1.5 text-xs bg-surface border-transparent font-medium hover:bg-surface-hover transition-colors"
                  >
                    <CircleNotch className="h-3.5 w-3.5 animate-spin text-primary" />
                    <span className="text-primary font-semibold">Formatting…</span>
                  </Button>
                </div>
              ) : (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={openModal}
                  className="h-8 gap-1.5 text-xs"
                >
                  <FileDoc className="h-3.5 w-3.5 text-primary" weight="duotone" />
                  <span>Format Resume</span>
                </Button>
              )}
            </TooltipTrigger>
            <TooltipContent>
              {isProcessing ? "Resume formatting in progress (click to view)" : "Format a resume for client submission"}
            </TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                size="sm"
                variant="outline"
                onClick={() => setQuickScreenOpen(true)}
                className="h-8 gap-1.5 text-xs"
              >
                <ListChecks className="h-3.5 w-3.5 text-primary" />
                <span>Quick Screen</span>
              </Button>
            </TooltipTrigger>
            <TooltipContent>Start a live candidate screening call</TooltipContent>
          </Tooltip>

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

      <QuickScreenDialog
        open={quickScreenOpen}
        onOpenChange={setQuickScreenOpen}
      />
      <ResumeFormatterModal
        open={isOpen}
        onClose={closeModal}
      />
    </>
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