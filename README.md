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
    scroll-5stars.mp4       # master 23,6 MB
    scroll-5stars-web.mp4   # 1280x720 · h264 · faststart · sin audio · 20 s · 3,9 MB
    poster.jpg              # poster original (fotograma en negro)
  img/                      # derivados generados con ffmpeg desde el .mp4 web
    poster-hero.jpg         # poster real del <video> (t = 0,30 s)
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

Las ventanas de cada servicio no son estimaciones: salen de medir la luminancia
media del propio video con `ffprobe + signalstats` a 4 fps. Los picos reales de
fogonazo caen en **2,85 s · 6,30 s · 8,80 s · 13,25 s · 15,90 s**, y ahí está
anclado el destello y la subida de brillo de cada bloque.

| # | Servicio | Entra | Pico | Sale |
|---|---|---|---|---|
| 01 | Identidad visual | 1,90 s | 2,85 s | 4,50 s |
| 02 | Producción audiovisual | 5,50 s | 6,30 s | 7,70 s |
| 03 | Analítica de marketing, campañas y pautas | 8,10 s | 8,80 s | 10,60 s |
| 04 | Publicidad con IA · UGC | 12,30 s | 13,25 s | 14,20 s |
| 05 | Desarrollo de diseño web | 14,90 s | 15,90 s | 16,80 s |
| — | lockup 5 + estrella | 17,70 s | — | 20,00 s |

Altura de la sección fijada: **460vh** en escritorio, **300vh** en retrato
angosto.

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
- Display **Anton** (Google Fonts), cuerpo en stack de sistema.
- El **5 y la estrella son siempre elementos separados** — nunca un solo glifo.
- «FILMS» aparece sólo como descriptor en el pie, nunca pegado al logo reducido.
- El bordó nunca se usa como color de texto sobre negro (no llega a AA);
  vive en la estrella, las reglas, los subrayados, el fogonazo y el relleno del
  botón, siempre con texto hueso encima (8,3:1).

---

## Dependencias (CDN)

- GSAP 3.13.0 + ScrollTrigger + SplitText + DrawSVGPlugin — cdnjs
- Lenis 1.1.14 — jsDelivr
- Anton — Google Fonts

Si alguna falla, la página degrada al modo estático en lugar de romperse.
