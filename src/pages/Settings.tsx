import { useState } from "react";
import {
  Database,
  DownloadSimple,
  FileXls,
  Info,
  Monitor,
  Moon,
  ShieldCheck,
  Sun,
  UploadSimple,
} from "@phosphor-icons/react";
import { toast } from "sonner";
import { open as openDialog, save as saveDialog } from "@tauri-apps/plugin-dialog";
import { readFile, readTextFile, writeFile, writeTextFile } from "@tauri-apps/plugin-fs";
import { useQueryClient } from "@tanstack/react-query";
import { useTheme } from "../store/theme";
import { useProfile } from "../store/profile";
import { US_TIME_ZONES } from "../lib/constants";
import { apiClients, apiData, apiJobs } from "../lib/api";
import { PageHeader } from "../components/common/PageHeader";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Switch } from "../components/ui/switch";
import { errorMessage, cn } from "../lib/utils";
import { generateExcelWorkbook, generateSampleExcelTemplate } from "../lib/excelExport";
import { parseExcelImport, type ExcelImportValidation } from "../lib/excelImport";
import { ExcelImportPreviewDialog } from "../components/common/ExcelImportPreviewDialog";
import type { ExportEnvelope, ThemeMode, ThemeName } from "../types";

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

export function Settings() {
  const qc = useQueryClient();
  const { mode, theme, setMode, setTheme } = useTheme();
  const { name, setName, timeZones, setTimeZones } = useProfile();
  const [replace, setReplace] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [excelValidation, setExcelValidation] = useState<ExcelImportValidation | null>(null);

  function invalidateAllDataQueries() {
    qc.invalidateQueries({ queryKey: ["clients"] });
    qc.invalidateQueries({ queryKey: ["jobs"] });
    qc.invalidateQueries({ queryKey: ["candidates"] });
    qc.invalidateQueries({ queryKey: ["dashboard"] });
    qc.invalidateQueries({ queryKey: ["globalSearch"] });
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
          `Imported ${summary.clients} clients, ${summary.jobs} jobs, ${summary.candidates} candidates`,
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
    <div className="px-6 pt-4">
      <PageHeader title="Settings" subtitle="Preferences and data management" />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-1">
          <section className="rounded-xl border border-border bg-surface p-6">
            <h2 className="font-display mb-1 text-[15px] font-semibold tracking-tight text-fg">Appearance</h2>
            <p className="mb-4 text-xs text-fg-subtle">Choose how the app looks.</p>
            <div className="flex flex-wrap items-center gap-2">
              {themeOptions.map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => setMode(opt.value)}
                  className={cn(
                    "flex h-9 cursor-pointer items-center gap-2 rounded-lg border px-4 text-sm font-medium transition-all duration-150 active:scale-[0.97]",
                    mode === opt.value
                      ? "border-primary/50 bg-primary/10 text-fg shadow-raise"
                      : "border-border text-fg-muted hover:bg-surface-hover hover:text-fg",
                  )}
                >
                  <opt.icon className="h-4 w-4" />
                  {opt.label}
                </button>
              ))}
            </div>

            <div className="mt-4 flex items-center gap-2">
              <span className="text-[11px] font-medium uppercase tracking-wider text-fg-subtle">Theme</span>
              <span className="h-px flex-1 bg-border" />
            </div>
            <div className="mt-3 grid grid-cols-3 gap-2">
              {colorThemes.map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => setTheme(opt.value)}
                  title={`${opt.label} theme (applies to light and dark)`}
                  className={cn(
                    "flex h-9 cursor-pointer items-center justify-center gap-2 rounded-lg border px-3 text-[13px] font-medium transition-all duration-150 active:scale-[0.97]",
                    theme === opt.value
                      ? "border-primary/50 bg-primary/10 text-fg shadow-raise"
                      : "border-border text-fg-muted hover:bg-surface-hover hover:text-fg",
                  )}
                >
                  <span
                    className="relative h-4 w-4 shrink-0 overflow-hidden rounded-full border border-border-strong"
                    style={{
                      background: `linear-gradient(135deg, ${opt.bg} 50%, ${opt.darkBg} 50%)`,
                    }}
                  >
                    <span
                      className="absolute left-1/2 top-1/2 h-2 w-2 -translate-x-1/2 -translate-y-1/2 rounded-full"
                      style={{ background: opt.primary }}
                    />
                  </span>
                  {opt.label}
                </button>
              ))}
            </div>

            <div className="mt-4 flex items-center gap-2">
              <span className="text-[11px] font-medium uppercase tracking-wider text-fg-subtle">Your name</span>
              <span className="h-px flex-1 bg-border" />
            </div>
            <div className="mt-3">
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Samy"
                className="h-8 text-[13px]"
              />
              <p className="mt-1.5 text-[11px] text-fg-subtle">Shown in the greeting on your dashboard.</p>
            </div>

            <div className="mt-4 flex items-center gap-2">
              <span className="text-[11px] font-medium uppercase tracking-wider text-fg-subtle">Clock</span>
              <span className="h-px flex-1 bg-border" />
            </div>
            <p className="mt-1.5 mb-3 text-[11px] text-fg-subtle">
              Show US time zones on the dashboard header.
            </p>
            <div className="flex flex-wrap items-center gap-2">
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
                      "flex h-9 cursor-pointer items-center gap-2 rounded-lg border px-4 text-sm font-medium transition-all duration-150 active:scale-[0.97]",
                      active
                        ? "border-primary/50 bg-primary/10 text-fg shadow-raise"
                        : "border-border text-fg-muted hover:bg-surface-hover hover:text-fg",
                    )}
                  >
                    {tz.label}
                  </button>
                );
              })}
            </div>
          </section>

          <section className="rounded-xl border border-border bg-surface p-6">
            <h2 className="font-display mb-3 flex items-center gap-2 text-[15px] font-semibold tracking-tight text-fg">
              <Info className="h-4 w-4 text-fg-subtle" />
              About
            </h2>
            <p className="text-[13px] text-fg-muted">
              RecDesk. A local-first personal recruiting tracker.
              Built with Tauri, Rust, and React.
            </p>
          </section>
        </div>

        <section className="rounded-xl border border-border bg-surface p-5 lg:col-span-2 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border/70 pb-3">
            <div>
              <h2 className="font-display flex items-center gap-2 text-[15px] font-semibold tracking-tight text-fg">
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

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
            {/* Export Group */}
            <div className="flex flex-col justify-between rounded-lg border border-border/70 bg-surface-hover/30 p-3.5 space-y-3">
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
            <div className="flex flex-col justify-between rounded-lg border border-border/70 bg-surface-hover/30 p-3.5 space-y-3">
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
