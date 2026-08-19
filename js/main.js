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
     2. Ventanas de servicio, medidas sobre el propio video
        (picos de luminancia reales: 2.85s, 6.30s, 8.80s, 13.25s, 15.90s)
     --------------------------------------------------------------------- */
  var VIDEO_DUR = 20;
  var WINDOWS = [
    { in: 1.90, peak: 2.85,  out: 4.50 },
    { in: 5.50, peak: 6.30,  out: 7.70 },
    { in: 8.10, peak: 8.80,  out: 10.60 },
    { in: 12.30, peak: 13.25, out: 14.20 },
    { in: 14.90, peak: 15.90, out: 16.80 }
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

    var targets = qa('.lite__item, .lite__end, .row');

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
    var split = SplitText.create(el, { type: 'chars,words', mask: 'chars', aria: 'auto' });
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
    var size = 170;
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

    tl.to('.preloader__flare', { opacity: 1, scale: 1.6, duration: 0.32, ease: 'power2.out' }, 1.06)
      .to('.preloader__star', { scale: 1.18, duration: 0.42, ease: 'power2.out' }, 1.06)
      .to('.preloader__count', { opacity: 0, duration: 0.22 }, 1.06)
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
    return tl;
  }

  // El hero no se desvanece: atraviesa la cámara y deja pasar al video.
  function heroHandoff() {
    gsap.to('.hero__inner', {
      scale: 1.3, yPercent: -6, filter: 'blur(16px)', opacity: 0, ease: 'none',
      scrollTrigger: { trigger: '.hero', start: 'top top', end: 'bottom top', scrub: 0.55 }
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
    if (video.dataset.src && !video.src) video.src = video.dataset.src;
    video.muted = true;

    var state = { t: 0 };

    // Consultamos readyState en cada seek en vez de fiarnos de un evento único:
    // si el video todavía se estaba descargando, igual arranca solo al estar listo.
    function seek() {
      if (video.readyState < 1) return;   // HAVE_METADATA
      var t = state.t;
      if (t < 0) t = 0;
      if (t > VIDEO_DUR) t = VIDEO_DUR;
      try { video.currentTime = t; } catch (err) { /* el navegador aún no puede buscar */ }
    }

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

      tl.set(card, { autoAlpha: 1 }, w.in)
        .fromTo(num, { yPercent: 118, skewY: 8 },
          { yPercent: 0, skewY: 0, duration: 0.75, ease: 'power4.out' }, w.in)
        .fromTo(title, { yPercent: 16, opacity: 0, filter: 'blur(18px)', skewY: 5 },
          { yPercent: 0, opacity: 1, filter: 'blur(0px)', skewY: 0, duration: 1.0, ease: 'power3.out' }, w.in + 0.10)
        .fromTo(rule, { scaleX: 0 }, { scaleX: 1, duration: 0.7, ease: 'power2.out' }, w.in + 0.30)
        .fromTo(desc, { y: 24, opacity: 0 }, { y: 0, opacity: 1, duration: 0.7, ease: 'power2.out' }, w.in + 0.42);

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
      { autoAlpha: 1, yPercent: 0, duration: 0.9, ease: 'power3.out' }, 17.70);

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
      if (!reelLive || video.readyState < 1 || video.seeking) return;
      var t = state.t;
      if (t < 0) t = 0;
      if (t > VIDEO_DUR) t = VIDEO_DUR;
      if (Math.abs(video.currentTime - t) > 0.2) {
        try { video.currentTime = t; } catch (err) { /* seek no disponible aún */ }
      }
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
      },
      onLeave: function () { skewTo(0); speedTo(1); },
      onLeaveBack: function () { skewTo(0); speedTo(1); }
    });

    gsap.from('.marquee', {
      clipPath: 'inset(0% 0% 100% 0%)', duration: 1, ease: 'power3.out',
      scrollTrigger: { trigger: '.marquee', start: 'top 92%', once: true }
    });
  }

  /* =====================================================================
     E. ÍNDICE — filas tipográficas con barrido lateral
     ===================================================================== */
  function buildIndex() {
    fadeIn('.index .eyebrow', {
      duration: 0.7,
      scrollTrigger: { trigger: '.index', start: 'top 78%', once: true }
    });

    splitReveal('.index__title', {
      scrollTrigger: { trigger: '.index__title', start: 'top 85%', once: true }
    });

    qa('.row').forEach(function (row) {
      gsap.fromTo(row,
        { clipPath: 'inset(0% 100% 0% 0%)', opacity: 0 },
        {
          clipPath: 'inset(0% 0% 0% 0%)', opacity: 1, duration: 0.85, ease: 'power3.out',
          scrollTrigger: {
            trigger: row, start: 'top 90%', once: true,
            onEnter: function () { if (!HOVERS) row.classList.add('is-in'); }
          }
        });
    });
  }

  /* =====================================================================
     F. CONTACTO — la estrella se dibuja a mano mientras bajás
     ===================================================================== */
  function buildContact() {
    gsap.to('.contact__bg img', {
      yPercent: 14, ease: 'none',
      scrollTrigger: { trigger: '.contact', start: 'top bottom', end: 'bottom top', scrub: true }
    });

    if (HAS_DRAW) {
      gsap.fromTo('#drawStar',
        { drawSVG: '0% 0%' },
        {
          drawSVG: '0% 100%', ease: 'none',
          scrollTrigger: { trigger: '.contact', start: 'top 88%', end: 'bottom 92%', scrub: 0.6 }
        });
    }

    fadeIn('.contact .eyebrow', {
      duration: 0.7,
      scrollTrigger: { trigger: '.contact', start: 'top 72%', once: true }
    });

    splitReveal('.contact__title', {
      duration: 1.05, stagger: { each: 0.026, from: 'start' },
      scrollTrigger: { trigger: '.contact__title', start: 'top 85%', once: true }
    });

    gsap.from('.btn', {
      y: 34, opacity: 0, duration: 0.8,
      scrollTrigger: { trigger: '.btn', start: 'top 92%', once: true }
    });
    gsap.from('.contact__alt', {
      y: 22, opacity: 0, duration: 0.7,
      scrollTrigger: { trigger: '.contact__alt', start: 'top 95%', once: true }
    });
  }

  /* =====================================================================
     G. Cromo: nav y barra de progreso
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
    buildIndex();
    buildContact();
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
