import { memo, useEffect, useRef, useState } from "react";
import type { CSSProperties } from "react";
import { Tooltip, TooltipContent, TooltipTrigger } from "../ui/tooltip";

const DIRECTIONS = [
  "up-left",
  "up",
  "up-right",
  "left",
  "center",
  "right",
  "down-left",
  "down",
  "down-right",
] as const;

const REACTIONS = [
  "blink",
  "heart",
  "sparkle",
  "surprised",
  "wink",
  "bashful",
  "sleepy",
  "dizzy",
  "delighted",
] as const;

type Direction = (typeof DIRECTIONS)[number];
type Reaction = (typeof REACTIONS)[number];

// Clockwise from the right, matching atan2 with y pointing down.
const CLOCKWISE: Direction[] = [
  "right",
  "down-right",
  "down",
  "down-left",
  "left",
  "up-left",
  "up",
  "up-right",
];
const SECTOR = (Math.PI * 2) / CLOCKWISE.length;
const HYSTERESIS = 0.12;
const DEAD_ZONE = 60;

const PAYOFFS: Reaction[] = ["heart", "sparkle", "delighted"];
const BOOP_PAYOFF = 120;
const BOOP_END = 560;
const SQUASH_MS = 420;
const DIZZY_AFTER = 4;
const DIZZY_WINDOW = 1600;
const DIZZY_END = 1100;

const SQUASH: Keyframe[] = [
  { transform: "scale(1, 1)", easing: "ease-in" },
  { transform: "scale(1.12, 0.85)", offset: 0.18, easing: "ease-out" },
  { transform: "scale(0.94, 1.08)", offset: 0.45, easing: "ease-in-out" },
  { transform: "scale(1.03, 0.97)", offset: 0.72, easing: "ease-in-out" },
  { transform: "scale(1, 1)" },
];

function cell(index: number): CSSProperties {
  return { backgroundPosition: `${(index % 3) * 50}% ${Math.floor(index / 3) * 50}%` };
}

function wrap(angle: number) {
  return Math.atan2(Math.sin(angle), Math.cos(angle));
}

// GPU-accelerated layer with layout containment to prevent repaints outside the mascot
const layer: CSSProperties = {
  position: "absolute",
  inset: 0,
  backgroundSize: "300% 300%",
  backgroundRepeat: "no-repeat",
  willChange: "background-position, opacity",
  transform: "translateZ(0)",
};

export interface MascotConfig {
  id: string;
  name: string;
  role: string;
  directions: string;
  reactions: string;
}

export const MASCOTS: MascotConfig[] = [
  {
    id: "beard",
    name: "Beard",
    role: "Senior Recruiter",
    directions: "/mascots/beard-directions.webp",
    reactions: "/mascots/beard-reactions.webp",
  },
  {
    id: "crt",
    name: "RecBot",
    role: "CRT Desktop Companion",
    directions: "/mascots/crt-directions.webp",
    reactions: "/mascots/crt-reactions.webp",
  },
  {
    id: "cat",
    name: "Cat",
    role: "Office Cat",
    directions: "/mascots/cat-directions.webp",
    reactions: "/mascots/cat-reactions.webp",
  },
  {
    id: "fox-riso",
    name: "Fox Riso",
    role: "Chibi Riso Fox",
    directions: "/mascots/fox-riso-directions.webp",
    reactions: "/mascots/fox-riso-reactions.webp",
  },
];


export interface MascotProps {
  size?: number;
  className?: string;
}

export const Mascot = memo(function Mascot({ size = 52, className = "" }: MascotProps) {
  const [activeMascotIndex, setActiveMascotIndex] = useState<number>(() => {
    const saved = localStorage.getItem("recdesk_active_mascot");
    const found = MASCOTS.findIndex((m) => m.id === saved);
    return found !== -1 ? found : 0;
  });

  const mascot = MASCOTS[activeMascotIndex];

  const buttonRef = useRef<HTMLButtonElement>(null);
  const squashRef = useRef<HTMLSpanElement>(null);
  const animationRef = useRef<Animation | null>(null);
  const timersRef = useRef<number[]>([]);
  const boopsRef = useRef({ count: 0, at: 0 });
  const currentDirectionRef = useRef<Direction>("center");
  const [direction, setDirection] = useState<Direction>("center");
  const [reaction, setReaction] = useState<Reaction | null>(null);


  // Switch to next mascot on right-click or keyboard trigger with smooth bounce
  const toggleMascot = (e?: React.MouseEvent | React.KeyboardEvent) => {
    e?.stopPropagation();

    // Clear any active reaction timers and reset expression so new mascot is immediately responsive
    timersRef.current.forEach(window.clearTimeout);
    timersRef.current = [];
    setReaction(null);

    const nextIndex = (activeMascotIndex + 1) % MASCOTS.length;
    setActiveMascotIndex(nextIndex);
    localStorage.setItem("recdesk_active_mascot", MASCOTS[nextIndex].id);

    // Subtle micro-bounce transition on switch without locking expressions
    if (squashRef.current) {
      animationRef.current?.cancel();
      animationRef.current = squashRef.current.animate(
        [
          { transform: "scale(0.92, 1.08)", easing: "ease-out" },
          { transform: "scale(1.04, 0.96)", offset: 0.5, easing: "ease-in-out" },
          { transform: "scale(1, 1)" },
        ],
        { duration: 240, easing: "linear" }
      );
    }
  };


  // High-performance pointer tracker:
  // 1. requestAnimationFrame throttled (zero layout thrashing)
  // 2. Cached bounding rect (no getBoundingClientRect on every mousemove)
  // 3. Render gating (only updates React state if sector actually changes)
  useEffect(() => {
    if (!window.matchMedia("(hover: hover) and (pointer: fine)").matches) {
      return;
    }

    let sector = -1;
    let pointer: { x: number; y: number } | null = null;
    let rafId: number | null = null;
    let cachedBox: DOMRect | null = null;

    const updateBox = () => {
      if (buttonRef.current) {
        cachedBox = buttonRef.current.getBoundingClientRect();
      }
    };

    updateBox();

    const aim = () => {
      rafId = null;
      if (!pointer) return;
      if (!cachedBox) {
        updateBox();
        if (!cachedBox) return;
      }

      const dx = pointer.x - (cachedBox.left + cachedBox.width / 2);
      const dy = pointer.y - (cachedBox.top + cachedBox.height / 2);

      if (Math.hypot(dx, dy) < DEAD_ZONE) {
        if (sector !== -1 || currentDirectionRef.current !== "center") {
          sector = -1;
          currentDirectionRef.current = "center";
          setDirection("center");
        }
        return;
      }

      const angle = Math.atan2(dy, dx);
      if (sector !== -1 && Math.abs(wrap(angle - sector * SECTOR)) < SECTOR / 2 + HYSTERESIS) {
        return;
      }

      const nextSector = (Math.round(angle / SECTOR) + CLOCKWISE.length) % CLOCKWISE.length;
      const nextDirection = CLOCKWISE[nextSector];
      sector = nextSector;

      if (currentDirectionRef.current !== nextDirection) {
        currentDirectionRef.current = nextDirection;
        setDirection(nextDirection);
      }
    };

    const scheduleAim = () => {
      if (rafId === null) {
        rafId = window.requestAnimationFrame(aim);
      }
    };

    const onPointerMove = (event: PointerEvent) => {
      pointer = { x: event.clientX, y: event.clientY };
      scheduleAim();
    };

    const onResizeOrScroll = () => {
      updateBox();
      scheduleAim();
    };

    const onLeaveOrBlur = () => {
      if (rafId !== null) {
        window.cancelAnimationFrame(rafId);
        rafId = null;
      }
      pointer = null;
      if (currentDirectionRef.current !== "center") {
        currentDirectionRef.current = "center";
        setDirection("center");
      }
    };

    window.addEventListener("pointermove", onPointerMove, { passive: true });
    window.addEventListener("resize", onResizeOrScroll, { passive: true });
    window.addEventListener("scroll", onResizeOrScroll, { passive: true });
    window.addEventListener("blur", onLeaveOrBlur);
    document.addEventListener("mouseleave", onLeaveOrBlur);

    return () => {
      if (rafId !== null) {
        window.cancelAnimationFrame(rafId);
      }
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("resize", onResizeOrScroll);
      window.removeEventListener("scroll", onResizeOrScroll);
      window.removeEventListener("blur", onLeaveOrBlur);
      document.removeEventListener("mouseleave", onLeaveOrBlur);
    };
  }, []);

  useEffect(() => {
    return () => {
      timersRef.current.forEach(window.clearTimeout);
    };
  }, []);

  const boop = () => {
    timersRef.current.forEach(window.clearTimeout);
    timersRef.current = [];

    const later = (ms: number, next: Reaction | null) => {
      timersRef.current.push(window.setTimeout(() => setReaction(next), ms));
    };

    const now = Date.now();
    const boops = boopsRef.current;
    boops.count = now - boops.at < DIZZY_WINDOW ? boops.count + 1 : 1;
    boops.at = now;

    if (boops.count >= DIZZY_AFTER) {
      boops.count = 0;
      setReaction("dizzy");
      later(DIZZY_END, null);
    } else {
      setReaction("blink");
      later(BOOP_PAYOFF, PAYOFFS[(boops.count - 1) % PAYOFFS.length]);
      later(BOOP_END, null);
    }

    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      return;
    }

    if (squashRef.current) {
      animationRef.current?.cancel();
      animationRef.current = squashRef.current.animate(SQUASH, { duration: SQUASH_MS, easing: "linear" });
    }
  };

  return (
    <div
      data-tauri-drag-region={false}
      className={`inline-flex items-center shrink-0 translate-y-[4px] ${className}`}
      style={{
        contain: "layout paint",
        userSelect: "none",
      }}
    >
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            ref={buttonRef}
            type="button"
            data-tauri-drag-region={false}
            onClick={boop}
            onContextMenu={(e) => {
              e.preventDefault();
              toggleMascot(e);
            }}
            onKeyDown={(e) => {
              if ((e.key === "Enter" || e.key === " ") && (e.shiftKey || e.altKey)) {
                e.preventDefault();
                toggleMascot(e);
              }
            }}
            aria-label={`${mascot.name} - Right-click to switch character`}
            className="group relative cursor-pointer select-none rounded-lg p-0 border-0 bg-transparent transition-transform duration-200 hover:scale-[1.02] active:scale-[0.98] focus:outline-hidden"
            style={{
              width: size,
              height: size,
            }}
          >
            <span
              ref={squashRef}
              style={{
                position: "relative",
                display: "block",
                width: "100%",
                height: "100%",
                transformOrigin: "50% 80%",
                willChange: "transform",
              }}
            >
              {/* Pre-render all 4 mascots in the DOM so all textures remain permanently decoded in GPU memory */}
              {MASCOTS.map((m, idx) => {
                const isActive = idx === activeMascotIndex;
                return (
                  <span
                    key={m.id}
                    aria-hidden={!isActive}
                    style={{
                      position: "absolute",
                      inset: 0,
                      opacity: isActive ? 1 : 0,
                      pointerEvents: isActive ? "auto" : "none",
                      transition: "opacity 120ms cubic-bezier(0.4, 0, 0.2, 1)",
                      willChange: "opacity",
                      filter: "drop-shadow(0 2px 4px rgba(0,0,0,0.12))",
                    }}
                  >
                    {/* Directions Layer */}
                    <span
                      style={{
                        ...layer,
                        backgroundImage: `url(${m.directions})`,
                        ...cell(DIRECTIONS.indexOf(direction)),
                        opacity: isActive && reaction ? 0 : 1,
                      }}
                    />
                    {/* Reactions Layer */}
                    <span
                      style={{
                        ...layer,
                        backgroundImage: `url(${m.reactions})`,
                        ...cell(REACTIONS.indexOf(reaction ?? "blink")),
                        opacity: isActive && reaction ? 1 : 0,
                      }}
                    />
                  </span>
                );
              })}
            </span>
          </button>
        </TooltipTrigger>
        <TooltipContent
          side="bottom"
          sideOffset={6}
          className="border border-border bg-surface text-fg shadow-md px-2.5 py-1 text-xs select-none"
        >
          <span className="font-semibold text-fg">{mascot.name}</span>
          <span className="ml-1.5 text-[11px] text-fg-muted">• Right-click to switch</span>
        </TooltipContent>
      </Tooltip>
    </div>
  );
});

