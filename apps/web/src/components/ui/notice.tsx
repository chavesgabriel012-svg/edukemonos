import { cn } from "cn";

const TONE = {
  info: "border-[#cfc7fb] bg-[#f1eefe] text-tinta",
  warn: "border-[#f0d48a] bg-[#fdf6e3] text-[#4f3700]",
  help: "border-[#a9dcf3] bg-[#eaf7fd] text-[#0b3a50]",
} as const;

/** A short message that is part of the page (not an error): a tip, a pending-review warning, a help card. */
export function Notice({ tone = "info", className, children, ...props }: { tone?: keyof typeof TONE } & React.ComponentProps<"div">) {
  return (
    <div className={cn("rounded-[16px] border p-4 text-sm leading-relaxed", TONE[tone], className)} {...props}>
      {children}
    </div>
  );
}
