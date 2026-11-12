import { cn } from "cn";

/** The content column shared by the header, the footer and every page that is not full-bleed. */
export const SHELL =
  "mx-auto w-full max-w-6xl pr-[max(1rem,env(safe-area-inset-right))] pl-[max(1rem,env(safe-area-inset-left))] sm:pr-[max(1.5rem,env(safe-area-inset-right))] sm:pl-[max(1.5rem,env(safe-area-inset-left))]";

export function PageShell({ className, children }: { className?: string; children: React.ReactNode }) {
  return <div className={cn(SHELL, "py-8 sm:py-10", className)}>{children}</div>;
}
