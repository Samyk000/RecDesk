import { useState, useRef, useEffect } from "react";
import {
  CaretDown,
  Sparkle,
  Gear,
  Check,
  MagnifyingGlass,
} from "@phosphor-icons/react";
import { useNavigate } from "react-router-dom";

interface Props {
  selectedModel: string;
  setSelectedModel: (id: string) => void;
  activeModelDisplay: string;
  freeCloudModels: { id: string; name: string; desc: string }[];
  apiKeys: string[];
  onCloseModal: () => void;
}

export function ModelSelectorDropdown({
  selectedModel,
  setSelectedModel,
  activeModelDisplay,
  freeCloudModels,
  apiKeys,
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
        title="Select AI Model"
      >
        <Sparkle className="h-3 w-3 text-primary group-hover:scale-110 transition-transform duration-150" weight="fill" />
        <span className="max-w-[150px] truncate text-[11.5px] font-medium">{activeModelDisplay}</span>
        <CaretDown className={`h-3 w-3 text-fg-subtle transition-transform duration-200 ${open ? "rotate-180" : ""}`} />
      </button>

      {open && (
        <div className="absolute left-0 top-full mt-1.5 z-50 w-72 origin-top-left rounded-xl border border-border bg-surface p-2 shadow-2xl backdrop-blur-md animate-in fade-in zoom-in-95 duration-150">
          <div className="flex items-center justify-between pb-1.5 border-b border-border/70">
            <span className="text-[11px] font-bold text-fg">AI Model (OpenRouter)</span>
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

          <div className="space-y-2 pt-1.5">
            <div className="flex items-center justify-between px-1 text-[10px] text-fg-subtle font-medium uppercase tracking-wider">
              <span>Cloud Models ({freeCloudModels.length})</span>
              <span className="text-fg-subtle lowercase">
                {apiKeys.length} key{apiKeys.length === 1 ? "" : "s"}
              </span>
            </div>

            {apiKeys.length === 0 ? (
              <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-2.5 text-center text-[11px] text-amber-300 space-y-1">
                <p className="font-medium">No OpenRouter API key configured</p>
                <p className="text-[10px] text-fg-subtle">
                  Resumes will format instantly using the built-in offline engine.
                </p>
                <button
                  type="button"
                  onClick={() => {
                    setOpen(false);
                    onCloseModal();
                    navigate("/settings");
                  }}
                  className="mt-1 inline-block text-[10.5px] font-semibold text-primary underline hover:text-primary-hover cursor-pointer"
                >
                  Configure Key in Settings →
                </button>
              </div>
            ) : (
              <>
                <div className="relative px-0.5">
                  <MagnifyingGlass className="absolute left-2.5 top-2 h-3.5 w-3.5 text-fg-subtle" />
                  <input
                    type="text"
                    placeholder="Search models…"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="w-full h-7 pl-7 pr-2 text-xs rounded-lg border border-border bg-surface-hover/60 placeholder:text-fg-subtle text-fg focus:outline-none focus:ring-1 focus:ring-primary"
                  />
                </div>

                <div className="max-h-52 overflow-y-auto scrollbar-thin pr-1 space-y-1">
                  {filteredCloudModels.length === 0 ? (
                    <div className="py-4 text-center text-xs text-fg-subtle">
                      No matching models found
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

            <div className="pt-1 px-1 text-[10px] text-fg-subtle border-t border-border/60 flex items-center justify-between">
              <span>Zero-credit offline fallback active</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
