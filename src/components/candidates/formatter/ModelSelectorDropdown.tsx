import { useState, useRef, useEffect } from "react";
import {
  CaretDown,
  Lightning,
  Sparkle,
  Gear,
  Check,
  MagnifyingGlass,
  WarningCircle,
} from "@phosphor-icons/react";
import { useNavigate } from "react-router-dom";
import type { AiModelInfo } from "../../../types";

interface Props {
  activeProvider: "local" | "openrouter";
  setActiveProvider: (p: "local" | "openrouter") => void;
  selectedModelId: string;
  setSelectedModelId: (id: string) => void;
  selectedModel: string;
  setSelectedModel: (id: string) => void;
  activeModelDisplay: string;
  freeCloudModels: { id: string; name: string; desc: string }[];
  apiKeys: string[];
  aiModelsData?: AiModelInfo[];
  onCloseModal: () => void;
}

const LOCAL_MODELS = [
  { id: "qwen-1.5b", name: "Qwen 2.5 1.5B", tag: "Recommended · Balanced", size: "1.1 GB" },
  { id: "qwen-0.5b", name: "Qwen 2.5 0.5B", tag: "Ultra-Fast · Low RAM", size: "468 MB" },
  { id: "qwen-3b", name: "Qwen 2.5 3B", tag: "High Precision", size: "2.2 GB" },
];

export function ModelSelectorDropdown({
  activeProvider,
  setActiveProvider,
  selectedModelId,
  setSelectedModelId,
  selectedModel,
  setSelectedModel,
  activeModelDisplay,
  freeCloudModels,
  apiKeys,
  aiModelsData,
  onCloseModal,
}: Props) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const dropdownRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    if (open) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [open]);

  const isModelDownloaded = (modelId: string) => {
    return Boolean(aiModelsData?.some((m) => m.id === modelId && m.is_downloaded));
  };

  const currentLocalDownloaded = isModelDownloaded(selectedModelId);

  const filteredCloudModels = freeCloudModels.filter((m) => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return m.name.toLowerCase().includes(q) || m.id.toLowerCase().includes(q);
  });

  return (
    <div className="relative inline-block" ref={dropdownRef}>
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        className="group flex items-center gap-1.5 rounded-lg border border-border bg-surface-hover/70 px-2 py-1 text-xs font-semibold text-fg hover:border-primary/40 hover:bg-surface-hover transition-all duration-150 active:scale-[0.98] cursor-pointer shadow-2xs"
        title="Select AI Engine & Model"
      >
        {activeProvider === "local" ? (
          <Lightning className="h-3 w-3 text-amber-400 group-hover:scale-110 transition-transform duration-150" weight="fill" />
        ) : (
          <Sparkle className="h-3 w-3 text-primary group-hover:scale-110 transition-transform duration-150" weight="fill" />
        )}
        <span className="max-w-[150px] truncate text-[11.5px] font-medium">{activeModelDisplay}</span>
        <CaretDown className={`h-3 w-3 text-fg-subtle transition-transform duration-200 ${open ? "rotate-180" : ""}`} />
      </button>

      {open && (
        <div className="absolute left-0 top-full mt-1.5 z-50 w-72 origin-top-left rounded-xl border border-border bg-surface p-2 shadow-2xl backdrop-blur-md animate-in fade-in zoom-in-95 duration-150">
          <div className="flex items-center justify-between pb-1.5 border-b border-border/70">
            <span className="text-[11px] font-bold text-fg">AI Engine & Model</span>
            <button
              type="button"
              onClick={() => {
                setOpen(false);
                onCloseModal();
                navigate("/settings");
              }}
              className="flex items-center gap-1 text-[10.5px] text-fg-muted hover:text-primary transition-colors cursor-pointer"
            >
              <Gear className="h-3 w-3" />
              <span>Settings</span>
            </button>
          </div>

          {/* Provider Switcher Tabs with Micro-motion */}
          <div className="grid grid-cols-2 gap-1 rounded-lg bg-surface-hover/80 p-1 my-2">
            <button
              type="button"
              onClick={() => setActiveProvider("local")}
              className={`flex items-center justify-center gap-1.5 rounded-md py-1 text-[11px] font-semibold transition-all duration-150 active:scale-95 cursor-pointer ${
                activeProvider === "local"
                  ? "bg-surface text-amber-300 shadow-xs border border-amber-500/20"
                  : "text-fg-muted hover:text-fg"
              }`}
            >
              <Lightning className="h-3 w-3 text-amber-400" weight="fill" />
              <span>Local AI</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveProvider("openrouter")}
              className={`flex items-center justify-center gap-1.5 rounded-md py-1 text-[11px] font-semibold transition-all duration-150 active:scale-95 cursor-pointer ${
                activeProvider === "openrouter"
                  ? "bg-surface text-primary shadow-xs border border-primary/20"
                  : "text-fg-muted hover:text-fg"
              }`}
            >
              <Sparkle className="h-3 w-3 text-primary" weight="fill" />
              <span>OpenRouter</span>
            </button>
          </div>

          {/* Local Provider Content */}
          {activeProvider === "local" ? (
            <div className="space-y-1 pt-0.5">
              <div className="px-1 text-[10px] text-fg-subtle font-medium uppercase tracking-wider mb-1">
                Local GGUF Models
              </div>
              {LOCAL_MODELS.map((m) => {
                const downloaded = isModelDownloaded(m.id);
                return (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => {
                      setSelectedModelId(m.id);
                      setOpen(false);
                    }}
                    className={`flex items-center justify-between w-full px-2 py-1.5 rounded-lg text-left text-xs transition-colors duration-150 active:scale-[0.99] cursor-pointer ${
                      selectedModelId === m.id
                        ? "bg-amber-500/10 text-amber-300 font-medium border border-amber-500/20"
                        : "hover:bg-surface-hover text-fg"
                    }`}
                  >
                    <div className="flex flex-col min-w-0 pr-2">
                      <div className="flex items-center gap-1.5">
                        <span className="text-[11.5px] leading-tight font-medium">{m.name}</span>
                        <span
                          className={`text-[9px] px-1.5 py-0.2 rounded-full ${
                            downloaded
                              ? "bg-emerald-500/15 text-emerald-400 font-semibold"
                              : "bg-surface-hover text-fg-subtle font-normal"
                          }`}
                        >
                          {downloaded ? "Ready" : m.size}
                        </span>
                      </div>
                      <span className="text-[9.5px] text-fg-subtle">{m.tag}</span>
                    </div>
                    {selectedModelId === m.id && (
                      <Check className="h-3.5 w-3.5 text-amber-400 shrink-0" weight="bold" />
                    )}
                  </button>
                );
              })}

              {!currentLocalDownloaded ? (
                <div className="mt-1.5 rounded-lg border border-amber-500/30 bg-amber-500/10 p-2 text-[11px] text-amber-300">
                  <div className="flex items-center gap-1.5 font-medium">
                    <WarningCircle className="h-3.5 w-3.5 shrink-0" />
                    <span>Model not downloaded</span>
                  </div>
                  <p className="text-[10px] text-amber-300/80 mt-0.5">
                    Download model in Settings to enable offline LLM inference.
                  </p>
                  <button
                    type="button"
                    onClick={() => {
                      setOpen(false);
                      onCloseModal();
                      navigate("/settings");
                    }}
                    className="mt-1.5 flex items-center gap-1 text-[10.5px] font-semibold text-amber-300 underline hover:text-amber-200 cursor-pointer"
                  >
                    <span>Open Settings to Download →</span>
                  </button>
                </div>
              ) : (
                <div className="pt-1 px-1 text-[10px] text-emerald-400/90 flex items-center gap-1">
                  <span>🛡️ 100% offline & private · Zero credits</span>
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-2 pt-0.5">
              <div className="flex items-center justify-between px-1 text-[10px] text-fg-subtle font-medium uppercase tracking-wider">
                <span>Free Cloud Models ({freeCloudModels.length})</span>
                <span className="text-fg-subtle lowercase">
                  {apiKeys.length} key{apiKeys.length === 1 ? "" : "s"}
                </span>
              </div>

              {apiKeys.length === 0 ? (
                <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-2 text-center text-[11px] text-amber-300">
                  <p className="font-medium">No API keys saved</p>
                  <button
                    type="button"
                    onClick={() => {
                      setOpen(false);
                      onCloseModal();
                      navigate("/settings");
                    }}
                    className="mt-1.5 inline-block text-[10.5px] font-semibold text-primary underline hover:text-primary-hover cursor-pointer"
                  >
                    Add OpenRouter key in Settings →
                  </button>
                </div>
              ) : (
                <>
                  <div className="relative px-0.5">
                    <MagnifyingGlass className="absolute left-2.5 top-2 h-3.5 w-3.5 text-fg-subtle" />
                    <input
                      type="text"
                      placeholder="Search free models…"
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                      className="w-full h-7 pl-7 pr-2 text-xs rounded-lg border border-border bg-surface-hover/60 placeholder:text-fg-subtle text-fg focus:outline-none focus:ring-1 focus:ring-primary"
                    />
                  </div>

                  <div className="max-h-52 overflow-y-auto scrollbar-thin pr-1 space-y-1">
                    {filteredCloudModels.length === 0 ? (
                      <div className="py-4 text-center text-xs text-fg-subtle">
                        No matching free models found
                      </div>
                    ) : (
                      filteredCloudModels.map((m) => (
                        <button
                          key={m.id}
                          type="button"
                          onClick={() => {
                            setSelectedModel(m.id);
                            setOpen(false);
                          }}
                          className={`flex items-center justify-between w-full px-2 py-1.5 rounded-lg text-left text-xs transition-colors duration-150 active:scale-[0.99] cursor-pointer ${
                            selectedModel === m.id
                              ? "bg-primary/10 text-primary font-medium border border-primary/20"
                              : "hover:bg-surface-hover text-fg"
                          }`}
                        >
                          <div className="flex flex-col min-w-0 pr-1.5">
                            <span className="text-[11.5px] truncate font-medium">{m.name}</span>
                            <span className="text-[9.5px] text-fg-subtle truncate">{m.desc}</span>
                          </div>
                          {selectedModel === m.id && (
                            <Check className="h-3.5 w-3.5 text-primary shrink-0" weight="bold" />
                          )}
                        </button>
                      ))
                    )}
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
