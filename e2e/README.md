# Pruebas de punta a punta

Corren contra un Supabase **local** (Docker) y `next dev`. Nunca tocan el proyecto real.

```bash
e2e/setup.sh                                          # Supabase local + datos de prueba
pnpm --filter web dev --hostname 127.0.0.1 &          # la app en http://127.0.0.1:3000
pnpm test:e2e
```

`revisar.spec.ts` cubre: enlace mágico (vía Mailpit local), que una cuenta nueva no vea nada sin rol de revisor,
que una habilidad inventada bloquee la publicación, que guardar vuelva a verificar textualmente (incluida una
paráfrasis del extracto), la publicación y el `review_log`.

Los datos de `fixtures/extraction-mat-g7.json` usan texto real de las páginas 276–277 del programa de Matemáticas
y una habilidad **inventada a propósito** ("Dominar los números complejos en una semana.") para probar que se detecta.
Si el Chromium instalado no coincide con la versión de Playwright, define `PLAYWRIGHT_CHROMIUM_PATH`.
