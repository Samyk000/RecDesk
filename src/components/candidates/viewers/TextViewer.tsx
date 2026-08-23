import { useMemo } from "react";

interface Props {
  data: Uint8Array;
  scale: number;
}

export function TextViewer({ data, scale }: Props) {
  const text = useMemo(() => {
    try {
      return new TextDecoder().decode(data);
    } catch {
      return "Unable to decode text file.";
    }
  }, [data]);

  return (
    <div className="flex-1 overflow-y-auto overflow-x-auto p-6 bg-slate-900/30 dark:bg-black/40 flex justify-center">
      <div
        className="w-full max-w-4xl transition-transform duration-150 origin-top"
        style={{ transform: `scale(${scale})` }}
      >
        <div className="rounded-sm bg-white p-10 text-slate-900 shadow-2xl dark:bg-zinc-900 dark:text-zinc-100 min-h-[600px]">
          <pre className="font-mono text-xs leading-relaxed whitespace-pre-wrap select-text break-words">
            {text}
          </pre>
        </div>
      </div>
    </div>
  );
}
