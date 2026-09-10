import { useEffect, useRef, useState, useCallback, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import {
  ArrowDown,
  ArrowUp,
  Cpu,
  Globe,
  Sparkle,
  Stop,
  Trash,
  X,
  CaretDown,
  Check,
  Paperclip,
  UploadSimple,
  Lightning,
  MagnifyingGlass,
  ArrowsClockwise,
  GearSix,
} from "@phosphor-icons/react";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import { toast } from "sonner";
import { useChatStore } from "../../store/chatStore";
import { useOpenRouterStore, type OpenRouterModel } from "../../store/openRouterStore";
import { fetchOpenRouterModels } from "../../lib/openRouterClient";
import { ChatMessageItem } from "./ChatMessageItem";
import { ChatLoadingIndicator } from "./ChatLoadingIndicator";
import { Button } from "../ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "../ui/tooltip";
import { cn } from "../../lib/utils";
import type { AiChatSource } from "../../types";

const LOCAL_MODELS = [
  { id: "qwen-1.5b", name: "Qwen 2.5 1.5B Instruct", shortName: "Qwen 1.5B", tag: "Fast & Offline" },
  { id: "qwen-3b", name: "Qwen 2.5 3B Instruct", shortName: "Qwen 3B", tag: "Precision" },
];

const DEFAULT_OPENROUTER_MODELS: OpenRouterModel[] = [
  { id: "meta-llama/llama-3.3-70b-instruct:free", name: "Llama 3.3 70B (Free)", is_free: true, context_length: 131072 },
  { id: "deepseek/deepseek-r1:free", name: "DeepSeek R1 (Free)", is_free: true, context_length: 163840 },
  { id: "deepseek/deepseek-chat:free", name: "DeepSeek V3 (Free)", is_free: true, context_length: 65536 },
  { id: "google/gemini-2.0-flash-exp:free", name: "Gemini 2.0 Flash (Free)", is_free: true, context_length: 1048576 },
  { id: "google/gemini-2.0-pro-exp-02-05:free", name: "Gemini 2.0 Pro (Free)", is_free: true, context_length: 2097152 },
  { id: "mistralai/mistral-small-24b-instruct-2501:free", name: "Mistral Small 24B (Free)", is_free: true, context_length: 32768 },
  { id: "qwen/qwen-2.5-72b-instruct:free", name: "Qwen 2.5 72B (Free)", is_free: true, context_length: 131072 },
  { id: "openai/gpt-4o-mini", name: "GPT-4o Mini", is_free: false, context_length: 128000 },
  { id: "openai/gpt-4o", name: "GPT-4o", is_free: false, context_length: 128000 },
  { id: "anthropic/claude-3.5-sonnet", name: "Claude 3.5 Sonnet", is_free: false, context_length: 200000 },
  { id: "google/gemini-2.5-flash", name: "Gemini 2.5 Flash", is_free: false, context_length: 1000000 },
];

const QUICK_STARTERS = [
  { label: "⚡ Move Candidate Stage", prompt: "Move Bilal Niazi to Interview stage" },
  { label: "📅 Add Follow-up Task", prompt: "Create a reminder to follow up on client feedback tomorrow at 10 AM" },
  { label: "👥 Who is Interviewing?", prompt: "Who are all candidates in interview stage?" },
  { label: "💼 Open Job Requisitions", prompt: "List all open job requisitions" },
];

export function AiChatDrawer() {
  const navigate = useNavigate();
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [showScrollBottom, setShowScrollBottom] = useState(false);

  // Tracks whether the user manually scrolled away from the bottom
  const isUserScrolledUpRef = useRef(false);

  const {
    isOpen,
    closeChat,
    messages,
    input,
    setInput,
    sendMessage,
    uploadAndParseResume,
    clearChat,
    loadingStep,
    loadingStepMessage,
    activeProvider,
    setActiveProvider,
    selectedLocalModelId,
    setSelectedLocalModelId,
    selectedOpenRouterModel,
    setSelectedOpenRouterModel,
    stopGeneration,
  } = useChatStore();

  const openRouterStore = useOpenRouterStore();
  const apiKeys = openRouterStore.apiKeys;

  const [modelSearch, setModelSearch] = useState("");
  const [freeOnlyFilter, setFreeOnlyFilter] = useState(false);
  const [isRefreshingModels, setIsRefreshingModels] = useState(false);

  // Synchronize active model and load catalog if empty
  useEffect(() => {
    if (isOpen) {
      if (openRouterStore.modelsCache.length === 0) {
        fetchOpenRouterModels().catch(() => {});
      }
      if (
        openRouterStore.selectedModel &&
        openRouterStore.selectedModel !== selectedOpenRouterModel
      ) {
        setSelectedOpenRouterModel(openRouterStore.selectedModel);
      }
    }
  }, [isOpen, openRouterStore.selectedModel, selectedOpenRouterModel]);

  const handleRefreshModels = async (e?: React.MouseEvent) => {
    e?.stopPropagation();
    setIsRefreshingModels(true);
    try {
      const list = await fetchOpenRouterModels();
      toast.success(`Loaded ${list.length} models from OpenRouter`);
    } catch {
      toast.error("Could not fetch models from OpenRouter API.");
    } finally {
      setIsRefreshingModels(false);
    }
  };

  const scrollToBottom = useCallback((behavior: ScrollBehavior = "smooth") => {
    isUserScrolledUpRef.current = false;
    setShowScrollBottom(false);
    messagesEndRef.current?.scrollIntoView({ behavior });
  }, []);

  // Monitor user wheel gestures to immediately free scroll position
  const handleWheel = (e: React.WheelEvent<HTMLDivElement>) => {
    if (e.deltaY < -2) {
      // User is scrolling upwards
      isUserScrolledUpRef.current = true;
      setShowScrollBottom(true);
    } else if (e.deltaY > 2) {
      const container = scrollContainerRef.current;
      if (container) {
        const distanceToBottom = container.scrollHeight - container.scrollTop - container.clientHeight;
        if (distanceToBottom < 40) {
          isUserScrolledUpRef.current = false;
          setShowScrollBottom(false);
        }
      }
    }
  };

  // Monitor scroll position
  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const { scrollTop, scrollHeight, clientHeight } = e.currentTarget;
    const distanceToBottom = scrollHeight - scrollTop - clientHeight;
    const isScrolledUp = distanceToBottom > 70;

    isUserScrolledUpRef.current = isScrolledUp;
    setShowScrollBottom(isScrolledUp);
  };

  // Instant non-blocking auto-scroll (zero thread contention with user mouse wheel)
  useEffect(() => {
    if (isOpen && !isUserScrolledUpRef.current) {
      const container = scrollContainerRef.current;
      if (container) {
        container.scrollTop = container.scrollHeight;
      }
    }
  }, [messages, loadingStep, isOpen]);

  // Focus textarea and reset scroll flag when drawer opens
  useEffect(() => {
    if (isOpen) {
      isUserScrolledUpRef.current = false;
      setTimeout(() => {
        textareaRef.current?.focus();
        const container = scrollContainerRef.current;
        if (container) {
          container.scrollTop = container.scrollHeight;
        }
      }, 100);
    }
  }, [isOpen]);

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      isUserScrolledUpRef.current = false;
      sendMessage();
    }
  }

  // Smart Entity Click & Drawer Handoff
  function handleEntityClick(source: AiChatSource) {
    closeChat();
    if (source.entity_type === "candidate") {
      navigate(`/candidates?candidate=${source.id}`);
    } else if (source.entity_type === "job") {
      navigate(`/jobs/${source.id}`);
    } else if (source.entity_type === "reminder") {
      navigate("/reminders");
    }
  }

  // Handle Drag & Drop Files
  function handleDragOver(e: React.DragEvent) {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  }

  function handleDragLeave(e: React.DragEvent) {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const file = e.dataTransfer.files[0];
      processResumeFile(file);
    }
  }

  function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    if (e.target.files && e.target.files.length > 0) {
      const file = e.target.files[0];
      processResumeFile(file);
      e.target.value = "";
    }
  }

  function processResumeFile(file: File) {
    const validExts = [".pdf", ".docx", ".doc", ".txt"];
    const ext = file.name.slice(file.name.lastIndexOf(".")).toLowerCase();
    if (!validExts.includes(ext)) {
      toast.error("Please drop a PDF, DOCX, or text resume file");
      return;
    }

    toast.info(`Parsing ${file.name}...`);
    isUserScrolledUpRef.current = false;
    uploadAndParseResume(file);
  }

  const isStreaming = loadingStep !== "idle";

  const availableOpenRouterModels = useMemo(() => {
    const rawList =
      openRouterStore.modelsCache.length > 0
        ? openRouterStore.modelsCache
        : DEFAULT_OPENROUTER_MODELS;

    let list = [...rawList];

    // Ensure selected model is always present in list even if not in default or cache
    if (
      selectedOpenRouterModel &&
      !list.some((m) => m.id === selectedOpenRouterModel)
    ) {
      list.unshift({
        id: selectedOpenRouterModel,
        name: selectedOpenRouterModel.split("/").pop() || selectedOpenRouterModel,
        is_free: selectedOpenRouterModel.includes(":free"),
        context_length: undefined,
      });
    }

    if (freeOnlyFilter) {
      list = list.filter((m) => m.is_free);
    }

    if (modelSearch.trim()) {
      const q = modelSearch.toLowerCase();
      list = list.filter(
        (m) =>
          m.name.toLowerCase().includes(q) ||
          m.id.toLowerCase().includes(q)
      );
    }

    return list;
  }, [
    openRouterStore.modelsCache,
    selectedOpenRouterModel,
    freeOnlyFilter,
    modelSearch,
  ]);

  const activeModelShort = useMemo(() => {
    if (activeProvider === "local") {
      return LOCAL_MODELS.find((m) => m.id === selectedLocalModelId)?.shortName ?? "Local AI";
    }
    const allKnown =
      openRouterStore.modelsCache.length > 0
        ? openRouterStore.modelsCache
        : DEFAULT_OPENROUTER_MODELS;
    const found = allKnown.find((m) => m.id === selectedOpenRouterModel);
    if (found) {
      return found.name.replace(/\(free\)/i, "").trim();
    }
    const tail = selectedOpenRouterModel.split("/").pop() || selectedOpenRouterModel;
    return tail.replace(/:free$/, "");
  }, [activeProvider, selectedLocalModelId, selectedOpenRouterModel, openRouterStore.modelsCache]);

  return (
    <div
      className={cn(
        "fixed inset-0 z-50 flex justify-end transition-all duration-300 ease-out",
        isOpen
          ? "bg-black/50 backdrop-blur-xs opacity-100 pointer-events-auto"
          : "bg-black/0 backdrop-blur-none opacity-0 pointer-events-none"
      )}
    >
      {/* Backdrop click to close */}
      <div className="flex-1" onClick={closeChat} />

      {/* Slide-over Drawer Panel with hardware-accelerated cubic bezier animation */}
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={cn(
          "relative flex h-full w-full max-w-lg flex-col border-l border-border/80 bg-bg shadow-2xl transition-transform duration-300 ease-[cubic-bezier(0.16,1,0.3,1)]",
          isOpen ? "translate-x-0" : "translate-x-full"
        )}
      >
        {/* Drag Overlay */}
        {isDragging && (
          <div className="absolute inset-0 z-50 flex flex-col items-center justify-center gap-3 bg-primary/15 backdrop-blur-xs border-2 border-dashed border-primary m-3 rounded-2xl animate-in fade-in-50">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary text-white shadow-lg">
              <UploadSimple className="h-7 w-7 animate-bounce" />
            </div>
            <div className="text-center">
              <p className="text-sm font-bold text-fg">Drop Resume File</p>
              <p className="text-xs text-fg-subtle">
                AI will extract details and create candidate in 1-click
              </p>
            </div>
          </div>
        )}

        {/* Hidden File Input for Paperclip */}
        <input
          ref={fileInputRef}
          type="file"
          accept=".pdf,.docx,.doc,.txt"
          onChange={handleFileSelect}
          className="hidden"
        />

        {/* Top Header */}
        <div className="flex items-center justify-between border-b border-border/60 bg-surface/90 px-4 py-2.5 backdrop-blur-md">
          {/* App Title & Status */}
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-primary/10 text-primary border border-primary/20 shadow-2xs">
              <Sparkle className="h-4 w-4" weight="fill" />
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <h3 className="font-display text-sm font-bold text-fg tracking-tight">RecDesk AI</h3>
                <span className="flex h-2 w-2 relative">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                </span>
              </div>
              <p className="text-[10.5px] text-fg-muted font-medium">
                1-click actions • database grounded
              </p>
            </div>
          </div>

          {/* Model Selector & Control Icons */}
          <div className="flex items-center gap-1.5">
            <DropdownMenu.Root>
              <DropdownMenu.Trigger asChild>
                <button className="flex h-7 items-center gap-1.5 rounded-lg border border-border/80 bg-surface px-2.5 text-xs font-semibold text-fg-subtle hover:border-primary/50 hover:text-fg hover:bg-surface-hover transition-all cursor-pointer shadow-2xs">
                  {activeProvider === "local" ? (
                    <Cpu className="h-3.5 w-3.5 text-emerald-500" />
                  ) : (
                    <Globe className="h-3.5 w-3.5 text-primary" />
                  )}
                  <span className="max-w-[100px] truncate">{activeModelShort}</span>
                  <CaretDown className="h-3 w-3 opacity-60" />
                </button>
              </DropdownMenu.Trigger>

              <DropdownMenu.Portal>
                <DropdownMenu.Content
                  align="end"
                  sideOffset={6}
                  className="z-50 w-80 sm:w-88 rounded-xl border border-border bg-surface p-2 shadow-2xl text-xs animate-in fade-in-50 backdrop-blur-md flex flex-col max-h-[460px]"
                >
                  {/* Provider Tabs */}
                  <div className="grid grid-cols-2 gap-1 p-0.5 rounded-lg bg-surface-hover/50 border border-border/50 mb-2">
                    <button
                      type="button"
                      onClick={() => {
                        setActiveProvider("local");
                        openRouterStore.setActiveProvider("local");
                      }}
                      className={cn(
                        "flex items-center justify-center gap-1.5 py-1 px-2 rounded-md font-semibold text-[11px] transition-all cursor-pointer",
                        activeProvider === "local"
                          ? "bg-surface text-fg shadow-xs border border-border"
                          : "text-fg-muted hover:text-fg"
                      )}
                    >
                      <Cpu className="h-3.5 w-3.5 text-emerald-500" />
                      <span>Local AI</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setActiveProvider("openrouter");
                        openRouterStore.setActiveProvider("openrouter");
                      }}
                      className={cn(
                        "flex items-center justify-center gap-1.5 py-1 px-2 rounded-md font-semibold text-[11px] transition-all cursor-pointer",
                        activeProvider === "openrouter"
                          ? "bg-surface text-fg shadow-xs border border-border"
                          : "text-fg-muted hover:text-fg"
                      )}
                    >
                      <Globe className="h-3.5 w-3.5 text-primary" />
                      <span>OpenRouter</span>
                    </button>
                  </div>

                  {activeProvider === "local" ? (
                    <div className="space-y-1 py-1">
                      <div className="px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-fg-muted flex items-center gap-1">
                        <Lightning className="h-3 w-3 text-emerald-500" weight="fill" />
                        <span>Local Offline Models</span>
                      </div>
                      {LOCAL_MODELS.map((model) => (
                        <DropdownMenu.Item
                          key={model.id}
                          onClick={() => {
                            setActiveProvider("local");
                            setSelectedLocalModelId(model.id as "qwen-1.5b" | "qwen-3b");
                            openRouterStore.setActiveProvider("local");
                          }}
                          className={cn(
                            "flex items-center justify-between rounded-lg px-2.5 py-2 cursor-pointer outline-none transition-colors",
                            activeProvider === "local" && selectedLocalModelId === model.id
                              ? "bg-primary/10 text-primary font-semibold"
                              : "text-fg-subtle hover:bg-surface-hover hover:text-fg"
                          )}
                        >
                          <div className="flex flex-col">
                            <span className="font-medium">{model.name}</span>
                            <span className="text-[10px] text-fg-muted">{model.tag}</span>
                          </div>
                          {activeProvider === "local" && selectedLocalModelId === model.id && (
                            <Check className="h-4 w-4 text-primary" />
                          )}
                        </DropdownMenu.Item>
                      ))}
                    </div>
                  ) : (
                    <div className="flex flex-col min-h-0 flex-1">
                      {/* Search & Filter Header */}
                      <div className="flex items-center gap-1.5 pb-2">
                        <div className="relative flex-1">
                          <MagnifyingGlass className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3 w-3 text-fg-muted" />
                          <input
                            type="text"
                            value={modelSearch}
                            onChange={(e) => setModelSearch(e.target.value)}
                            placeholder="Search OpenRouter models…"
                            className="h-7 w-full rounded-md border border-border bg-bg pl-7 pr-2 text-[11px] placeholder:text-fg-muted focus:outline-none focus:border-primary/60"
                            onClick={(e) => e.stopPropagation()}
                            onKeyDown={(e) => e.stopPropagation()}
                          />
                        </div>

                        <button
                          type="button"
                          onClick={() => setFreeOnlyFilter(!freeOnlyFilter)}
                          className={cn(
                            "h-7 px-2 rounded-md border text-[10.5px] font-semibold transition-colors flex items-center gap-1 cursor-pointer shrink-0",
                            freeOnlyFilter
                              ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                              : "border-border bg-surface-hover text-fg-muted hover:text-fg"
                          )}
                          title="Toggle Free Models Only"
                        >
                          <Sparkle className="h-2.5 w-2.5" weight={freeOnlyFilter ? "fill" : "regular"} />
                          <span>Free</span>
                        </button>

                        <button
                          type="button"
                          onClick={handleRefreshModels}
                          disabled={isRefreshingModels}
                          className="h-7 w-7 rounded-md border border-border bg-surface text-fg-muted hover:text-fg hover:bg-surface-hover flex items-center justify-center cursor-pointer shrink-0 disabled:opacity-50"
                          title="Refresh OpenRouter model catalog"
                        >
                          <ArrowsClockwise className={cn("h-3 w-3", isRefreshingModels && "animate-spin")} />
                        </button>
                      </div>

                      {apiKeys.length === 0 && (
                        <div className="mb-2 rounded-lg bg-amber-500/10 border border-amber-500/20 px-2.5 py-1.5 flex items-center justify-between text-[11px] text-amber-600 dark:text-amber-400">
                          <span>API Key required</span>
                          <button
                            type="button"
                            onClick={() => {
                              closeChat();
                              navigate("/settings");
                            }}
                            className="underline font-semibold hover:text-amber-500 cursor-pointer text-[10.5px]"
                          >
                            Add Key
                          </button>
                        </div>
                      )}

                      {/* Scrollable Model List */}
                      <div className="overflow-y-auto max-h-56 pr-1 space-y-0.5 scrollbar-thin flex-1">
                        {availableOpenRouterModels.length === 0 ? (
                          <div className="py-6 text-center text-[11px] text-fg-muted">
                            No models found matching "{modelSearch}".
                          </div>
                        ) : (
                          availableOpenRouterModels.map((model) => {
                            const isSelected = activeProvider === "openrouter" && selectedOpenRouterModel === model.id;
                            const ctxK = model.context_length ? `${Math.round(model.context_length / 1024)}k` : "";

                            return (
                              <DropdownMenu.Item
                                key={model.id}
                                onClick={() => {
                                  setActiveProvider("openrouter");
                                  setSelectedOpenRouterModel(model.id);
                                  openRouterStore.setSelectedModel(model.id);
                                  openRouterStore.setActiveProvider("openrouter");
                                }}
                                className={cn(
                                  "flex items-center justify-between rounded-lg px-2.5 py-1.5 cursor-pointer outline-none transition-colors text-[11.5px]",
                                  isSelected
                                    ? "bg-primary/10 text-primary font-semibold"
                                    : "text-fg-subtle hover:bg-surface-hover hover:text-fg"
                                )}
                              >
                                <div className="min-w-0 flex-1 pr-2">
                                  <div className="flex items-center gap-1.5">
                                    <span className="truncate">{model.name}</span>
                                    {model.is_free && (
                                      <span className="rounded bg-emerald-500/15 px-1 py-0.2 text-[8.5px] font-bold text-emerald-600 dark:text-emerald-400 shrink-0">
                                        FREE
                                      </span>
                                    )}
                                  </div>
                                  <div className="flex items-center gap-2 text-[10px] text-fg-muted truncate">
                                    <span className="truncate">{model.id}</span>
                                    {ctxK && <span className="font-mono shrink-0">· {ctxK}</span>}
                                  </div>
                                </div>
                                {isSelected && <Check className="h-4 w-4 shrink-0 text-primary" />}
                              </DropdownMenu.Item>
                            );
                          })
                        )}
                      </div>

                      {/* Footer */}
                      <div className="mt-2 pt-1.5 border-t border-border/50 flex items-center justify-between text-[10.5px] text-fg-muted px-1">
                        <span>{availableOpenRouterModels.length} models available</span>
                        <button
                          type="button"
                          onClick={() => {
                            closeChat();
                            navigate("/settings");
                          }}
                          className="hover:text-primary transition-colors cursor-pointer flex items-center gap-1"
                        >
                          <GearSix className="h-3 w-3" />
                          <span>Configure Keys</span>
                        </button>
                      </div>
                    </div>
                  )}
                </DropdownMenu.Content>
              </DropdownMenu.Portal>
            </DropdownMenu.Root>

            {/* Clear Chat */}
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  onClick={clearChat}
                  className="flex h-7 w-7 items-center justify-center rounded-lg border border-border/70 bg-surface text-fg-muted hover:text-rose-500 hover:border-rose-500/40 transition-colors cursor-pointer shadow-2xs"
                >
                  <Trash className="h-3.5 w-3.5" />
                </button>
              </TooltipTrigger>
              <TooltipContent>Clear chat history</TooltipContent>
            </Tooltip>

            {/* Close */}
            <button
              onClick={closeChat}
              className="flex h-7 w-7 items-center justify-center rounded-lg border border-border/70 bg-surface text-fg-muted hover:text-fg hover:border-border-strong transition-colors cursor-pointer shadow-2xs"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>

        {/* Message Thread with non-blocking scroll and wheel listeners */}
        <div
          ref={scrollContainerRef}
          onScroll={handleScroll}
          onWheel={handleWheel}
          className="relative flex-1 overflow-y-auto p-4 space-y-2 [scrollbar-width:thin]"
        >
          {messages.map((msg) => (
            <ChatMessageItem
              key={msg.id}
              message={msg}
              onFollowupClick={(prompt) => {
                isUserScrolledUpRef.current = false;
                sendMessage(prompt);
              }}
              onEntityClick={handleEntityClick}
            />
          ))}

          {/* Live Multi-Step Loading Bubble */}
          <ChatLoadingIndicator step={loadingStep} message={loadingStepMessage} />

          <div ref={messagesEndRef} />
        </div>

        {/* Floating Scroll-to-Bottom Button */}
        {showScrollBottom && (
          <button
            onClick={() => scrollToBottom("smooth")}
            className="absolute bottom-24 right-6 z-30 flex h-8 w-8 items-center justify-center rounded-full bg-surface border border-border/80 shadow-lg text-fg-subtle hover:text-primary hover:border-primary/50 transition-all duration-150 animate-in fade-in cursor-pointer active:scale-95"
            title="Scroll to bottom"
          >
            <ArrowDown className="h-4 w-4" weight="bold" />
          </button>
        )}

        {/* Quick Starters (if only welcome message) */}
        {messages.length <= 1 && (
          <div className="px-4 pb-2">
            <p className="text-[10.5px] font-bold uppercase tracking-wider text-fg-muted mb-2 flex items-center gap-1">
              <Sparkle className="h-3 w-3 text-primary" weight="fill" />
              <span>Try asking or executing actions:</span>
            </p>
            <div className="grid grid-cols-2 gap-1.5">
              {QUICK_STARTERS.map((item, idx) => (
                <button
                  key={idx}
                  onClick={() => {
                    isUserScrolledUpRef.current = false;
                    sendMessage(item.prompt);
                  }}
                  className="flex flex-col items-start rounded-xl border border-border/70 bg-surface p-2.5 text-left text-xs font-medium text-fg-subtle hover:border-primary/50 hover:bg-primary/5 hover:text-primary hover:shadow-xs transition-all duration-150 cursor-pointer group"
                >
                  <span className="font-semibold text-fg text-[11.5px] group-hover:text-primary transition-colors">
                    {item.label}
                  </span>
                  <span className="line-clamp-1 text-[10px] text-fg-muted mt-0.5">
                    {item.prompt}
                  </span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Footer & Input Box */}
        <div className="border-t border-border/60 bg-surface/90 p-3 backdrop-blur-md">
          <div className="relative flex flex-col rounded-xl border border-border bg-bg focus-within:border-primary focus-within:ring-2 focus-within:ring-primary/20 transition-all shadow-xs">
            <textarea
              ref={textareaRef}
              rows={2}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Ask anything, type an action (e.g. 'Move Bilal to Interview'), or drop a resume…"
              className="w-full resize-none bg-transparent p-3 text-xs text-fg placeholder:text-fg-muted outline-none [scrollbar-width:none]"
            />

            <div className="flex items-center justify-between px-3 pb-2.5 pt-1 text-[11px] text-fg-muted border-t border-border/40">
              <div className="flex items-center gap-2">
                {/* Resume Attach Button */}
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button
                      onClick={() => fileInputRef.current?.click()}
                      className="flex h-6 items-center gap-1 rounded-md border border-border bg-surface px-2 text-[10.5px] font-semibold text-fg-subtle hover:border-primary/50 hover:text-primary hover:bg-primary/5 transition-colors cursor-pointer shadow-2xs"
                    >
                      <Paperclip className="h-3 w-3 text-primary" />
                      <span>Attach Resume</span>
                    </button>
                  </TooltipTrigger>
                  <TooltipContent>Drop or attach PDF/DOCX to parse</TooltipContent>
                </Tooltip>

                {activeProvider === "local" ? (
                  <span className="hidden sm:inline-flex items-center gap-1 text-[10.5px] text-emerald-500 font-semibold">
                    <Cpu className="h-3 w-3" />
                    <span>Local Mode</span>
                  </span>
                ) : (
                  <span className="hidden sm:inline-flex items-center gap-1 text-[10.5px] text-primary font-semibold">
                    <Globe className="h-3 w-3" />
                    <span>Cloud Mode</span>
                  </span>
                )}
              </div>

              <div className="flex items-center gap-2">
                <span className="text-[10px] text-fg-muted hidden sm:inline">
                  Enter ↵
                </span>

                {isStreaming ? (
                  <Button
                    size="sm"
                    variant="destructive"
                    onClick={stopGeneration}
                    className="h-6.5 gap-1 px-2 text-xs rounded-lg"
                  >
                    <Stop className="h-3 w-3" weight="fill" />
                    <span>Stop</span>
                  </Button>
                ) : (
                  <Button
                    size="sm"
                    onClick={() => {
                      isUserScrolledUpRef.current = false;
                      sendMessage();
                    }}
                    disabled={!input.trim()}
                    className="h-6.5 w-6.5 p-0 rounded-lg shadow-xs active:scale-95"
                  >
                    <ArrowUp className="h-3.5 w-3.5" weight="bold" />
                  </Button>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
