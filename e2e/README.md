# Pruebas de punta a punta

Corren contra un Supabase **local** (Docker) y `next dev`. Nunca tocan el proyecto real.

```bash
e2e/setup.sh                                          # Supabase local + datos de prueba
e2e/dev.sh &                                          # la app en http://127.0.0.1:3000, solo con claves locales
pnpm test:e2e
```

`consola.spec.ts` recorre el ciclo completo de la consola, por la interfaz y sin llamar a la IA. SQL se usa solo para
hacer `admin` a la cuenta del equipo y publicar un tema de 7.º con 4 ejercicios verificados:

1. El equipo entra con enlace mágico (Mailpit), crea «Colegio Prueba», marca 7.º Matemáticas e invita a una docente y a
   una coordinadora pegando la lista.
2. La coordinadora abre su invitación, aprueba 7.º Matemáticas y crea el grupo 7-1.
3. El equipo pasa el colegio a Activo; la docente abre su invitación y crea su sección en 7-1.
4. Una estudiante se une con el código del grupo, ve solo 7.º y Matemáticas, practica, y la docente la ve en su panel.
5. La coordinadora oculta un tema y la estudiante recibe el 404 en ese tema.
6. Con el colegio en Preparando, el código de grupo muestra el texto de colegio no activo.
7. Una cuenta sin invitación ve el texto de docente sin colegio y no tiene el formulario de sección.

La app debe correr en `127.0.0.1:3000` (el `site_url` del Supabase local, que usan los enlaces de invitación) con las
claves **locales**. Use siempre `e2e/dev.sh`: toma las claves de `supabase status`, se niega si no son locales y deja en
blanco las de IA. Un `pnpm dev` simple usaría las claves de producción si la terminal las exporta. Por eso
`e2e/global-setup.ts` aborta antes de correr si `E2E_BASE_URL`, `E2E_DB_URL` o `E2E_MAILPIT_URL` no son locales, o si
la app que responde está construida con un Supabase `.supabase.co`. `e2e/setup.sh` tampoco sobrescribe un
`apps/web/.env.local` que apunte a otro Supabase: se niega y pide moverlo.

La plantilla de invitación (`supabase/templates/invite.html`) se carga con `supabase/config.toml`; si la cambia,
reinicie el stack (`pnpm exec supabase stop` y `e2e/setup.sh`).

`revisar.spec.ts` cubre: enlace mágico (vía Mailpit local), que una cuenta nueva no vea nada sin rol de revisor,
que una habilidad inventada bloquee la publicación, que guardar vuelva a verificar textualmente (incluida una
paráfrasis del extracto), la publicación y el `review_log`.

Los datos de `fixtures/extraction-mat-g7.json` usan texto real de las páginas 276–277 del programa de Matemáticas
y una habilidad **inventada a propósito** ("Dominar los números complejos en una semana.") para probar que se detecta.
Si el daemon de Docker no está corriendo, inícielo con `dockerd &`. Si el Chromium instalado no coincide con la versión de Playwright, define `PLAYWRIGHT_CHROMIUM_PATH`.
