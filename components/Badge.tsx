import type { ReactNode } from "react";

type BadgeVariant = "default" | "accent" | "success" | "warning" | "danger" | "info";

/** Small status/label pill. Presentational — safe as a server component. */
export function Badge({
  children,
  variant = "default",
  className = ""
}: {
  children: ReactNode;
  variant?: BadgeVariant;
  className?: string;
}) {
  return (
    <span className={`badge ${variant === "default" ? "" : variant} ${className}`.trim()}>
      {children}
    </span>
  );
}
