import type { MetadataRoute } from "next";
import { brand } from "@/lib/brand";
import { site } from "@/lib/site";

/** Lets students add Eduka to their phone's home screen. */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: site.name,
    short_name: site.name,
    description: site.description,
    lang: "es-CR",
    start_url: "/",
    display: "standalone",
    background_color: brand.papel,
    theme_color: brand.violeta,
    icons: [
      { src: "/icon.svg", sizes: "any", type: "image/svg+xml" },
      { src: "/icons/192", sizes: "192x192", type: "image/png", purpose: "maskable" },
      { src: "/icons/512", sizes: "512x512", type: "image/png", purpose: "maskable" },
      { src: "/icons/512", sizes: "512x512", type: "image/png", purpose: "any" },
    ],
  };
}
