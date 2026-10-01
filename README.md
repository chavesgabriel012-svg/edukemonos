# Edukemonos

Plataforma educativa abierta con IA para estudiantes de colegio público en Costa Rica (MVP: III Ciclo — 7.º, 8.º y 9.º).

> Edukemonos es una iniciativa independiente. No es una plataforma oficial del Ministerio de Educación Pública.

- Alcance y reglas: [`docs/SPEC.md`](docs/SPEC.md)
- Plan por fases, riesgos y preguntas abiertas: [`PLAN.md`](PLAN.md)
- Qué contienen realmente las fuentes del MEP: [`docs/sources-inventory.md`](docs/sources-inventory.md)

## Estructura

```
apps/web               Next.js 16 (App Router, TS), Tailwind v4 + shadcn/ui
packages/ai            Capa de IA intercambiable (Anthropic / OpenAI), registro de uso, prompts versionados
packages/curriculum    Tipos y esquema del manifiesto de fuentes
scripts/ingest         Programas de estudio oficiales del MEP: manifiesto (sources.json), descarga respetuosa, verificación
supabase/migrations    Esquema, funciones y RLS
supabase/tests         Pruebas de RLS contra Postgres (intentan romper cada política)
config/                help-resources.json (lo completa el fundador con números verificados)
```

## Requisitos

- Node 22+ y pnpm 10 (`corepack enable`)
- Postgres 16 local para las pruebas de RLS (o cualquier URL de superusuario en `TEST_DATABASE_URL`)

## Instalación

```bash
pnpm install
cp .env.example apps/web/.env.local   # complete los valores
pnpm dev                              # http://localhost:3000
```

## Variables de entorno

Todas están documentadas en [`.env.example`](.env.example). Lo importante:

| Variable | Para qué |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Cliente de Supabase en el navegador |
| `SUPABASE_SERVICE_ROLE_KEY` | Solo servidor y scripts. Nunca en el navegador |
| `AI_PROVIDER` | `anthropic` u `openai` |
| `MODEL_BULK`, `MODEL_TUTOR`, `MODEL_VERIFY` | Identificadores de modelo. **No están en el código**: tómelos de la documentación vigente del proveedor |
| `AI_PRICES_JSON` | Precios por modelo para estimar costos en `ai_usage` |
| `RETENTION_DAYS_CHAT` | Retención de transcripciones del tutor (pendiente de revisión legal) |

## Pruebas

```bash
eval "$(supabase/tests/start-local-pg.sh)"   # Postgres desechable en el puerto 54329
pnpm lint && pnpm typecheck && pnpm test
```

`pnpm test:rls` corre solo las pruebas de RLS. Crean una base nueva, aplican un *shim* mínimo de Supabase (`supabase/tests/supabase-shim.sql`: roles `anon`/`authenticated`/`service_role`, `auth.uid()`), todas las migraciones y la semilla, y luego actúan como cada rol.

## Base de datos (Supabase)

```bash
pnpm exec supabase link --project-ref <ref>
pnpm exec supabase db push        # aplica supabase/migrations
psql "$DATABASE_URL" -f supabase/seed.sql
```

Después de crear su cuenta de correo en la app, conviértase en admin desde el SQL editor:
`update public.profiles set role = 'admin' where id = '<su user id>';`

Puntos de diseño:
- Ciclo, grado y materia son **datos** (`cycles`, `grades`, `subjects`): sumar I/II Ciclo es insertar filas.
- Los estudiantes son usuarios **anónimos** de Supabase; se unen a una sección con `join_section(código, nombre, consentimiento)`.
- Las respuestas correctas de los ítems **no son legibles por la API**; se califican en el servidor con `submit_attempt()`.
- Los docentes ven el **tema** de las sesiones del tutor, nunca la transcripción.

## Despliegue (Vercel)

La app vive en `apps/web` dentro de un monorepo pnpm. En **Project Settings → Build and Deployment**:

| Ajuste | Valor |
|---|---|
| Root Directory | `apps/web` |
| Include files outside the root directory | Activado (por defecto) — necesario para el workspace |
| Framework Preset | Next.js (se detecta solo con el Root Directory correcto) |
| Install / Build / Output | Sin override |
| Node.js Version | 22.x |

Si Root Directory queda en la raíz del repo, Vercel no encuentra `next` en `package.json`, trata el proyecto como estático y falla con *"No Output Directory named \"public\" found"*.

Variables de entorno: las de `.env.example` (las de Supabase e IA son necesarias a partir de la Fase 1; la página inicial no las usa).

## Fuentes oficiales

```bash
pnpm sources:verify   # comprueba que los 6 programas del manifiesto siguen disponibles
```

El cliente respeta `robots.txt`, se identifica y espera ~2,5 s entre peticiones al mismo dominio. La ingesta y publicación de contenido (Fase 1) se documentará aquí cuando exista.

## Capa de IA

```ts
import { createAI } from "@edukemonos/ai";

const ai = createAI({ sink: (row) => saveToAiUsage(row) });
const { data } = await ai.generateStructured(
  { role: "bulk", purpose: "structure_curriculum" },
  { system, messages, schema, schemaName: "units" },
);
```

- Cambiar de proveedor = cambiar `AI_PROVIDER` y los `MODEL_*`.
- Cada llamada registra tokens, costo estimado y latencia; nunca el texto ni nombres.
- Los prompts viven en `packages/ai/src/prompts/` con id y versión, que se guardan junto al contenido generado.
