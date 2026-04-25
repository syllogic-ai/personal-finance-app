import { T } from "./_tokens";

export type DonutSegment = { label: string; pct: number; color: string };

export function AllocationDonut({
  segments,
  size = 72,
}: {
  segments: DonutSegment[];
  size?: number;
}) {
  const r = 28;
  const cx = 40;
  const cy = 40;
  const C = 2 * Math.PI * r;
  let acc = 0;
  return (
    <svg width={size} height={size} viewBox="0 0 80 80">
      <circle
        cx={cx}
        cy={cy}
        r={r}
        fill="none"
        stroke={T.border}
        strokeWidth="12"
      />
      {segments.map((s, i) => {
        const dash = (s.pct / 100) * C;
        const offset = -(acc / 100) * C;
        acc += s.pct;
        return (
          <circle
            key={i}
            cx={cx}
            cy={cy}
            r={r}
            fill="none"
            stroke={s.color}
            strokeWidth="12"
            strokeDasharray={`${dash} ${C}`}
            strokeDashoffset={offset}
            transform="rotate(-90 40 40)"
          />
        );
      })}
    </svg>
  );
}
