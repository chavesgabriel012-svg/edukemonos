import { cn } from "cn";

/** The content column shared by the header, the footer and every page that is not full-bleed. */
export const SHELL = "mx-auto w-full max-w-6xl px-4 sm:px-6";

export function PageShell({ className, children }: { className?: string; children: React.ReactNode }) {
  return <div className={cn(SHELL, "py-8 sm:py-10", className)}>{children}</div>;
}
