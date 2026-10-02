import { cn } from "cn";
import { brand } from "@/lib/brand";

/** Kemo only moves its eyes: never a mouth, arms or body. */
export type KemoMood = "normal" | "think" | "wow" | "happy" | "down";

export const KEMO_MOODS: Record<KemoMood, { name: string; use: string }> = {
  normal: { name: "Curioso", use: "Por defecto" },
  think: { name: "Pensando", use: "Tutor cargando" },
  wow: { name: "Sorpresa", use: "Dato curioso" },
  happy: { name: "Feliz", use: "Respuesta correcta" },
  down: { name: "Concentrado", use: "Leyendo, examen" },
};

/** Pupil box inside each eye, in % of the eye (left, top, width, height). */
const PUPIL: Record<KemoMood, [number, number, number, number]> = {
  normal: [42, 12, 46, 46],
  think: [10, 8, 46, 46],
  wow: [32, 32, 36, 36],
  happy: [12, 42, 76, 20],
  down: [27, 46, 46, 46],
};

const EYE = { y: 31, size: 30, xs: [17, 53] } as const;

interface KemoProps {
  size?: number;
  mood?: KemoMood;
  background?: string;
  eyeColor?: string;
  /** Corner radius in % of the side; 0 for full-bleed app icons. */
  radius?: number;
  className?: string;
  title?: string;
}

/** The symbol: Kemo, a rounded cube with two eyes looking up. Drawn on a 100×100 grid. */
export function Kemo({
  size = 48,
  mood = "normal",
  background = brand.violeta,
  eyeColor = brand.papel,
  radius = 28,
  className,
  title,
}: KemoProps) {
  const [pl, pt, pw, ph] = PUPIL[mood];
  const happy = mood === "happy";
  const s = EYE.size / 100;
  return (
    <svg
      viewBox="0 0 100 100"
      width={size}
      height={size}
      className={cn("shrink-0", className)}
      role={title ? "img" : undefined}
      aria-label={title}
      aria-hidden={title ? undefined : true}
    >
      <rect width="100" height="100" rx={radius} fill={background} />
      {EYE.xs.map((x) => {
        const w = pw * s;
        const h = ph * s;
        return (
          <g key={x}>
            {!happy && <circle cx={x + EYE.size / 2} cy={EYE.y + EYE.size / 2} r={EYE.size / 2} fill={eyeColor} />}
            <rect
              x={x + pl * s}
              y={EYE.y + pt * s}
              width={w}
              height={h}
              rx={Math.min(w, h) / 2}
              fill={happy ? eyeColor : brand.tinta}
            />
          </g>
        );
      })}
    </svg>
  );
}

interface WordmarkProps {
  /** Font size in px; the cap height of the "E" sets the clear space (× 0.35). */
  size?: number;
  ink?: string;
  accent?: string;
  className?: string;
}

/** "Eduka" in League Spartan Bold with the chat bubble over the "a": the tutor that guides you. */
export function Wordmark({ size = 32, ink = "currentColor", accent = brand.lima, className }: WordmarkProps) {
  return (
    <span
      className={cn("inline-flex items-baseline whitespace-nowrap font-heading font-bold", className)}
      style={{ fontSize: size, lineHeight: 1, letterSpacing: "-0.01em", paddingTop: "0.08em", color: ink }}
    >
      Eduk
      <span className="relative">
        a
        <span
          aria-hidden
          className="absolute"
          style={{
            left: "0.44em",
            top: "0.02em",
            width: "0.22em",
            height: "0.18em",
            borderRadius: "0.1em 0.1em 0.1em 0.02em",
            background: accent,
          }}
        />
      </span>
    </span>
  );
}

interface LogoProps extends WordmarkProps {
  symbolBackground?: string;
}

/** Symbol + wordmark lockup. Minimum 24 px tall. */
export function Logo({ size = 32, ink, accent, symbolBackground, className }: LogoProps) {
  return (
    <span className={cn("inline-flex items-center", className)} style={{ gap: Math.round(size * 0.22) }}>
      <Kemo size={Math.round(size * 0.92)} background={symbolBackground} />
      <Wordmark size={size} ink={ink} accent={accent} />
    </span>
  );
}
