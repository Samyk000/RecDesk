import { useState, useEffect, useMemo } from "react";
import {
  Key,
  Sparkle,
  Check,
  CircleNotch,
  ArrowsClockwise,
  MagnifyingGlass,
  CheckCircle,
  WarningCircle,
  Eye,
  EyeSlash,
} from "@phosphor-icons/react";
import { toast } from "sonner";
import { useOpenRouterStore } from "../../store/openRouterStore";
import { fetchOpenRouterModels, testOpenRouterConnection } from "../../lib/openRouterClient";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { cn } from "../../lib/utils";

export function OpenRouterSettings() {
  const {
    apiKeyInput,
    apiKeys,
    selectedModel,
    freeOnlyFilter,
    modelsCache,
    connectionStatus,
    connectionError,
    setApiKeyInput,
    setSelectedModel,
    setFreeOnlyFilter,
    setConnectionStatus,
  } = useOpenRouterStore();

  const [showKey, setShowKey] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [loadingModels, setLoadingModels] = useState(false);
  const [testingKey, setTestingKey] = useState(false);

  // Load models on mount if cache is empty
  useEffect(() => {
    if (modelsCache.length === 0) {
      loadModels();
    }
  }, []);

  async function loadModels() {
    setLoadingModels(true);
    try {
      await fetchOpenRouterModels();
    } catch {
      // Ignore initial silent fetch error
    } finally {
      setLoadingModels(false);
    }
  }

  async function handleTestKey() {
    if (apiKeys.length === 0) {
      toast.error("Please enter at least one OpenRouter API Key.");
      return;
    }

    setTestingKey(true);
    setConnectionStatus("checking");

    try {
      const activeKey = apiKeys[0];
      await testOpenRouterConnection(activeKey);
      setConnectionStatus("connected");
      toast.success("OpenRouter API key is valid and connected!");
      loadModels();
    } catch (err: any) {
      setConnectionStatus("error", err.message || "Connection failed");
      toast.error(`Key validation failed: ${err.message}`);
    } finally {
      setTestingKey(false);
    }
  }

  const filteredModels = useMemo(() => {
    return modelsCache.filter((m) => {
      if (freeOnlyFilter && !m.is_free) {
        return false;
      }
      if (!searchQuery.trim()) return true;

      const q = searchQuery.toLowerCase();
      return (
        m.name.toLowerCase().includes(q) ||
        m.id.toLowerCase().includes(q) ||
        (m.description && m.description.toLowerCase().includes(q))
      );
    });
  }, [modelsCache, freeOnlyFilter, searchQuery]);

  const selectedModelObj = useMemo(
    () => modelsCache.find((m) => m.id === selectedModel),
    [modelsCache, selectedModel]
  );

  return (
    <div className="space-y-2.5 animate-fade-in">
      {/* Row 1: API Key & Test Connection */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
        <div className="relative flex-1">
          <Key className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-fg-subtle" />
          <Input
            type={showKey ? "text" : "password"}
            value={apiKeyInput}
            onChange={(e) => setApiKeyInput(e.target.value)}
            placeholder="Paste OpenRouter API key (sk-or-v1-...)"
            className="h-7.5 pl-8 pr-8 text-xs font-mono bg-surface"
          />
          <button
            type="button"
            onClick={() => setShowKey(!showKey)}
            className="cursor-pointer absolute right-2 top-1/2 -translate-y-1/2 text-fg-subtle hover:text-fg p-0.5"
            title={showKey ? "Hide API key" : "Show API key"}
          >
            {showKey ? <EyeSlash className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
          </button>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleTestKey}
            disabled={testingKey || apiKeys.length === 0}
            className="h-7.5 text-xs gap-1 cursor-pointer px-2.5"
          >
            {testingKey ? (
              <CircleNotch className="h-3 w-3 animate-spin" />
            ) : (
              <Check className="h-3 w-3" />
            )}
            Test Key
          </Button>

          {connectionStatus === "connected" && (
            <span className="inline-flex items-center gap-1 rounded bg-emerald-500/10 px-2 py-1 text-[10.5px] font-medium text-emerald-600 dark:text-emerald-400">
              <CheckCircle className="h-3 w-3" weight="fill" />
              Connected
            </span>
          )}
          {connectionStatus === "error" && (
            <span className="inline-flex items-center gap-1 rounded bg-red-500/10 px-2 py-1 text-[10.5px] font-medium text-red-500">
              <WarningCircle className="h-3 w-3" weight="fill" />
              Invalid
            </span>
          )}
        </div>
      </div>

      {connectionError && (
        <p className="text-[10.5px] text-red-500 flex items-center gap-1">
          <WarningCircle className="h-3 w-3 shrink-0" />
          {connectionError}
        </p>
      )}

      {/* Row 2: Model Search, Filter & Controls */}
      <div className="flex flex-wrap items-center justify-between gap-1.5 pt-1">
        <div className="flex items-center gap-1.5 min-w-0 flex-1">
          <div className="relative flex-1 max-w-xs">
            <MagnifyingGlass className="absolute left-2 top-1/2 -translate-y-1/2 h-3 w-3 text-fg-subtle" />
            <Input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search models…"
              className="h-6.5 pl-7 text-[11px] bg-surface"
            />
          </div>

          {/* Free Models Filter Pill */}
          <button
            type="button"
            onClick={() => setFreeOnlyFilter(!freeOnlyFilter)}
            className={cn(
              "cursor-pointer inline-flex h-6.5 items-center gap-1 rounded-full px-2 text-[10.5px] font-medium border transition-colors shrink-0",
              freeOnlyFilter
                ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-semibold"
                : "border-border bg-surface-hover text-fg-muted hover:text-fg"
            )}
          >
            <Sparkle className="h-2.5 w-2.5" weight={freeOnlyFilter ? "fill" : "regular"} />
            Free Models {freeOnlyFilter ? "✓" : ""}
          </button>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          <span className="text-[10.5px] text-fg-subtle hidden sm:inline truncate max-w-[150px]">
            Active: <strong className="text-primary font-mono">{selectedModelObj?.name?.replace(/\(free\)/i, "").trim() || selectedModel.split("/").pop()}</strong>
          </span>

          <button
            type="button"
            onClick={loadModels}
            disabled={loadingModels}
            className="cursor-pointer flex h-6.5 w-6.5 items-center justify-center rounded border border-border bg-surface text-fg-muted hover:text-fg hover:bg-surface-hover disabled:opacity-50"
            title="Refresh models catalog"
          >
            <ArrowsClockwise className={cn("h-3 w-3", loadingModels && "animate-spin")} />
          </button>
        </div>
      </div>

      {/* Row 3: Compact Scrollable Model List */}
      <div className="h-32 overflow-y-auto space-y-1 pr-1 scrollbar-thin rounded-lg border border-border/70 bg-surface-hover/20 p-1.5">
        {loadingModels && modelsCache.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-fg-subtle gap-1.5">
            <CircleNotch className="h-4 w-4 animate-spin text-primary" />
            <span className="text-[11px]">Loading OpenRouter catalog…</span>
          </div>
        ) : filteredModels.length === 0 ? (
          <div className="flex items-center justify-center h-full text-[11px] text-fg-subtle">
            No models found. Try unchecking "Free Models" or clearing search.
          </div>
        ) : (
          filteredModels.map((model) => {
            const isSelected = selectedModel === model.id;

            return (
              <div
                key={model.id}
                onClick={() => setSelectedModel(model.id)}
                className={cn(
                  "cursor-pointer flex items-center justify-between gap-2 rounded px-2 py-1 text-xs transition-all duration-150",
                  isSelected
                    ? "border border-primary/50 bg-primary/10 font-medium text-primary shadow-2xs"
                    : "border border-transparent hover:bg-surface-hover text-fg"
                )}
              >
                <div className="min-w-0 flex-1 flex items-center gap-1.5">
                  <span className="truncate text-[11.5px] font-medium">{model.name}</span>
                  {model.is_free && (
                    <span className="rounded bg-emerald-500/15 px-1 py-0.1 text-[9px] font-bold text-emerald-600 dark:text-emerald-400 shrink-0">
                      FREE
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  {model.context_length && (
                    <span className="text-[9.5px] text-fg-subtle font-mono">
                      {Math.round(model.context_length / 1024)}k ctx
                    </span>
                  )}
                  {isSelected && (
                    <Check className="h-3.5 w-3.5 text-primary stroke-[2.5]" />
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
