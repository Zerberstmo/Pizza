import type React from "react";

// Pseudo-QR (deterministisch aus `data`) — reine Optik. Aus App.tsx:403-427.
export function QrCode({ data }: { data: string }): React.ReactElement {
  const seed = data.split("").reduce((a, c) => a + c.charCodeAt(0), 0);
  const N = 25;
  const cells = Array.from({ length: N }, (_, i) =>
    Array.from({ length: N }, (_, j) => {
      const inCorner = (i < 8 && j < 8) || (i < 8 && j >= N - 8) || (i >= N - 8 && j < 8);
      if (inCorner) {
        const ci = i < 8 ? i : i - (N - 8);
        const cj = j < 8 ? j : j - (N - 8);
        return ci === 0 || ci === 6 || cj === 0 || cj === 6 || (ci >= 2 && ci <= 4 && cj >= 2 && cj <= 4);
      }
      return ((seed * 31 + i * 37 + j * 41) % 17) > 8;
    })
  );
  return (
    <svg viewBox={`0 0 ${N * 4} ${N * 4}`} className="w-full h-full rounded-lg">
      <rect width="100%" height="100%" fill="white" />
      {cells.flatMap((row, i) =>
        row.map((cell, j) =>
          cell ? <rect key={`q-${i}-${j}`} x={j * 4} y={i * 4} width="4" height="4" fill="#09090B" /> : null
        )
      )}
    </svg>
  );
}
