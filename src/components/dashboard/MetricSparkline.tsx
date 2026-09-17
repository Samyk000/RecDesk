import { useId, useMemo, useRef, useState } from "react";
import type { MetricTrend } from "../../types";

interface MetricSparklineProps {
  trend?: MetricTrend;
  color: string; // CSS color string (e.g. "#8b5cf6", "#3b82f6", "#10b981")
  metricName: string; // e.g. "Candidates", "Submissions", "Interviews", "Placed"
}

export function MetricSparkline({ trend, color, metricName }: MetricSparklineProps) {
  const gradientId = useId();
  const svgRef = useRef<SVGSVGElement | null>(null);
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);

  // 14 data points fallback if trend is not loaded yet
  const points = useMemo(() => {
    if (trend?.points && trend.points.length > 0) {
      return trend.points;
    }
    return Array.from({ length: 14 }).map((_, i) => ({
      date: "",
      label: `Day ${i + 1}`,
      count: 0,
    }));
  }, [trend?.points]);

  const maxVal = useMemo(() => {
    const highest = Math.max(...points.map((p) => p.count));
    return highest > 0 ? highest : 1;
  }, [points]);

  const width = 110;
  const height = 36;
  const paddingY = 6;
  const chartHeight = height - paddingY * 2;

  const coordinates = useMemo(() => {
    const stepX = width / Math.max(points.length - 1, 1);
    return points.map((p, i) => {
      const x = Number((i * stepX).toFixed(1));
      const ratio = p.count / maxVal;
      const y = Number((height - paddingY - ratio * chartHeight).toFixed(1));
      return { x, y, ...p };
    });
  }, [points, maxVal, width, height, paddingY, chartHeight]);

  // Smooth Catmull-Rom to Cubic Bezier curve
  const { linePath, areaPath } = useMemo(() => {
    if (coordinates.length === 0) return { linePath: "", areaPath: "" };
    if (coordinates.length === 1) {
      const p = coordinates[0];
      return { linePath: `M 0,${p.y} L ${width},${p.y}`, areaPath: "" };
    }

    let d = `M ${coordinates[0].x},${coordinates[0].y}`;
    for (let i = 0; i < coordinates.length - 1; i++) {
      const p0 = coordinates[i === 0 ? 0 : i - 1];
      const p1 = coordinates[i];
      const p2 = coordinates[i + 1];
      const p3 = coordinates[i + 2 >= coordinates.length ? coordinates.length - 1 : i + 2];

      const cp1x = p1.x + (p2.x - p0.x) / 6;
      const cp1y = p1.y + (p2.y - p0.y) / 6;
      const cp2x = p2.x - (p3.x - p1.x) / 6;
      const cp2y = p2.y - (p3.y - p1.y) / 6;

      d += ` C ${cp1x.toFixed(1)},${cp1y.toFixed(1)} ${cp2x.toFixed(1)},${cp2y.toFixed(1)} ${p2.x.toFixed(1)},${p2.y.toFixed(1)}`;
    }

    const first = coordinates[0];
    const last = coordinates[coordinates.length - 1];
    const area = `${d} L ${last.x},${height} L ${first.x},${height} Z`;

    return { linePath: d, areaPath: area };
  }, [coordinates, width, height]);

  const handleMouseMove = (e: React.MouseEvent<SVGSVGElement>) => {
    if (!svgRef.current) return;
    const rect = svgRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const ratio = Math.max(0, Math.min(1, x / rect.width));
    const closestIdx = Math.round(ratio * (coordinates.length - 1));
    setHoverIndex(closestIdx);
  };

  const handleMouseLeave = () => {
    setHoverIndex(null);
  };

  const activeCoord = hoverIndex !== null ? coordinates[hoverIndex] : null;

  return (
    <div className="relative flex items-center shrink-0">
      <svg
        ref={svgRef}
        viewBox={`0 0 ${width} ${height}`}
        className="h-9 w-28 overflow-visible cursor-crosshair"
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
      >
        <defs>
          <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity="0.28" />
            <stop offset="100%" stopColor={color} stopOpacity="0" />
          </linearGradient>
        </defs>

        {/* Gradient fill area */}
        <path d={areaPath} fill={`url(#${gradientId})`} />

        {/* Sparkline curve */}
        <path
          d={linePath}
          fill="none"
          stroke={color}
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="transition-all duration-300"
        />

        {/* Active hovered indicator point */}
        {activeCoord && (
          <g className="transition-all duration-100 ease-out">
            {/* Subtle vertical dotted guide */}
            <line
              x1={activeCoord.x}
              y1={2}
              x2={activeCoord.x}
              y2={height - 2}
              stroke={color}
              strokeWidth="1"
              strokeDasharray="2 2"
              strokeOpacity="0.4"
            />
            {/* Outer halo */}
            <circle
              cx={activeCoord.x}
              cy={activeCoord.y}
              r="4.5"
              fill={color}
              fillOpacity="0.25"
            />
            {/* Center dot */}
            <circle
              cx={activeCoord.x}
              cy={activeCoord.y}
              r="2.2"
              fill={color}
              stroke="#ffffff"
              strokeWidth="1"
            />
          </g>
        )}
      </svg>

      {/* Floating Tooltip smoothly anchored near hovered point */}
      {activeCoord && (
        <div
          style={{
            left: `${Math.min(Math.max((activeCoord.x / width) * 100, 20), 80)}%`,
          }}
          className="pointer-events-none absolute bottom-full mb-1.5 -translate-x-1/2 z-40 whitespace-nowrap rounded-lg border border-border/80 bg-surface/95 px-2.5 py-1.5 shadow-xl backdrop-blur-md animate-in fade-in zoom-in-95 duration-150"
        >
          {/* Date & Count on that day */}
          <div className="flex items-center justify-between gap-3 text-[11px] leading-none">
            <span className="font-semibold text-fg">{activeCoord.label}</span>
            <span className="font-bold tabular-nums text-primary">
              +{activeCoord.count} {metricName.toLowerCase()}
            </span>
          </div>

          {/* Contextual This Week & This Month stats */}
          <div className="mt-1 flex items-center gap-2 border-t border-border/60 pt-1 text-[9.5px] text-fg-subtle leading-none">
            <span>
              Week: <strong className="font-semibold text-fg tabular-nums">{trend?.this_week ?? 0}</strong>
            </span>
            <span>·</span>
            <span>
              Month: <strong className="font-semibold text-fg tabular-nums">{trend?.this_month ?? 0}</strong>
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
