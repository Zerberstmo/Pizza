import type React from "react";
import { cn } from "@/lib/utils";

// Natives Select mit Dark-Styling. Aus App.tsx:433-461.
export function SelectInput({ value, onChange, options, placeholder, disabled = false }: {
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
  placeholder?: string;
  disabled?: boolean;
}): React.ReactElement {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      disabled={disabled}
      className={cn(
        "flex h-11 w-full rounded-xl border border-border bg-input-background px-4 py-2.5",
        "text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring/50 focus:border-primary/50 transition-colors",
        "disabled:opacity-50 disabled:cursor-not-allowed",
        !value && "text-muted-foreground"
      )}
      style={{ colorScheme: "dark" }}
    >
      {placeholder && <option value="" disabled>{placeholder}</option>}
      {options.map((o) => (
        <option key={o.value} value={o.value} style={{ background: "#18181B", color: "#FAFAF9" }}>
          {o.label}
        </option>
      ))}
    </select>
  );
}
