/* =========================================================
   ASCII Title — имя, собранное из символов
   ---------------------------------------------------------
   Адаптация ASCIIText: текст рисуется на скрытом canvas,
   затем каждый кадр сэмплируется в сетку символов с волной
   и лёгким наклоном от курсора. Без Three.js — 2D canvas
   + <pre>, поэтому весит копейки.
   ========================================================= */
(function () {
  "use strict";

  var pre = document.getElementById("ascii-title");
  if (!pre) return;

  var host = pre.parentElement;
  var root = document.documentElement;

  var LINES = ["GARFIELD", "CODER"];
  var CHARSET = " .'`^\",:;Il!i~+_-?][}{1)(|/tfjrxnuvczXYUJCLQ0OZmwqpdbkhao*#MW&8%B@$";
  var REDUCE = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  var source = null;
  var cols = 0;
  var rows = 0;
  var charRatio = 0.6;
  var mouse = { x: 0, y: 0, tx: 0, ty: 0 };
  var raf = 0;
  var last = 0;
  var started = false;
  var visible = true;
  var t0 = performance.now();

  function fontStack() {
    return '"JetBrains Mono", ui-monospace, "SF Mono", Menlo, monospace';
  }

  function buildSource() {
    var F = 256;
    var family = fontStack();
    var font = "700 " + F + "px " + family;
    var cv = document.createElement("canvas");
    var ctx = cv.getContext("2d");
    ctx.font = font;

    var widths = LINES.map(function (line) {
      return ctx.measureText(line).width;
    });
    var maxW = Math.max.apply(null, widths);
    var lineH = F * 1.06;
    var pad = F * 0.12;
    var w = Math.ceil(maxW + pad * 2);
    var h = Math.ceil(lineH * LINES.length + pad * 2);

    cv.width = w;
    cv.height = h;
    ctx = cv.getContext("2d");
    ctx.font = font;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillStyle = "#fff";

    LINES.forEach(function (line, i) {
      ctx.fillText(line, w / 2, pad + lineH * (i + 0.5));
    });

    /* реальная доля ширины моноширинного символа */
    var measure = document.createElement("canvas").getContext("2d");
    measure.font = "700 100px " + family;
    charRatio = measure.measureText("M").width / 100 || 0.6;

    return { w: w, h: h, data: ctx.getImageData(0, 0, w, h).data };
  }

  function layout() {
    if (!source) return;
    var W = host.clientWidth;
    if (!W) return;

    var step = W < 620 ? 3.2 : 4.8;
    cols = Math.max(44, Math.min(210, Math.round(W / step)));
    var srcAspect = source.w / source.h;
    rows = Math.max(9, Math.round((cols * charRatio) / srcAspect));

    var fontSize = W / (cols * charRatio);
    pre.style.fontSize = fontSize.toFixed(3) + "px";
    pre.style.lineHeight = "1";
  }

  function render(t) {
    if (!source) return;

    var w = source.w;
    var h = source.h;
    var data = source.data;
    var out = new Array(rows);
    var ampX = w * 0.0022;
    var ampY = h * 0.0035;
    var mx = mouse.x;
    var my = mouse.y;
    var lastIndex = CHARSET.length - 1;

    for (var y = 0; y < rows; y++) {
      var v = (y + 0.5) / rows;
      var line = "";

      for (var x = 0; x < cols; x++) {
        var u = (x + 0.5) / cols;

        var sx =
          u * w +
          Math.sin(v * 5.6 + t * 1.2) * ampX +
          (v - 0.5) * mx * 4 +
          mx * 1.5;
        var sy =
          v * h +
          Math.sin(u * 7.2 + t * 1.0) * ampY +
          (u - 0.5) * my * 3 +
          my * 1.5;

        var ix = sx | 0;
        var iy = sy | 0;
        if (ix < 0) ix = 0;
        else if (ix >= w) ix = w - 1;
        if (iy < 0) iy = 0;
        else if (iy >= h) iy = h - 1;

        var alpha = data[(iy * w + ix) * 4 + 3] / 255;
        if (alpha < 0.045) {
          line += " ";
          continue;
        }

        var texture = 0.5 + 0.5 * Math.sin(x * 0.34 - y * 0.6 + t * 1.1);
        var density = alpha * (0.82 + 0.18 * texture);
        var index = (density * lastIndex) | 0;
        if (index < 0) index = 0;
        else if (index > lastIndex) index = lastIndex;

        line += CHARSET.charAt(index);
      }

      out[y] = line;
    }

    pre.textContent = out.join("\n");
  }

  function frame(now) {
    if (!visible) return;
    raf = requestAnimationFrame(frame);
    var cost = cols * rows;
    if (now - last < (cost > 7000 ? 42 : 32)) return;
    last = now;

    mouse.x += (mouse.tx - mouse.x) * 0.07;
    mouse.y += (mouse.ty - mouse.y) * 0.07;

    var t = REDUCE ? 0.7 : (now - t0) / 1000;
    render(t);

    pre.style.transform =
      "translate3d(" + (mouse.x * 5).toFixed(2) + "px," + (mouse.y * 3).toFixed(2) + "px,0)";
  }

  function start() {
    if (started) return;
    started = true;

    source = buildSource();
    layout();
    render(0.7);
    root.classList.add("ascii-ready");

    if (!REDUCE) {
      t0 = performance.now();
      raf = requestAnimationFrame(frame);
    }
  }

  function onResize() {
    if (!started) return;
    layout();
    render(REDUCE ? 0.7 : (performance.now() - t0) / 1000);
  }

  window.addEventListener(
    "pointermove",
    function (e) {
      mouse.tx = (e.clientX / Math.max(1, window.innerWidth) - 0.5) * 2;
      mouse.ty = (e.clientY / Math.max(1, window.innerHeight) - 0.5) * 2;
    },
    { passive: true }
  );

  window.addEventListener("resize", onResize);

  document.addEventListener("visibilitychange", function () {
    if (document.hidden) {
      visible = false;
      if (raf) cancelAnimationFrame(raf);
      raf = 0;
    } else if (started && !REDUCE) {
      visible = true;
      last = 0;
      raf = requestAnimationFrame(frame);
    }
  });

  if (document.fonts && document.fonts.load) {
    document.fonts.load('700 100px "JetBrains Mono"').then(start).catch(start);
    setTimeout(start, 1200);
  } else {
    start();
  }
})();
