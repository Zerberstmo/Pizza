import type React from "react";

// Donut-Diagramm (reines SVG). Aus App.tsx:1274-1305.
export function SvgDonutChart({ data, colors }: {
  data: Array<{ name: string; v: number }>;
  colors: string[];
}): React.ReactElement {
  const cx = 55, cy = 55, R = 50, r = 30;
  const total = data.reduce((s, d) => s + d.v, 0);
  let angle = -Math.PI / 2;

  const slices = data.map((d, i) => {
    const sweep  = (d.v / total) * 2 * Math.PI;
    const x1 = cx + R * Math.cos(angle);
    const y1 = cy + R * Math.sin(angle);
    const x2 = cx + R * Math.cos(angle + sweep);
    const y2 = cy + R * Math.sin(angle + sweep);
    const ix1 = cx + r * Math.cos(angle);
    const iy1 = cy + r * Math.sin(angle);
    const ix2 = cx + r * Math.cos(angle + sweep);
    const iy2 = cy + r * Math.sin(angle + sweep);
    const large = sweep > Math.PI ? 1 : 0;
    const path = `M ${x1} ${y1} A ${R} ${R} 0 ${large} 1 ${x2} ${y2} L ${ix2} ${iy2} A ${r} ${r} 0 ${large} 0 ${ix1} ${iy1} Z`;
    angle += sweep;
    return { path, color: colors[i], name: d.name };
  });

  return (
    <svg viewBox="0 0 110 110" style={{ width: 110, height: 110 }}>
      {slices.map((s) => (
        <path key={`slice-${s.name}`} d={s.path} fill={s.color} opacity="0.9" />
      ))}
    </svg>
  );
}
