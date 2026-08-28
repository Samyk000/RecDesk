import { useEffect, useState } from "react";
import {
  Check,
  CircleNotch,
  Cpu,
  Database,
  DownloadSimple,
  FileXls,
  Info,
  Lightning,
  Monitor,
  Moon,
  ShieldCheck,
  Sparkle,
  Sun,
  Trash,
  UploadSimple,
  X,
} from "@phosphor-icons/react";
import { toast } from "sonner";
import { open as openDialog, save as saveDialog } from "@tauri-apps/plugin-dialog";
import { readFile, readTextFile, writeFile, writeTextFile } from "@tauri-apps/plugin-fs";
import { listen } from "@tauri-apps/api/event";
import { useQueryClient } from "@tanstack/react-query";
import { useTheme } from "../store/theme";
import { useProfile } from "../store/profile";
import { useAiStore } from "../store/ai";
import { useOpenRouterStore } from "../store/openRouterStore";
import { US_TIME_ZONES } from "../lib/constants";
import { apiClients, apiData, apiJobs } from "../lib/api";
import {
  useAiModels,
  useDownloadAiModel,
  useCancelAiDownload,
  useDeleteAiModel,
} from "../hooks/useQueries";
import { PageHeader } from "../components/common/PageHeader";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Switch } from "../components/ui/switch";
import { errorMessage, cn } from "../lib/utils";
import { generateExcelWorkbook, generateSampleExcelTemplate } from "../lib/excelExport";
import { parseExcelImport, type ExcelImportValidation } from "../lib/excelImport";
import { ExcelImportPreviewDialog } from "../components/common/ExcelImportPreviewDialog";
import { OpenRouterSettings } from "../components/settings/OpenRouterSettings";
import type { DownloadProgressPayload, ExportEnvelope, ThemeMode, ThemeName } from "../types";

const themeOptions: { value: ThemeMode; label: string; icon: typeof Sun }[] = [
  { value: "light", label: "Light", icon: Sun },
  { value: "dark", label: "Dark", icon: Moon },
  { value: "system", label: "System", icon: Monitor },
];

const colorThemes: { value: ThemeName; label: string; primary: string; bg: string; darkBg: string }[] = [
  { value: "blue", label: "Blue", primary: "#2563eb", bg: "#f2f5fa", darkBg: "#0c0c0f" },
  { value: "teal", label: "Teal", primary: "#0d9488", bg: "#e9f4f1", darkBg: "#0a1211" },
  { value: "emerald", label: "Emerald", primary: "#059669", bg: "#eaf5f0", darkBg: "#08130e" },
  { value: "forest", label: "Forest", primary: "#7a8f3d", bg: "#f1f4e7", darkBg: "#0d100a" },
  { value: "amber", label: "Amber", primary: "#d97706", bg: "#f7f3ec", darkBg: "#120e0b" },
  { value: "sunset", label: "Sunset", primary: "#f97316", bg: "#faf3ea", darkBg: "#120d08" },
  { value: "rose", label: "Rose", primary: "#e11d48", bg: "#faf1f3", darkBg: "#150d10" },
  { value: "violet", label: "Violet", primary: "#7c3aed", bg: "#f1eefb", darkBg: "#0d0b15" },
  { value: "slate", label: "Slate", primary: "#0284c7", bg: "#edf2f7", darkBg: "#080c14" },
];

function formatModelSize(mb: number): string {
  if (mb >= 1000) {
    return `${(mb / 1000).toFixed(2)} GB`;
  }
  return `${mb} MB`;
}

export function Settings() {
  const qc = useQueryClient();
  const { mode, theme, setMode, setTheme } = useTheme();
  const { name, setName, timeZones, setTimeZones } = useProfile();
  const { selectedModelId, setSelectedModelId } = useAiStore();
  const { activeProvider, setActiveProvider } = useOpenRouterStore();

  const { data: aiModels, refetch: refetchModels } = useAiModels();
  const downloadAiMutation = useDownloadAiModel();
  const cancelAiMutation = useCancelAiDownload();
  const deleteAiMutation = useDeleteAiModel();

  const [downloadProgress, setDownloadProgress] = useState<DownloadProgressPayload | null>(null);
  const [downloadingModelId, setDownloadingModelId] = useState<string | null>(null);

  const [replace, setReplace] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [excelValidation, setExcelValidation] = useState<ExcelImportValidation | null>(null);

  useEffect(() => {
    const unlisten = listen<DownloadProgressPayload>("ai-download-progress", (event) => {
      setDownloadProgress(event.payload);
      if (event.payload.is_complete) {
        setDownloadingModelId(null);
        setDownloadProgress(null);
        refetchModels();
        toast.success("AI model downloaded and ready for offline use!");
      }
    });

    return () => {
      unlisten.then((fn) => fn());
    };
  }, [refetchModels]);

  function invalidateAllDataQueries() {
    qc.invalidateQueries({ queryKey: ["clients"] });
    qc.invalidateQueries({ queryKey: ["jobs"] });
    qc.invalidateQueries({ queryKey: ["candidates"] });
    qc.invalidateQueries({ queryKey: ["dashboard"] });
    qc.invalidateQueries({ queryKey: ["globalSearch"] });
    qc.invalidateQueries({ queryKey: ["reminders"] });
  }

  async function handleDownloadModel(modelId: string) {
    setDownloadingModelId(modelId);
    setDownloadProgress(null);
    try {
      await downloadAiMutation.mutateAsync(modelId);
      refetchModels();
    } catch (err) {
      setDownloadingModelId(null);
      setDownloadProgress(null);
      const msg = errorMessage(err);
      if (!msg.includes("cancelled")) {
        toast.error(`Download failed: ${msg}`);
      }
    }
  }

  async function handleCancelDownload(modelId: string) {
    try {
      await cancelAiMutation.mutateAsync(modelId);
      setDownloadingModelId(null);
      setDownloadProgress(null);
      refetchModels();
      toast.info("Model download cancelled");
    } catch (err) {
      toast.error(`Cancel failed: ${errorMessage(err)}`);
    }
  }

  async function handleDeleteModel(modelId: string) {
    try {
      await deleteAiMutation.mutateAsync(modelId);
      refetchModels();
      toast.success("AI model removed from local disk");
    } catch (err) {
      toast.error(`Delete failed: ${errorMessage(err)}`);
    }
  }

  async function exportJsonData() {
    setBusy("export-json");
    try {
      const json = await apiData.export();
      const path = await saveDialog({
        title: "Export JSON backup",
        defaultPath: `recdesk-backup-${new Date().toISOString().slice(0, 10)}.json`,
        filters: [{ name: "JSON", extensions: ["json"] }],
      });
      if (!path) return;
      await writeTextFile(path, json);
      toast.success("JSON backup exported");
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setBusy(null);
    }
  }

  async function exportExcelData() {
    setBusy("export-excel");
    try {
      const json = await apiData.export();
      const envelope: ExportEnvelope = JSON.parse(json);
      const excelBytes = generateExcelWorkbook(envelope);

      const path = await saveDialog({
        title: "Export Excel workbook",
        defaultPath: `recdesk-export-${new Date().toISOString().slice(0, 10)}.xlsx`,
        filters: [{ name: "Excel Workbook", extensions: ["xlsx"] }],
      });
      if (!path) return;
      await writeFile(path, excelBytes);
      toast.success("Excel workbook exported");
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setBusy(null);
    }
  }

  async function downloadExcelTemplate() {
    setBusy("template");
    try {
      const templateBytes = generateSampleExcelTemplate();
      const path = await saveDialog({
        title: "Save sample Excel template",
        defaultPath: `recdesk-sample-template.xlsx`,
        filters: [{ name: "Excel Workbook", extensions: ["xlsx"] }],
      });
      if (!path) return;
      await writeFile(path, templateBytes);
      toast.success("Sample Excel template saved");
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setBusy(null);
    }
  }

  async function handleImportClick() {
    setBusy("import");
    try {
      const path = await openDialog({
        title: "Import data (JSON or Excel)",
        multiple: false,
        filters: [
          { name: "Supported Data Files", extensions: ["json", "xlsx", "xls"] },
          { name: "Excel Workbook", extensions: ["xlsx", "xls"] },
          { name: "JSON Backup", extensions: ["json"] },
        ],
      });
      if (!path || typeof path !== "string") return;

      const lower = path.toLowerCase();
      if (lower.endsWith(".xlsx") || lower.endsWith(".xls")) {
        // Read Excel binary
        const bytes = await readFile(path);
        const [existingClients, existingJobs] = await Promise.all([
          apiClients.list().catch(() => []),
          apiJobs.list().catch(() => []),
        ]);
        const validation = parseExcelImport(bytes, existingClients, existingJobs);
        setExcelValidation(validation);
      } else {
        // Read JSON text
        const json = await readTextFile(path);
        const summary = await apiData.import(json, replace);
        invalidateAllDataQueries();
        toast.success(
          `Imported ${summary.clients} clients, ${summary.jobs} jobs, ${summary.candidates} candidates${summary.reminders ? `, ${summary.reminders} reminders` : ""}`,
        );
      }
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setBusy(null);
    }
  }

  async function confirmExcelImport() {
    if (!excelValidation) return;
    setBusy("confirming-excel");
    try {
      const json = JSON.stringify(excelValidation.envelope);
      const summary = await apiData.import(json, replace);
      invalidateAllDataQueries();
      setExcelValidation(null);
      toast.success(
        `Imported ${summary.clients} clients, ${summary.jobs} jobs, ${summary.candidates} candidates from Excel`,
      );
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="px-6 pt-3.5 pb-6">
      <PageHeader title="Settings" subtitle="Preferences, AI models, and data management" />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        {/* Left Column: Preferences */}
        <div className="space-y-4 lg:col-span-1">
          <section className="rounded-xl border border-border bg-surface p-4.5 space-y-4">
            <div>
              <h2 className="font-display text-[14.5px] font-semibold tracking-tight text-fg">Appearance</h2>
              <p className="mt-0.5 text-xs text-fg-subtle">Interface mode and color themes.</p>
            </div>

            {/* Mode Selector */}
            <div className="grid grid-cols-3 gap-1.5">
              {themeOptions.map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => setMode(opt.value)}
                  className={cn(
                    "flex h-8 cursor-pointer items-center justify-center gap-1.5 rounded-lg border text-xs font-medium transition-all duration-150 active:scale-[0.97]",
                    mode === opt.value
                      ? "border-primary/50 bg-primary/10 text-fg font-semibold shadow-raise"
                      : "border-border text-fg-muted hover:bg-surface-hover hover:text-fg",
                  )}
                >
                  <opt.icon className="h-3.5 w-3.5" />
                  {opt.label}
                </button>
              ))}
            </div>

            {/* Color Palette */}
            <div className="grid grid-cols-3 gap-1.5">
              {colorThemes.map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => setTheme(opt.value)}
                  title={`${opt.label} theme`}
                  className={cn(
                    "flex h-7.5 cursor-pointer items-center justify-center gap-1.5 rounded-lg border px-2 text-xs font-medium transition-all duration-150 active:scale-[0.97]",
                    theme === opt.value
                      ? "border-primary/50 bg-primary/10 text-fg font-semibold shadow-raise"
                      : "border-border text-fg-muted hover:bg-surface-hover hover:text-fg",
                  )}
                >
                  <span
                    className="relative h-3.5 w-3.5 shrink-0 overflow-hidden rounded-full border border-border-strong"
                    style={{
                      background: `linear-gradient(135deg, ${opt.bg} 50%, ${opt.darkBg} 50%)`,
                    }}
                  >
                    <span
                      className="absolute left-1/2 top-1/2 h-1.5 w-1.5 -translate-x-1/2 -translate-y-1/2 rounded-full"
                      style={{ background: opt.primary }}
                    />
                  </span>
                  {opt.label}
                </button>
              ))}
            </div>

            {/* Compact Name Section */}
            <div className="flex items-center justify-between gap-3 border-t border-border/70 pt-3">
              <div className="min-w-0 flex-1">
                <p className="text-xs font-semibold text-fg">Your Name</p>
                <p className="text-[11px] text-fg-subtle">Greeting on dashboard</p>
              </div>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Samy"
                className="h-7.5 w-36 text-xs text-right"
              />
            </div>

            {/* Compact Clock Section */}
            <div className="border-t border-border/70 pt-3 space-y-2">
              <div className="flex items-center justify-between">
                <p className="text-xs font-semibold text-fg">Dashboard Clock</p>
                <p className="text-[10.5px] text-fg-subtle">US time zones</p>
              </div>
              <div className="grid grid-cols-4 gap-1.5">
                {US_TIME_ZONES.map((tz) => {
                  const active = timeZones.includes(tz.zone);
                  return (
                    <button
                      key={tz.zone}
                      onClick={() =>
                        setTimeZones(
                          active
                            ? timeZones.filter((z) => z !== tz.zone)
                            : [...timeZones, tz.zone],
                        )
                      }
                      className={cn(
                        "flex h-7 cursor-pointer items-center justify-center rounded-md border text-[11px] font-medium transition-all duration-150 active:scale-[0.97]",
                        active
                          ? "border-primary/50 bg-primary/10 text-primary font-semibold shadow-raise"
                          : "border-border text-fg-muted hover:bg-surface-hover hover:text-fg",
                      )}
                    >
                      {tz.label}
                    </button>
                  );
                })}
              </div>
            </div>
          </section>

          <section className="rounded-xl border border-border bg-surface p-4 space-y-1">
            <h2 className="font-display flex items-center gap-1.5 text-xs font-semibold text-fg">
              <Info className="h-3.5 w-3.5 text-fg-subtle" />
              About RecDesk
            </h2>
            <p className="text-[11.5px] text-fg-muted leading-relaxed">
              Local-first personal recruiting tracker. Built with Tauri, Rust, SQLite, and React.
            </p>
          </section>
        </div>

        {/* Right Column: AI & Data Management */}
        <div className="space-y-4 lg:col-span-2">
          {/* Unified AI Models Card */}
          <section className="rounded-xl border border-border bg-surface p-4 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border/70 pb-2.5">
              <div>
                <h2 className="font-display flex items-center gap-2 text-[14.5px] font-semibold tracking-tight text-fg">
                  <Sparkle className="h-4 w-4 text-primary" />
                  AI Models
                </h2>
                <p className="mt-0.5 text-xs text-fg-subtle">
                  Choose between local on-device models or cloud OpenRouter for AI features.
                </p>
              </div>

              {/* Segmented Pill Tabs */}
              <div className="flex items-center gap-1 rounded-lg border border-border bg-surface-hover/50 p-0.5">
                <button
                  type="button"
                  onClick={() => setActiveProvider("local")}
                  className={cn(
                    "cursor-pointer flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium transition-all duration-150 active:scale-[0.97]",
                    activeProvider === "local"
                      ? "bg-primary text-white font-semibold shadow-raise"
                      : "text-fg-muted hover:text-fg"
                  )}
                >
                  <Cpu className="h-3.5 w-3.5" />
                  Local AI
                </button>
                <button
                  type="button"
                  onClick={() => setActiveProvider("openrouter")}
                  className={cn(
                    "cursor-pointer flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium transition-all duration-150 active:scale-[0.97]",
                    activeProvider === "openrouter"
                      ? "bg-primary text-white font-semibold shadow-raise"
                      : "text-fg-muted hover:text-fg"
                  )}
                >
                  <Lightning className="h-3.5 w-3.5" />
                  OpenRouter
                </button>
              </div>
            </div>

            {/* Tab 1: Local AI */}
            {activeProvider === "local" && (
              <div className="space-y-2.5 animate-fade-in">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-2.5">
                  {(aiModels || []).map((model) => {
                    const isSelected = selectedModelId === model.id;
                    const isDownloading = downloadingModelId === model.id;

                    return (
                      <div
                        key={model.id}
                        onClick={() => setSelectedModelId(model.id)}
                        className={cn(
                          "flex flex-col justify-between rounded-lg border p-3 space-y-2 cursor-pointer transition-all duration-150",
                          isSelected
                            ? "border-primary/60 bg-primary/5 shadow-raise"
                            : "border-border/70 bg-surface-hover/30 hover:border-border hover:bg-surface-hover/60",
                        )}
                      >
                        <div>
                          <div className="flex items-center justify-between gap-1">
                            <span className="text-[12.5px] font-semibold text-fg truncate">{model.name}</span>
                            {model.tier === "balanced" && (
                              <span className="rounded bg-primary/15 px-1.5 py-0.2 text-[9.5px] font-medium text-primary shrink-0">
                                Recommended
                              </span>
                            )}
                          </div>
                          <p className="mt-1 text-[11px] text-fg-subtle leading-relaxed line-clamp-2">
                            {model.description}
                          </p>
                        </div>

                        <div className="pt-1.5 border-t border-border/40 flex items-center justify-between text-xs">
                          <span className="text-[11px] font-medium text-fg-muted">
                            {formatModelSize(model.size_mb)}
                          </span>
                          {model.is_downloaded ? (
                            <div className="flex items-center gap-1">
                              <span className="inline-flex items-center gap-1 text-[11px] font-medium text-emerald-600 dark:text-emerald-400">
                                <Check className="h-3 w-3" /> Ready
                              </span>
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleDeleteModel(model.id);
                                }}
                                className="ml-1 text-fg-subtle hover:text-red-500 p-0.5 cursor-pointer"
                                title="Delete model file from disk"
                              >
                                <Trash className="h-3 w-3" />
                              </button>
                            </div>
                          ) : isDownloading ? (
                            <div className="flex items-center gap-1.5">
                              <span className="inline-flex items-center gap-1 text-[11px] font-medium text-primary">
                                <CircleNotch className="h-3 w-3 animate-spin" />
                                {downloadProgress ? `${Math.round(downloadProgress.percentage)}%` : "Starting…"}
                              </span>
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleCancelDownload(model.id);
                                }}
                                className="rounded p-0.5 text-fg-subtle hover:bg-surface-hover hover:text-red-500 cursor-pointer"
                                title="Cancel download"
                              >
                                <X className="h-3 w-3" />
                              </button>
                            </div>
                          ) : (
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-6 px-2 text-[11px] cursor-pointer"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleDownloadModel(model.id);
                              }}
                            >
                              Download
                            </Button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Download progress bar with Cancel button */}
                {downloadProgress && downloadingModelId && (
                  <div className="rounded-lg border border-primary/20 bg-primary/5 p-2.5 space-y-1.5 animate-fade-in">
                    <div className="flex items-center justify-between text-xs font-medium">
                      <span className="text-primary flex items-center gap-1.5 truncate">
                        <CircleNotch className="h-3.5 w-3.5 animate-spin shrink-0" />
                        Downloading model to AppData…
                      </span>
                      <div className="flex items-center gap-2 shrink-0">
                        <span className="text-fg-subtle text-[11px]">
                          {(downloadProgress.downloaded_bytes / (1024 * 1024)).toFixed(0)} MB /{" "}
                          {(downloadProgress.total_bytes / (1024 * 1024)).toFixed(0)} MB (
                          {Math.round(downloadProgress.percentage)}%)
                        </span>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-5 px-1.5 text-[10.5px] text-red-500 hover:bg-red-500/10 cursor-pointer"
                          onClick={() => handleCancelDownload(downloadingModelId)}
                        >
                          Cancel
                        </Button>
                      </div>
                    </div>
                    <div className="h-1.5 w-full overflow-hidden rounded-full bg-border/60">
                      <div
                        className="h-full bg-primary transition-all duration-200"
                        style={{ width: `${downloadProgress.percentage}%` }}
                      />
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Tab 2: OpenRouter */}
            {activeProvider === "openrouter" && <OpenRouterSettings />}
          </section>

          {/* Data Management Section */}
          <section className="rounded-xl border border-border bg-surface p-4.5 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border/70 pb-2.5">
              <div>
                <h2 className="font-display flex items-center gap-2 text-[14.5px] font-semibold tracking-tight text-fg">
                  <Database className="h-4 w-4 text-primary" />
                  Data Management
                </h2>
                <p className="mt-0.5 text-xs text-fg-subtle">
                  Local-first private SQLite storage with backup, export, and migration capabilities.
                </p>
              </div>
              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-0.5 text-[11px] font-medium text-emerald-600 dark:text-emerald-400">
                <ShieldCheck className="h-3.5 w-3.5" />
                100% Offline & Private
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {/* Export Group */}
              <div className="flex flex-col justify-between rounded-lg border border-border/70 bg-surface-hover/30 p-3 space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-fg-subtle">
                    <DownloadSimple className="h-3.5 w-3.5 text-primary" />
                    Export & Backups
                  </span>
                  <span className="text-[10.5px] text-fg-subtle">Machine & Sheets</span>
                </div>

                <div className="space-y-2">
                  {/* Export JSON */}
                  <div className="flex items-center justify-between gap-2 rounded-md border border-border/50 bg-surface px-3 py-2 text-xs">
                    <div className="min-w-0 flex-1">
                      <p className="font-medium text-fg truncate">JSON Snapshot</p>
                      <p className="text-[11px] text-fg-subtle truncate">Raw backup for migration</p>
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-7 text-xs shrink-0 cursor-pointer"
                      onClick={exportJsonData}
                      disabled={busy !== null}
                    >
                      {busy === "export-json" ? "Exporting…" : "Export JSON"}
                    </Button>
                  </div>

                  {/* Export Excel */}
                  <div className="flex items-center justify-between gap-2 rounded-md border border-border/50 bg-surface px-3 py-2 text-xs">
                    <div className="min-w-0 flex-1">
                      <p className="font-medium text-fg truncate">Excel Workbook</p>
                      <p className="text-[11px] text-fg-subtle truncate">Multi-sheet .xlsx tables</p>
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-7 text-xs shrink-0 cursor-pointer"
                      onClick={exportExcelData}
                      disabled={busy !== null}
                    >
                      <FileXls className="h-3.5 w-3.5 text-emerald-500 mr-1" />
                      {busy === "export-excel" ? "Exporting…" : "Export Excel"}
                    </Button>
                  </div>
                </div>
              </div>

              {/* Import & Template Group */}
              <div className="flex flex-col justify-between rounded-lg border border-border/70 bg-surface-hover/30 p-3 space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-fg-subtle">
                    <UploadSimple className="h-3.5 w-3.5 text-primary" />
                    Import & Templates
                  </span>
                  <span className="text-[10.5px] text-fg-subtle">JSON & Excel</span>
                </div>

                <div className="space-y-2">
                  {/* Import File */}
                  <div className="flex items-center justify-between gap-2 rounded-md border border-border/50 bg-surface px-3 py-2 text-xs">
                    <div className="min-w-0 flex-1">
                      <p className="font-medium text-fg truncate">Import Data File</p>
                      <p className="text-[11px] text-fg-subtle truncate">Load .json or .xlsx file</p>
                    </div>
                    <Button
                      size="sm"
                      variant="primary"
                      className="h-7 text-xs shrink-0 cursor-pointer"
                      onClick={handleImportClick}
                      disabled={busy !== null}
                    >
                      {busy === "import" ? "Reading…" : "Import File"}
                    </Button>
                  </div>

                  {/* Sample Template */}
                  <div className="flex items-center justify-between gap-2 rounded-md border border-border/50 bg-surface px-3 py-2 text-xs">
                    <div className="min-w-0 flex-1">
                      <p className="font-medium text-fg truncate">Sample Template</p>
                      <p className="text-[11px] text-fg-subtle truncate">Pre-formatted Excel sheet</p>
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-7 text-xs shrink-0 cursor-pointer"
                      onClick={downloadExcelTemplate}
                      disabled={busy !== null}
                    >
                      {busy === "template" ? "Generating…" : "Download"}
                    </Button>
                  </div>
                </div>
              </div>
            </div>

            {/* Bottom Toolbar: Replace on Import toggle */}
            <div className="flex items-center justify-between gap-4 rounded-lg border border-border/70 bg-surface-hover/20 px-3.5 py-2.5">
              <div className="min-w-0">
                <p className="text-xs font-medium text-fg">Replace existing records on import</p>
                <p className="text-[11px] text-fg-subtle">When enabled, existing database records will be erased prior to importing.</p>
              </div>
              <Switch checked={replace} onCheckedChange={setReplace} />
            </div>
          </section>
        </div>
      </div>

      {excelValidation && (
        <ExcelImportPreviewDialog
          validation={excelValidation}
          replace={replace}
          onConfirm={confirmExcelImport}
          onClose={() => setExcelValidation(null)}
          isImporting={busy === "confirming-excel"}
        />
      )}
    </div>
  );
}
