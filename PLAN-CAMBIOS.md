# PLAN DE CAMBIOS — Landing 5STAR v2

## A · VIDEO NUEVO (punto 1) — 8K → scrub fluido
Fuente: `~/Downloads/hf_20260819_202558_e3cd4f3d-ff54-4b22-a118-671bb43a478c.mp4` (7680×4320, 60fps, 20s, 100MB).

Tratamientos obligatorios:
1. **Transcodificar** con ffmpeg (sin re-escalares absurdos, el scrub no necesita 8K):
   - `scroll-5stars-web.mp4` → **1920×1080 @ 24fps** (el contenido es 24fps, 60fps solo duplica frames a decodificar), H.264 CRF 22, preset slow, `-movflags +faststart`, sin audio → ~8-12MB.
   - `scroll-5stars-scrub.mp4` → **1280×720 @ 24fps** CRF 26 → ~3-4MB (versión de scrub para celulares/modo COARSE).
   - poster del frame 0 → `poster-hero.jpg` (1920px, calidad alta).
2. Mantener el patrón actual: video con `data-src` que se carga solo cuando el reel entra en viewport, `preload="auto"`, muted+playsinline, reconciliador de seeks ya existente.
3. **Regenerar los 5 frames del fallback estático** (`assets/img/frame-01…05.jpg` + `frame-lockup.jpg`) desde el video nuevo, en 1080p — el `lite` (modo estático) debe seguir mostrando la MISMA narrativa que el scrub.

## B · FUERA LA "ESTRELLA DE DAVID" (puntos 2 y 5)
Diagnóstico real: no hay un hexagrama — lo que se ve es un **pentagrama** (5 trazados curvos que se cruzan por el centro) en DOS lugares:
- **Preloader** (`index.html` líneas 29-34, los `path.pl-leg`).
- **Contacto** (`index.html` líneas 213-215, `#drawStar` con las curvas cruzadas).

Reemplazo: **estrella de 5 puntas clásica** (el path estándar `M50 3 L60.87 35.03 …` que ya usa el nav/HUD/rows) con la MISMA animación de dibujo (stroke reveal) pero sin cruces internos. El preloader conserva el countdown 5→1; el contacto conserva su efecto de "se dibuja sola" con la estrella clásica.

## C · SINCRONIZACIÓN ESTRELLAS ↔ SERVICIOS (punto 3)
Hoy el `WINDOWS` del JS mapea 5 momentos fijos al video viejo y una estrella queda "salteada" (el orden de aparición no coincide con 1-2-3-4-5).

Procedimiento:
1. Extraer frames del video NUEVO cada 0.5s (40 frames) + zoom en los momentos de aparición.
2. Detectar el tick real de aparición de CADA una de las 5 estrellas (t₁…t₅) y el tick de **unificación** (todas juntas → estallido → lockup 5+estrella).
3. Remapear en `js/main.js`: el servicio i se muestra cuando su estrella i aparece en pantalla; **el servicio 05 (Desarrollo de diseño web) se muestra en el momento de la UNIFICACIÓN** (todas las estrellas juntas), no antes.
4. Reordenar los servicios según el orden real de aparición (la que "salta" pasa a ser la correcta en su ventana).
5. Actualizar el HUD (5 estrellas que se encienden) y el fallback `lite` para que coincidan con el nuevo mapeo.

## D · TIPOGRAFÍA COMPLETA (punto 4)
- **Display (títulos)**: Druk Wide ya está como `--display` — auditar y aplicar a TODO lo que hoy cae en la pila system sans por error: eyebrow, marquee (ya la usa), btn label grande, `lite__title`, numeraciones, contacto.
- **Sub-fuente (cuerpo/sub)**: hoy es pila de sistema genérica. Definir la "sub-fuente nuestra". **Recomendada: Archivo** (vibra editorial que acompaña la Druk, variable de Google Fonts, gratis). Alternativas: Inter (neutral) o Helvetica Now. → Decisión del plan: Archivo, salvo que digas otra. Se aplica a: descripciones, párrafos, labels menores, footer, nav.
- Tipografía fluida con `clamp()` en todos los títulos grandes; el `5` gigante y las palabras del hero en Druk siempre.

## E · SECCIÓN "LO QUE HACEMOS" DISRUPTIVA (punto 4b)
Fuera el dictado de 5 filas. Propuesta: **"Constelación 5STAR"** — un sistema tipográfico-movimiento que ES la prueba de capacidad:
- Las 5 disciplinas como **palabras gigantes en Druk** (IDENTIDAD VISUAL / PRODUCCIÓN AUDIOVISUAL / ANALÍTICA · CAMPAÑAS / IA · UGC / DISEÑO WEB) dispuestas en coordenadas orbitales fijas del viewport, cada una orbitando/rotando suavemente con el scroll (ScrollTrigger + MotionPathPlugin; la sección pinned ~150vh).
- Al centrar cada palabra (momento de "pasa por su órbita") se **enciende** en bordó con un destello y su **sub-fuente** la acompaña con una línea corta al costado (sin re-dictar: una frase/verbo potente por servicio, ej. "IDENTIDAD VISUAL — marcas que se miran dos veces").
- Hover en desktop: **scramble de letras** (efecto "decodificación" hecho a mano con SplitText, sin plugin de pago) + skew.
- Una **figura SVG viva** en el centro (estrella clásica que rota y late) que morfea al 5 en el último tramo — morph por interpolación de paths, sin plugins de Club.
- Mobile: las palabras apiladas con stagger reveal (la órbita solo en `(hover:hover) and (pointer:fine)`).

## F · ANIMACIONES NUEVAS (punto 6) — libertad disruptiva
Skills/plugins a sumar (todos gratuitos, ya instalados en `~/.claude/skills`): `gsap-plugins`, `gsap-timeline`, `gsap-utils`, `gsap-performance` + técnicas nativas.
- **Text**: SplitText en modo `chars` con mask reveals en los títulos del hero/index; blur→focus; scramble casero en hovers; títulos con contorno (stroke text) sobre relleno.
- **Figuras**: estrellas que se dibujan (stroke-dashoffset, ya existe el patrón), estrella HUD que se llena con el scroll, marquees dobles en direcciones opuestas con skew, un "5" gigante outline que se recorta con scroll (clip-path reveal).
- **Micro**: cursor? No (mobile-first); sí: link hovers con subrayado que crece, texto del nav con hover fill alternado, transiciones de sección con pin + fade del grano.
- Todo respetando `prefers-reduced-motion` y sin romper el fallback estático (`lite`) y móvil.

## G · VERIFICACIÓN (al cierre)
- Probe en Chrome headless (desktop 1280 + móvil 390): overflow=0, 0 errores, video scrubea (currentTime avanza con scroll incremental REAL vía script con Lenis), draw de estrellas presente, sin pentagramas (verificación visual por screenshot).
- Screenshots internos de: preloader, reel con servicios, constelación, contacto.
- Chequeo de rendimiento: sin layout thrash (will-change correctos, filters acotados), video 1080/720 cargado según dispositivo.

## H · EJECUCIÓN
- Claude Code **opus + effort high**, en `~/5star-landing` (sesión retomada con `--resume c1e9753e` para conservar contexto del build original).
- Skills a cargar: `frontend-design`, `creative-director`, `gsap-core/scrolltrigger/plugins/timeline/utils/performance`, `impeccable`, `brand-guidelines`.
- Yo (Hermes) hago la verificación final real (probe + screenshots) antes de entregar; después redeploy a Vercel si querés.