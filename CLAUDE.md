# Eduka

Plataforma de estudio con IA para colegios privados de Costa Rica (B2B). Es el registro de qué domina
cada estudiante del programa de su colegio, construido sin trabajo del docente. Kemo es el tutor.

Antes de decidir qué construir o cómo describirlo, lee:

- `docs/producto/competencia.md`: el posicionamiento y las 5 ventajas que no se debilitan.
- `docs/producto/salir-live.md`: lo que falta para empezar con el colegio fundador.
- `docs/producto/gamificacion.md`: las reglas de rachas, torneo, insignias y certificados.

## Reglas

- **Lo que nunca se hace:**
  - Pedirle preparación al docente.
  - Publicar contenido sin verificar.
  - Mostrar al docente lo que el estudiante escribe al tutor.
  - Enviar nombres u otros datos personales a la IA.
  - Alargar la retención de los chats, que es de 30 días.
- **Tono:**
  - Tuteo con el estudiante y usted con el docente y el colegio.
  - Nunca se asume el género del estudiante.
- **Textos honestos:**
  - Se describe lo que existe.
  - No se escribe «100 % del MEP» ni «ingesta automática de Word».
- **Gamificación:** premia el dominio, nunca el tiempo ni la velocidad. Sin compras ni cajas de botín.
- **Reglas en dos lenguajes:** cada regla en SQL tiene su espejo en `packages/curriculum`, y
  `supabase/tests/rls.test.ts` compara las dos.
- **`apps/web` usa Next.js 16:** lee `apps/web/AGENTS.md` antes de tocarlo.
- **Ramas:** las fases salen de `producto/eduka-v2` y vuelven con un PR. Nada llega a `main` sin la
  aprobación del fundador.
- **Producción:** nunca se crean datos de prueba en el Supabase de producción. Para probar de punta
  a punta, usa `e2e/setup.sh`, que levanta un Supabase local con Docker.

## Departamento técnico

Los agentes están en `.claude/agents/`:

| Agente | Área | Qué hace |
|---|---|---|
| `eduka-arquitectura` | Datos, separación por colegio y estructura | Diseña, no escribe código |
| `eduka-desarrollo` | Implementación | Construye y prueba |
| `eduka-seguridad` | Ciberseguridad y privacidad de menores | Revisa y reporta |
| `eduka-juegos` | Minijuegos y gamificación | Propone y construye |
| `eduka-contenido` | Ingestión, generación, verificación y prompts | Carga y mejora el contenido |
| `eduka-qa` | Pruebas y recorridos de punta a punta | Prueba y reporta fallas |
| `eduka-producto` | Interfaz, textos y accesibilidad | Revisa y propone |
