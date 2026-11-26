import type { ReactNode } from "react";

type NoticeVariant = "accent" | "error" | "warning" | "info";

/** Inline status notice. Presentational — safe as a server component. */
export function Notice({
  children,
  variant = "accent",
  role,
  className = ""
}: {
  children: ReactNode;
  variant?: NoticeVariant;
  role?: "status" | "alert";
  className?: string;
}) {
  const roleAttr = role ?? (variant === "error" ? "alert" : "status");
  return (
    <div className={`notice ${variant === "accent" ? "" : variant} ${className}`.trim()} role={roleAttr}>
      {children}
    </div>
  );
}
