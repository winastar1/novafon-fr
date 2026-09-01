/* NOVAFON France — moteur d'interactions (Lenis+GSAP self-host, vidéos in-view, anti-slop) */
(function () {
  "use strict";
  var reduceAuto = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var hasGSAP = !!(window.gsap && window.ScrollTrigger);
  if (hasGSAP) { try { gsap.registerPlugin(ScrollTrigger); } catch (e) { hasGSAP = false; } }
  var $ = function (s, c) { return (c || document).querySelector(s); };
  var $$ = function (s, c) { return Array.prototype.slice.call((c || document).querySelectorAll(s)); };

  function revealAll() { $$("[data-rise]").forEach(function (e) { e.classList.add("is-in"); }); }
  window.addEventListener("error", revealAll);

  /* ---------- Smooth scroll (Lenis) ---------- */
  if (!reduceAuto && window.Lenis) {
    var lenis = new Lenis({ duration: 1.1, smoothWheel: true });
    if (hasGSAP) {
      lenis.on("scroll", ScrollTrigger.update);
      gsap.ticker.add(function (t) { lenis.raf(t * 1000); });
      gsap.ticker.lagSmoothing(0);
    } else {
      var raf = function (t) { lenis.raf(t); requestAnimationFrame(raf); };
      requestAnimationFrame(raf);
    }
  }

  /* ---------- Reveals (fondu + montée) ---------- */
  (function () {
    if (!("IntersectionObserver" in window)) { revealAll(); return; }
    var io = new IntersectionObserver(function (ents) {
      ents.forEach(function (en) { if (en.isIntersecting) { en.target.classList.add("is-in"); io.unobserve(en.target); } });
    }, { threshold: 0.12, rootMargin: "0px 0px -8% 0px" });
    $$("[data-rise]").forEach(function (e) {
      var sib = e.parentElement ? Array.prototype.indexOf.call(e.parentElement.children, e) : 0;
      e.style.transitionDelay = Math.min(sib, 5) * 0.07 + "s";
      io.observe(e);
    });
    setTimeout(revealAll, 5000);
  })();

  /* ---------- Compteurs animés ---------- */
  (function () {
    var nums = $$("[data-count]"); if (!nums.length || !("IntersectionObserver" in window)) return;
    var io = new IntersectionObserver(function (ents) {
      ents.forEach(function (en) {
        if (!en.isIntersecting) return;
        var el = en.target, target = parseFloat(el.getAttribute("data-count")), suf = el.getAttribute("data-suffix") || "", t0 = null;
        function step(ts) { if (!t0) t0 = ts; var p = Math.min((ts - t0) / 1100, 1), e = 1 - Math.pow(1 - p, 3);
          el.textContent = Math.round(target * e) + suf; if (p < 1) requestAnimationFrame(step); }
        requestAnimationFrame(step); io.unobserve(el);
      });
    }, { threshold: 0.6 });
    nums.forEach(function (n) { io.observe(n); });
  })();

  /* ---------- Vidéos : lecture quand visibles (UX fluide + perf) ---------- */
  (function () {
    var vids = $$("video[data-inview]"); if (!vids.length) return;
    function play(v) { var p = v.play(); if (p && p.catch) p.catch(function () {}); }
    if (reduceAuto) { vids.forEach(function (v) { v.pause(); v.removeAttribute("autoplay"); }); return; }
    if (!("IntersectionObserver" in window)) { vids.forEach(play); return; }
    var io = new IntersectionObserver(function (ents) {
      ents.forEach(function (en) {
        if (en.isIntersecting) play(en.target); else { try { en.target.pause(); } catch (e) {} }
      });
    }, { threshold: 0.25 });
    vids.forEach(function (v) { io.observe(v); });
  })();

  /* ---------- Switcher produit 3D (depth, CSS) ---------- */
  (function () {
    var stage = $("[data-stage]"); if (!stage) return;
    var prods = $$(".prod", stage), dots = $$("[data-dot]", stage), n = prods.length, idx = 0, timer = null;
    function apply() {
      prods.forEach(function (p, i) { p.classList.remove("is-active", "is-prev", "is-next");
        p.classList.add(i === idx ? "is-active" : (i === (idx - 1 + n) % n ? "is-prev" : "is-next")); });
      dots.forEach(function (d, i) {
        d.classList.toggle("on", i === idx);
        d.setAttribute("aria-selected", i === idx);
        d.setAttribute("tabindex", i === idx ? "0" : "-1");
      });
    }
    function go(i) { idx = (i + n) % n; apply(); restart(); }
    var held = false;
    function stop() { clearInterval(timer); timer = null; }
    function restart() { stop(); if (reduceAuto || held) return; timer = setInterval(function () { go(idx + 1); }, 4200); }
    /* Pause tant que l'utilisateur survole, pointe ou navigue au clavier dans le bloc */
    ["mouseenter", "focusin", "touchstart"].forEach(function (ev) {
      stage.addEventListener(ev, function () { held = true; stop(); }, { passive: true });
    });
    ["mouseleave", "focusout"].forEach(function (ev) {
      stage.addEventListener(ev, function () { held = false; restart(); });
    });
    dots.forEach(function (d, i) {
      d.addEventListener("click", function () { go(i); dots[idx].focus(); });
      d.addEventListener("keydown", function (e) {
        var k = e.key, d2 = (k === "ArrowRight" || k === "ArrowDown") ? 1 : ((k === "ArrowLeft" || k === "ArrowUp") ? -1 : 0);
        if (!d2) return;
        e.preventDefault(); go(idx + d2); dots[idx].focus();
      });
    });
    var x0 = null;
    stage.addEventListener("touchstart", function (e) { x0 = e.touches[0].clientX; }, { passive: true });
    stage.addEventListener("touchend", function (e) { if (x0 === null) return; var dx = e.changedTouches[0].clientX - x0; if (Math.abs(dx) > 44) go(idx + (dx < 0 ? 1 : -1)); x0 = null; }, { passive: true });
    apply(); restart();
  })();

  /* ---------- Boutons magnétiques ---------- */
  if (!reduceAuto && window.matchMedia("(pointer:fine)").matches) {
    $$(".magnetic").forEach(function (el) {
      var r = null, raf = 0, mx = 0, my = 0;
      function write() { raf = 0; if (!r) return;
        el.style.transform = "translate(" + (mx - r.left - r.width / 2) * 0.22 + "px," + (my - r.top - r.height / 2) * 0.3 + "px)"; }
      /* rect mesure a l'entree seulement : un mousemove ne doit jamais forcer un reflow */
      el.addEventListener("mouseenter", function () { r = el.getBoundingClientRect(); });
      el.addEventListener("mousemove", function (e) { mx = e.clientX; my = e.clientY; if (!raf) raf = requestAnimationFrame(write); });
      el.addEventListener("mouseleave", function () { r = null; if (raf) { cancelAnimationFrame(raf); raf = 0; } el.style.transform = ""; });
    });
  }

  /* ---------- Transition hero → bloc suivant (parallax + fondu au scroll) ---------- */
  if (hasGSAP && !reduceAuto && $(".hero")) {
    var stH = { trigger: ".hero", start: "top top", end: "bottom top", scrub: true };
    gsap.to(".hero-copy", { yPercent: -16, opacity: 0.12, ease: "none", scrollTrigger: stH });
    gsap.to(".hero-visual", { yPercent: -34, scale: 0.85, opacity: 0.25, ease: "none", scrollTrigger: stH });
    gsap.to(".hero-glow", { yPercent: -28, opacity: 0.35, ease: "none", scrollTrigger: stH });
    gsap.to(".scroll-cue", { opacity: 0, ease: "none", scrollTrigger: { trigger: ".hero", start: "top top", end: "18% top", scrub: true } });
    gsap.fromTo(".trustbar-inner", { yPercent: 55, opacity: 0 }, { yPercent: 0, opacity: 1, ease: "power2.out",
      scrollTrigger: { trigger: ".trustbar", start: "top 96%", end: "top 62%", scrub: true } });
  }

  /* ---------- Hero : pivot 3D de l'appareil au curseur ---------- */
  (function () {
    if (reduceAuto || !window.matchMedia("(pointer:fine)").matches) return;
    var hero = $(".hero"), img = $(".hero-visual img"); if (!hero || !img) return;
    hero.addEventListener("mousemove", function (e) {
      var r = hero.getBoundingClientRect();
      var rx = (e.clientY - r.top) / r.height - 0.5, ry = (e.clientX - r.left) / r.width - 0.5;
      img.style.transform = "rotateX(" + (-rx * 9).toFixed(2) + "deg) rotateY(" + (ry * 13).toFixed(2) + "deg)";
    });
    hero.addEventListener("mouseleave", function () { img.style.transform = ""; });
  })();

  /* ---------- Pop-up d'arrivée ---------- */
  (function () {
    var modal = $("#welcome"); if (!modal) return;
    var KEY = "nvf_welcome_seen";
    var lastFocus = null;
    var SEL = 'a[href],button:not([disabled]),input:not([disabled]),[tabindex]:not([tabindex="-1"])';
    function focusables() { return $$(SEL, modal).filter(function (e) { return e.offsetParent !== null; }); }
    function open() {
      lastFocus = document.activeElement;
      modal.classList.add("open"); modal.setAttribute("aria-hidden", "false");
      var f = modal.querySelector("input"); if (f) setTimeout(function () { f.focus(); }, 400);
    }
    function close() {
      modal.classList.remove("open"); modal.setAttribute("aria-hidden", "true");
      try { sessionStorage.setItem(KEY, "1"); } catch (e) {}
      if (lastFocus && lastFocus.focus) { try { lastFocus.focus(); } catch (e) {} }
    }
    /* Le focus ne sort pas de la modale tant qu'elle est ouverte */
    modal.addEventListener("keydown", function (e) {
      if (e.key !== "Tab" || !modal.classList.contains("open")) return;
      var f = focusables(); if (!f.length) return;
      var first = f[0], last = f[f.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    });
    $$("[data-close]", modal).forEach(function (b) { b.addEventListener("click", close); });
    document.addEventListener("keydown", function (e) { if (e.key === "Escape" && modal.classList.contains("open")) close(); });
    modal.querySelector(".modal-form").addEventListener("submit", function (e) { e.preventDefault(); this.querySelector("button").textContent = "Code envoyé ✓"; setTimeout(close, 1100); });
    var seen; try { seen = sessionStorage.getItem(KEY); } catch (e) { seen = null; }
    if (!seen && !window.__noModal) setTimeout(open, 1300);
    window.__openWelcome = open; window.__closeWelcome = close;
  })();

})();
