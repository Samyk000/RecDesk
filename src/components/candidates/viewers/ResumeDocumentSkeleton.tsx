import { ThemedOrb } from "../../common/Spinner";

interface Props {
  scale?: number;
}

export function ResumeDocumentSkeleton({ scale = 1.0 }: Props) {
  return (
    <div
      className="w-full h-full max-w-5xl rounded-md bg-white dark:bg-zinc-900 shadow-2xl border border-black/5 dark:border-white/10 p-8 sm:p-14 overflow-hidden relative transition-transform duration-150 origin-top select-none flex flex-col justify-start"
      style={{
        transform: scale !== 1.0 ? `scale(${scale})` : undefined,
        height: scale > 1.0 ? `${100 / scale}%` : "100%",
      }}
    >
      {/* Continuous Wavy Shimmer Light Beam */}
      <div className="pointer-events-none absolute inset-0 -translate-x-full bg-linear-to-r from-transparent via-slate-100/80 dark:via-white/5 to-transparent animate-wave-shimmer z-10" />

      {/* Header Profile Section */}
      <div className="space-y-3">
        <div className="h-7 w-64 rounded-md bg-slate-200/80 dark:bg-zinc-800/80" />
        <div className="h-4 w-44 rounded bg-slate-200/60 dark:bg-zinc-800/60" />
        <div className="flex flex-wrap items-center gap-3 pt-1">
          <div className="h-3 w-32 rounded bg-slate-200/50 dark:bg-zinc-800/50" />
          <div className="h-3 w-28 rounded bg-slate-200/50 dark:bg-zinc-800/50" />
          <div className="h-3 w-24 rounded bg-slate-200/50 dark:bg-zinc-800/50" />
        </div>
      </div>

      {/* Decorative Document Rule */}
      <div className="my-6 h-px w-full bg-slate-200/80 dark:bg-zinc-800/80" />

      {/* Section 1: Professional Summary */}
      <div className="space-y-3">
        <div className="h-4 w-36 rounded bg-slate-300/80 dark:bg-zinc-700/80" />
        <div className="space-y-2">
          <div className="h-3 w-full rounded bg-slate-200/60 dark:bg-zinc-800/60" />
          <div className="h-3 w-11/12 rounded bg-slate-200/60 dark:bg-zinc-800/60" />
          <div className="h-3 w-4/5 rounded bg-slate-200/60 dark:bg-zinc-800/60" />
        </div>
      </div>

      {/* Section 2: Work Experience */}
      <div className="mt-8 space-y-4">
        <div className="h-4 w-40 rounded bg-slate-300/80 dark:bg-zinc-700/80" />

        {/* Experience Item 1 */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <div className="h-3.5 w-52 rounded bg-slate-200/80 dark:bg-zinc-800/80" />
            <div className="h-3 w-24 rounded bg-slate-200/50 dark:bg-zinc-800/50" />
          </div>
          <div className="space-y-1.5 pl-4 border-l-2 border-slate-200/60 dark:border-zinc-800/60">
            <div className="h-3 w-full rounded bg-slate-200/60 dark:bg-zinc-800/60" />
            <div className="h-3 w-11/12 rounded bg-slate-200/60 dark:bg-zinc-800/60" />
            <div className="h-3 w-3/4 rounded bg-slate-200/60 dark:bg-zinc-800/60" />
          </div>
        </div>

        {/* Experience Item 2 */}
        <div className="space-y-2 pt-1">
          <div className="flex items-center justify-between">
            <div className="h-3.5 w-44 rounded bg-slate-200/80 dark:bg-zinc-800/80" />
            <div className="h-3 w-20 rounded bg-slate-200/50 dark:bg-zinc-800/50" />
          </div>
          <div className="space-y-1.5 pl-4 border-l-2 border-slate-200/60 dark:border-zinc-800/60">
            <div className="h-3 w-full rounded bg-slate-200/60 dark:bg-zinc-800/60" />
            <div className="h-3 w-5/6 rounded bg-slate-200/60 dark:bg-zinc-800/60" />
          </div>
        </div>
      </div>

      {/* Section 3: Skills & Competencies */}
      <div className="mt-8 space-y-3">
        <div className="h-4 w-32 rounded bg-slate-300/80 dark:bg-zinc-700/80" />
        <div className="flex flex-wrap gap-2 pt-1">
          <div className="h-6 w-20 rounded-full bg-slate-200/70 dark:bg-zinc-800/70" />
          <div className="h-6 w-24 rounded-full bg-slate-200/70 dark:bg-zinc-800/70" />
          <div className="h-6 w-16 rounded-full bg-slate-200/70 dark:bg-zinc-800/70" />
          <div className="h-6 w-28 rounded-full bg-slate-200/70 dark:bg-zinc-800/70" />
          <div className="h-6 w-22 rounded-full bg-slate-200/70 dark:bg-zinc-800/70" />
        </div>
      </div>

      {/* Centered Loading Orb (no text, pure aesthetic motion) */}
      <div className="absolute inset-0 z-20 flex items-center justify-center pointer-events-none">
        <div className="flex items-center justify-center rounded-3xl bg-white/80 dark:bg-zinc-900/80 p-5 shadow-xl backdrop-blur-md border border-black/5 dark:border-white/10 animate-fade-in">
          <ThemedOrb state="searching" size={64} />
        </div>
      </div>
    </div>
  );
}
