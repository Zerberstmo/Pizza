import type React from "react";

// Belag-Renderer für die Pizza-SVG. 1:1 aus `Frontend vorlage/src/app/App.tsx:269-371`.

export const TOPPING_POSITIONS: [number, number][] = (() => {
  const cx = 100, cy = 100;
  const pts: [number, number][] = [];
  for (const { r, n, off } of [
    { r: 24, n: 5,  off: 0 },
    { r: 46, n: 8,  off: Math.PI / 8 },
    { r: 63, n: 11, off: 0 },
  ]) {
    for (let i = 0; i < n; i++) {
      const a = off + (i / n) * 2 * Math.PI - Math.PI / 2;
      pts.push([cx + r * Math.cos(a), cy + r * Math.sin(a)]);
    }
  }
  return pts;
})();

export function getToppingPositions(idx: number, total: number): [number, number][] {
  return TOPPING_POSITIONS.filter((_, i) => i % total === idx).slice(0, 5);
}

export interface TP { x: number; y: number; rot?: number; }

export const TOPPING_COLORS: Record<string, string> = {
  mozzarella: "#F5F0DC", "extra-kaese": "#F5D76E", salami: "#8B2525",
  schinken: "#D4857A", haehnchen: "#E8D4A0", hackfleisch: "#8B4513",
  thunfisch: "#8FAFB8", garnelen: "#FFAA80",
  ananas: "#FCD34D", paprika: "#E84B3A", mais: "#F1C40F",
  jalapenos: "#2ECC71", pilze: "#9B7B5A", zwiebeln: "#C084FC",
  oliven: "#1A1A2E", rucola: "#22C55E", spinat: "#166534",
  kirschtomaten: "#DC2626", artischocken: "#4B7A5A", knoblauch: "#F5E6C8",
  basilikum: "#16A34A", peperoncini: "#84CC16", gorgonzola: "#92A0B8",
};

export function ToppingDot({ x, y, color, r = 7 }: TP & { color: string; r?: number }): React.ReactElement {
  return <circle cx={x} cy={y} r={r} fill={color} opacity="0.9" />;
}
function SalamiT({ x, y }: TP): React.ReactElement {
  return (
    <g>
      <circle cx={x} cy={y} r={11} fill="#6B1A1A" opacity="0.92" />
      <circle cx={x} cy={y} r={7}  fill="#8B2525" opacity="0.9" />
      <circle cx={x} cy={y} r={2}  fill="#501010" opacity="0.7" />
    </g>
  );
}
function MozzarellaT({ x, y }: TP): React.ReactElement {
  return <ellipse cx={x} cy={y} rx={10} ry={8} fill="#F5F0DC" opacity="0.95" />;
}
function SchinkenT({ x, y, rot = 0 }: TP): React.ReactElement {
  return <ellipse cx={x} cy={y} rx={12} ry={7} fill="#D4857A" opacity="0.88" transform={`rotate(${rot} ${x} ${y})`} />;
}
function PaprikaT({ x, y, rot = 0 }: TP): React.ReactElement {
  const cs = ["#E84B3A", "#27AE60", "#F39C12"];
  return <rect x={x - 7} y={y - 2.5} width="14" height="5" rx="2.5" fill={cs[Math.abs(Math.round(rot)) % 3]} opacity="0.9" transform={`rotate(${rot} ${x} ${y})`} />;
}
function PilzeT({ x, y }: TP): React.ReactElement {
  return (
    <g>
      <path d={`M${x-7},${y} Q${x-7},${y-9} ${x},${y-9} Q${x+7},${y-9} ${x+7},${y} Z`} fill="#9B7B5A" opacity="0.9" />
      <rect x={x - 2.5} y={y} width="5" height="5" rx="1" fill="#B89070" opacity="0.9" />
    </g>
  );
}
function JalapenoT({ x, y, rot = 0 }: TP): React.ReactElement {
  return <ellipse cx={x} cy={y} rx={8} ry={4} fill="#2ECC71" opacity="0.9" transform={`rotate(${rot} ${x} ${y})`} />;
}
function ZwiebelnT({ x, y, rot = 0 }: TP): React.ReactElement {
  return (
    <g>
      <ellipse cx={x} cy={y} rx={9} ry={4} fill="none" stroke="#C084FC" strokeWidth="2" opacity="0.85" transform={`rotate(${rot} ${x} ${y})`} />
      <ellipse cx={x} cy={y} rx={5} ry={2} fill="none" stroke="#C084FC" strokeWidth="1.5" opacity="0.85" transform={`rotate(${rot} ${x} ${y})`} />
    </g>
  );
}
function OlivenT({ x, y }: TP): React.ReactElement {
  return (
    <g>
      <ellipse cx={x} cy={y} rx={6} ry={4.5} fill="#1A1A2E" opacity="0.9" />
      <ellipse cx={x} cy={y} rx={3} ry={2}   fill="#27273A" opacity="0.9" />
    </g>
  );
}
function RucolaT({ x, y }: TP): React.ReactElement {
  return (
    <g transform={`translate(${x - 7} ${y - 7})`} fill="#22C55E" opacity="0.9">
      <path d="M7,7 C5,2 1,3 2,7 C0,4 0,8 4,8 C1,9 2,13 5,10 C5,14 8,14 9,10 C12,13 12,9 10,8 C13,8 13,4 11,7 C12,3 8,2 7,7Z" />
    </g>
  );
}
function AnanaT({ x, y }: TP): React.ReactElement {
  return (
    <g>
      <rect x={x - 8} y={y - 4} width="16" height="8" rx="3" fill="#FCD34D" opacity="0.9" />
      <line x1={x - 5} y1={y} x2={x + 5} y2={y} stroke="#F59E0B" strokeWidth="1.5" opacity="0.6" />
    </g>
  );
}

export const RENDERERS: Record<string, (p: TP) => React.ReactElement> = {
  "mozzarella":   (p) => <MozzarellaT {...p} />,
  "extra-kaese":  (p) => <MozzarellaT {...p} />,
  "salami":       (p) => <SalamiT     {...p} />,
  "schinken":     (p) => <SchinkenT   {...p} />,
  "haehnchen":    (p) => <SchinkenT   {...p} />,
  "hackfleisch":  (p) => <ToppingDot  {...p} color="#8B4513" r={8} />,
  "thunfisch":    (p) => <SchinkenT   {...p} />,
  "garnelen":     (p) => <ToppingDot  {...p} color="#FFAA80" r={7} />,
  "ananas":       (p) => <AnanaT      {...p} />,
  "paprika":      (p) => <PaprikaT    {...p} />,
  "mais":         (p) => <ToppingDot  {...p} color="#F1C40F" r={4} />,
  "jalapenos":    (p) => <JalapenoT   {...p} />,
  "pilze":        (p) => <PilzeT      {...p} />,
  "zwiebeln":     (p) => <ZwiebelnT   {...p} />,
  "oliven":       (p) => <OlivenT     {...p} />,
  "rucola":       (p) => <RucolaT     {...p} />,
  "spinat":       (p) => <ToppingDot  {...p} color="#166534" r={6} />,
  "kirschtomaten":(p) => <ToppingDot  {...p} color="#DC2626" r={5} />,
  "artischocken": (p) => <ToppingDot  {...p} color="#4B7A5A" r={6} />,
  "knoblauch":    (p) => <ToppingDot  {...p} color="#F5E6C8" r={4} />,
  "basilikum":    (p) => <RucolaT     {...p} />,
  "peperoncini":  (p) => <JalapenoT   {...p} />,
  "gorgonzola":   (p) => <MozzarellaT {...p} />,
};
