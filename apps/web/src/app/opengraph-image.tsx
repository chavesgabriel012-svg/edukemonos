import { ImageResponse } from "next/og";
import { Kemo } from "@/components/brand/logo";
import { brand } from "@/lib/brand";

export const alt = "Eduka: estudia a tu ritmo, de 7.º a 9.º, con los programas del MEP.";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const TEXT = "EdukaEstudia a tu ritmo.De 7.º a 9.ºGratis · Programas del MEP · Tutor que te guía";

/** League Spartan Bold as TTF (the image renderer cannot read woff2); null keeps the default font. */
async function leagueSpartan(): Promise<ArrayBuffer | null> {
  try {
    const css = await (await fetch(`https://fonts.googleapis.com/css2?family=League+Spartan:wght@700&text=${encodeURIComponent(TEXT)}`)).text();
    const url = css.match(/src: url\((.+?)\) format\('(?:opentype|truetype)'\)/)?.[1];
    return url ? await (await fetch(url)).arrayBuffer() : null;
  } catch {
    return null;
  }
}

/** Link preview (WhatsApp, Facebook, X…), after the brand manual's Instagram post. */
export default async function OpengraphImage() {
  const spartan = await leagueSpartan();
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", justifyContent: "space-between", background: brand.violeta, padding: 72, fontFamily: "League Spartan", color: brand.papel }}>
        <div style={{ display: "flex", alignItems: "center", gap: 20, fontSize: 64 }}>
          <Kemo size={72} background={brand.lima} />
          <span>Eduka</span>
        </div>
        <div style={{ display: "flex", flexDirection: "column", fontSize: 104, lineHeight: 0.95, letterSpacing: "-0.02em" }}>
          <span>Estudia a tu ritmo.</span>
          <span style={{ color: brand.lima }}>De 7.º a 9.º</span>
        </div>
        <div style={{ display: "flex", fontSize: 34, opacity: 0.85 }}>Gratis · Programas del MEP · Tutor que te guía</div>
      </div>
    ),
    { ...size, fonts: spartan ? [{ name: "League Spartan", data: spartan, weight: 700, style: "normal" }] : undefined },
  );
}
