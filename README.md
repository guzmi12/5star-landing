# 5STAR — landing

Landing de una sola página para **5STAR**, estudio creativo de Montevideo.
La idea central: **el video es el scroll**. Una sección fijada conecta el
progreso del scroll con `video.currentTime`, y los cinco servicios aparecen
exactamente cuando su estrella está en pantalla.

Sin build step: HTML, CSS y JavaScript vanilla. GSAP y Lenis por CDN.

---

## Cómo correrlo

Necesita un servidor HTTP (el `<video>` con seek no funciona bien desde `file://`):

```bash
cd ~/5star-landing
python3 -m http.server 4322
```

Después abrí <http://127.0.0.1:4322/>.

### Parámetros de prueba

| URL | Qué fuerza |
|---|---|
| `?lite=1` | Modo estático (fotogramas fijos + IntersectionObserver) |
| `?lite=0` | Fuerza el scrub aunque el dispositivo parezca lento |
| `?motion=off` | Simula `prefers-reduced-motion: reduce` |
| `?motion=on` | Ignora `prefers-reduced-motion` |

En la consola, `window.__fivestar` expone `mode`, `progress`, `videoTime`,
`videoDuration` y `scrubTarget` para verificar el scrub.

---

## Estructura

```
index.html
css/style.css
js/main.js
assets/
  src/                      # originales, sin tocar
    scroll-5stars-web.mp4   # 1920x1080 @24fps · CRF 22 · faststart · sin audio · 20 s · 8,7 MB
    scroll-5stars-scrub.mp4 # 1280x720  @24fps · CRF 26 · versión liviana · 2,4 MB
    scroll-5stars.mp4       # master v1, superado por el video nuevo
    poster.jpg              # poster v1 (fotograma en negro)
  fonts/
    DrukWideBold.ttf        # display de marca
  img/                      # derivados 1080p generados con ffmpeg desde el .mp4 web
    poster-hero.jpg         # poster real del <video> (t = 1,50 s)
    frame-01..05.jpg        # un fotograma por servicio, para el modo estático
    frame-lockup.jpg        # lockup final: 5 + estrella
    favicon.svg
README.md
```

`assets/src/poster.jpg` quedó intacto pero es un fotograma negro, así que el
`<video>` usa `assets/img/poster-hero.jpg`, extraído a los 0,30 s (las cinco
estrellas ya en cuadro).

---

## Cómo funciona el scrub

La línea de tiempo de GSAP está **medida en segundos de video**: dura 20 y cada
posición del timeline es literalmente el fotograma en pantalla.

```js
tl.to(state, { t: VIDEO_DUR, duration: VIDEO_DUR, onUpdate: seek }, 0);
```

Las ventanas no son estimaciones: salen de medir la luminancia media del propio
video con `ffprobe + signalstats` a 8 fps y de mirar los fotogramas uno por uno.
Los picos reales caen en **2,94 · 6,38 · 8,75 · 13,38 · 16,60 s**, y ahí está
anclado el destello y la subida de brillo de cada bloque.

| # | Servicio | Entra | Pico | Sale | Qué se ve |
|---|---|---|---|---|---|
| 01 | Identidad visual | 2,00 s | 2,94 s | 4,10 s | una estrella llena el cuadro |
| 02 | Producción audiovisual | 5,50 s | 6,38 s | 7,40 s | fogonazo blanco al cruzar |
| 03 | Analítica de marketing, campañas y pautas | 8,05 s | 8,75 s | 10,40 s | la estrella más grande, centrada |
| 04 | Publicidad con IA · UGC | 12,45 s | 13,38 s | 14,35 s | la estrella con su séquito |
| 05 | Desarrollo de diseño web | 15,30 s | 16,60 s | 16,95 s | **unificación**: las cinco juntas → estallido |
| — | lockup 5 + estrella | 18,10 s | — | 20,00 s | el logo, ya limpio sobre negro |

El 05 cae en la unificación a propósito: es el servicio que junta a todos los
demás. Las cinco estrellas del HUD se encienden una por ventana, en orden.

Altura de la sección fijada: **460vh** en escritorio, **300vh** en retrato
angosto.

En escritorio se sirve el 1080p; en táctil, pantallas < 900 px o `saveData`, el
720p (`data-src-light`). El video se asigna por JS, así que en modo estático no
se descarga nada.

---

## Constelación 5STAR

La sección «lo que hacemos» no es una lista: las cinco disciplinas orbitan la
estrella en un carrusel con profundidad. Para cada palabra, con `θ = a₀ᵢ + p·TURN`:

```
z = cos θ            →  1 = adelante, -1 = al fondo
x = RX · sen θ       y = RY · z
escala, opacidad y blur salen todos de z
```

La que pasa por el frente se enciende: fogonazo bordó, regla, su línea en
Archivo, y el texto se **decodifica** (scramble hecho a mano, sin plugins de
pago). Las de atrás quedan chicas, tenues y desenfocadas — jerarquiza el
movimiento, no una numeración. Sobre el final la órbita se apaga y queda el
lockup **5 + estrella**.

Se dibuja con `quickSetter` (5 nodos, sólo transform/opacity/filter), sin
MotionPathPlugin. En táctil o < 900 px no hay órbita: las cinco se apilan con
revelado escalonado.

---

## Comportamiento por dispositivo

- **Escritorio**: Lenis (smooth scroll), scrub `0.85`, grano de película al 5,5 %.
- **Táctil**: scroll nativo (Lenis desactivado), scrub `0.4`, sin grano.
  En retrato el video se ve entero como banda 16:9 y la copy vive debajo, sobre
  negro — nada de recorte destructivo ni texto sobre un fondo blanco.
- **Modo estático** (`prefers-reduced-motion`, `saveData`,
  `hardwareConcurrency <= 4`, o táctil con lado corto < 380 px):
  no se descarga el video, se muestran los seis fotogramas apilados y los
  servicios aparecen con IntersectionObserver.
- **Sin JavaScript**: se ve el modo estático completo, con el marquee animado
  por CSS.

---

## Marca

- Paleta oficial: negro `#000000`, hueso `#F2EFE9`, bordó `#910005`.
- Display **Druk Wide Bold** (`assets/fonts/`), con Anton como reemplazo mientras carga.
- Sub-fuente **Archivo** (Google Fonts): descripciones, notas, nav y pie.
- El **5 y la estrella son siempre elementos separados** — nunca un solo glifo.
- «FILMS» aparece sólo como descriptor en el pie, nunca pegado al logo reducido.
- El bordó nunca se usa como color de texto sobre negro (no llega a AA);
  vive en la estrella, las reglas, los subrayados, el fogonazo y el relleno del
  botón, siempre con texto hueso encima (8,3:1).

---

## Dependencias (CDN)

- GSAP 3.13.0 + ScrollTrigger + SplitText + DrawSVGPlugin — cdnjs
- Lenis 1.1.14 — jsDelivr
- Anton + Archivo — Google Fonts

---

## Dos apartes del plan v2

1. **La estrella no morfea al 5.** El brandbook dice que el 5 y la estrella son
   siempre elementos separados; un morph genera glifos híbridos en los
   fotogramas intermedios. La estrella late y gira, y el 5 **llega al lado**
   como elemento aparte hasta armar el lockup.
2. **La sección va a 240vh, no 150vh.** Con `pinSpacing:false`, 150vh dejan
   sólo 50vh de scroll para cinco encendidos (~10vh cada uno): ilegible.

Si alguna falla, la página degrada al modo estático en lugar de romperse.
