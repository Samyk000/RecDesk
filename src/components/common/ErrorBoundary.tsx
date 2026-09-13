import { Component, type ErrorInfo, type ReactNode } from "react";
import { ArrowClockwise, House, WarningCircle, Copy, Check } from "@phosphor-icons/react";
import { Button } from "../ui/button";

interface Props {
  children: ReactNode;
  fallbackTitle?: string;
  onReset?: () => void;
}

interface State {
  hasError: boolean;
  error: Error | null;
  copied: boolean;
}

export class ErrorBoundary extends Component<Props, State> {
  public override state: State = {
    hasError: false,
    error: null,
    copied: false,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error, copied: false };
  }

  public override componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("RecDesk Uncaught Error in Component Tree:", error, errorInfo);
  }

  private handleReset = () => {
    this.setState({ hasError: false, error: null, copied: false });
    this.props.onReset?.();
  };

  private handleReload = () => {
    window.location.reload();
  };

  private handleGoHome = () => {
    window.location.href = "/";
  };

  private handleCopy = () => {
    if (this.state.error) {
      const text = `${this.state.error.name}: ${this.state.error.message}\n\n${this.state.error.stack || ""}`;
      navigator.clipboard.writeText(text);
      this.setState({ copied: true });
      setTimeout(() => this.setState({ copied: false }), 2000);
    }
  };

  public override render() {
    if (this.state.hasError) {
      const title = this.props.fallbackTitle || "Something went wrong in this view";
      const message = this.state.error?.message || "An unexpected error occurred.";

      return (
        <div className="flex h-full min-h-[360px] w-full flex-col items-center justify-center p-6 text-center">
          <div className="flex max-w-md flex-col items-center rounded-2xl border border-border bg-surface p-8 shadow-float animate-scale-in">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-red-500/10 text-red-500 mb-4">
              <WarningCircle className="h-7 w-7" weight="duotone" />
            </div>

            <h2 className="text-base font-semibold text-fg tracking-tight">{title}</h2>
            <p className="mt-1.5 text-xs text-fg-muted leading-relaxed max-w-sm">{message}</p>

            {this.state.error?.stack && (
              <div className="mt-4 w-full text-left">
                <div className="flex items-center justify-between pb-1 text-[11px] text-fg-subtle">
                  <span>Diagnostic Details</span>
                  <button
                    type="button"
                    onClick={this.handleCopy}
                    className="inline-flex items-center gap-1 hover:text-fg transition-colors cursor-pointer"
                  >
                    {this.state.copied ? (
                      <>
                        <Check className="h-3 w-3 text-emerald-500" />
                        <span className="text-emerald-500">Copied</span>
                      </>
                    ) : (
                      <>
                        <Copy className="h-3 w-3" />
                        <span>Copy</span>
                      </>
                    )}
                  </button>
                </div>
                <pre className="max-h-28 overflow-y-auto rounded-lg border border-border bg-surface-hover/80 p-2.5 font-mono text-[10.5px] text-fg-muted scrollbar-thin">
                  {this.state.error.stack}
                </pre>
              </div>
            )}

            <div className="mt-6 flex flex-wrap items-center justify-center gap-2">
              <Button size="sm" variant="primary" onClick={this.handleReset} className="gap-1.5">
                <ArrowClockwise className="h-3.5 w-3.5" />
                Try again
              </Button>
              <Button size="sm" variant="outline" onClick={this.handleGoHome} className="gap-1.5">
                <House className="h-3.5 w-3.5" />
                Return to Dashboard
              </Button>
              <Button size="sm" variant="ghost" onClick={this.handleReload} className="text-xs text-fg-subtle">
                Reload App
              </Button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
