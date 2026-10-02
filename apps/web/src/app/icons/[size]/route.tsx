import { ImageResponse } from "next/og";
import { Kemo } from "@/components/brand/logo";

const SIZES = [192, 512] as const;

export function generateStaticParams() {
  return SIZES.map((s) => ({ size: String(s) }));
}

/** App icons for the web manifest: Kemo full-bleed, so the OS mask (circle, squircle) can shape it. */
export async function GET(_request: Request, ctx: RouteContext<"/icons/[size]">) {
  const size = Number((await ctx.params).size);
  if (!SIZES.includes(size as (typeof SIZES)[number])) return new Response("Not found", { status: 404 });
  return new ImageResponse(<Kemo size={size} radius={0} />, { width: size, height: size });
}
