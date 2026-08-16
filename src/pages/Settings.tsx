import { useState } from "react";
import { Database, DownloadSimple, Info, Monitor, Moon, Sun, UploadSimple, Sparkle } from "@phosphor-icons/react";
import { toast } from "sonner";
import { open as openDialog, save as saveDialog } from "@tauri-apps/plugin-dialog";
import { readTextFile, writeTextFile } from "@tauri-apps/plugin-fs";
import { useTheme } from "../store/theme";
import { apiData } from "../lib/api";
import { PageHeader } from "../components/common/PageHeader";
import { Button } from "../components/ui/button";
import { Switch } from "../components/ui/switch";
import { errorMessage, cn } from "../lib/utils";
import type { ThemeAccent, ThemeMode } from "../types";

const themeOptions: { value: ThemeMode; label: string; icon: typeof Sun }[] = [
  { value: "light", label: "Light", icon: Sun },
  { value: "dark", label: "Dark", icon: Moon },
  { value: "system", label: "System", icon: Monitor },
];

const colorThemes: { value: ThemeAccent; label: string; swatch: string }[] = [
  { value: "orange", label: "Orange", swatch: "#f97316" },
  { value: "gray", label: "Off Gray", swatch: "#525c67" },
  { value: "olive", label: "Olive", swatch: "#7a8f3d" },
];

export function Settings() {
  const { mode, accent, setMode, setAccent } = useTheme();
  const [replace, setReplace] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);

  async function exportData() {
    setBusy("export");
    try {
      const json = await apiData.export();
      const path = await saveDialog({
        title: "Export data",
        defaultPath: `recruiting-backup-${new Date().toISOString().slice(0, 10)}.json`,
        filters: [{ name: "JSON", extensions: ["json"] }],
      });
      if (!path) return;
      await writeTextFile(path, json);
      toast.success("Data exported");
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setBusy(null);
    }
  }

  async function importData() {
    setBusy("import");
    try {
      const path = await openDialog({
        title: "Import data",
        multiple: false,
        filters: [{ name: "JSON", extensions: ["json"] }],
      });
      if (!path || typeof path !== "string") return;
      const json = await readTextFile(path);
      const summary = await apiData.import(json, replace);
      toast.success(
        `Imported ${summary.clients} clients, ${summary.jobs} jobs, ${summary.candidates} candidates`,
      );
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setBusy(null);
    }
  }

  async function seedDemo() {
    setBusy("seed");
    try {
      const summary = await apiData.seedDemo();
      toast.success(`Seeded ${summary.clients} clients, ${summary.jobs} jobs, ${summary.candidates} candidates`);
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
              <span className="text-[11px] font-medium uppercase tracking-wider text-fg-subtle">Color themes</span>
              <span className="h-px flex-1 bg-border" />
            </div>
                        <div className="mt-3 flex flex-wrap items-center gap-2">
              {colorThemes.map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => setAccent(accent === opt.value ? "default" : opt.value)}
                  title={
                    accent === opt.value
                      ? "Clear accent (back to default)"
                      : "Applies as an accent over your current theme"
                  }
                  className={cn(
                    "flex h-8 cursor-pointer items-center gap-2 rounded-lg border px-3 text-[13px] font-medium transition-all duration-150 active:scale-[0.97]",
                    accent === opt.value
                      ? "border-primary/50 bg-primary/10 text-fg shadow-raise"
                      : "border-border text-fg-muted hover:bg-surface-hover hover:text-fg",
                  )}
                >
                  <span
                    className="h-3 w-3 rounded-full"
                    style={{ background: opt.swatch, boxShadow: "inset 0 0 0 1px rgb(0 0 0 / 0.15)" }}
                  />
                  {opt.label}
                </button>
              ))}
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

        <section className="rounded-xl border border-border bg-surface p-6 lg:col-span-2">
          <h2 className="font-display mb-1 flex items-center gap-2 text-[15px] font-semibold tracking-tight text-fg">
            <Database className="h-4 w-4 text-fg-subtle" />
            Data
          </h2>
          <p className="mb-4 text-xs text-fg-subtle">
            Your data is stored locally in a SQLite database on this device.
          </p>

          <div className="space-y-3">
            <div className="flex items-center justify-between gap-4 rounded-xl border border-border bg-surface-hover/40 px-4 py-3 transition-colors duration-150 hover:bg-surface-hover/70">
              <div className="flex items-center gap-3">
                <DownloadSimple className="h-4 w-4 text-fg-subtle" />
                <div>
                  <p className="text-[13px] font-medium text-fg">Export backup</p>
                  <p className="text-xs text-fg-subtle">Save all data to a JSON file.</p>
                </div>
              </div>
              <Button size="sm" variant="outline" onClick={exportData} disabled={busy !== null}>
                {busy === "export" ? "Exporting…" : "Export"}
              </Button>
            </div>

            <div className="flex items-center justify-between gap-4 rounded-xl border border-border bg-surface-hover/40 px-4 py-3 transition-colors duration-150 hover:bg-surface-hover/70">
              <div className="flex items-center gap-3">
                <UploadSimple className="h-4 w-4 text-fg-subtle" />
                <div>
                  <p className="text-[13px] font-medium text-fg">Import backup</p>
                  <p className="text-xs text-fg-subtle">Load data from a JSON file.</p>
                </div>
              </div>
              <Button size="sm" variant="outline" onClick={importData} disabled={busy !== null}>
                {busy === "import" ? "Importing…" : "Import"}
              </Button>
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <label className="flex cursor-pointer items-center justify-between gap-4 rounded-xl border border-border bg-surface-hover/40 px-4 py-3 transition-colors duration-150 hover:bg-surface-hover/70">
                <div className="flex items-center gap-3">
                  <Database className="h-4 w-4 text-fg-subtle" />
                  <div>
                    <p className="text-[13px] font-medium text-fg">Replace on import</p>
                    <p className="text-xs text-fg-subtle">Delete existing data before importing.</p>
                  </div>
                </div>
                <Switch checked={replace} onCheckedChange={setReplace} />
              </label>

              <div className="flex items-center justify-between gap-4 rounded-xl border border-border bg-surface-hover/40 px-4 py-3 transition-colors duration-150 hover:bg-surface-hover/70">
                <div className="flex items-center gap-3">
                  <Sparkle className="h-4 w-4 text-fg-subtle" />
                  <div>
                    <p className="text-[13px] font-medium text-fg">Load demo data</p>
                    <p className="text-xs text-fg-subtle">Add sample data to explore the app.</p>
                  </div>
                </div>
                <Button size="sm" variant="outline" onClick={seedDemo} disabled={busy !== null}>
                  {busy === "seed" ? "Seeding…" : "Seed demo"}
                </Button>
              </div>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
