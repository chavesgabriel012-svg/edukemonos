import { ImageResponse } from "next/og";
import { Kemo } from "@/components/brand/logo";

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

/** Home-screen icon: Kemo full-bleed, the OS rounds the corners. */
export default function AppleIcon() {
  return new ImageResponse(<Kemo size={180} radius={0} />, size);
}
