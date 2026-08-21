import { Building, Briefcase, UserList, WarningCircle, CheckCircle, Info } from "@phosphor-icons/react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "../ui/dialog";
import { Button } from "../ui/button";
import type { ExcelImportValidation } from "../../lib/excelImport";

interface Props {
  validation: ExcelImportValidation;
  replace: boolean;
  onConfirm: () => void;
  onClose: () => void;
  isImporting: boolean;
}

export function ExcelImportPreviewDialog({
  validation,
  replace,
  onConfirm,
  onClose,
  isImporting,
}: Props) {
  const {
    clientsCount,
    jobsCount,
    candidatesCount,
    autoCreatedClients,
    autoCreatedJobs,
    skippedRows,
  } = validation;

  const totalRecords = clientsCount + jobsCount + candidatesCount;

  return (
    <Dialog open={true} onOpenChange={onClose}>
      <DialogContent className="max-w-xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base font-semibold">
            <CheckCircle className="size-5 text-emerald-500" weight="fill" />
            Excel Import Preview
          </DialogTitle>
          <DialogDescription>
            Review the detected spreadsheet structure and data mappings before committing to the database.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Summary Metric Cards */}
          <div className="grid grid-cols-3 gap-3">
            <div className="rounded-lg border border-border bg-card p-3 text-center">
              <div className="flex items-center justify-center gap-1.5 text-xs text-muted-foreground mb-1">
                <Building className="size-4 text-blue-500" />
                Clients
              </div>
              <div className="text-xl font-bold text-foreground">{clientsCount}</div>
            </div>

            <div className="rounded-lg border border-border bg-card p-3 text-center">
              <div className="flex items-center justify-center gap-1.5 text-xs text-muted-foreground mb-1">
                <Briefcase className="size-4 text-amber-500" />
                Jobs
              </div>
              <div className="text-xl font-bold text-foreground">{jobsCount}</div>
            </div>

            <div className="rounded-lg border border-border bg-card p-3 text-center">
              <div className="flex items-center justify-center gap-1.5 text-xs text-muted-foreground mb-1">
                <UserList className="size-4 text-emerald-500" />
                Candidates
              </div>
              <div className="text-xl font-bold text-foreground">{candidatesCount}</div>
            </div>
          </div>

          {/* Import Strategy Callout */}
          <div className="rounded-lg border border-border/80 bg-muted/40 p-3 flex items-start gap-2.5 text-xs text-muted-foreground">
            <Info className="size-4 text-primary shrink-0 mt-0.5" />
            <div>
              {replace ? (
                <span>
                  <strong className="text-foreground">Replace Mode:</strong> All existing clients, jobs, and candidates in the database will be replaced by these {totalRecords} records.
                </span>
              ) : (
                <span>
                  <strong className="text-foreground">Append Mode:</strong> These records will be added alongside your existing database records (duplicate IDs will be safely skipped).
                </span>
              )}
            </div>
          </div>

          {/* Auto-created Relations Info */}
          {(autoCreatedClients.length > 0 || autoCreatedJobs.length > 0) && (
            <div className="rounded-lg border border-blue-500/20 bg-blue-500/5 p-3 space-y-1.5">
              <div className="text-xs font-semibold text-blue-600 dark:text-blue-400 flex items-center gap-1.5">
                <Info className="size-3.5" />
                Relational Auto-Linking
              </div>
              {autoCreatedClients.length > 0 && (
                <p className="text-xs text-muted-foreground">
                  • <strong>{autoCreatedClients.length}</strong> Client account(s) auto-created from job client references.
                </p>
              )}
              {autoCreatedJobs.length > 0 && (
                <p className="text-xs text-muted-foreground">
                  • <strong>{autoCreatedJobs.length}</strong> Job requisition(s) auto-created from candidate job references.
                </p>
              )}
            </div>
          )}

          {/* Skipped Rows / Warnings */}
          {skippedRows.length > 0 && (
            <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-3 space-y-2">
              <div className="text-xs font-semibold text-amber-600 dark:text-amber-400 flex items-center gap-1.5">
                <WarningCircle className="size-4 shrink-0" />
                {skippedRows.length} Row(s) Skipped (Incomplete Data)
              </div>
              <div className="max-h-28 overflow-y-auto space-y-1 text-xs text-muted-foreground font-mono">
                {skippedRows.map((s, idx) => (
                  <div key={idx} className="flex justify-between border-b border-border/40 pb-1">
                    <span>{s.sheet} (Row {s.row})</span>
                    <span className="text-destructive/80 font-sans">{s.reason}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={onClose} disabled={isImporting}>
            Cancel
          </Button>
          <Button
            onClick={onConfirm}
            disabled={totalRecords === 0 || isImporting}
            className="gap-1.5"
          >
            <CheckCircle className="size-4" />
            {isImporting ? "Importing Data..." : `Confirm & Import ${totalRecords} Records`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
