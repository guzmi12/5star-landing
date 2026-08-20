/* =========================================================================
   5STAR — landing
   El scroll conduce el video: la línea de tiempo de GSAP está medida en
   SEGUNDOS DE VIDEO, así que cada posición del timeline es literalmente el
   fotograma que se ve en pantalla.
   ========================================================================= */
(function () {
  'use strict';

  var doc = document.documentElement;
  var body = document.body;
  var params = new URLSearchParams(location.search);

  function q(sel, ctx) { return (ctx || document).querySelector(sel); }
  function qa(sel, ctx) { return Array.prototype.slice.call((ctx || document).querySelectorAll(sel)); }

  doc.classList.add('js');

  /* ---------------------------------------------------------------------
     1. Capacidades del dispositivo
     --------------------------------------------------------------------- */
  var mqReduce = window.matchMedia('(prefers-reduced-motion: reduce)');
  var REDUCED = params.get('motion') === 'off' ||
                (params.get('motion') !== 'on' && mqReduce.matches);

  var COARSE = window.matchMedia('(pointer: coarse)').matches;
  var HOVERS = window.matchMedia('(hover: hover) and (pointer: fine)').matches;
  var CORES = navigator.hardwareConcurrency || 8;
  var SAVE_DATA = !!(navigator.connection && navigator.connection.saveData);
  var TINY = Math.min(window.innerWidth, window.innerHeight) < 380;

  var hasGSAP = typeof window.gsap !== 'undefined' && typeof window.ScrollTrigger !== 'undefined';

  var LITE;
  if (params.get('lite') === '1') LITE = true;
  else if (params.get('lite') === '0') LITE = false;
  else LITE = REDUCED || SAVE_DATA || CORES <= 4 || (COARSE && TINY);

  /* ---------------------------------------------------------------------
     2. Ventanas de servicio, en SEGUNDOS DE VIDEO
     --------------------------------------------------------------------- */
  var VIDEO_DUR = 20;

  // Cadencia v4, aprobada por Juan Pedro: los cinco servicios entran en el
  // primer tercio (4-13 s) y el último tramo queda limpio para el final.
  //
  // Contrastada contra el video con ffprobe + signalstats a 8 fps
  // (YAVG/SATAVG) y con lectura de fotogramas. Beats reales del video:
  //   2.9  pico  una estrella llena el cuadro
  //   4.0  pico  la estrella con dos compañeras y estelas
  //   6.4  PICO  fogonazo blanco al cruzar (YAVG 105, el más alto del tramo)
  //   7.8  pico  la estrella y su compañera sobre el humo
  //   8.8  pico  la estrella más grande, centrada (meseta 8.5-9.1)
  //  13.0  TODAS LAS ESTRELLAS JUNTAS  -> arranca la unificación
  //  16.6  ESTALLIDO (YAVG 152, SATAVG 57: el pico absoluto del video)
  //  18.5  lockup limpio, 5 + estrella sobre negro
  //
  // El servicio 05 abre la unificación en 13.0 y sale en 13.8: de ahí en más
  // no compite nada con el estallido ni con el lockup (el rótulo de cierre
  // entra recién en 18.10). Nunca antes de las estrellas juntas.
  //
  // Dos correcciones finas sobre las ventanas de referencia:
  //   · 02 peak 6.00 -> 6.30. En 6.00 la luminancia está en un valle
  //     (YAVG 34); el fogonazo real es 6.38. El flare arranca en peak-0.28,
  //     así que a 6.30 el destello de la copy revienta junto con el del video.
  //   · 03 in 6.40 -> 6.90 (= out de 02) y peak 7.00 -> 7.60. Las .svc están
  //     absolutamente posicionadas una sobre otra: con in(03) < out(02) se
  //     veían dos servicios sólidos encimados. Ahora cada tarjeta entra justo
  //     cuando la anterior empieza a irse -> disolvencia, nunca pila. 7.60
  //     además cae sobre el pico real de ese tramo (7.75-7.88).
  var WINDOWS = [
    { in: 3.20,  peak: 4.00,  out: 5.00 },   // 01 · la estrella con sus dos compañeras
    { in: 5.20,  peak: 6.30,  out: 6.90 },   // 02 · fogonazo blanco al cruzar
    { in: 6.90,  peak: 7.60,  out: 8.20 },   // 03 · la estrella sobre el humo
    { in: 8.20,  peak: 9.00,  out: 9.80 },   // 04 · la estrella más grande, centrada
    { in: 12.20, peak: 13.00, out: 13.80 }   // 05 · UNIFICACIÓN -> estallido -> lockup
  ];

  /* =====================================================================
     MODO ESTÁTICO — sin GSAP, dispositivo lento o movimiento reducido
     ===================================================================== */
  function staticMode() {
    doc.classList.add('js-static');
    body.classList.remove('is-loading');

    var pre = q('#preloader');
    if (pre) pre.parentNode.removeChild(pre);

    var video = q('#reelVideo');
    if (video) video.parentNode.removeChild(video);

    var constel = q('.constel');
    if (constel) constel.classList.add('constel--stack');
    var targets = qa('.lite__item, .lite__end, .orb');

    if ('IntersectionObserver' in window) {
      var io = new IntersectionObserver(function (entries) {
        entries.forEach(function (e) {
          if (e.isIntersecting) {
            e.target.classList.add('is-in');
            io.unobserve(e.target);
          }
        });
      }, { rootMargin: '0px 0px -10% 0px', threshold: 0.12 });
      targets.forEach(function (el) { io.observe(el); });
    } else {
      targets.forEach(function (el) { el.classList.add('is-in'); });
    }

    // Barra de progreso sin GSAP
    var bar = q('#progressBar');
    if (bar) {
      var onScroll = function () {
        var max = document.documentElement.scrollHeight - window.innerHeight;
        bar.style.transform = 'scaleX(' + (max > 0 ? window.scrollY / max : 0) + ')';
      };
      window.addEventListener('scroll', onScroll, { passive: true });
      onScroll();
    }
    window.__fivestar = { mode: 'static', reduced: REDUCED, cores: CORES };
  }

  if (!hasGSAP || LITE) { staticMode(); return; }

  /* =====================================================================
     MODO COMPLETO
     ===================================================================== */
  doc.classList.add('js-reel', 'js-motion');

  gsap.registerPlugin(ScrollTrigger);
  var HAS_SPLIT = typeof window.SplitText !== 'undefined';
  var HAS_DRAW = typeof window.DrawSVGPlugin !== 'undefined';
  if (HAS_SPLIT) gsap.registerPlugin(SplitText);
  if (HAS_DRAW) gsap.registerPlugin(DrawSVGPlugin);

  ScrollTrigger.config({ ignoreMobileResize: true });
  gsap.defaults({ ease: 'power3.out' });

  /* ---------------------------------------------------------------------
     Lenis — smooth scroll sólo en punteros finos (en táctil, scroll nativo)
     --------------------------------------------------------------------- */
  var lenis = null;
  if (!COARSE && typeof window.Lenis !== 'undefined') {
    lenis = new Lenis({ lerp: 0.085, wheelMultiplier: 1, smoothWheel: true, syncTouch: false });
    lenis.on('scroll', ScrollTrigger.update);
    gsap.ticker.add(function (time) { lenis.raf(time * 1000); });
    gsap.ticker.lagSmoothing(0);

    qa('a[href^="#"]').forEach(function (a) {
      a.addEventListener('click', function (e) {
        var target = q(a.getAttribute('href'));
        if (!target) return;
        e.preventDefault();
        lenis.scrollTo(target, { offset: 0, duration: 1.2 });
      });
    });
  }

  /* ---------------------------------------------------------------------
     Helper: revelado tipográfico con máscara por caracter
     --------------------------------------------------------------------- */
  function splitReveal(target, vars) {
    var el = typeof target === 'string' ? q(target) : target;
    if (!el) return gsap.timeline();
    gsap.set(el, { autoAlpha: 1 });

    if (!HAS_SPLIT) {
      return gsap.from(el, Object.assign({ yPercent: 40, opacity: 0, duration: 0.9 }, vars || {}));
    }
    var split = SplitText.create(el, { type: 'chars,words', mask: 'chars', charsClass: 'ch', aria: 'auto' });
    return gsap.from(split.chars, Object.assign({
      yPercent: 118,
      skewY: 7,
      duration: 0.95,
      ease: 'power4.out',
      stagger: { each: 0.032, from: 'start' }
    }, vars || {}));
  }

  function fadeIn(target, vars) {
    return gsap.fromTo(target,
      { autoAlpha: 0, y: 18 },
      Object.assign({ autoAlpha: 1, y: 0, duration: 0.8 }, vars || {}));
  }

  /* ---------------------------------------------------------------------
     GRANO DE PELÍCULA (una sola textura, animada por CSS · sólo escritorio)
     --------------------------------------------------------------------- */
  function buildGrain() {
    if (COARSE || REDUCED || window.innerWidth < 1024) return;
    var size = 200;   // se muestra escalado por CSS -> textura fina, no manchas
    var c = document.createElement('canvas');
    c.width = c.height = size;
    var ctx = c.getContext('2d');
    if (!ctx) return;
    var img = ctx.createImageData(size, size);
    var d = img.data;
    for (var i = 0; i < d.length; i += 4) {
      var v = (Math.random() * 255) | 0;
      d[i] = d[i + 1] = d[i + 2] = v;
      d[i + 3] = 255;
    }
    ctx.putImageData(img, 0, 0);
    doc.style.setProperty('--grain-src', 'url(' + c.toDataURL('image/png') + ')');
    doc.classList.add('has-grain');
  }

  /* ---------------------------------------------------------------------
     ESTALLIDO DE TIZA — el número revienta en polvo de marcador.
     Canvas 2D liviano, sin librerías: se dibuja encima de todo, vive lo que
     dura el estallido y se destruye solo liberando ticker y nodo.
     --------------------------------------------------------------------- */
  function chalkBurst(originEl, count, life) {
    if (REDUCED) return;

    var canvas = document.createElement('canvas');
    var ctx = canvas.getContext && canvas.getContext('2d');
    if (!ctx) return;                       // sin contexto 2D no hay estallido y nada rompe

    var W = window.innerWidth, H = window.innerHeight;
    if (!(W > 0 && H > 0)) return;          // un canvas de 0px tira errores al dibujar

    var dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.round(W * dpr);
    canvas.height = Math.round(H * dpr);
    // Por encima del preloader (z-index 100): el polvo tiene que verse
    // mientras la cortina negra todavía está puesta.
    canvas.style.cssText = 'position:fixed;inset:0;width:100%;height:100%;z-index:101;pointer-events:none';
    canvas.setAttribute('aria-hidden', 'true');
    ctx.scale(dpr, dpr);

    // El polvo sale del centro del propio número
    var ox = W / 2, oy = H / 2;
    if (originEl) {
      var r = originEl.getBoundingClientRect();
      if (r.width || r.height) { ox = r.left + r.width / 2; oy = r.top + r.height / 2; }
    }

    var N = count || 200;
    var LIFE = life || 1.5;
    var parts = new Array(N);
    for (var i = 0; i < N; i++) {
      var a = Math.random() * Math.PI * 2;
      var sp = 60 + Math.pow(Math.random(), 0.55) * 520;    // px/s
      parts[i] = {
        x: ox + (Math.random() - 0.5) * 10,
        y: oy + (Math.random() - 0.5) * 10,
        vx: Math.cos(a) * sp,
        vy: Math.sin(a) * sp * 0.82,
        r: 0.7 + Math.random() * 2.4,
        life: LIFE * (0.45 + Math.random() * 0.55),
        age: 0,
        bone: Math.random() < 0.62                          // hueso mayoría, bordó el resto
      };
    }

    document.body.appendChild(canvas);

    var dead = false;
    function destroy() {
      if (dead) return;
      dead = true;
      gsap.ticker.remove(frame);
      if (canvas.parentNode) canvas.parentNode.removeChild(canvas);
      ctx = null; parts = null;
    }

    function frame(time, deltaTime) {
      if (dead) return;
      var dt = Math.min((deltaTime || 16) / 1000, 0.05);
      ctx.clearRect(0, 0, W, H);
      ctx.globalCompositeOperation = 'lighter';

      var alive = 0;
      for (var j = 0; j < N; j++) {
        var p = parts[j];
        p.age += dt;
        if (p.age >= p.life) continue;
        alive++;
        p.vx *= 0.955;                        // la tiza frena en el aire
        p.vy = p.vy * 0.955 + 220 * dt;       // y termina cayendo
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        var k = 1 - p.age / p.life;
        ctx.globalAlpha = k * k * 0.9;
        ctx.fillStyle = p.bone ? '#F2EFE9' : '#910005';
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r * (0.4 + k * 0.6), 0, 6.283185);
        ctx.fill();
      }
      if (!alive) destroy();
    }

    gsap.ticker.add(frame);
    gsap.delayedCall(LIFE + 0.6, destroy);   // red de seguridad: el canvas no sobrevive
  }

  /* =====================================================================
     A. PRELOADER — cinco trazos, cinco cuentas, una estrella
     ===================================================================== */
  function playIntro() {
    var pre = q('#preloader');
    var count = q('#plCount');
    var legs = qa('.pl-leg');

    if (!pre) { heroIn(); return; }

    if (!HAS_DRAW) {
      gsap.set(legs, { opacity: 0 });
    } else {
      gsap.set(legs, { drawSVG: '0% 0%' });
    }

    var tl = gsap.timeline({
      onComplete: function () {
        body.classList.remove('is-loading');
        if (pre.parentNode) pre.parentNode.removeChild(pre);
        ScrollTrigger.refresh();
      }
    });

    legs.forEach(function (leg, i) {
      var at = 0.14 + i * 0.18;
      tl.set(count, { textContent: String(5 - i) }, at);
      if (HAS_DRAW) tl.to(leg, { drawSVG: '0% 100%', duration: 0.22, ease: 'power2.out' }, at);
      else tl.to(leg, { opacity: 1, duration: 0.22 }, at);
    });

    // Al llegar a 1 el número se desdobla ~100 ms (doble exposición: el mismo
    // glifo corrido y en bordó encima del original) y revienta en polvo.
    var ghost = q('#plGhost');
    var G = 0.90;
    if (ghost && count) {
      tl.set(ghost, { textContent: '1' }, G)
        .set(ghost, { opacity: 1, x: 5, y: -3, scaleX: 1.06 }, G)
        .set(count, { x: -4 }, G)
        .set(ghost, { opacity: 1, x: -6, y: 2, scaleX: 0.94 }, G + 0.05)
        .set(count, { x: 3 }, G + 0.05)
        .set(ghost, { opacity: 0, x: 0, y: 0, scaleX: 1 }, G + 0.10)
        .set(count, { x: 0 }, G + 0.10);
    }

    tl.add(function () { chalkBurst(count, 200, 1.5); }, G + 0.12)
      .to('.preloader__count', { opacity: 0, scale: 1.5, duration: 0.18, ease: 'power2.out' }, G + 0.12)
      .to('.preloader__flare', { opacity: 1, scale: 1.6, duration: 0.32, ease: 'power2.out' }, 1.06)
      .to('.preloader__star', { scale: 1.18, duration: 0.42, ease: 'power2.out' }, 1.06)
      .to('.preloader__flare', { opacity: 0, duration: 0.5, ease: 'power2.in' }, 1.34)
      .to('.preloader__label', { opacity: 0, duration: 0.3 }, 1.06)
      .to(pre, { clipPath: 'inset(0% 0% 100% 0%)', duration: 0.75, ease: 'power4.inOut' }, 1.28)
      .add(heroIn(), 1.46);

    return tl;
  }

  /* =====================================================================
     B. HERO — "5STAR" en máscara + la estrella (elemento aparte) cayendo
     ===================================================================== */
  function heroIn() {
    var tl = gsap.timeline();
    tl.add(fadeIn('.hero__meta', { duration: 0.7 }), 0)
      .add(splitReveal('.hero__word', { duration: 1.05, stagger: { each: 0.055, from: 'start' } }), 0.08)
      .from('.hero__star', { scale: 0, rotate: -170, opacity: 0, duration: 0.95, ease: 'back.out(2.2)' }, 0.42)
      .add(fadeIn('.hero__sub', { duration: 0.8 }), 0.6)
      .add(fadeIn('.hero__cue', { duration: 0.7 }), 0.8)
      .from('.cue__line', { scaleX: 0, duration: 0.8, ease: 'power3.out' }, 0.86)
      .add(function () {
        gsap.fromTo('.cue__line',
          { scaleX: 0.32 },
          { scaleX: 1, duration: 1.35, repeat: -1, yoyo: true, ease: 'sine.inOut' });
      });
    heroFill();
    return tl;
  }

  // El 5STAR arranca hueco —sólo el contorno de marcador— y los primeros
  // 110 px de scroll lo repasan letra por letra, como si alguien lo pintara
  // de izquierda a derecha. El contorno vira de hueso a bordó mientras se
  // llena, así que el trazo sigue leyéndose sobre la letra ya rellena.
  function heroFill() {
    var word = q('.hero__word');
    if (!word) return;

    // splitReveal marca los caracteres con .ch; si SplitText no cargó,
    // rellenamos la palabra entera de una.
    var chars = qa('.ch', word);
    var targets = chars.length ? chars : [word];

    var RANGE = { trigger: '.hero', start: 'top top', end: '+=110', scrub: 0.4 };

    gsap.fromTo(targets,
      { color: 'rgba(242,239,233,0)' },
      {
        color: 'rgba(242,239,233,1)',
        ease: 'none',
        stagger: { each: 0.1, from: 'start' },
        scrollTrigger: RANGE
      });

    // -webkit-text-stroke-color no es una propiedad que GSAP sepa
    // interpolar como color, así que la escribimos a mano desde un proxy.
    var edge = { p: 0 };
    gsap.to(edge, {
      p: 1, ease: 'none',
      scrollTrigger: RANGE,
      onUpdate: function () {
        word.style.webkitTextStrokeColor =
          gsap.utils.interpolate('#F2EFE9', '#910005', edge.p);
      }
    });
  }

  // El hero no se desvanece: atraviesa la cámara y deja pasar al video.
  function heroHandoff() {
    // El bloque se queda atrás del scroll (yPercent positivo = se arrastra
    // hacia abajo mientras la página sube) antes de atravesar la cámara.
    gsap.to('.hero__inner', {
      scale: 1.3, yPercent: 12, filter: 'blur(16px)', opacity: 0, ease: 'none',
      scrollTrigger: { trigger: '.hero', start: 'top top', end: 'bottom top', scrub: 0.55 }
    });

    // Parallax: cada línea se arrastra a su propio ritmo, así el hero tiene
    // profundidad en vez de moverse como una calcomanía.
    gsap.to('.hero__meta', {
      yPercent: 90, ease: 'none',
      scrollTrigger: { trigger: '.hero', start: 'top top', end: 'bottom top', scrub: 0.7 }
    });
    gsap.to('.hero__sub', {
      yPercent: -55, ease: 'none',
      scrollTrigger: { trigger: '.hero', start: 'top top', end: 'bottom top', scrub: 0.7 }
    });
    gsap.to('.hero__cue', {
      opacity: 0, y: 40, ease: 'none',
      scrollTrigger: { trigger: '.hero', start: 'top top', end: '45% top', scrub: 0.35 }
    });
  }

  /* =====================================================================
     C. EL REEL — el scroll ES el video
     ===================================================================== */
  function buildReel() {
    var video = q('#reelVideo');
    var media = q('#reelMedia');
    var flare = q('#reelFlare');
    var intro = q('#reelIntro');
    var end = q('#reelEnd');
    var hudStars = qa('.hud__star');
    var cards = qa('.svc');

    if (!video || !cards.length) return;

    // Cargamos el video sólo en modo completo
    if (!video.src) {
      var useLight = COARSE || SAVE_DATA || window.innerWidth < 900;
      var picked = (useLight && video.dataset.srcLight) ? video.dataset.srcLight : video.dataset.src;
      if (picked) video.src = picked;
    }
    video.muted = true;

    var state = { t: 0 };

    // Tolerancia de sincronía: a 24 fps un fotograma dura 0.0417 s, así que
    // 0.05 es "estamos en el frame correcto". Por debajo de eso no pedimos
    // nada y le ahorramos el trabajo al decodificador.
    var SEEK_EPS = 0.05;
    var pendingSeek = null;

    function clampT(t) {
      if (!(t > 0)) return 0;                       // cubre NaN y negativos
      return t > VIDEO_DUR ? VIDEO_DUR : t;
    }

    // Único camino para mover el video, compartido por el scrub y por el
    // reconciliador. Consultamos readyState en cada seek en vez de fiarnos de
    // un evento único: si el video todavía se estaba descargando, igual
    // arranca solo al estar listo.
    function applySeek(t) {
      if (video.readyState < 1) return;             // HAVE_METADATA
      t = clampT(t);
      if (Math.abs(video.currentTime - t) <= SEEK_EPS) return;

      // Pedir un seek nuevo mientras hay otro en curso cancela el anterior y
      // deja el video donde estaba: guardamos el destino y lo reemitimos
      // cuando el navegador avisa que terminó.
      if (video.seeking) { pendingSeek = t; return; }
      pendingSeek = null;

      try {
        // El video es all-intra: todo fotograma es keyframe, así que fastSeek
        // cae exactamente en el frame pedido y cuesta bastante menos que
        // currentTime (Safari y Firefox). En Chrome no existe todavía.
        if (typeof video.fastSeek === 'function') video.fastSeek(t);
        else video.currentTime = t;
      } catch (err) { /* el navegador aún no puede buscar */ }
    }

    video.addEventListener('seeked', function () {
      if (pendingSeek === null) return;
      var t = pendingSeek;
      pendingSeek = null;
      applySeek(t);
    });

    function seek() { applySeek(state.t); }

    function onMeta() {
      if (video.duration && isFinite(video.duration)) VIDEO_DUR = video.duration;
      seek();
      ScrollTrigger.refresh();
    }
    video.addEventListener('loadedmetadata', onMeta, { once: true });
    video.addEventListener('loadeddata', seek, { once: true });
    video.addEventListener('canplay', seek, { once: true });
    if (video.readyState >= 1) onMeta();

    // iOS: un play/pause silencioso habilita el seek en el primer gesto
    var unlocked = false;
    function unlock() {
      if (unlocked) return;
      unlocked = true;
      var p = video.play();
      if (p && p.then) p.then(function () { video.pause(); seek(); }).catch(function () {});
      else { try { video.pause(); } catch (e) {} }
    }
    window.addEventListener('touchstart', unlock, { once: true, passive: true });
    window.addEventListener('pointerdown', unlock, { once: true, passive: true });

    gsap.set(media, { '--vb': 1 });
    gsap.set(flare, { opacity: 0, scale: 0.75 });

    var tl = gsap.timeline({
      defaults: { ease: 'none' },
      scrollTrigger: {
        id: 'reel',
        trigger: '.reel',
        start: 'top top',
        end: 'bottom bottom',
        pin: '#reelPin',
        pinSpacing: false,
        scrub: COARSE ? 0.4 : 0.85,
        anticipatePin: 1,
        invalidateOnRefresh: true
      }
    });

    // El motor: 0 → 20 s de video, un segundo de timeline = un segundo de video
    tl.to(state, { t: VIDEO_DUR, duration: VIDEO_DUR, onUpdate: seek }, 0);

    // Rótulo de apertura
    tl.fromTo(intro, { autoAlpha: 0, yPercent: 45 },
      { autoAlpha: 1, yPercent: 0, duration: 0.75, ease: 'power3.out' }, 0.18)
      .to(intro, { autoAlpha: 0, yPercent: -28, filter: 'blur(10px)', duration: 0.55, ease: 'power2.in' }, 1.20);

    // Un bloque por estrella
    WINDOWS.forEach(function (w, i) {
      var card = cards[i];
      if (!card) return;
      var num = q('.svc__num i', card);
      var title = q('.svc__title', card);
      var rule = q('.svc__rule', card);
      var desc = q('.svc__desc', card);

      // Las ventanas v4 son más cortas que las de v3 (la 03 dura 1.3 s contra
      // los 2.35 s de antes): escalamos la entrada para que el título termine
      // de formarse dentro de su propia ventana y no justo al salir.
      var k = gsap.utils.clamp(0.62, 1, (w.out - w.in) / 1.8);

      tl.set(card, { autoAlpha: 1 }, w.in)
        .fromTo(num, { yPercent: 118, skewY: 8 },
          { yPercent: 0, skewY: 0, duration: 0.75 * k, ease: 'power4.out' }, w.in)
        .fromTo(title, { yPercent: 16, opacity: 0, filter: 'blur(18px)', skewY: 5 },
          { yPercent: 0, opacity: 1, filter: 'blur(0px)', skewY: 0, duration: 1.0 * k, ease: 'power3.out' }, w.in + 0.10 * k)
        .fromTo(rule, { scaleX: 0 }, { scaleX: 1, duration: 0.7 * k, ease: 'power2.out' }, w.in + 0.30 * k)
        .fromTo(desc, { y: 24, opacity: 0 }, { y: 0, opacity: 1, duration: 0.7 * k, ease: 'power2.out' }, w.in + 0.42 * k);

      // La estrella ilumina la copy: fogonazo + subida de brillo del video
      tl.to(flare, { opacity: 0.9, scale: 1.25, duration: 0.30, ease: 'power2.out' }, w.peak - 0.28)
        .to(flare, { opacity: 0, scale: 0.75, duration: 0.85, ease: 'power2.in' }, w.peak + 0.04)
        .to(media, { '--vb': 1.6, duration: 0.28, ease: 'power2.out' }, w.peak - 0.26)
        .to(media, { '--vb': 1, duration: 0.85, ease: 'power2.in' }, w.peak + 0.04);

      // HUD: la estrella nº i se enciende (y se apaga al subir)
      if (hudStars[i]) {
        tl.to(hudStars[i], {
          fill: 'rgba(145,0,5,1)', stroke: '#910005', scale: 1.35,
          duration: 0.35, ease: 'power2.out'
        }, w.in)
          .to(hudStars[i], { scale: 1, duration: 0.45, ease: 'power2.out' }, w.in + 0.35);
      }

      // Salida
      tl.to([num, title, rule, desc], {
        opacity: 0, y: -30, filter: 'blur(9px)',
        duration: 0.55, ease: 'power2.in', stagger: 0.035
      }, w.out)
        .set(card, { autoAlpha: 0 }, w.out + 0.75);
    });

    // Cierre: el lockup del video (5 + estrella) queda solo en pantalla
    tl.fromTo(end, { autoAlpha: 0, yPercent: 45 },
      { autoAlpha: 1, yPercent: 0, duration: 0.9, ease: 'power3.out' }, 18.10);

    // El indicador de progreso sólo existe mientras dura el reel
    var hud = q('#hud');
    var reelLive = false;
    function syncReel(self) {
      reelLive = self.isActive;
      if (hud) hud.classList.toggle('is-live', self.isActive);
    }
    ScrollTrigger.create({
      trigger: '.reel', start: 'top 80%', end: 'bottom 20%',
      onToggle: syncReel, onRefresh: syncReel
    });

    // Reconciliador: con la caché fría, Chrome descarta el primer seek en
    // silencio y no vuelve a intentarlo. Mientras el reel está en pantalla
    // comparamos posición real contra objetivo y reemitimos si se desfasaron.
    gsap.ticker.add(function () {
      if (!reelLive || video.readyState < 1) return;
      applySeek(state.t);
    });

    // Sonda de verificación
    window.__fivestar = {
      mode: 'full',
      reduced: REDUCED, cores: CORES, lenis: !!lenis,
      windows: WINDOWS,
      get progress() { var st = ScrollTrigger.getById('reel'); return st ? st.progress : 0; },
      get videoTime() { return video.currentTime; },
      get videoDuration() { return VIDEO_DUR; },
      get scrubTarget() { return state.t; }
    };
  }

  /* =====================================================================
     D. MARQUEE — la velocidad del scroll inclina y acelera el texto
     ===================================================================== */
  function buildMarquee() {
    var rows = qa('.marquee__row');
    if (!rows.length) return;
    var loops = [];

    rows.forEach(function (row) {
      var dir = parseFloat(row.dataset.dir) || 1;
      var track = q('.marquee__track', row);
      var dur = dir > 0 ? 26 : 36;
      var loop = dir > 0
        ? gsap.fromTo(track, { xPercent: 0 }, { xPercent: -50, duration: dur, ease: 'none', repeat: -1 })
        : gsap.fromTo(track, { xPercent: -50 }, { xPercent: 0, duration: dur, ease: 'none', repeat: -1 });
      loops.push(loop);
    });

    var tracks = qa('.marquee__track');
    var skewTo = gsap.quickTo(tracks, 'skewX', { duration: 0.55, ease: 'power3' });

    // A alta velocidad el texto se arrastra: hasta 1px de desenfoque, con la
    // misma inercia que el skew. filter no es numérico, así que interpolamos
    // un proxy y escribimos el string; por debajo de 0.02px volvemos a
    // 'none' para no dejar una capa compuesta viva de gusto.
    var blurState = { b: 0 };
    var blurTo = gsap.quickTo(blurState, 'b', {
      duration: 0.5, ease: 'power3',
      onUpdate: function () {
        var f = blurState.b > 0.02 ? 'blur(' + blurState.b.toFixed(2) + 'px)' : 'none';
        for (var i = 0; i < tracks.length; i++) tracks[i].style.filter = f;
      }
    });

    var speed = { s: 1 };
    var speedTo = gsap.quickTo(speed, 's', {
      duration: 0.7, ease: 'power2',
      onUpdate: function () { loops.forEach(function (l) { l.timeScale(speed.s); }); }
    });

    ScrollTrigger.create({
      trigger: '.marquee',
      start: 'top bottom',
      end: 'bottom top',
      onUpdate: function (self) {
        var v = self.getVelocity();
        skewTo(gsap.utils.clamp(-10, 10, v / -190));
        speedTo(gsap.utils.clamp(1, 4.5, 1 + Math.abs(v) / 1600));
        blurTo(gsap.utils.clamp(0, 1, Math.abs(v) / 2600));
      },
      onLeave: function () { skewTo(0); speedTo(1); blurTo(0); },
      onLeaveBack: function () { skewTo(0); speedTo(1); blurTo(0); }
    });

    gsap.from('.marquee', {
      clipPath: 'inset(0% 0% 100% 0%)', duration: 1, ease: 'power3.out',
      scrollTrigger: { trigger: '.marquee', start: 'top 92%', once: true }
    });
  }

  /* =====================================================================
     E. CONSTELACIÓN — cinco disciplinas orbitando la estrella.
        La palabra que pasa por el frente se enciende; el resto se hunde
        en el fondo, chica y desenfocada. Es el propio movimiento el que
        jerarquiza: no hay lista que dictar.
     ===================================================================== */
  var GLYPHS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789·';

  function scramble(el) {
    if (REDUCED || !el) return;
    var finalText = el.dataset.text || el.textContent;
    el.dataset.text = finalText;
    if (el._scr) el._scr.kill();
    var st = { p: 0 };
    el._scr = gsap.to(st, {
      p: 1, duration: 0.5, ease: 'power2.out',
      onUpdate: function () {
        var n = finalText.length, shown = Math.floor(st.p * n), out = '', i, c;
        for (i = 0; i < n; i++) {
          c = finalText.charAt(i);
          out += (i < shown || c === ' ') ? c : GLYPHS.charAt((Math.random() * GLYPHS.length) | 0);
        }
        el.textContent = out;
      },
      onComplete: function () { el.textContent = finalText; }
    });
  }

  function buildConstel() {
    var sec = q('.constel');
    var pin = q('.constel__pin');
    var orbs = qa('.orb');
    var core = q('.constel__core');
    var five = q('.core__five');
    var star = q('.core__star');
    if (!sec || !pin || !orbs.length) return;

    fadeIn('.constel .eyebrow', {
      duration: 0.7,
      scrollTrigger: { trigger: sec, start: 'top 80%', once: true }
    });
    splitReveal('.constel__title', {
      scrollTrigger: { trigger: '.constel__title', start: 'top 92%', once: true }
    });

    var mm = gsap.matchMedia();

    mm.add({
      orbit: '(hover: hover) and (pointer: fine) and (min-width: 901px)',
      stack: '(hover: none), (pointer: coarse), (max-width: 900px)'
    }, function (ctx) {

      /* ---------- apilado: sin órbita, revelado escalonado ---------- */
      if (ctx.conditions.stack) {
        sec.classList.add('constel--stack');
        orbs.forEach(function (el, i) {
          gsap.from(el, {
            y: 34, opacity: 0, duration: 0.75, ease: 'power3.out',
            scrollTrigger: { trigger: el, start: 'top 92%', once: true }
          });
        });
        return function () { sec.classList.remove('constel--stack'); };
      }

      /* ---------- órbita ---------- */
      sec.classList.remove('constel--stack');
      doc.classList.add('js-constel');

      var TURN = 6.98;                                  // ~1,11 vueltas en toda la sección
      var AT = [0.10, 0.28, 0.46, 0.64, 0.82];          // cuándo pasa cada palabra por el frente
      var a0 = AT.map(function (p) { return -p * TURN; });

      var RX = 0, RY = 0;
      function measure() {
        RX = Math.min(pin.offsetWidth * 0.22, 300);
        RY = Math.min(pin.offsetHeight * 0.20, 165);
      }
      measure();

      gsap.set(orbs, { xPercent: -50, yPercent: -50 });
      gsap.set(core, { xPercent: -50, yPercent: -50 });

      var sx = orbs.map(function (el) { return gsap.quickSetter(el, 'x', 'px'); });
      var sy = orbs.map(function (el) { return gsap.quickSetter(el, 'y', 'px'); });
      var ss = orbs.map(function (el) { return gsap.quickSetter(el, 'scale'); });
      var so = orbs.map(function (el) { return gsap.quickSetter(el, 'opacity'); });
      var sf = orbs.map(function (el) { return gsap.quickSetter(el, 'filter'); });
      var flare = orbs.map(function (el) { return gsap.quickSetter(q('.orb__flare', el), 'opacity'); });
      var rule = orbs.map(function (el) { return gsap.quickSetter(q('.orb__rule', el), 'scaleX'); });
      var note = orbs.map(function (el) { return gsap.quickSetter(q('.orb__note', el), 'opacity'); });
      var words = orbs.map(function (el) { return q('.orb__word', el); });
      var wasLit = orbs.map(function () { return false; });

      /* ---------- pentagrama: se traza con el scroll ---------- */
      // stroke-dashoffset a mano en vez de drawSVG por frame: es un solo
      // número, lo escribe un quickSetter y no recalcula el path.
      var penta = q('#constelPenta path');
      var pentaLen = 0, setDash = null, setPentaO = null;
      var pentaBase = 0;
      var blink = { v: 1 };
      var blinked = false;

      if (penta && penta.getTotalLength) {
        pentaLen = penta.getTotalLength();
        penta.style.strokeDasharray = pentaLen;
        penta.style.strokeDashoffset = pentaLen;
        setDash = gsap.quickSetter(penta, 'strokeDashoffset');
        setPentaO = gsap.quickSetter(q('#constelPenta'), 'opacity');
      }

      function paintPenta() {
        if (setPentaO) setPentaO(pentaBase * blink.v);
      }

      /* ---------- campo de estrellitas ---------- */
      var field = null;
      var twinkles = [];

      function buildField() {
        if (REDUCED) return;                       // (en lite nunca se llega hasta acá)
        field = document.createElement('div');
        field.className = 'constel__field';
        field.setAttribute('aria-hidden', 'true');

        var frag = document.createDocumentFragment();
        for (var i = 0; i < 40; i++) {
          // Dejamos libre la banda central: ahí viven las palabras y el lockup.
          var x, y, tries = 0;
          do {
            x = Math.random() * 100;
            y = Math.random() * 100;
            tries++;
          } while (tries < 12 && Math.abs(x - 50) < 34 && Math.abs(y - 50) < 22);

          var s = document.createElement('i');
          var size = 2 + Math.random() * 4;
          s.style.left = x.toFixed(2) + '%';
          s.style.top = y.toFixed(2) + '%';
          s.style.width = size.toFixed(1) + 'px';
          s.style.height = size.toFixed(1) + 'px';
          frag.appendChild(s);
        }
        field.appendChild(frag);
        pin.insertBefore(field, pin.firstChild);

        qa('i', field).forEach(function (s) {
          var top = 0.12 + Math.random() * 0.40;
          twinkles.push(gsap.fromTo(s,
            { opacity: top * 0.12 },
            {
              opacity: top,
              duration: 1.1 + Math.random() * 2.4,
              delay: Math.random() * 2.5,
              repeat: -1, yoyo: true, ease: 'sine.inOut'
            }));
        });
      }
      buildField();

      function render(p) {
        // Sobre el final la órbita se apaga: el lockup 5 + estrella se queda solo.
        var clear = 1 - gsap.utils.clamp(0, 1, (p - 0.82) / 0.14);

        // El pentagrama se termina de trazar antes de que la órbita se apague
        // y se desvanece con ella, así el lockup queda solo en cuadro.
        if (setDash) {
          var draw = gsap.utils.clamp(0, 1, (p - 0.06) / 0.70);
          setDash(pentaLen * (1 - draw));
          pentaBase = 0.5 * draw * clear;
          paintPenta();

          // Un solo parpadeo, justo cuando la órbita empieza a apagarse.
          if (!blinked && p > 0.82) {
            blinked = true;
            gsap.timeline({ onUpdate: paintPenta })
              .to(blink, { v: 0.06, duration: 0.07, ease: 'none' })
              .to(blink, { v: 1, duration: 0.10, ease: 'none' })
              .to(blink, { v: 0.18, duration: 0.06, ease: 'none' })
              .to(blink, { v: 1, duration: 0.14, ease: 'none' });
          } else if (blinked && p < 0.78) {
            blinked = false;                 // se rearma si vuelve a subir
          }
        }

        for (var i = 0; i < orbs.length; i++) {
          var th = a0[i] + p * TURN;
          var z = Math.cos(th);            //  1 = frente, -1 = fondo
          var d = (z + 1) / 2;             //  0..1 profundidad

          sx[i](RX * Math.sin(th));
          sy[i](RY * z);
          ss[i](0.46 + 0.54 * d);
          so[i]((0.10 + 0.90 * Math.pow(d, 2.1)) * clear);
          sf[i]('blur(' + ((1 - d) * 7).toFixed(2) + 'px)');
          orbs[i].style.zIndex = String(Math.round(50 + z * 40));

          var lit = gsap.utils.clamp(0, 1, (z - 0.55) / 0.42) * clear;
          flare[i](lit * 0.72);
          rule[i](lit);
          note[i](lit);

          var isLit = lit > 0.62;
          if (isLit !== wasLit[i]) {
            wasLit[i] = isLit;
            orbs[i].classList.toggle('is-lit', isLit);
            if (isLit) scramble(words[i]);           // se enciende decodificándose
          }
        }
      }

      var stOrbit = ScrollTrigger.create({
        id: 'constel',
        trigger: sec,
        start: 'top top',
        end: 'bottom bottom',
        pin: pin,
        pinSpacing: false,
        scrub: 0.7,
        invalidateOnRefresh: true,
        onRefresh: function (self) { measure(); render(self.progress); },
        onUpdate: function (self) { render(self.progress); }
      });

      // El núcleo late y gira. El 5 llega sobre el final SIEMPRE como elemento
      // aparte de la estrella: nunca se funden en un solo glifo.
      // Un único timeline sobre el rango del pin -> las posiciones son
      // fracciones del scroll fijado (con pinSpacing:false, '76% top' caería
      // fuera del rango y el tween no llegaría a correr).
      var tlCore = gsap.timeline({
        defaults: { ease: 'none' },
        scrollTrigger: {
          trigger: sec, start: 'top top', end: 'bottom bottom',
          scrub: 0.8, invalidateOnRefresh: true
        }
      });
      tlCore.to(star, { rotation: 216, duration: 1 }, 0)
        .fromTo(five,
          { opacity: 0, x: -60, filter: 'blur(12px)' },
          { opacity: 1, x: 0, filter: 'blur(0px)', duration: 0.22, ease: 'power2.out' }, 0.74)
        .fromTo(core,
          { x: 0 },
          { x: function () { return five.offsetWidth * 0.5; }, duration: 0.22 }, 0.74);

      gsap.to(star, {
        scale: 1.12, duration: 1.9, repeat: -1, yoyo: true, ease: 'sine.inOut',
        transformOrigin: '50% 50%'
      });

      // hover: decodificación manual (sin plugin de pago)
      var onEnter = orbs.map(function (el, i) {
        var fn = function () { if (orbs[i].classList.contains('is-lit')) scramble(words[i]); };
        el.addEventListener('mouseenter', fn);
        return fn;
      });

      render(stOrbit.progress);

      return function () {
        doc.classList.remove('js-constel');

        twinkles.forEach(function (t) { t.kill(); });
        twinkles.length = 0;
        if (field && field.parentNode) field.parentNode.removeChild(field);
        field = null;

        if (penta) {
          gsap.killTweensOf(blink);
          penta.style.strokeDasharray = '';
          penta.style.strokeDashoffset = '';
          gsap.set('#constelPenta', { clearProps: 'all' });
        }

        orbs.forEach(function (el, i) {
          el.removeEventListener('mouseenter', onEnter[i]);
          if (words[i] && words[i].dataset.text) words[i].textContent = words[i].dataset.text;
          el.style.zIndex = '';
          gsap.set(el, { clearProps: 'all' });
          gsap.set(q('.orb__flare', el), { clearProps: 'all' });
          gsap.set(q('.orb__rule', el), { clearProps: 'all' });
          gsap.set(q('.orb__note', el), { clearProps: 'all' });
        });
        gsap.set([core, five, star], { clearProps: 'all' });
      };
    });
  }

  /* =====================================================================
     F. CONTACTO — fondo limpio: sólo el cierre y el mail
     ===================================================================== */
  function buildContact() {
    fadeIn('.contact .eyebrow', {
      duration: 0.7,
      scrollTrigger: { trigger: '.contact', start: 'top 72%', once: true }
    });

    splitReveal('.contact__title', {
      duration: 1.05, stagger: { each: 0.026, from: 'start' },
      scrollTrigger: { trigger: '.contact__title', start: 'top 85%', once: true }
    });

    gsap.from('.mail', {
      y: 34, opacity: 0, duration: 0.8,
      scrollTrigger: { trigger: '.mail', start: 'top 92%', once: true }
    });

    // La estrella gigante del fondo se traza al entrar la sección, detrás
    // del copy y siempre por debajo del bordó pleno para no competir.
    var star = q('#contactStar');
    var starPath = q('#contactStar path');
    if (star && starPath) {
      var enter = { trigger: '.contact', start: 'top 78%', once: true };
      gsap.to(star, { opacity: 0.5, duration: 1.2, scrollTrigger: enter });
      if (HAS_DRAW) {
        gsap.fromTo(starPath,
          { drawSVG: '0% 0%' },
          { drawSVG: '0% 100%', duration: 2.4, ease: 'power2.inOut', scrollTrigger: enter });
      }
    }
    gsap.from('.contact__alt', {
      y: 22, opacity: 0, duration: 0.7,
      scrollTrigger: { trigger: '.contact__alt', start: 'top 95%', once: true }
    });
  }

  /* =====================================================================
     G. CURSOR DE MARCADOR — una estrella de cinco puntas y su estela
     ===================================================================== */
  var STAR_PATH = 'M50 3 L60.87 35.03 L94.7 35.48 L67.59 55.72 L77.62 88.02 ' +
                  'L50 68.5 L22.38 88.02 L32.41 55.72 L5.3 35.48 L39.13 35.03 Z';

  function starMarkup() {
    return '<svg viewBox="0 0 100 100" aria-hidden="true" focusable="false">' +
           '<path d="' + STAR_PATH + '"/></svg>';
  }

  function buildCursor() {
    if (!HOVERS || COARSE || REDUCED) return;

    var wrap = document.createElement('div');
    wrap.className = 'cursor';
    wrap.setAttribute('aria-hidden', 'true');

    // La estela va primero en el DOM para quedar por detrás de la punta.
    var TRAIL = 5;
    var dots = [];
    for (var i = 0; i < TRAIL; i++) {
      var d = document.createElement('span');
      d.className = 'cursor__dot';
      d.innerHTML = starMarkup();
      wrap.appendChild(d);
      dots.push(d);
    }
    var tip = document.createElement('span');
    tip.className = 'cursor__tip';
    tip.innerHTML = starMarkup();
    wrap.appendChild(tip);

    document.body.appendChild(wrap);
    doc.classList.add('has-cursor');          // recién ahora escondemos el puntero

    gsap.set([tip].concat(dots), { xPercent: -50, yPercent: -50 });
    dots.forEach(function (d, i) {
      gsap.set(d, { opacity: 0.5 - i * 0.07, scale: 1 - i * 0.1 });
    });

    var tipX = gsap.quickTo(tip, 'x', { duration: 0.25, ease: 'power3' });
    var tipY = gsap.quickTo(tip, 'y', { duration: 0.25, ease: 'power3' });
    var rotTo = gsap.quickTo(tip, 'rotation', { duration: 0.4, ease: 'power2' });
    var scaleTo = gsap.quickTo(tip, 'scale', { duration: 0.35, ease: 'power3' });

    // Cada mini-estrella llega más tarde que la anterior: la estela se abre
    // sola cuando el mouse acelera y se cierra cuando frena.
    var dotX = dots.map(function (d, i) {
      return gsap.quickTo(d, 'x', { duration: 0.32 + i * 0.09, ease: 'power3' });
    });
    var dotY = dots.map(function (d, i) {
      return gsap.quickTo(d, 'y', { duration: 0.32 + i * 0.09, ease: 'power3' });
    });

    var HOT = 'a,.orb,button,[role="button"]';
    var wasHot = false;
    var shown = false;
    var px = null, pt = 0;

    window.addEventListener('pointermove', function (e) {
      var x = e.clientX, y = e.clientY;
      tipX(x); tipY(y);
      for (var i = 0; i < TRAIL; i++) { dotX[i](x); dotY[i](y); }

      // Se inclina hacia donde va, hasta ±8°
      var t = e.timeStamp;
      if (px !== null && t > pt) {
        rotTo(gsap.utils.clamp(-8, 8, (x - px) / (t - pt) * 1000 / 220));
      }
      px = x; pt = t;

      var hot = !!(e.target && e.target.closest && e.target.closest(HOT));
      if (hot !== wasHot) {
        wasHot = hot;
        tip.classList.toggle('is-hot', hot);
        scaleTo(hot ? 1.2 : 1);
      }

      if (!shown) { shown = true; gsap.to(wrap, { opacity: 1, duration: 0.3 }); }
    }, { passive: true });

    document.addEventListener('pointerleave', function () {
      gsap.to(wrap, { opacity: 0, duration: 0.25 });
      shown = false;
    });
  }

  /* =====================================================================
     H. FONDO REACTIVO — el negro se tiñe de bordó donde pasa el cursor
     ===================================================================== */
  function buildSpotlight() {
    if (!HOVERS || COARSE || REDUCED) return;

    var spot = document.createElement('div');
    spot.className = 'spot';
    spot.setAttribute('aria-hidden', 'true');
    document.body.appendChild(spot);

    gsap.set(spot, {
      xPercent: -50, yPercent: -50,
      x: window.innerWidth / 2, y: window.innerHeight / 2
    });

    var xTo = gsap.quickTo(spot, 'x', { duration: 0.55, ease: 'power3' });
    var yTo = gsap.quickTo(spot, 'y', { duration: 0.55, ease: 'power3' });
    var aTo = gsap.quickTo(spot, 'opacity', { duration: 0.6, ease: 'power2' });

    // Sobre hero, constelación y contacto el bordó sube a tope; en el resto
    // se queda a media luz. Preguntamos por el target del propio evento en
    // vez de hacer elementFromPoint: no fuerza layout.
    window.addEventListener('pointermove', function (e) {
      xTo(e.clientX);
      yTo(e.clientY);
      var hot = e.target && e.target.closest &&
                e.target.closest('.hero,.constel,.contact');
      aTo(hot ? 1 : 0.6);
    }, { passive: true });

    document.addEventListener('pointerleave', function () { aTo(0); });
  }

  /* =====================================================================
     I. Cromo: nav y barra de progreso
     ===================================================================== */
  function buildChrome() {
    var nav = q('#nav');
    var hidden = false;

    ScrollTrigger.create({
      start: 0, end: 'max',
      onUpdate: function (self) {
        var down = self.direction === 1 && self.scroll() > window.innerHeight * 0.6;
        if (down === hidden) return;
        hidden = down;
        gsap.to(nav, { yPercent: down ? -150 : 0, duration: 0.5, ease: 'power3.out' });
      }
    });

    gsap.to('#progressBar', {
      scaleX: 1, ease: 'none',
      scrollTrigger: { trigger: body, start: 'top top', end: 'bottom bottom', scrub: 0.3 }
    });
  }

  /* =====================================================================
     Arranque — ScrollTriggers creados de arriba hacia abajo
     ===================================================================== */
  function boot() {
    buildGrain();
    heroHandoff();
    buildReel();
    buildMarquee();
    buildConstel();
    buildContact();
    buildSpotlight();
    buildCursor();
    buildChrome();
    ScrollTrigger.refresh();
    playIntro();
  }

  var booted = false;
  function bootOnce() { if (booted) return; booted = true; boot(); }

  // Red de seguridad: si algo falla, la página nunca queda bloqueada
  setTimeout(function () { body.classList.remove('is-loading'); }, 5000);

  // Precargamos la display de marca para que SplitText mida bien
  if (document.fonts && typeof FontFace !== 'undefined') {
    try {
      var druk = new FontFace('Druk Wide', "url('assets/fonts/DrukWideBold.ttf')", { weight: '700' });
      druk.load().then(function (f) { document.fonts.add(f); }).catch(function () {});
    } catch (e) { /* el @font-face del CSS alcanza */ }
  }

  if (document.fonts && document.fonts.ready) {
    document.fonts.ready.then(bootOnce).catch(bootOnce);
    setTimeout(bootOnce, 2500); // no esperamos indefinidamente por la tipografía
  } else {
    bootOnce();
  }

  window.addEventListener('load', function () { ScrollTrigger.refresh(); });
})();
