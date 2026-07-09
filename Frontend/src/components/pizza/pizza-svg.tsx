import type React from "react";
import { RENDERERS, ToppingDot, TOPPING_COLORS, getToppingPositions, type TP } from "./toppings";

// Pizza-Vorschau als SVG. 1:1 aus `Frontend vorlage/src/app/App.tsx:373-397`.
export function PizzaSVG({ selected }: { selected: string[] }): React.ReactElement {
  const total = selected.length;
  return (
    <svg viewBox="0 0 200 200" className="w-full h-full drop-shadow-2xl" xmlns="http://www.w3.org/2000/svg">
      <circle cx="100" cy="100" r="96" fill="#C4956A" />
      <circle cx="100" cy="100" r="88" fill="#B03818" />
      <circle cx="100" cy="100" r="84" fill="#9B2A14" />
      <circle cx="100" cy="100" r="82" fill="#E8C070" opacity="0.38" />
      {total === 0 && (
        <text x="100" y="107" textAnchor="middle" fill="#C4956A" fontSize="9"
          fontFamily="DM Sans, sans-serif" opacity="0.5">Zutaten wählen</text>
      )}
      {selected.map((id, idx) => {
        const renderer = RENDERERS[id] ?? ((p: TP) => <ToppingDot {...p} color={TOPPING_COLORS[id] ?? "#888"} />);
        return getToppingPositions(idx, total).map(([x, y], i) => (
          <g key={`${id}-${i}`}>
            {renderer({ x, y, rot: (idx * 47 + i * 73) % 360 })}
          </g>
        ));
      })}
      <circle cx="100" cy="100" r="96" fill="none" stroke="#D4A574" strokeWidth="1.5" opacity="0.25" />
      <circle cx="100" cy="100" r="88" fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth="1" />
    </svg>
  );
}
