import { useState } from "react";
import { Database, Download, Info, Monitor, Moon, Sun, Upload, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { open as openDialog, save as saveDialog } from "@tauri-apps/plugin-dialog";
import { readTextFile, writeTextFile } from "@tauri-apps/plugin-fs";
import { useTheme } from "../store/theme";
import { apiData } from "../lib/api";
import { PageHeader } from "../components/common/PageHeader";
import { Button } from "../components/ui/button";
import { Switch } from "../components/ui/switch";
import { errorMessage, cn } from "../lib/utils";
import type { ThemeMode } from "../types";

const themeOptions: { value: ThemeMode; label: string; icon: typeof Sun }[] = [
  { value: "light", label: "Light", icon: Sun },
  { value: "dark", label: "Dark", icon: Moon },
  { value: "system", label: "System", icon: Monitor },
];

export function Settings() {
  const { mode, setMode } = useTheme();
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
          <section className="rounded-lg border border-border bg-surface p-6">
            <h2 className="mb-1 text-sm font-semibold text-fg">Appearance</h2>
            <p className="mb-4 text-xs text-fg-subtle">Choose how the app looks.</p>
            <div className="flex flex-wrap items-center gap-2">
              {themeOptions.map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => setMode(opt.value)}
                  className={cn(
                    "flex h-9 items-center gap-2 rounded-lg border px-4 text-sm font-medium transition-colors",
                    mode === opt.value
                      ? "border-primary/50 bg-primary/10 text-fg"
                      : "border-border text-fg-muted hover:bg-surface-hover hover:text-fg",
                  )}
                >
                  <opt.icon className="h-4 w-4" />
                  {opt.label}
                </button>
              ))}
            </div>
          </section>

          <section className="rounded-lg border border-border bg-surface p-6">
            <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold text-fg">
              <Info className="h-4 w-4 text-fg-subtle" />
              About
            </h2>
            <p className="text-[13px] text-fg-muted">
              Recruiting Workspace — local-first personal recruiting tracker.
              Built with Tauri, Rust, and React.
            </p>
          </section>
        </div>

        <section className="rounded-lg border border-border bg-surface p-6 lg:col-span-2">
          <h2 className="mb-1 flex items-center gap-2 text-sm font-semibold text-fg">
            <Database className="h-4 w-4 text-fg-subtle" />
            Data
          </h2>
          <p className="mb-4 text-xs text-fg-subtle">
            Your data is stored locally in a SQLite database on this device.
          </p>

          <div className="space-y-3">
            <div className="flex items-center justify-between gap-4 rounded-lg border border-border bg-surface-hover/40 px-4 py-3">
              <div className="flex items-center gap-3">
                <Download className="h-4 w-4 text-fg-subtle" />
                <div>
                  <p className="text-[13px] font-medium text-fg">Export backup</p>
                  <p className="text-xs text-fg-subtle">Save all data to a JSON file.</p>
                </div>
              </div>
              <Button size="sm" variant="outline" onClick={exportData} disabled={busy !== null}>
                {busy === "export" ? "Exporting…" : "Export"}
              </Button>
            </div>

            <div className="flex items-center justify-between gap-4 rounded-lg border border-border bg-surface-hover/40 px-4 py-3">
              <div className="flex items-center gap-3">
                <Upload className="h-4 w-4 text-fg-subtle" />
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
              <label className="flex items-center justify-between gap-4 rounded-lg border border-border bg-surface-hover/40 px-4 py-3">
                <div className="flex items-center gap-3">
                  <Database className="h-4 w-4 text-fg-subtle" />
                  <div>
                    <p className="text-[13px] font-medium text-fg">Replace on import</p>
                    <p className="text-xs text-fg-subtle">Delete existing data before importing.</p>
                  </div>
                </div>
                <Switch checked={replace} onCheckedChange={setReplace} />
              </label>

              <div className="flex items-center justify-between gap-4 rounded-lg border border-border bg-surface-hover/40 px-4 py-3">
                <div className="flex items-center gap-3">
                  <Sparkles className="h-4 w-4 text-fg-subtle" />
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
