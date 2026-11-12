import { cva, type VariantProps } from "class-variance-authority";

/**
 * Buttons and button-like links (brand manual: radius 14 px, height 52 px). Primary is violet with
 * white text, `lima` is the accent with Tinta text, `outline` has a Tinta border. The `on-dark`
 * variants are for violet or Tinta backgrounds. Use the classes on <button> or <Link>.
 */
export const action = cva(
  "inline-flex shrink-0 cursor-pointer items-center justify-center gap-2 text-center font-semibold transition focus-visible:outline-2 focus-visible:outline-offset-2 disabled:pointer-events-none disabled:opacity-50",
  {
    variants: {
      variant: {
        primary: "bg-violeta text-white hover:bg-[#4a2fe0] focus-visible:outline-violeta",
        lima: "bg-lima text-tinta hover:bg-[#b5e51f] focus-visible:outline-tinta",
        outline: "border-2 border-tinta text-tinta hover:bg-tinta hover:text-papel focus-visible:outline-tinta",
        soft: "bg-secondary text-foreground hover:bg-[#e2e0ea] focus-visible:outline-violeta",
        "lima-on-dark": "bg-lima text-tinta hover:bg-[#b5e51f] focus-visible:outline-white",
        "outline-on-dark": "border-2 border-white/70 text-white hover:bg-white/10 focus-visible:outline-white",
      },
      size: {
        lg: "min-h-[52px] rounded-[14px] px-6 py-2 text-base",
        md: "min-h-11 rounded-[12px] px-4 py-2 text-sm",
        sm: "min-h-9 rounded-[10px] px-3 py-1.5 text-sm",
      },
    },
    defaultVariants: { variant: "primary", size: "lg" },
  },
);

export type ActionProps = VariantProps<typeof action>;
