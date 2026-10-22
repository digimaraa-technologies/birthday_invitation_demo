/* ==========================================================================
   Akash's Birthday Celebration — interaction layer (vanilla JS)
   Modules: config binding · entrance curtain · scratch card · countdown
            · navigation · scroll reveal · RSVP · back-to-top · music
   ========================================================================== */
(function () {
  "use strict";

  var CONFIG = window.EVENT_CONFIG || {};
  var reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)");

  /* ---------------------------------------------------------------- utils */
  function $(sel, root) { return (root || document).querySelector(sel); }
  function $$(sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); }

  function getPath(obj, path) {
    return path.split(".").reduce(function (acc, key) {
      return acc == null ? undefined : acc[key];
    }, obj);
  }

  function debounce(fn, wait) {
    var t;
    return function () {
      var args = arguments, ctx = this;
      clearTimeout(t);
      t = setTimeout(function () { fn.apply(ctx, args); }, wait);
    };
  }

  /* ------------------------------------------------- config -> DOM binding */
  function applyConfig() {
    var root = document.documentElement;

    if (CONFIG.theme) {
      root.style.setProperty("--rose", CONFIG.theme.primary);
      root.style.setProperty("--gold", CONFIG.theme.accent);
      root.style.setProperty("--ivory", CONFIG.theme.background);
      root.style.setProperty("--ink", CONFIG.theme.text);
      var metaTheme = $('meta[name="theme-color"]');
      if (metaTheme) metaTheme.setAttribute("content", CONFIG.theme.primary);
    }

    $$("[data-bind]").forEach(function (el) {
      var value = getPath(CONFIG, el.getAttribute("data-bind"));
      if (value == null) return;
      if (el.classList.contains("seal__monogram")) {
        el.textContent = String(CONFIG.name || "A").trim().charAt(0).toUpperCase();
        return;
      }
      if (el.tagName === "A" && el.hasAttribute("href")) {
        el.setAttribute("href", value);
        return;
      }
      el.textContent = value;
    });

    $$("[data-asset]").forEach(function (el) {
      var path = getPath(CONFIG.assets || {}, el.getAttribute("data-asset"));
      if (!path) return;
      el.setAttribute("src", path);
      el.addEventListener("error", function () {
        el.style.display = "none";
        el.parentElement.classList.add("is-media-missing");
      });
    });
  }

  /* ------------------------------------------------------- entrance curtain */
  function initCurtain() {
    var curtain = $("#curtain");
    var openBtn = $("#curtainOpen");
    var hero = $(".hero");
    if (!curtain || !openBtn) return;

    var particles = $("#curtainParticles");
    var confetti = $("#curtainConfetti");
    var state = "idle";

    document.documentElement.classList.add("is-locked");

    /* optional backdrop revealed as the panels slide apart */
    var entranceSrc = CONFIG.assets && CONFIG.assets.entrance;
    if (entranceSrc) {
      curtain.classList.add("has-entrance-image");
      curtain.style.setProperty("--entrance-image", 'url("' + entranceSrc + '")');
    }

    /* floating gold motes */
    if (particles) {
      for (var i = 0; i < 14; i++) {
        var mote = document.createElement("span");
        mote.className = "curtain__particle";
        mote.style.left = (4 + Math.random() * 92).toFixed(2) + "%";
        mote.style.bottom = (-8 - Math.random() * 22).toFixed(2) + "%";
        mote.style.animationDuration = (7 + Math.random() * 9).toFixed(2) + "s";
        mote.style.animationDelay = (-Math.random() * 12).toFixed(2) + "s";
        mote.style.transform = "scale(" + (0.6 + Math.random() * 1.2).toFixed(2) + ")";
        particles.appendChild(mote);
      }
    }

    /* confetti burst on open */
    function burstConfetti() {
      if (!confetti) return;
      for (var c = 0; c < 26; c++) {
        var piece = document.createElement("span");
        piece.className = "curtain__confetti-piece";
        var angle = (Math.PI * 2 * c) / 26 + Math.random() * 0.4;
        var distance = 140 + Math.random() * 260;
        piece.style.setProperty("--tx", Math.cos(angle) * distance + "px");
        piece.style.setProperty("--ty", (Math.sin(angle) * distance - 60) + "px");
        piece.style.setProperty("--rot", (Math.random() * 900 - 450).toFixed(0) + "deg");
        piece.style.background = c % 3 === 0 ? "#d31876" : c % 3 === 1 ? "#ffbf00" : "#fff8f0";
        piece.style.animationDelay = (Math.random() * 180).toFixed(0) + "ms";
        confetti.appendChild(piece);
      }
    }

    function finish() {
      curtain.classList.add("is-fading");
      curtain.setAttribute("aria-hidden", "true");
      document.documentElement.classList.remove("is-locked");
      document.body.classList.remove("is-locked");
      if (hero) hero.classList.add("is-ready");
      var main = $("#main");
      if (main) main.setAttribute("tabindex", "-1");
      window.dispatchEvent(new CustomEvent("akash:entrance-opened"));
      window.setTimeout(function () { curtain.hidden = true; }, reduceMotion.matches ? 0 : 420);
    }

    function open() {
      if (state !== "idle") return;
      state = "opening";
      curtain.classList.add("is-opening");
      burstConfetti();
      var delay = reduceMotion.matches ? 260 : 1250;
      setTimeout(finish, delay);
    }

    openBtn.addEventListener("click", open);
    curtain.addEventListener("click", function (e) {
      if (e.target === curtain) open();
    });
    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape" && state === "idle") open();
    });
  }

  /* ----------------------------------------------------------- scratch card */
  function initScratch() {
    var card = $("#scratchCard");
    var canvas = $("#scratchCanvas");
    var inner = $("#scratchInner");
    var status = $("#scratchStatus");
    var tip = $("#scratchTip");
    var manual = $("#scratchManual");
    if (!card || !canvas || !inner) return;

    var ctx = canvas.getContext("2d");
    var mask = document.createElement("canvas");
    var mctx = mask.getContext("2d", { willReadFrequently: true });
    var MASK_W = 160;

    var cssW = 0, cssH = 0, dpr = 1;
    var drawing = false, revealed = false, last = null, moves = 0;
    var threshold = (CONFIG.behaviour && CONFIG.behaviour.scratchRevealThreshold) || 0.45;
    var coverImg = null, coverReady = false;

    /* optional photo cover, painted under the foil art when configured */
    var coverSrc = CONFIG.assets && CONFIG.assets.scratchCover;
    if (coverSrc) {
      coverImg = new Image();
      coverImg.onload = function () {
        coverReady = true;
        if (!revealed) paintCover();
      };
      coverImg.src = coverSrc;
    }

    /* deterministic pseudo random so the cover art never jumps between repaints */
    var seed = 20270220;
    function rnd() {
      seed = (seed * 1664525 + 1013904223) % 4294967296;
      return seed / 4294967296;
    }

    function spacedText(text, cx, y, spacing) {
      var chars = Array.from(text);
      var widths = chars.map(function (c) { return ctx.measureText(c).width; });
      var total = widths.reduce(function (a, b) { return a + b; }, 0) + spacing * (chars.length - 1);
      var x = cx - total / 2;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      chars.forEach(function (c, i) {
        ctx.fillText(c, x + widths[i] / 2, y);
        x += widths[i] + spacing;
      });
    }

    function star(x, y, r, rot) {
      ctx.beginPath();
      for (var i = 0; i < 10; i++) {
        var rad = i % 2 === 0 ? r : r * 0.45;
        var a = rot + (Math.PI / 5) * i - Math.PI / 2;
        var px = x + Math.cos(a) * rad;
        var py = y + Math.sin(a) * rad;
        if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
      }
      ctx.closePath();
      ctx.fill();
    }

    function balloon(x, y, w, h, color, tilt) {
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(tilt);
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.ellipse(0, 0, w / 2, h / 2, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "rgba(255,255,255,0.35)";
      ctx.beginPath();
      ctx.ellipse(-w * 0.16, -h * 0.2, w * 0.13, h * 0.2, -0.4, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.moveTo(-w * 0.09, h / 2);
      ctx.lineTo(w * 0.09, h / 2);
      ctx.lineTo(0, h / 2 + h * 0.13);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = "rgba(255,255,255,0.5)";
      ctx.lineWidth = Math.max(1, w * 0.012);
      ctx.beginPath();
      ctx.moveTo(0, h / 2 + h * 0.13);
      ctx.quadraticCurveTo(w * 0.18, h * 0.95, -w * 0.05, h * 1.5);
      ctx.stroke();
      ctx.restore();
    }

    function gift(x, y, s, box, ribbon) {
      ctx.save();
      ctx.translate(x, y);
      ctx.fillStyle = box;
      ctx.fillRect(-s * 0.5, -s * 0.42, s, s * 0.78);
      ctx.fillStyle = ribbon;
      ctx.fillRect(-s * 0.08, -s * 0.42, s * 0.16, s * 0.78);
      ctx.fillRect(-s * 0.5, -s * 0.14, s, s * 0.14);
      ctx.beginPath();
      ctx.ellipse(-s * 0.14, -s * 0.5, s * 0.15, s * 0.11, -0.5, 0, Math.PI * 2);
      ctx.ellipse(s * 0.14, -s * 0.5, s * 0.15, s * 0.11, 0.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    function paintCover() {
      if (!cssW || !cssH) return;
      var w = cssW, h = cssH;
      ctx.clearRect(0, 0, w, h);
      var photo = coverReady && coverImg && coverImg.width;

      if (photo) {
        /* configured cover photo, cropped to fill the card */
        var ratio = Math.max(w / coverImg.width, h / coverImg.height);
        var dw = coverImg.width * ratio, dh = coverImg.height * ratio;
        ctx.drawImage(coverImg, (w - dw) / 2, (h - dh) / 2, dw, dh);
        ctx.fillStyle = "rgba(74, 44, 0, 0.34)";
        ctx.fillRect(0, 0, w, h);
      } else {
        var base = ctx.createLinearGradient(0, 0, w, h);
        base.addColorStop(0, "#ffe7a8");
        base.addColorStop(0.26, "#ffc93c");
        base.addColorStop(0.55, "#ffbf00");
        base.addColorStop(0.82, "#eaa200");
        base.addColorStop(1, "#ffd873");
        ctx.fillStyle = base;
        ctx.fillRect(0, 0, w, h);
      }

      /* metallic shimmer bands */
      ctx.save();
      ctx.globalAlpha = photo ? 0.1 : 0.16;
      ctx.translate(w / 2, h / 2);
      ctx.rotate(-0.34);
      var band = w * 0.055;
      for (var b = -14; b < 14; b++) {
        ctx.fillStyle = b % 2 === 0 ? "#fff8dd" : "#b37a00";
        ctx.fillRect(b * band * 2, -h * 1.6, band, h * 3.2);
      }
      ctx.restore();

      /* vignette */
      var vig = ctx.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.18, w / 2, h / 2, Math.max(w, h) * 0.8);
      vig.addColorStop(0, "rgba(255,255,255,0.16)");
      vig.addColorStop(1, "rgba(120,66,0,0.42)");
      ctx.fillStyle = vig;
      ctx.fillRect(0, 0, w, h);

      /* confetti + stars */
      for (var i = 0; i < 34; i++) {
        var cx = rnd() * w, cy = rnd() * h;
        ctx.save();
        ctx.translate(cx, cy);
        ctx.rotate(rnd() * Math.PI);
        ctx.globalAlpha = 0.5 + rnd() * 0.4;
        ctx.fillStyle = ["#d31876", "#fff8f0", "#8c0b4b", "#ffffff"][Math.floor(rnd() * 4)];
        var s = w * (0.008 + rnd() * 0.012);
        ctx.fillRect(-s / 2, -s * 1.6, s, s * 3.2);
        ctx.restore();
      }
      ctx.globalAlpha = 0.85;
      ctx.fillStyle = "#fff8f0";
      for (var s2 = 0; s2 < 9; s2++) {
        star(rnd() * w, rnd() * h * 0.85, w * (0.008 + rnd() * 0.012), rnd() * Math.PI);
      }
      ctx.globalAlpha = 1;

      /* balloons + gift */
      if (!photo) {
        balloon(w * 0.17, h * 0.24, w * 0.11, h * 0.2, "#d31876", -0.16);
        balloon(w * 0.83, h * 0.21, w * 0.1, h * 0.18, "#fff1c9", 0.14);
        balloon(w * 0.72, h * 0.36, w * 0.075, h * 0.14, "#8c0b4b", 0.1);
        gift(w * 0.24, h * 0.72, w * 0.13, "#d31876", "#ffbf00");
        gift(w * 0.79, h * 0.74, w * 0.11, "#fff8f0", "#d31876");
      }

      /* frame */
      ctx.strokeStyle = "rgba(255,255,255,0.75)";
      ctx.lineWidth = Math.max(1, w * 0.0022);
      ctx.strokeRect(w * 0.045, h * 0.06, w * 0.91, h * 0.88);
      ctx.strokeStyle = "rgba(255,255,255,0.45)";
      ctx.strokeRect(w * 0.062, h * 0.085, w * 0.876, h * 0.83);

      /* copy */
      var cx = w / 2;
      if (photo) {
        ctx.fillStyle = "rgba(40, 18, 0, 0.55)";
        ctx.fillRect(w * 0.12, h * 0.33, w * 0.76, h * 0.34);
      }
      ctx.fillStyle = photo ? "rgba(255,248,225,0.9)" : "rgba(90,52,0,0.62)";
      ctx.font = "500 " + (w * 0.028).toFixed(0) + "px Jost, system-ui, sans-serif";
      spacedText("AKASH'S BIRTHDAY", cx, h * 0.4, w * 0.012);

      ctx.fillStyle = photo ? "#fff8f0" : "#4a2c00";
      ctx.font = "600 " + (w * 0.075).toFixed(0) + "px 'Playfair Display', Georgia, serif";
      spacedText("SCRATCH HERE", cx, h * 0.5, w * 0.012);

      ctx.fillStyle = photo ? "rgba(255,248,225,0.85)" : "rgba(74,44,0,0.78)";
      ctx.font = "400 " + (w * 0.032).toFixed(0) + "px Jost, system-ui, sans-serif";
      spacedText("TO REVEAL THE INVITATION", cx, h * 0.585, w * 0.008);

      /* monogram disc */
      ctx.beginPath();
      ctx.arc(cx, h * 0.27, Math.min(w, h) * 0.075, 0, Math.PI * 2);
      ctx.strokeStyle = photo ? "rgba(255, 248, 225, 0.55)" : "rgba(90,52,0,0.4)";
      ctx.lineWidth = Math.max(1, w * 0.002);
      ctx.stroke();
      ctx.fillStyle = photo ? "#fff8f0" : "#4a2c00";
      ctx.font = "600 " + (w * 0.06).toFixed(0) + "px 'Playfair Display', Georgia, serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(String(CONFIG.name || "A").trim().charAt(0).toUpperCase(), cx, h * 0.272);
    }

    function resize() {
      var rect = canvas.getBoundingClientRect();
      if (!rect.width || !rect.height) return;
      if (Math.abs(rect.width - cssW) < 1 && Math.abs(rect.height - cssH) < 1) return;
      cssW = rect.width;
      cssH = rect.height;
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.round(cssW * dpr);
      canvas.height = Math.round(cssH * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      mask.width = MASK_W;
      mask.height = Math.max(1, Math.round(MASK_W * (cssH / cssW)));
      mctx.clearRect(0, 0, mask.width, mask.height);
      if (!revealed) paintCover();
    }

    /* a fingertip-wide brush: ~36px on phones, scaling up on wide cards */
    function brushSize() { return Math.max(36, cssW * 0.1); }

    function eraseAt(x, y) {
      ctx.save();
      ctx.globalCompositeOperation = "destination-out";
      ctx.strokeStyle = "rgba(0,0,0,1)";
      ctx.fillStyle = "rgba(0,0,0,1)";
      ctx.lineWidth = brushSize();
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      ctx.beginPath();
      ctx.arc(x, y, brushSize() / 2, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    function eraseStroke(x0, y0, x1, y1) {
      ctx.save();
      ctx.globalCompositeOperation = "destination-out";
      ctx.strokeStyle = "rgba(0,0,0,1)";
      ctx.lineWidth = brushSize();
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      ctx.beginPath();
      ctx.moveTo(x0, y0);
      ctx.lineTo(x1, y1);
      ctx.stroke();
      ctx.restore();
    }

    function eraseMask(x0, y0, x1, y1) {
      var k = mask.width / cssW;
      var sx = x1 * k;
      var sy = (y1 / cssH) * mask.height;
      mctx.save();
      mctx.strokeStyle = "#000";
      mctx.lineWidth = Math.max(2, brushSize() * k);
      mctx.lineCap = "round";
      mctx.lineJoin = "round";
      mctx.beginPath();
      mctx.moveTo(x0 * k, y0 * k);
      mctx.lineTo(sx, sy);
      mctx.stroke();
      mctx.restore();
    }

    function coverage() {
      var data = mctx.getImageData(0, 0, mask.width, mask.height).data;
      var total = mask.width * mask.height;
      var hit = 0;
      for (var i = 3; i < data.length; i += 4) {
        if (data[i] > 24) hit++;
      }
      return hit / total;
    }

    function reveal(reason) {
      if (revealed) return;
      revealed = true;
      card.classList.add("is-revealed");
      canvas.setAttribute("aria-hidden", "true");
      inner.setAttribute("aria-hidden", "false");
      if (status) {
        status.textContent = reason === "manual"
          ? "Invitation revealed."
          : "Invitation revealed — the celebration starts Saturday, 20 February 2027.";
      }
      if (tip) tip.textContent = "You're invited — see you on the night.";
      window.dispatchEvent(new CustomEvent("akash:invitation-revealed"));
    }

    function pointFromEvent(e) {
      var rect = canvas.getBoundingClientRect();
      return { x: e.clientX - rect.left, y: e.clientY - rect.top };
    }

    canvas.addEventListener("pointerdown", function (e) {
      if (revealed || drawing) return;
      e.preventDefault();
      drawing = true;
      try { canvas.setPointerCapture(e.pointerId); } catch (err) { /* older browsers */ }
      last = pointFromEvent(e);
      eraseAt(last.x, last.y);
      eraseMask(last.x, last.y, last.x, last.y);
    });

    canvas.addEventListener("pointermove", function (e) {
      if (!drawing || revealed) return;
      e.preventDefault();
      var p = pointFromEvent(e);
      eraseStroke(last.x, last.y, p.x, p.y);
      eraseMask(last.x, last.y, p.x, p.y);
      last = p;
      moves++;
      if (moves % 8 === 0 && coverage() >= threshold) reveal("auto");
    });

    function endStroke() {
      if (!drawing) return;
      drawing = false;
      last = null;
      if (!revealed && coverage() >= threshold) reveal("auto");
    }
    ["pointerup", "pointercancel"].forEach(function (evt) {
      canvas.addEventListener(evt, endStroke);
    });

    canvas.addEventListener("keydown", function (e) {
      if (e.key === "Enter" || e.key === " ") { e.preventDefault(); reveal("manual"); }
    });
    canvas.setAttribute("tabindex", "0");

    if (manual) manual.addEventListener("click", function () { reveal("manual"); });

    resize();
    window.addEventListener("resize", debounce(resize, 160));
    if (window.ResizeObserver) {
      var frame = card.querySelector(".scratch__frame");
      if (frame) new ResizeObserver(debounce(resize, 90)).observe(frame);
    }
    if (document.fonts && document.fonts.ready) {
      document.fonts.ready.then(resize).catch(function () { /* ignore */ });
    }
  }

  /* ------------------------------------------------------------- countdown */
  function initCountdown() {
    var wrap = $("#countdownTimer");
    var done = $("#countdownDone");
    if (!wrap) return;

    var target = new Date(CONFIG.countdownTarget || CONFIG.date + "T" + CONFIG.startTime);
    if (isNaN(target.getTime())) return;

    var el = {
      days: $("#cdDays"), hours: $("#cdHours"),
      minutes: $("#cdMinutes"), seconds: $("#cdSeconds")
    };
    var timer = null;

    function pad(n) { return String(n).padStart(2, "0"); }

    /* the new digit rolls up into its slot, the way a flip clock does */
    function tick(node) {
      if (!node || reduceMotion.matches) return;
      node.animate(
        [{ transform: "translateY(100%)" }, { transform: "translateY(0)" }],
        { duration: 420, easing: "cubic-bezier(.23,1,.32,1)" }
      );
    }

    function set(node, text) {
      if (!node || node.textContent === text) return;
      node.textContent = text;
      tick(node);
    }

    function render() {
      var diff = target.getTime() - Date.now();
      if (diff <= 0) {
        wrap.classList.add("is-complete");
        if (done) done.hidden = false;
        stop();
        return;
      }
      var s = Math.floor(diff / 1000);
      var days = Math.floor(s / 86400);
      var hours = Math.floor((s % 86400) / 3600);
      var minutes = Math.floor((s % 3600) / 60);
      var seconds = s % 60;
      set(el.days, String(days).padStart(2, "0"));
      set(el.hours, pad(hours));
      set(el.minutes, pad(minutes));
      set(el.seconds, pad(seconds));
    }

    function start() { if (!timer) timer = setInterval(render, 1000); }
    function stop() { if (timer) { clearInterval(timer); timer = null; } }

    render();
    start();

    document.addEventListener("visibilitychange", function () {
      if (document.hidden) stop(); else { render(); start(); }
    });
  }

  /* ------------------------------------------------------------ navigation */
  function initNav() {
    var header = $("#siteHeader");
    var toggle = $("#navToggle");
    var nav = $("#primaryNav");
    var toTop = $("#backToTop");
    var lastY = window.scrollY;

    function closeMenu() {
      if (!nav || !toggle) return;
      nav.classList.remove("is-open");
      toggle.setAttribute("aria-expanded", "false");
      toggle.setAttribute("aria-label", "Open menu");
    }

    if (toggle && nav) {
      toggle.addEventListener("click", function () {
        var open = nav.classList.toggle("is-open");
        toggle.setAttribute("aria-expanded", open ? "true" : "false");
        toggle.setAttribute("aria-label", open ? "Close menu" : "Open menu");
      });
      nav.addEventListener("click", function (e) {
        if (e.target.closest("a")) closeMenu();
      });
      document.addEventListener("keydown", function (e) {
        if (e.key === "Escape") closeMenu();
      });
      window.addEventListener("resize", debounce(function () {
        if (window.innerWidth > 760) closeMenu();
      }, 150));
    }

    function onScroll() {
      var y = window.scrollY;
      if (header) {
        header.classList.toggle("is-scrolled", y > 40);
        var menuOpen = nav && nav.classList.contains("is-open");
        header.classList.toggle("is-hidden", y > 520 && y > lastY && !menuOpen);
      }
      if (toTop) toTop.classList.toggle("is-visible", y > 620);
      lastY = y;
    }
    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();

    if (toTop) {
      toTop.addEventListener("click", function () {
        window.scrollTo({ top: 0, behavior: reduceMotion.matches ? "auto" : "smooth" });
      });
    }

    /* active section highlight */
    var links = $$(".nav__link");
    var sections = links
      .map(function (a) { return document.querySelector(a.getAttribute("href")); })
      .filter(Boolean);
    if (sections.length && "IntersectionObserver" in window) {
      var spy = new IntersectionObserver(function (entries) {
        entries.forEach(function (entry) {
          if (!entry.isIntersecting) return;
          links.forEach(function (a) {
            var active = a.getAttribute("href") === "#" + entry.target.id;
            a.classList.toggle("is-active", active);
            if (active) a.setAttribute("aria-current", "true");
            else a.removeAttribute("aria-current");
          });
        });
      }, { rootMargin: "-45% 0px -50% 0px", threshold: 0 });
      sections.forEach(function (s) { spy.observe(s); });
    }
  }

  /* ---------------------------------------------------------- scroll reveal */
  function initReveal() {
    var items = $$(".reveal");
    if (!items.length) return;

    /* stagger siblings that share a grid */
    [".cards", ".timeline", ".dress", ".invite__meta"].forEach(function (sel) {
      $$(sel).forEach(function (group) {
        $$(".reveal", group).forEach(function (child, i) {
          child.style.setProperty("--d", i * 70 + "ms");
        });
      });
    });

    if (!("IntersectionObserver" in window)) {
      items.forEach(function (el) { el.classList.add("is-visible"); });
      return;
    }
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        entry.target.classList.add("is-visible");
        io.unobserve(entry.target);
      });
    }, { threshold: 0.12, rootMargin: "0px 0px -8% 0px" });
    items.forEach(function (el) { io.observe(el); });
  }

  /* ------------------------------------------------------------------ RSVP */
  function initRsvp() {
    var form = $("#rsvpForm");
    if (!form) return;

    var submitBtn = $("#rsvpSubmit");
    var submitLabel = $("#rsvpSubmitLabel");
    var status = $("#rsvpStatus");
    var note = $("#rsvpNote");

    var fields = {
      name: $("#rsvpName"),
      phone: $("#rsvpPhone"),
      guests: $("#rsvpGuests"),
      attendance: form.querySelector('input[name="attendance"]:checked'),
      wishes: $("#rsvpWishes")
    };
    var errors = {
      name: $("#errName"), phone: $("#errPhone"),
      guests: $("#errGuests"), attendance: $("#errAttendance"), wishes: $("#errWishes")
    };
    var maxGuests = (CONFIG.behaviour && CONFIG.behaviour.maxGuests) || 10;

    function clearErrors() {
      Object.keys(errors).forEach(function (key) {
        if (errors[key]) errors[key].textContent = "";
      });
      ["name", "phone", "guests"].forEach(function (key) {
        if (fields[key]) fields[key].removeAttribute("aria-invalid");
      });
      if (status) { status.textContent = ""; status.className = "form__status"; }
    }

    function setError(key, message) {
      if (errors[key]) errors[key].textContent = message;
      if (fields[key] && fields[key].setAttribute) fields[key].setAttribute("aria-invalid", "true");
    }

    function validate() {
      var data = read();
      var found = {};

      if (!data.name) found.name = "Please tell us your name.";
      else if (data.name.length < 2) found.name = "That name looks a little short.";

      if (data.phone && !/^[+()\d][\d\s\-()]{6,19}$/.test(data.phone)) {
        found.phone = "Enter a valid mobile number or leave it blank.";
      }

      var guests = Number(data.guests);
      if (!data.guests) found.guests = "Let us know how many are coming.";
      else if (!Number.isInteger(guests) || guests < 1 || guests > maxGuests) {
        found.guests = "Please enter a number between 1 and " + maxGuests + ".";
      }

      if (!data.attendance) found.attendance = "Please choose whether you can join us.";

      return { data: data, found: found };
    }

    function read() {
      var checked = form.querySelector('input[name="attendance"]:checked');
      return {
        name: (fields.name.value || "").trim(),
        phone: (fields.phone.value || "").trim(),
        guests: (fields.guests.value || "").trim(),
        attendance: checked ? checked.value : "",
        wishes: (fields.wishes.value || "").trim()
      };
    }

    function attendanceLabel(value) {
      return value === "yes" ? "Yes, I'll be there!" : "Sorry, I can't make it.";
    }

    function buildMessage(data) {
      var tpl = (CONFIG.organizer && CONFIG.organizer.messageTemplate) || "";
      return tpl
        .replace(/\{host\}/g, CONFIG.name || "the birthday boy")
        .replace(/\{name\}/g, data.name || "")
        .replace(/\{attendance\}/g, attendanceLabel(data.attendance))
        .replace(/\{guests\}/g, data.guests || "1")
        .replace(/\{phone\}/g, data.phone || "Not provided")
        .replace(/\{wishes\}/g, data.wishes || "—");
    }

    function showCopyFallback(message) {
      var box = $(".form__fallback");
      if (box) box.remove();
      box = document.createElement("div");
      box.className = "form__fallback";
      var ta = document.createElement("textarea");
      ta.className = "field__input field__input--area";
      ta.readOnly = true;
      ta.rows = 6;
      ta.value = message;
      var copy = document.createElement("button");
      copy.type = "button";
      copy.className = "btn btn--outline btn--sm";
      copy.textContent = "Copy RSVP details";
      copy.addEventListener("click", function () {
        ta.select();
        try {
          if (navigator.clipboard) navigator.clipboard.writeText(message);
          else document.execCommand("copy");
          copy.textContent = "Copied!";
          setTimeout(function () { copy.textContent = "Copy RSVP details"; }, 2000);
        } catch (err) {
          copy.textContent = "Select the text above to copy";
        }
      });
      box.appendChild(ta);
      box.appendChild(copy);
      if (status && status.parentNode) status.parentNode.appendChild(box);
    }

    ["input", "change"].forEach(function (evt) {
      form.addEventListener(evt, function (e) {
        var key = e.target && e.target.name;
        if (key && errors[key]) {
          errors[key].textContent = "";
          if (e.target.setAttribute) e.target.removeAttribute("aria-invalid");
        }
      });
    });

    form.addEventListener("submit", function (e) {
      e.preventDefault();
      clearErrors();

      var result = validate();
      var keys = Object.keys(result.found);
      if (keys.length) {
        keys.forEach(function (k) { setError(k, result.found[k]); });
        var first = result.data && fields[keys[0]];
        if (first && first.focus) first.focus();
        if (status) {
          status.className = "form__status is-error";
          status.textContent = "Please fix the highlighted fields and try again.";
        }
        return;
      }

      var message = buildMessage(result.data);
      var number = String((CONFIG.organizer && CONFIG.organizer.whatsappNumber) || "").replace(/\D/g, "");

      if (!number) {
        if (status) {
          status.className = "form__status is-error";
          status.textContent =
            "The organizer's WhatsApp number has not been added to config.js yet, so WhatsApp could not open. " +
            "Copy your RSVP details below and send them to the organizer instead.";
        }
        showCopyFallback(message);
        return;
      }

      var url = "https://wa.me/" + number + "?text=" + encodeURIComponent(message);
      if (submitBtn) {
        submitBtn.disabled = true;
        submitLabel.textContent = "Opening WhatsApp…";
      }
      window.open(url, "_blank", "noopener");
      if (status) {
        status.className = "form__status is-success";
        status.textContent = "WhatsApp is opening with your RSVP — press send there to confirm.";
      }
      setTimeout(function () {
        if (submitBtn) submitBtn.disabled = false;
        submitLabel.textContent = "Confirm Attendance";
      }, 1600);
    });

    if (note && !((CONFIG.organizer && CONFIG.organizer.whatsappNumber) || "").trim()) {
      note.textContent =
        "Your RSVP is prepared as a WhatsApp message. The organizer's number has not been added to config.js yet, " +
        "so the details are shown for you to copy and send.";
    }
  }

  /* ----------------------------------------------------------------- music */
  function initMusic() {
    var src = CONFIG.assets && CONFIG.assets.music;
    if (!src) return;

    var audio = new Audio(src);
    audio.loop = true;
    audio.volume = 0.45;

    var btn = document.createElement("button");
    btn.type = "button";
    btn.className = "music-toggle";
    btn.setAttribute("aria-label", "Toggle background music");
    btn.innerHTML = '<span class="music-toggle__icon" aria-hidden="true">&#9835;</span><span class="music-toggle__text">Music</span>';
    btn.hidden = true;
    document.body.appendChild(btn);

    var ready = false;
    audio.addEventListener("canplaythrough", function () {
      ready = true;
      btn.hidden = false;
    }, { once: true });
    audio.addEventListener("error", function () { btn.remove(); }, { once: true });

    var playing = false;
    btn.addEventListener("click", function () {
      if (!ready) return;
      if (playing) {
        audio.pause();
        playing = false;
        btn.classList.remove("is-playing");
        btn.setAttribute("aria-label", "Play background music");
      } else {
        audio.play().then(function () {
          playing = true;
          btn.classList.add("is-playing");
          btn.setAttribute("aria-label", "Pause background music");
        }).catch(function () { /* autoplay blocked */ });
      }
    });

    window.addEventListener("akash:entrance-opened", function () {
      if (!ready) return;
      audio.play().then(function () {
        playing = true;
        btn.classList.add("is-playing");
        btn.setAttribute("aria-label", "Pause background music");
      }).catch(function () { /* autoplay blocked until user gesture */ });
    });
  }

  /* ------------------------------------------------------------------ init */
  function init() {
    applyConfig();
    initCurtain();
    initScratch();
    initCountdown();
    initNav();
    initReveal();
    initRsvp();
    initMusic();

    var year = $("#year");
    if (year && CONFIG.date) year.textContent = String(CONFIG.date).slice(0, 4);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
