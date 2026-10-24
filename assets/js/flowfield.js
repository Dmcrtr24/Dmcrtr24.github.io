/* =========================================================
   Flow Field — генеративный WebGL-фон для GARFIELD CODER
   ---------------------------------------------------------
   Идея: адвекция вдоль градиента шума. Шесть коротких шагов
   по перпендикуляру к конечно-разностному градиенту поля —
   так рисуются линии тока, а не само поле.
   Палитра: #0F0400 / #E05710 / #FFDB99.
   Без библиотек: один fullscreen-квад + fbm.
   ========================================================= */
(function () {
  "use strict";

  var cfg = window.FLOW_FIELD || {};
  var opts = {
    color: cfg.color || "#e05710",
    highlight: cfg.highlight || "#ffdb99",
    speed: typeof cfg.speed === "number" ? cfg.speed : 1,
    scale: typeof cfg.scale === "number" ? cfg.scale : 2.1,
    opacity: typeof cfg.opacity === "number" ? cfg.opacity : 1,
    mouseInteractive: cfg.mouseInteractive !== false,
    maxPixels: cfg.maxPixels || 2100000
  };

  var canvas = document.getElementById("flow-canvas");
  var root = document.documentElement;

  function fallback() {
    root.classList.add("no-webgl");
    root.classList.add("is-ready");
    if (canvas) canvas.style.display = "none";
  }

  if (!canvas) return;

  var contextAttrs = {
    alpha: false,
    antialias: false,
    depth: false,
    stencil: false,
    premultipliedAlpha: false,
    preserveDrawingBuffer: false,
    powerPreference: "high-performance"
  };

  var gl = null;
  try {
    gl = canvas.getContext("webgl", contextAttrs) || canvas.getContext("experimental-webgl", contextAttrs);
  } catch (err) {
    gl = null;
  }

  if (!gl) {
    fallback();
    return;
  }

  function hexToRgb(hex) {
    var h = String(hex).replace("#", "");
    if (h.length === 3) h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
    var n = parseInt(h, 16);
    return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
  }

  var VERT = `
attribute vec2 aPos;
void main() {
  gl_Position = vec4(aPos, 0.0, 1.0);
}`;

  var FRAG = `
precision highp float;

uniform vec2 uRes;
uniform float uTime;
uniform vec2 uMouse;
uniform float uIntensity;
uniform float uScale;
uniform float uOpacity;
uniform vec3 uColor;
uniform vec3 uHighlight;

const mat2 ROT = mat2(1.6, 1.2, -1.2, 1.6);

float hash21(vec2 p) {
  p = fract(p * vec2(123.34, 345.45));
  p += dot(p, p + 34.345);
  return fract(p.x * p.y);
}

float vnoise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  float a = hash21(i);
  float b = hash21(i + vec2(1.0, 0.0));
  float c = hash21(i + vec2(0.0, 1.0));
  float d = hash21(i + vec2(1.0, 1.0));
  return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
}

float fbm(vec2 p) {
  float v = 0.0;
  float a = 0.5;
  for (int i = 0; i < 6; i++) {
    v += a * vnoise(p);
    p = ROT * p;
    a *= 0.5;
  }
  return v;
}

void main() {
  float t = uTime;
  vec2 uv = (gl_FragCoord.xy - 0.5 * uRes) / uRes.y;
  vec2 p = uv * uScale;

  /* медленный дрейф всего поля */
  vec2 drift = vec2(t * 0.030, -t * 0.022);

  /* двухуровневый domain warp */
  float w1 = fbm(p * 0.85 + drift);
  float w2 = fbm(p * 0.85 + vec2(5.2, 1.3) - drift * 1.4);
  vec2 wp = p + (vec2(w1, w2) - 0.5) * 1.15;

  /* поле и конечно-разностный градиент */
  float n = fbm(wp);
  float e = 0.065;
  float nx = fbm(wp + vec2(e, 0.0));
  float ny = fbm(wp + vec2(0.0, e));
  vec2 g = vec2(nx - n, ny - n) / e;

  /* перпендикуляр к градиенту = касательная к линии тока */
  vec2 flow = normalize(vec2(-g.y, g.x) + vec2(0.0001));

  /* шесть шагов адвекции: вытягиваем тонкие нити вдоль потока */
  float strands = 0.0;
  for (int i = 0; i < 6; i++) {
    vec2 q = wp + flow * (float(i) - 2.5) * 0.050;
    float m = fbm(q + vec2(0.0, t * 0.020));
    float band = abs(fract(m * 2.9 + t * 0.040) - 0.5);
    strands += 1.0 - smoothstep(0.004, 0.038, band);
  }
  strands *= 0.1667;

  /* свет живёт пятнами, а не по всему экрану */
  float presence = smoothstep(0.37, 0.78, fbm(wp * 0.46 + vec2(2.7, 1.1) + drift * 0.5));
  float presence2 = smoothstep(0.44, 0.84, fbm(wp * 0.34 - vec2(4.1, 2.3) + drift * 0.32));
  presence = max(presence, presence2 * 0.85);
  strands *= 0.19 + 0.81 * presence;

  /* тёмная тёплая подложка: почти чёрный #0F0400 */
  vec3 col = vec3(0.0588, 0.0157, 0.0);
  float smoke = fbm(wp * 0.72 - drift * 0.6);
  col *= 0.82 + 0.46 * smoke;
  col += uColor * pow(smoke, 2.4) * 0.075;
  col += uColor * pow(smoothstep(0.42, 0.95, fbm(wp * 0.34 + drift * 0.30)), 2.0) * 0.11;

  /* сами нити: тёплое тело + горячее ядро */
  col += uColor * strands * 0.72;
  col += mix(uColor, uHighlight, 0.72) * pow(strands, 2.4) * 1.35;

  /* широкий ореол по одной изолинии — глубина */
  float halo = 1.0 - smoothstep(0.0, 0.34, abs(fract(n * 2.0 + t * 0.03) - 0.5));
  col += uColor * halo * 0.030 * (0.35 + 0.65 * presence);

  /* курсор: мягкое пятно и локальное усиление свечения */
  vec2 m = vec2((uMouse.x - 0.5) * (uRes.x / uRes.y), 0.5 - uMouse.y);
  float md = length(uv - m);
  float spot = exp(-md * md * 3.2);
  col += mix(uColor, uHighlight, 0.4) * spot * (0.035 + 0.16 * uIntensity);
  col += uHighlight * pow(strands, 2.0) * spot * 0.55 * uIntensity;

  /* виньетка, зерно, гамма */
  float vig = smoothstep(0.22, 1.22, length(uv * vec2(0.82, 1.0)));
  col *= 1.0 - vig * 0.62;

  float grain = hash21(gl_FragCoord.xy + fract(t) * 173.0);
  col += (grain - 0.5) * 0.020;

  col = pow(max(col, 0.0), vec3(0.95));
  col *= uOpacity;

  gl_FragColor = vec4(col, 1.0);
}`;

  function compile(type, source) {
    var shader = gl.createShader(type);
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
      console.error("[flowfield] shader:", gl.getShaderInfoLog(shader));
      gl.deleteShader(shader);
      return null;
    }
    return shader;
  }

  var vs = compile(gl.VERTEX_SHADER, VERT);
  var fs = compile(gl.FRAGMENT_SHADER, FRAG);

  if (!vs || !fs) {
    fallback();
    return;
  }

  var program = gl.createProgram();
  gl.attachShader(program, vs);
  gl.attachShader(program, fs);
  gl.linkProgram(program);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    console.error("[flowfield] link:", gl.getProgramInfoLog(program));
    fallback();
    return;
  }
  gl.useProgram(program);

  var buffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);

  var aPos = gl.getAttribLocation(program, "aPos");
  gl.enableVertexAttribArray(aPos);
  gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0);

  var uniforms = {};
  ["uRes", "uTime", "uMouse", "uIntensity", "uScale", "uOpacity", "uColor", "uHighlight"].forEach(
    function (name) {
      uniforms[name] = gl.getUniformLocation(program, name);
    }
  );

  var color = hexToRgb(opts.color);
  var highlight = hexToRgb(opts.highlight);

  gl.uniform3f(uniforms.uColor, color[0], color[1], color[2]);
  gl.uniform3f(uniforms.uHighlight, highlight[0], highlight[1], highlight[2]);
  gl.uniform1f(uniforms.uScale, opts.scale);
  gl.uniform1f(uniforms.uOpacity, opts.opacity);
  gl.uniform1f(uniforms.uIntensity, 0);
  gl.uniform2f(uniforms.uMouse, 0.5, 0.5);

  var reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var mouse = { x: 0.5, y: 0.5 };
  var targetIntensity = 0;
  var intensity = 0;
  var raf = 0;
  var ready = false;
  var running = false;
  var startedAt = performance.now();
  var idleTimer = 0;

  function drawFrame() {
    var t = reduced ? 11.5 : 8.4 + (performance.now() - startedAt) * 0.001 * opts.speed;
    intensity += (targetIntensity - intensity) * 0.045;

    gl.uniform1f(uniforms.uTime, t);
    gl.uniform1f(uniforms.uIntensity, intensity);
    gl.uniform2f(uniforms.uMouse, mouse.x, mouse.y);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);

    if (!ready) {
      ready = true;
      root.classList.add("is-ready");
    }
  }

  function setSize() {
    var w = Math.max(1, window.innerWidth);
    var h = Math.max(1, window.innerHeight);
    var limit = Math.min(window.devicePixelRatio || 1, 2);
    var fit = Math.sqrt(opts.maxPixels / (w * h));
    var dpr = Math.max(0.75, Math.min(limit, fit));

    var bw = Math.round(w * dpr);
    var bh = Math.round(h * dpr);

    if (canvas.width !== bw || canvas.height !== bh) {
      canvas.width = bw;
      canvas.height = bh;
    }
    gl.viewport(0, 0, bw, bh);
    gl.uniform2f(uniforms.uRes, bw, bh);

    if (reduced) drawFrame();
  }

  function loop() {
    if (!running) return;
    raf = requestAnimationFrame(loop);
    drawFrame();
  }

  function start() {
    if (reduced || running) return;
    running = true;
    raf = requestAnimationFrame(loop);
  }

  function stop() {
    running = false;
    if (raf) cancelAnimationFrame(raf);
    raf = 0;
  }

  function markMove(x, y) {
    mouse.x = x / Math.max(1, window.innerWidth);
    mouse.y = y / Math.max(1, window.innerHeight);
    targetIntensity = 1;
    clearTimeout(idleTimer);
    idleTimer = setTimeout(function () {
      targetIntensity = 0;
    }, 1500);
  }

  if (opts.mouseInteractive) {
    window.addEventListener("pointermove", function (e) { markMove(e.clientX, e.clientY); }, { passive: true });
    window.addEventListener("pointerdown", function (e) { markMove(e.clientX, e.clientY); }, { passive: true });
    document.addEventListener("mouseleave", function () { targetIntensity = 0; });
  }

  window.addEventListener("resize", setSize);

  document.addEventListener("visibilitychange", function () {
    if (document.hidden) stop();
    else start();
  });

  canvas.addEventListener("webglcontextlost", function (e) {
    e.preventDefault();
    stop();
    fallback();
  });

  setSize();

  if (reduced) drawFrame();
  else start();
})();
