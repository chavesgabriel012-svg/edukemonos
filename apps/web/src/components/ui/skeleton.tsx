import { cn } from "cn";

/** A grey block with a shimmer, in the shape of what is loading. Decorative: hidden from screen readers. */
export function Skeleton({ className }: { className?: string }) {
  return <span aria-hidden className={cn("skeleton block", className)} />;
}

/** Wraps a group of skeletons and tells screen readers that the page is loading. */
export function Loading({ label = "Cargando…", className, children }: { label?: string; className?: string; children: React.ReactNode }) {
  return (
    <div role="status" aria-busy="true" className={className}>
      <span className="sr-only">{label}</span>
      {children}
    </div>
  );
}
