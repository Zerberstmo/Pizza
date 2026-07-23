import type React from "react";
import { motion, useReducedMotion } from "motion/react";

export function Reveal({ children, delay = 0, className }: {
  children: React.ReactNode;
  delay?: number;
  className?: string;
}): React.ReactElement {
  const reduce = useReducedMotion();
  if (reduce) return <div className={className}>{children}</div>;
  return (
    <motion.div
      className={className}
      initial={{ opacity: 0, y: 16 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.2 }}
      transition={{ delay, duration: 0.3 }}
    >
      {children}
    </motion.div>
  );
}
