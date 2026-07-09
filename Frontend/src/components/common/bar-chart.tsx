import type React from "react";

// Balkendiagramm (reines SVG). Aus App.tsx:1230-1271.
export function SvgBarChart({ data }: { data: Array<{ day: string; n: number }> }): React.ReactElement {
  const W = 280, H = 120, PAD = { t: 8, r: 4, b: 24, l: 28 };
  const innerW = W - PAD.l - PAD.r;
  const innerH = H - PAD.t - PAD.b;
  const maxVal = Math.max(...data.map((d) => d.n));
  const barW = Math.floor(innerW / data.length) - 4;

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ height: H }}>
      {[0, 0.5, 1].map((frac) => {
        const y = PAD.t + innerH * (1 - frac);
        return (
          <line key={`gl-${frac}`} x1={PAD.l} y1={y} x2={W - PAD.r} y2={y}
            stroke="rgba(255,255,255,0.05)" strokeWidth="1" />
        );
      })}
      {[0, maxVal].map((v, i) => (
        <text key={`yl-${i}`}
          x={PAD.l - 4} y={i === 0 ? H - PAD.b + 4 : PAD.t + 4}
          textAnchor="end" fill="#71717A" fontSize="9">
          {v}
        </text>
      ))}
      {data.map((d, i) => {
        const bH = maxVal > 0 ? (d.n / maxVal) * innerH : 0;
        const x  = PAD.l + i * (innerW / data.length) + (innerW / data.length - barW) / 2;
        const y  = PAD.t + innerH - bH;
        return (
          <g key={`bar-${d.day}`}>
            <rect x={x} y={y} width={barW} height={bH} fill="#F97316" rx="3" opacity="0.9" />
            <text x={x + barW / 2} y={H - PAD.b + 14} textAnchor="middle" fill="#71717A" fontSize="10">
              {d.day}
            </text>
          </g>
        );
      })}
    </svg>
  );
}
