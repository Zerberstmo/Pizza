import type React from "react";
import { cn } from "@/lib/utils";

export function SectionHeader({ eyebrow, title, className }: {
  eyebrow?: string;
  title: string;
  className?: string;
}): React.ReactElement {
  return (
    <div className={cn("mb-4", className)}>
      {eyebrow ? (
        <p data-testid="eyebrow" className="text-xs font-semibold uppercase tracking-widest text-accent mb-1">
          {eyebrow}
        </p>
      ) : null}
      <h2 className="text-2xl font-extrabold tracking-tight">{title}</h2>
    </div>
  );
}
