// Small illustrations for the explainer: plain 2D canvas, a little fake 3D.
(function () {
  const TEAL = "#4FD1C5", AMBER = "#FFB547", GLASS = "#6FA8FF", TEXT = "#DCE2EC", MUTED = "#8A95AA", RED = "#FF6B6B", SAND = [196, 178, 140];
  const reduce = window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches;
  const TAU = 2 * Math.PI, G_ACC = 981;
  const $ = id => document.getElementById(id);

  // canvas that repaints while visible; draw(c, W, H, t, dt) in CSS pixels
  // film mode: no observers or animation loop; the film drives each figure with fig.at(t)
  window.FIGS = window.FIGS || {};
  function makeFig(canvas, draw) {
    if (window.FILM_MODE) {
      const c = canvas.getContext("2d"); let last = null, t = 0, W = canvas.width, H = canvas.height, dpr = 1;
      const paint = dt => {
        if (window.LIVE_MODE) {
          const r = canvas.getBoundingClientRect();
          if (r.width > 0 && r.height > 0) { W = r.width; H = r.height; dpr = Math.min(2, window.devicePixelRatio || 1);
            const w = Math.round(W * dpr), h = Math.round(H * dpr);
            if (canvas.width !== w || canvas.height !== h) { canvas.width = w; canvas.height = h; }
          }
        }
        c.setTransform(1, 0, 0, 1, 0, 0); c.clearRect(0, 0, canvas.width, canvas.height);
        c.setTransform(dpr, 0, 0, dpr, 0, 0); draw(c, W, H, t, dt);
      };
      const f = { redraw: () => paint(0), reset: () => { t = 0; last = null; if (f.onReset) f.onReset(); }, at: T => { const dt = last === null ? 0 : Math.max(0, Math.min(0.1, T - last)); last = T; t = window.LIVE_MODE ? Math.max(0, T) : t + dt; paint(dt); }, canvas };
      window.FIGS[canvas.id] = f; return f;
    }
    const c = canvas.getContext("2d"); let W = 0, H = 0, dpr = 1, t = 0, last = 0, visible = false, running = false;
    const paint = dt => { c.setTransform(dpr, 0, 0, dpr, 0, 0); c.clearRect(0, 0, W, H); draw(c, W, H, t, dt); };
    const resize = () => { const r = canvas.getBoundingClientRect(); dpr = Math.min(2, window.devicePixelRatio || 1); W = r.width; H = r.height;
      canvas.width = Math.max(1, Math.round(W * dpr)); canvas.height = Math.max(1, Math.round(H * dpr)); paint(0); };
    const loop = now => { if (!visible) { running = false; return; } const dt = Math.min(0.05, (now - last) / 1000); last = now; if (!reduce) t += dt; paint(reduce ? 0 : dt); requestAnimationFrame(loop); };
    new ResizeObserver(resize).observe(canvas);
    new IntersectionObserver(es => { visible = es[0].isIntersecting; if (visible && !running) { running = true; last = performance.now(); requestAnimationFrame(loop); } }).observe(canvas);
    resize();
    return { redraw: () => paint(0), reset: () => { t = 0; } };
  }
  const font = (c, px, w = 400, fam = "IBM Plex Sans, system-ui, sans-serif") => { c.font = `${w} ${px}px ${fam}`; };
  function arrowHead(c, x, y, ang, s) { c.beginPath(); c.moveTo(x + s * Math.cos(ang), y + s * Math.sin(ang)); c.lineTo(x + s * Math.cos(ang + 2.5), y + s * Math.sin(ang + 2.5)); c.lineTo(x + s * Math.cos(ang - 2.5), y + s * Math.sin(ang - 2.5)); c.closePath(); c.fill(); }
  function arrow(c, x0, y0, x1, y1, s = 6) { c.beginPath(); c.moveTo(x0, y0); c.lineTo(x1, y1); c.stroke(); arrowHead(c, x1, y1, Math.atan2(y1 - y0, x1 - x0), s); }
  // circular arrow showing a spin: counterclockwise on screen when ccw is true
  function spinMark(c, x, y, r, ccw, col, phase = 0) {
    c.strokeStyle = col; c.fillStyle = col; c.lineWidth = 2;
    const a0 = phase, a1 = phase + 4.4; c.beginPath();
    if (ccw) { c.arc(x, y, r, -a0, -a1, true); } else { c.arc(x, y, r, a0, a1, false); }
    c.stroke(); const ae = ccw ? -a1 : a1; arrowHead(c, x + r * Math.cos(ae), y + r * Math.sin(ae), ae + (ccw ? -Math.PI / 2 : Math.PI / 2), 5);
  }

  // ---------------------------------------------------------------- 1. the dip and its shadow
  function figDip() {
    const cv = $("figDip"); if (!cv) return; const sl = $("dipG"), out = $("dipGOut");
    const a = 0.6, D = 12, n = 1.333, sun = 0.22, X = 4.5; let cache = null;
    const eta = (x, G) => -G * G / (8 * Math.PI * Math.PI * G_ACC * (x * x + a * a));
    const slope = (x, G) => G * G * 2 * x / (8 * Math.PI * Math.PI * G_ACC * (x * x + a * a) ** 2);
    function land(x, G) {                                            // refract a sunray at surface point x, return where it hits the bed
      const d = [Math.sin(sun), -Math.cos(sun)], s = slope(x, G), m = Math.hypot(s, 1), N = [-s / m, 1 / m];
      const ci = -(N[0] * d[0] + N[1] * d[1]), r = 1 / n, k = 1 - r * r * (1 - ci * ci), t = r * ci - Math.sqrt(k);
      const R = [r * d[0] + t * N[0], r * d[1] + t * N[1]]; return x + (D + eta(x, G)) * R[0] / -R[1];
    }
    const fig = makeFig(cv, (c, W, H) => {
      const G = +sl.value, depth = G * G / (8 * Math.PI * Math.PI * G_ACC * a * a); out.textContent = `${G} cm²/s · dip ${(10 * depth).toFixed(1)} mm`;
      const L = 14, R = W - 14, sx = x => L + (x + X) / (2 * X) * (R - L), ys = H * 0.30, yb = H * 0.80, exag = 3 * (R - L) / (2 * X);
      const sy = x => ys - eta(x, G) * exag;
      // water body
      c.fillStyle = "rgba(60,120,160,0.20)"; c.beginPath(); c.moveTo(sx(-X), yb);
      for (let i = 0; i <= 200; i++) { const x = -X + 2 * X * i / 200; c.lineTo(sx(x), sy(x)); } c.lineTo(sx(X), yb); c.closePath(); c.fill();
      // rays
      const shift = D * Math.tan(Math.asin(Math.sin(sun) / n));
      c.lineWidth = 1;
      for (let i = 0; i <= 64; i++) {
        const x = -X - shift - 0.3 + (2 * X + 0.3) * i / 64, xb = land(x, G);
        const top = 8, xt = sx(x) - Math.tan(sun) * (sy(x) - top) * 0.35;
        c.strokeStyle = "rgba(255,228,160,0.35)"; c.beginPath(); c.moveTo(xt, top); c.lineTo(sx(x), sy(x)); c.stroke();
        c.strokeStyle = "rgba(255,228,160,0.22)"; c.beginPath(); c.moveTo(sx(x), sy(x)); c.lineTo(sx(xb), yb); c.stroke();
      }
      // bed brightness from many rays
      const NB = 220, M = 24000, x0 = -X - shift - 2, x1 = X + 2;
      if (!cache || cache.G !== G) { const h = new Float64Array(NB); for (let i = 0; i < M; i++) { const x = x0 + (x1 - x0) * (i + 0.5) / M, xb = land(x, G), b = Math.floor((xb + X) / (2 * X) * NB); if (b >= 0 && b < NB) h[b]++; } cache = { G, h }; }
      const hist = cache.h;
      const flat = M / (x1 - x0) * (2 * X) / NB; let lo = 1e9, loX = 0, hi = 0, hiX = 0;
      for (let b = 0; b < NB; b++) { const v = hist[b] / flat, x = -X + (b + 0.5) / NB * 2 * X;
        const cc = SAND.map(s => Math.round(Math.min(255, s * (0.25 + 0.75 * Math.min(v, 3.5) / 1.4))));
        c.fillStyle = `rgb(${cc[0]},${cc[1]},${cc[2]})`; c.fillRect(sx(x) - (R - L) / NB / 2 - 0.5, yb, (R - L) / NB + 1, 12);
        if (v < lo) { lo = v; loX = x; } if (v > hi) { hi = v; hiX = x; } }
      // surface line
      c.strokeStyle = GLASS; c.lineWidth = 2; c.beginPath(); for (let i = 0; i <= 300; i++) { const x = -X + 2 * X * i / 300; i ? c.lineTo(sx(x), sy(x)) : c.moveTo(sx(x), sy(x)); } c.stroke();
      c.strokeStyle = "#3A4458"; c.lineWidth = 1; c.beginPath(); c.moveTo(L, yb); c.lineTo(R, yb); c.stroke();
      // labels
      font(c, 12.5, 500); c.textAlign = "center"; c.fillStyle = TEXT;
      if (G > 5) { c.fillText("dimple", sx(0), sy(0) + 18); }
      c.fillStyle = MUTED; c.fillText("sunlight", sx(-X * 0.75), 22); c.textAlign = "left"; c.fillText("air", L + 2, ys - 8); c.fillText("water, 12 cm deep", L + 2, ys + 18);
      c.textAlign = "center";
      if (G > 15) {
        c.fillStyle = TEXT; c.fillText("shadow", sx(loX), yb + 30);
        if (hi > 1.6) { c.fillStyle = "#FFE7A8"; c.fillText("bright rim", sx(hiX), yb + 46); c.strokeStyle = "rgba(255,231,168,0.6)"; c.beginPath(); c.moveTo(sx(hiX), yb + 34); c.lineTo(sx(hiX), yb + 14); c.stroke(); }
      }
      c.fillStyle = MUTED; font(c, 11.5); c.textAlign = "right"; c.fillText("dip drawn 3× deeper, depth squeezed", R, ys - 8);
    });
    sl.addEventListener("input", fig.redraw);
  }

  // ---------------------------------------------------------------- 2. circulation: walk around a loop
  function figLoop() {
    const cv = $("figLoop"); if (!cv) return; const out = $("loopOut"), pairBtn = $("loopPair");
    const a = 0.6; let pair = false, vort = [[0, 0, 60]];
    const loop = { x: -0.5, y: 0.3, r: 1.6 }; let drag = null; window.LOOP_STATE = loop;
    const vel = (x, y) => { let u = 0, v = 0; for (const [X, Y, G] of vort) { const dx = x - X, dy = y - Y, s = dx * dx + dy * dy + a * a; u -= G / TAU * dy / s; v += G / TAU * dx / s; } return [u, v]; };
    const vorticity = (x, y) => { let w = 0; for (const [X, Y, G] of vort) { const s = (x - X) ** 2 + (y - Y) ** 2 + a * a; w += G * a * a / (Math.PI * s * s); } return w; };
    let seed = 731; const random = () => window.LIVE_MODE ? ((seed = (1664525 * seed + 1013904223) >>> 0) / 4294967296) : Math.random();
    const P = []; function seedParticles() { seed = 731; P.length = 0; for (let i = 0; i < 520; i++) P.push([random() * 14 - 7, random() * 8 - 4, random() * 3]); }
    seedParticles(); let wheel = 0, view = null, measured = 0;
    const fig = makeFig(cv, (c, W, H, t, dt) => {
      const S = W / 13, cx = W / 2, cy = H / 2, sx = x => cx + x * S, sy = y => cy - y * S; view = { S, cx, cy };
      const hw = W / 2 / S, hh = H / 2 / S;
      // streaks
      c.lineCap = "round";
      for (const p of P) {
        const [u, v] = vel(p[0], p[1]);
        if (dt) { const [u2, v2] = vel(p[0] + 0.5 * dt * u, p[1] + 0.5 * dt * v); p[0] += dt * u2; p[1] += dt * v2; p[2] -= dt; }
        if (p[2] < 0 || Math.abs(p[0]) > hw + 0.5 || Math.abs(p[1]) > hh + 0.5) { p[0] = (random() * 2 - 1) * hw; p[1] = (random() * 2 - 1) * hh; p[2] = 1 + 2 * random(); }
        const sp = Math.hypot(u, v), L = Math.min(0.35, 0.18 * sp / 3);
        c.strokeStyle = `rgba(150,190,235,${Math.min(0.55, 0.15 + sp / 12)})`; c.lineWidth = 1.4;
        c.beginPath(); c.moveTo(sx(p[0]), sy(p[1])); c.lineTo(sx(p[0] - u / (sp + 1e-9) * L), sy(p[1] - v / (sp + 1e-9) * L)); c.stroke();
      }
      for (const [X, Y, G] of vort) { c.fillStyle = G > 0 ? TEAL : AMBER; c.beginPath(); c.arc(sx(X), sy(Y), 4, 0, TAU); c.fill(); spinMark(c, sx(X), sy(Y), 13, G > 0, G > 0 ? TEAL : AMBER, t * 2); }
      // circulation around the loop
      let circ = 0; const NS = 256;
      for (let i = 0; i < NS; i++) { const th = (i + 0.5) / NS * TAU, x = loop.x + loop.r * Math.cos(th), y = loop.y + loop.r * Math.sin(th), [u, v] = vel(x, y); circ += (u * -Math.sin(th) + v * Math.cos(th)) * loop.r * TAU / NS; }
      c.strokeStyle = "#FFFFFF"; c.lineWidth = 2; c.setLineDash([7, 5]); c.lineDashOffset = -t * 20;
      c.beginPath(); c.arc(sx(loop.x), sy(loop.y), loop.r * S, 0, TAU); c.stroke(); c.setLineDash([]);
      c.fillStyle = "#FFFFFF"; c.beginPath(); c.arc(sx(loop.x + loop.r), sy(loop.y), 5, 0, TAU); c.fill();
      // paddle wheel at the loop's centre turns at half the local spin (slowed down for the eye)
      const w = vorticity(loop.x, loop.y); wheel += dt * 0.5 * w * 0.12;
      c.save(); c.translate(sx(loop.x), sy(loop.y)); c.rotate(-wheel); c.strokeStyle = TEXT; c.lineWidth = 2;
      for (let k = 0; k < 4; k++) { c.beginPath(); c.moveTo(0, 0); c.lineTo(9 * Math.cos(k * Math.PI / 2), 9 * Math.sin(k * Math.PI / 2)); c.stroke(); } c.restore();
      measured = circ;
      out.innerHTML = `circulation around the loop <b>${Math.abs(circ) < 0.05 ? "0.0" : circ.toFixed(1)}</b> cm²/s`;
      font(c, 12); c.fillStyle = MUTED; c.textAlign = "left"; c.fillText("drag the loop · drag its handle to resize", 10, H - 10);
    });
    const pos = e => { const r = cv.getBoundingClientRect();
      const sx = window.FILM_MODE && !window.LIVE_MODE ? cv.width / r.width : 1, sy = window.FILM_MODE && !window.LIVE_MODE ? cv.height / r.height : 1;
      return [((e.clientX - r.left) * sx - view.cx) / view.S, -((e.clientY - r.top) * sy - view.cy) / view.S]; };
    cv.addEventListener("pointerdown", e => { if (!view) return; const [x, y] = pos(e), d = Math.hypot(x - loop.x, y - loop.y);
      drag = Math.abs(d - loop.r) < 14 / view.S && Math.hypot(x - loop.x - loop.r, y - loop.y) < 0.6 ? "r" : d < loop.r + 12 / view.S ? [x - loop.x, y - loop.y] : null;
      if (drag) { cv.setPointerCapture(e.pointerId); e.preventDefault(); } });
    cv.addEventListener("pointermove", e => { if (!drag) return; const [x, y] = pos(e);
      if (drag === "r") loop.r = Math.max(0.25, Math.min(4.5, Math.hypot(x - loop.x, y - loop.y))); else { loop.x = x - drag[0]; loop.y = y - drag[1]; } fig.redraw(); if (fig.onChange) fig.onChange(); });
    cv.addEventListener("pointerup", () => { drag = null; });
    cv.addEventListener("pointercancel", () => { drag = null; });
    cv.addEventListener("lostpointercapture", () => { drag = null; });
    const setPair = on => { pair = !!on; pairBtn.setAttribute("aria-pressed", String(pair)); vort = pair ? [[-1.5, 0, 60], [1.5, 0, -60]] : [[0, 0, 60]]; };
    pairBtn.onclick = () => { setPair(!pair); fig.redraw(); };
    if (window.LIVE_MODE) {
      fig.onReset = () => { loop.x = -0.5; loop.y = 0.3; loop.r = 1.6; drag = null; wheel = 0; seedParticles(); setPair(false); };
      fig.setLoop = values => { Object.assign(loop, values); loop.r = Math.max(0.25, Math.min(4.5, loop.r)); fig.redraw(); };
      fig.getState = () => ({ loop: { ...loop }, pair, measured, wheel, particles: P.map(p => p.slice()) });
      fig.onReset();
    }
  }

  // ---------------------------------------------------------------- tiny 3D helpers
  function camera(yaw, pitch, S, cx, cy) {
    const cyw = Math.cos(yaw), syw = Math.sin(yaw), cp = Math.cos(pitch), sp = Math.sin(pitch);
    return (x, y, z) => { const X = x * cyw - y * syw, Yd = x * syw + y * cyw; return [cx + S * X, cy - S * (z * cp + Yd * sp), Yd * cp - z * sp]; };
  }
  const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]], cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
  const norm = a => { const m = Math.hypot(...a) || 1; return [a[0] / m, a[1] / m, a[2] / m]; };
  function frame(pts, i) { const T = norm(sub(pts[Math.min(pts.length - 1, i + 1)], pts[Math.max(0, i - 1)])); let N = cross(T, Math.abs(T[2]) < 0.9 ? [0, 0, 1] : [1, 0, 0]); N = norm(N); return [T, N, cross(T, N)]; }
  function slab(c, P, X, Y, D, opts = {}) {                    // bed, surface, and edges of a block of water
    const q = (pts, fill, stroke) => { c.beginPath(); pts.forEach((p, i) => { const s = P(...p); i ? c.lineTo(s[0], s[1]) : c.moveTo(s[0], s[1]); }); c.closePath(); if (fill) { c.fillStyle = fill; c.fill(); } if (stroke) { c.strokeStyle = stroke; c.lineWidth = 1; c.stroke(); } };
    q([[-X, -Y, -D], [X, -Y, -D], [X, Y, -D], [-X, Y, -D]], "rgba(150,132,98,0.30)", "rgba(196,178,140,0.45)");
    c.strokeStyle = "rgba(111,168,255,0.22)"; c.lineWidth = 1;
    for (const [x, y] of [[-X, -Y], [X, -Y], [X, Y], [-X, Y]]) { const a = P(x, y, -D), b = P(x, y, 0); c.beginPath(); c.moveTo(a[0], a[1]); c.lineTo(b[0], b[1]); c.stroke(); }
    return () => q([[-X, -Y, 0], [X, -Y, 0], [X, Y, 0], [-X, Y, 0]], opts.surf || "rgba(90,150,230,0.16)", "rgba(140,190,255,0.55)");
  }
  // a vortex tube along pts (world), radius r; spin markers turn about the tangent (sign G)
  function tube(c, P, S, pts, r, t, G, alpha = 1) {
    const sp = pts.map(p => P(...p)); if (sp.length < 2) return;
    c.save(); c.globalAlpha = alpha; c.lineCap = "round"; c.lineJoin = "round";
    const path = (dy = 0) => { c.beginPath(); sp.forEach((s, i) => i ? c.lineTo(s[0], s[1] + dy) : c.moveTo(s[0], s[1] + dy)); };
    c.strokeStyle = "rgba(70,120,200,0.55)"; c.lineWidth = 2 * r * S; path(); c.stroke();
    c.strokeStyle = "rgba(190,220,255,0.45)"; c.lineWidth = 0.55 * r * S; path(-0.35 * r * S); c.stroke();
    const step = Math.max(6, Math.round(pts.length / 7));
    for (let i = Math.floor(step / 2); i < pts.length - 1; i += step) {
      const [T, N, B] = frame(pts, i), p = pts[i], R = 1.35 * r, ring = [];
      for (let k = 0; k <= 32; k++) { const f = k / 32 * TAU; ring.push(P(p[0] + R * (Math.cos(f) * N[0] + Math.sin(f) * B[0]), p[1] + R * (Math.cos(f) * N[1] + Math.sin(f) * B[1]), p[2] + R * (Math.cos(f) * N[2] + Math.sin(f) * B[2]))); }
      c.strokeStyle = "rgba(230,240,255,0.35)"; c.lineWidth = 1; c.beginPath(); ring.forEach((s, k) => k ? c.lineTo(s[0], s[1]) : c.moveTo(s[0], s[1])); c.stroke();
      for (let m = 0; m < 2; m++) {
        const f = Math.sign(G) * t * 2.2 + m * Math.PI + i, f2 = f + Math.sign(G) * 0.3;
        const at = ff => P(p[0] + R * (Math.cos(ff) * N[0] + Math.sin(ff) * B[0]), p[1] + R * (Math.cos(ff) * N[1] + Math.sin(ff) * B[1]), p[2] + R * (Math.cos(ff) * N[2] + Math.sin(ff) * B[2]));
        const s1 = at(f), s2 = at(f2); c.fillStyle = "rgba(240,246,255,0.9)"; arrowHead(c, s2[0], s2[1], Math.atan2(s2[1] - s1[1], s2[0] - s1[0]), 4.5);
      }
    }
    c.restore();
  }
  // where a tube meets the surface: a dimple with a spin arrow (up = counterclockwise from above)
  function dimple(c, P, x, y, up, t, alpha = 1) {
    const col = up ? TEAL : AMBER, R = 0.55, pts = [];
    for (let k = 0; k <= 40; k++) { const f = k / 40 * TAU; pts.push(P(x + R * Math.cos(f), y + R * Math.sin(f), 0)); }
    c.save(); c.globalAlpha = alpha; c.fillStyle = "rgba(10,14,22,0.45)"; c.strokeStyle = col; c.lineWidth = 2;
    c.beginPath(); pts.forEach((s, k) => k ? c.lineTo(s[0], s[1]) : c.moveTo(s[0], s[1])); c.fill(); c.stroke();
    const f = (up ? 1 : -1) * t * 2.2, s = P(x + R * Math.cos(f), y + R * Math.sin(f), 0), s2 = P(x + R * Math.cos(f + (up ? 0.3 : -0.3)), y + R * Math.sin(f + (up ? 0.3 : -0.3)), 0);
    c.fillStyle = col; arrowHead(c, s2[0], s2[1], Math.atan2(s2[1] - s[1], s2[0] - s[0]), 6); c.restore();
  }
  function topInset(c, x0, y0, w, h, dots, t, label) {         // the surface seen from above
    c.fillStyle = "rgba(10,14,22,0.75)"; c.strokeStyle = "#2C3649"; c.lineWidth = 1; c.fillRect(x0, y0, w, h); c.strokeRect(x0, y0, w, h);
    font(c, 11, 500); c.fillStyle = MUTED; c.textAlign = "left"; c.fillText("from above", x0 + 7, y0 + 15);
    for (const [u, v, up] of dots) { const X = x0 + w / 2 + u * w / 2, Y = y0 + h / 2 + 6 - v * h / 2; c.fillStyle = up ? TEAL : AMBER; c.beginPath(); c.arc(X, Y, 3.5, 0, TAU); c.fill(); spinMark(c, X, Y, 11, up, up ? TEAL : AMBER, t * 2.2); }
    if (label) { c.fillStyle = MUTED; c.textAlign = "center"; c.fillText(label, x0 + w / 2, y0 + h / 2 + 10); }
  }

  // ---------------------------------------------------------------- 3. what a vortex line can do
  function figLines() {
    const cv = $("figLines"); if (!cv) return; const btns = [...document.querySelectorAll("[data-line]")], cap = $("linesCap");
    let mode = "upright", yaw = -0.55, dragX = null, userYaw = false;
    const D = 3, X = 3.4, Y = 2.2, r = 0.2;
    const CAPS = {
      upright: "A whirlpool standing on the riverbed. Its circulation is the same at every depth: slide the loop and it doesn't change. One end, one dimple.",
      arch: "An arch with both feet on the surface. Going down one leg and up the other, the same spin looks counterclockwise from above at one foot and clockwise at the other: two dimples, opposite spins.",
      ring: "A closed ring, like a smoke ring. It has no ends, so it never touches the surface and makes no dimple.",
      end: "Suppose a vortex line just stopped in the water. The loop keeps its circulation as it slides along the tube, and still has it just past the end. But there the water isn't spinning, and shrinking the loop to a point gives zero. Contradiction: vortex lines can't end in the water.",
    };
    const curves = {
      upright: () => { const p = []; for (let i = 0; i <= 60; i++) { const z = -D + D * i / 60; p.push([0.35 * Math.sin(1.4 * z), 0.25 * Math.cos(1.1 * z) - 0.25, z]); } return p; },
      arch: () => { const p = []; for (let i = 0; i <= 80; i++) { const s = Math.PI * i / 80; p.push([-1.5 * Math.cos(s), 0.2 * Math.sin(2 * s), -2.0 * Math.sin(s)]); } return p; },
      ring: () => { const p = []; for (let i = 0; i <= 90; i++) { const s = TAU * i / 90; p.push([1.3 * Math.cos(s), 1.3 * Math.sin(s) * 0.55, -1.6 + 1.3 * Math.sin(s) * 0.62]); } return p; },
      end: () => { const p = []; for (let i = 0; i <= 50; i++) { const z = -1.5 * i / 50; p.push([0.15 * Math.sin(2 * z), 0, z]); } return p; },
    };
    const fig = makeFig(cv, (c, W, H, t) => {
      if (!userYaw && !reduce) yaw = -0.55 + 0.35 * Math.sin(t * 0.25);
      const S = Math.min(W / (2 * X + 1.9), H / 5.2), P = camera(yaw, 0.42, S, W * (W < 560 ? 0.5 : 0.44), H * (W < 560 ? 0.42 : 0.34));
      const pts = curves[mode](), surf = slab(c, P, X, Y, D);
      // sliding loop
      const cyc = 8, u = (t % cyc) / cyc; let li, shrink = 1, gam = "60 cm²/s", bad = false, beyond = 0;
      if (mode === "end") { if (u < 0.45) li = Math.round(u / 0.45 * (pts.length - 1)); else { li = pts.length - 1; beyond = Math.min(1, (u - 0.45) / 0.2) * 0.45; if (u > 0.68) { shrink = Math.max(0, 1 - (u - 0.68) / 0.22); gam = shrink < 0.05 ? "0 ?!" : "60 cm²/s"; bad = shrink < 0.05; } } }
      else li = Math.round((0.1 + 0.8 * (0.5 - 0.5 * Math.cos(u * TAU))) * (pts.length - 1));
      tube(c, P, S, pts, r, t, 1);
      if (mode === "end") { const e = P(...pts[pts.length - 1]); c.fillStyle = "rgba(255,107,107,0.9)"; c.beginPath(); c.arc(e[0], e[1], 5, 0, TAU); c.fill(); font(c, 15, 600); c.fillText("?", e[0] + 9, e[1] + 5); }
      // loop around the tube
      { const i = Math.min(pts.length - 1, li), [T, N, B] = frame(pts, i), p0 = pts[i], p = [p0[0] + T[0] * beyond, p0[1] + T[1] * beyond, p0[2] + T[2] * beyond], R = 0.55 * shrink, ring = [];
        for (let k = 0; k <= 40; k++) { const f = k / 40 * TAU; ring.push(P(p[0] + R * (Math.cos(f) * N[0] + Math.sin(f) * B[0]), p[1] + R * (Math.cos(f) * N[1] + Math.sin(f) * B[1]), p[2] + R * (Math.cos(f) * N[2] + Math.sin(f) * B[2]))); }
        c.strokeStyle = bad ? RED : "#FFFFFF"; c.lineWidth = 2.2; c.beginPath(); ring.forEach((s, k) => k ? c.lineTo(s[0], s[1]) : c.moveTo(s[0], s[1])); c.stroke();
        const lab = P(p[0] + 0.75, p[1], p[2]); font(c, 13, 600, "IBM Plex Mono, monospace"); c.fillStyle = bad ? RED : "#FFFFFF"; c.textAlign = "left"; c.fillText("Γ = " + gam, lab[0] + 4, lab[1] + 4); }
      surf();
      const dots = [];
      if (mode === "upright") { dimple(c, P, pts[60][0], pts[60][1], true, t); dots.push([0, 0, true]); const b = P(...pts[0]); font(c, 12); c.fillStyle = MUTED; c.textAlign = "left"; c.fillText("ends on the bed", b[0] + 12, b[1] + 4); }
      if (mode === "arch") { dimple(c, P, pts[0][0], pts[0][1], false, t); dimple(c, P, pts[80][0], pts[80][1], true, t); dots.push([-0.45, 0, false], [0.45, 0, true]); }
      if (mode === "end") { dimple(c, P, pts[0][0], pts[0][1], false, t); dots.push([0, 0, false]); }
      font(c, 12); c.fillStyle = MUTED; c.textAlign = "left"; const sl = P(X, -Y, 0); c.fillText("surface", sl[0] + 6, sl[1] + 4); const bl = P(X, -Y, -D); c.fillText("riverbed", bl[0] + 6, bl[1] + 4);
      const iw = Math.min(150, W * 0.28); topInset(c, W - iw - 10, 10, iw, iw * 0.72, dots, t, dots.length ? "" : "no dimples");
    });
    const set = m => { mode = m; btns.forEach(b => b.setAttribute("aria-pressed", String(b.dataset.line === m))); cap.textContent = CAPS[m]; fig.reset(); fig.redraw(); };
    if (window.LIVE_MODE) fig.onReset = () => { yaw = -0.55; userYaw = false; dragX = null; };
    btns.forEach(b => b.onclick = () => set(b.dataset.line)); set(window.LIVE_MODE ? "ring" : "upright");
    cv.addEventListener("pointerdown", e => { dragX = [e.clientX, yaw]; userYaw = true; cv.setPointerCapture(e.pointerId); });
    cv.addEventListener("pointermove", e => { if (dragX) { yaw = dragX[1] + (e.clientX - dragX[0]) * 0.01; fig.redraw(); } });
    cv.addEventListener("pointerup", () => { dragX = null; });
    cv.addEventListener("pointercancel", () => { dragX = null; });
    cv.addEventListener("lostpointercapture", () => { dragX = null; });
  }

  // ---------------------------------------------------------------- 4. how the river makes them
  function figRiver() {
    const cv = $("figRiver"); if (!cv) return;
    const X = 6, Y = 2.2, D = 3, zb = -D + 0.12, w = 1.15, cyc = 12;
    const hairpin = (xh, zh, Lleg) => { const p = []; for (let i = 0; i <= 90; i++) { const s = -1 + 2 * i / 90, a = Math.abs(s);
      p.push([xh - Lleg * a * a, w * Math.sin(Math.PI * s / 2), zb + (zh - zb) * Math.pow(Math.cos(Math.PI * s / 2), 0.8)]); } return p; };
    makeFig(cv, (c, W, H, t) => {
      const S = Math.min(W / (2 * X + 1.6), H / 5.6), P = camera(0.42, 0.5, S, W * 0.5, H * 0.32), surf = slab(c, P, X, Y, D, { surf: "rgba(90,150,230,0.13)" });
      // current profile on the near face: slow at the bed, fast at the top
      c.strokeStyle = "rgba(220,226,236,0.75)"; c.fillStyle = "rgba(220,226,236,0.75)"; c.lineWidth = 1.5;
      for (let k = 0; k < 7; k++) { const z = -D + 0.18 + k * (D - 0.35) / 6, len = 1.9 * Math.log(1 + (z + D) * 7) / Math.log(1 + D * 7), a = P(-X + 0.3, -Y, z), b = P(-X + 0.3 + len, -Y, z); arrow(c, a[0], a[1], b[0], b[1], 5); }
      { const a = P(-X + 0.3, -Y, -D), b = P(-X + 0.3, -Y, 0); c.beginPath(); c.moveTo(a[0], a[1]); c.lineTo(b[0], b[1]); c.stroke(); }
      // paddle wheel on the bed turns: that shear is spin
      { const cx = -X + 3.1, cz = -D + 0.45, ang = -t * 1.6, R = 0.33; c.strokeStyle = TEAL; c.lineWidth = 2;
        for (let k = 0; k < 4; k++) { const f = ang + k * Math.PI / 2, a = P(cx, -Y, cz), b = P(cx + R * Math.cos(f), -Y, cz + R * Math.sin(f)); c.beginPath(); c.moveTo(a[0], a[1]); c.lineTo(b[0], b[1]); c.stroke(); }
        c.lineWidth = 1.2; c.beginPath(); for (let k = 0; k <= 32; k++) { const f = k / 32 * TAU, q = P(cx + R * Math.cos(f), -Y, cz + R * Math.sin(f)); k ? c.lineTo(q[0], q[1]) : c.moveTo(q[0], q[1]); } c.stroke();
        const lp = P(cx, -Y, cz - R); font(c, 12); c.fillStyle = TEAL; c.textAlign = "center"; c.fillText("a paddle wheel on the bed turns", lp[0], lp[1] + 18); }
      // the hairpin: born at the bed, lifted and carried downstream, cut by the surface
      const u = (t % cyc), rise = Math.min(1, u / 5.5), xh = -1.6 + 3.4 * rise + Math.max(0, u - 5.5) * 0.45, zh = zb + (0 - zb) * rise + Math.max(0, u - 5.5) * 0.45, Lleg = 2.6;
      const fade = u > 10.5 ? Math.max(0, 1 - (u - 10.5) / 1.3) : Math.min(1, u / 0.6);
      let pts = hairpin(xh, zh, Lleg);
      if (zh <= 0) tube(c, P, S, pts, 0.14, t, 1, fade);
      else { const a = pts.filter((p, i) => i < 45 && p[2] <= 0), b = pts.filter((p, i) => i > 45 && p[2] <= 0); tube(c, P, S, a, 0.14, t, 1, fade); tube(c, P, S, b, 0.14, t, 1, fade); }
      // boil: the upwelling spreads at the surface as a smooth patch
      if (u > 3.8 && u < 10.5) { const g = Math.min(1, (u - 3.8) / 2), R = 0.6 + 1.1 * g, pts2 = []; for (let k = 0; k <= 40; k++) { const f = k / 40 * TAU; pts2.push(P(xh + R * Math.cos(f), R * 0.8 * Math.sin(f), 0)); }
        c.fillStyle = `rgba(200,225,255,${0.16 * fade})`; c.beginPath(); pts2.forEach((s, k) => k ? c.lineTo(s[0], s[1]) : c.moveTo(s[0], s[1])); c.fill(); }
      surf();
      if (zh > 0) { const a = pts.filter((p, i) => i < 45 && p[2] <= 0), b = pts.filter((p, i) => i > 45 && p[2] <= 0);
        const pa = a[a.length - 1], pb = b[0]; if (pa) dimple(c, P, pa[0], pa[1], true, t, fade); if (pb) dimple(c, P, pb[0], pb[1], false, t, fade);
        if (u > 6 && u < 10.5) { const l = P(xh + 0.3, Y * 0.2, 0.2); font(c, 12, 500); c.fillStyle = TEXT; c.textAlign = "left"; c.fillText("two dimples, opposite spins", l[0] + 14, l[1] - 16); } }
      else if (u > 1 && u < 5.5) { const l = P(xh, 0, zh); font(c, 12, 500); c.fillStyle = TEXT; c.textAlign = "left"; c.fillText("an arch lifts off the bed", l[0] + 14, l[1] - 8); }
      if (u > 4 && u < 7) { const l = P(xh - 1.2, -Y + 0.2, 0); font(c, 12); c.fillStyle = MUTED; c.textAlign = "right"; c.fillText("boil", l[0] - 4, l[1] + 16); }
      const fl = P(-X + 0.3, -Y, 0.05); font(c, 12); c.fillStyle = MUTED; c.textAlign = "left"; c.fillText("current", fl[0], fl[1] - 6);
    });
  }

  // ---------------------------------------------------------------- 5. stretching in 3D, none in 2D
  function figStretch() {
    const cv = $("figStretch"); if (!cv) return;
    let th3 = 0, th2 = 0;
    makeFig(cv, (c, W, H, t, dt) => {
      const f = 1 + 2 * (0.5 - 0.5 * Math.cos(TAU * t / 7)), stacked = W < 560, pw = stacked ? W : W / 2, ph = stacked ? H / 2 : H;
      // Analytic phase makes seeking/restarting independent of previous frames.
      if (window.LIVE_MODE) { th3 = 2.2 * (2 * t - 7 / TAU * Math.sin(TAU * t / 7)); th2 = 2.2 * t; }
      else { th3 += dt * 2.2 * f; th2 += dt * 2.2; }
      // left: a vortex tube stretched along its length
      { const ox = pw / 2, oy = ph * 0.52, L0 = pw * 0.13, r0 = ph * 0.16, L = L0 * f, r = r0 / Math.sqrt(f);
        c.fillStyle = "rgba(70,120,200,0.45)"; c.strokeStyle = "rgba(190,220,255,0.7)"; c.lineWidth = 1.5;
        c.beginPath(); c.moveTo(ox - L, oy - r); c.lineTo(ox + L, oy - r); c.ellipse(ox + L, oy, r * 0.35, r, 0, -Math.PI / 2, Math.PI / 2); c.lineTo(ox - L, oy + r); c.ellipse(ox - L, oy, r * 0.35, r, 0, Math.PI / 2, 3 * Math.PI / 2); c.closePath(); c.fill(); c.stroke();
        c.beginPath(); c.ellipse(ox + L, oy, r * 0.35, r, 0, 0, TAU); c.stroke();
        for (let k = 0; k < 7; k++) { const ph0 = th3 + k * TAU / 7, yy = Math.sin(ph0), front = Math.cos(ph0) > 0; if (!front) continue;
          c.strokeStyle = "rgba(240,246,255,0.8)"; c.beginPath(); c.moveTo(ox - L, oy + r * yy); c.lineTo(ox + L, oy + r * yy); c.stroke(); }
        c.strokeStyle = MUTED; c.fillStyle = MUTED; c.lineWidth = 1.5;
        arrow(c, ox + L + 12, oy, ox + L + 34, oy); arrow(c, ox - L - 12, oy, ox - L - 34, oy);
        arrow(c, ox, oy - r - 30, ox, oy - r - 10); arrow(c, ox, oy + r + 30, ox, oy + r + 10);
        font(c, 14, 600, "STIX Two Text, serif"); c.fillStyle = TEXT; c.textAlign = "center"; c.fillText("3D: stretched", ox, 22);
        font(c, 12.5, 500, "IBM Plex Mono, monospace"); c.fillStyle = f > 1.5 ? RED : TEXT; c.fillText(`length ×${f.toFixed(1)}   spin ×${f.toFixed(1)}`, ox, ph - 14); }
      // right: a patch of spin in a flat flow is only reshaped
      { const ox = stacked ? pw / 2 : pw + pw / 2, oy = stacked ? ph + ph * 0.52 : ph * 0.52, A = Math.min(pw, ph) * 0.2, ax = A * Math.sqrt(f), ay = A / Math.sqrt(f), rot = 0.5;
        c.save(); c.translate(ox, oy); c.rotate(-rot); c.fillStyle = "rgba(79,209,197,0.30)"; c.strokeStyle = TEAL; c.lineWidth = 1.5; c.beginPath(); c.ellipse(0, 0, ax, ay, 0, 0, TAU); c.fill(); c.stroke(); c.restore();
        c.save(); c.translate(ox, oy); c.rotate(-th2); c.strokeStyle = TEXT; c.lineWidth = 2; for (let k = 0; k < 4; k++) { c.beginPath(); c.moveTo(0, 0); c.lineTo(11 * Math.cos(k * Math.PI / 2), 11 * Math.sin(k * Math.PI / 2)); c.stroke(); } c.restore();
        font(c, 14, 600, "STIX Two Text, serif"); c.fillStyle = TEXT; c.textAlign = "center"; c.fillText("2D: only reshaped", ox, oy - ph * 0.52 + 22);
        font(c, 12.5, 500, "IBM Plex Mono, monospace"); c.fillText(`area ×1.0   spin ×1.0`, ox, oy - ph * 0.52 + ph - 14); }
      c.strokeStyle = "#1F2736"; c.lineWidth = 1; c.beginPath(); if (stacked) { c.moveTo(12, ph); c.lineTo(W - 12, ph); } else { c.moveTo(pw, 12); c.lineTo(pw, H - 12); } c.stroke();
    });
  }

  // ---------------------------------------------------------------- 6. how slowly friction fades a dimple
  function figFade() {
    const cv = $("figFade"); if (!cv) return; const nu = 0.01;
    makeFig(cv, (c, W, H) => {
      const L = 48, R = W - 14, T = 14, B = H - 34, tmax = 300;
      const sx = s => L + s / tmax * (R - L), sy = f => B - f * (B - T);
      c.strokeStyle = "#2C3649"; c.lineWidth = 1; font(c, 11.5); c.fillStyle = MUTED;
      for (let s = 0; s <= tmax; s += 60) { c.beginPath(); c.moveTo(sx(s), T); c.lineTo(sx(s), B); c.stroke(); c.textAlign = "center"; c.fillText(s === 0 ? "0" : s / 60 + " min", sx(s), B + 16); }
      for (let f = 0; f <= 1.001; f += 0.25) { c.beginPath(); c.moveTo(L, sy(f)); c.lineTo(R, sy(f)); c.stroke(); c.textAlign = "right"; c.fillText(Math.round(f * 100) + "%", L - 6, sy(f) + 4); }
      for (const [a0, col, lab] of [[0.6, AMBER, "6 mm core"], [1.0, TEAL, "1 cm core"], [2.0, GLASS, "2 cm core"]]) {
        const depth = s => a0 * a0 / (a0 * a0 + 4 * nu * s);
        c.save(); c.beginPath(); c.rect(L, T - 2, R - L, B - T + 4); c.clip();
        c.strokeStyle = col; c.lineWidth = 2; c.beginPath();
        for (let i = 0; i <= 240; i++) { const s = tmax * i / 240; i ? c.lineTo(sx(s), sy(depth(s))) : c.moveTo(sx(s), sy(depth(s))); }
        c.stroke(); c.restore();
        const sq = 3 * a0 * a0 / (4 * nu); c.fillStyle = col; if (sq <= tmax) { c.beginPath(); c.arc(sx(sq), sy(0.25), 3.5, 0, TAU); c.fill(); }
        const k = [0.6, 1.0, 2.0].indexOf(a0), ly = T + 36 + 18 * k; c.strokeStyle = col; c.beginPath(); c.moveTo(R - 150, ly - 4); c.lineTo(R - 126, ly - 4); c.stroke();
        c.textAlign = "left"; font(c, 12, 500); c.fillText(lab, R - 118, ly);
      }
      c.fillStyle = MUTED; c.textAlign = "right"; font(c, 11.5); c.fillText("dimple depth (smooth Lamb–Oseen core), relative to the start · dots: a quarter left", R - 6, T + 14);
    });
  }


  // ---------------------------------------------------------------- 7. Hamilton's rule: one recipe, two landscapes
  function figHam() {
    const cv = $("figHam"); if (!cv) return; const btns = [...document.querySelectorAll("[data-ham]")], cap = $("hamCap"), out = $("hamOut");
    const a2 = 0.04, V = 4 * Math.PI * 2 / (2 * Math.PI * (4 + a2));          // pair of whirlpools, Γ = 4π, 2 apart
    const MODES = {
      pend: { H: (q, p) => p * p / 2 - Math.cos(q), f: (q, p) => [p, -Math.sin(q)], lab: ["q  (angle)", "p  (momentum)"], parts: ["∂H/∂p", "−∂H/∂q"], lv: [-0.85, 3.6, 0.3], sep: 1,
        blob: [-2.3, 0.75, 0.42], hiker: [0.0, 1.35],
        cap: "A pendulum. Each moment of its life is a point: angle q across, momentum p up. The landscape is its energy, H = p²/2 − cos q. Every dot walks along a contour; the pink patch of starting states is sheared around the swinging and tumbling orbits, but its area never changes. The bright contour separates swinging from tumbling right over the top." },
      river: { H: (x, y) => -Math.log(x * x + (y - 1) ** 2 + a2) + Math.log(x * x + (y + 1) ** 2 + a2) - V * y,
        f: (x, y) => { const s1 = x * x + (y - 1) ** 2 + a2, s2 = x * x + (y + 1) ** 2 + a2; return [-2 * (y - 1) / s1 + 2 * (y + 1) / s2 - V, 2 * x / s1 - 2 * x / s2]; },
        lab: ["x", "y"], parts: ["∂ψ/∂y", "−∂ψ/∂x"], lv: [-3.2, 3.2, 0.32], sep: 0, blob: [3.4, 0.22, 0.38], hiker: [0.0, 1.95], vort: true,
        cap: "The same rule on a different landscape: the stream function ψ of a pair of whirlpools, seen riding along with them. Now the plane is the water surface itself. Drops inside the bright oval travel with the pair; the pink patch is dragged around it and stretched, and again keeps its area." },
    };
    let mode = "pend", M = MODES.pend, bg = null, bgKey = "", dots = [], blob = null, A0 = 1, hiker = null, clock = 0;
    const rk4 = (x, y, h) => { const k1 = M.f(x, y), k2 = M.f(x + h / 2 * k1[0], y + h / 2 * k1[1]), k3 = M.f(x + h / 2 * k2[0], y + h / 2 * k2[1]), k4 = M.f(x + h * k3[0], y + h * k3[1]);
      return [x + h / 6 * (k1[0] + 2 * k2[0] + 2 * k3[0] + k4[0]), y + h / 6 * (k1[1] + 2 * k2[1] + 2 * k3[1] + k4[1])]; };
    const areaOf = P => { let s = 0; for (let i = 0; i < P.length; i++) { const a = P[i], b = P[(i + 1) % P.length]; s += a[0] * b[1] - b[0] * a[1]; } return Math.abs(s) / 2; };
    function resetBlob() { const [cx, cy, r] = M.blob; blob = []; for (let i = 0; i < 180; i++) { const t = i / 180 * TAU; blob.push([cx + r * Math.cos(t), cy + r * Math.sin(t)]); } A0 = areaOf(blob); clock = 0; }
    function reset() { dots = []; for (let i = 0; i < 110; i++) dots.push([Math.random() * 8.4 - 4.2, Math.random() * 5 - 2.5, Math.random() * 8]); hiker = M.hiker.slice(); resetBlob(); bg = null; bgKey = ""; }
    function refine() { if (blob.length > 6000) return; const nb = [], n = blob.length;
      for (let i = 0; i < n; i++) { const a = blob[i], b = blob[(i + 1) % n]; nb.push(a);
        if (Math.hypot(b[0] - a[0], b[1] - a[1]) > 0.045) { const h = blob[(i - 1 + n) % n], k = blob[(i + 2) % n]; nb.push([(9 * (a[0] + b[0]) - h[0] - k[0]) / 16, (9 * (a[1] + b[1]) - h[1] - k[1]) / 16]); } }
      blob = nb; }
    reset();
    const fig = makeFig(cv, (c, W, H, t, dt) => {
      const XW = 4.2, YW = XW * H / W, S = W / (2 * XW), sx = x => W / 2 + x * S, sy = y => H / 2 - y * S;
      if (!W || !H) return;
      // landscape: shaded heights and contour lines, drawn once per size and mode
      const key = `${mode}:${W}x${H}`;
      if (bgKey !== key) {
        bg = document.createElement("canvas"); bg.width = Math.round(W * 2); bg.height = Math.round(H * 2); const b = bg.getContext("2d"), GW = 240, GH = Math.round(240 * H / W);
        const val = new Float64Array((GW + 1) * (GH + 1)); for (let j = 0; j <= GH; j++) for (let i = 0; i <= GW; i++) val[j * (GW + 1) + i] = M.H(-XW + 2 * XW * i / GW, YW - 2 * YW * j / GH);
        const img = b.createImageData(GW, GH), [l0, l1] = M.lv;
        for (let j = 0; j < GH; j++) for (let i = 0; i < GW; i++) { const f = Math.max(0, Math.min(1, (val[j * (GW + 1) + i] - l0) / (l1 - l0))), o = 4 * (j * GW + i);
          img.data[o] = 14 + 26 * f; img.data[o + 1] = 22 + 52 * f; img.data[o + 2] = 36 + 76 * f; img.data[o + 3] = 255; }
        const tmp = document.createElement("canvas"); tmp.width = GW; tmp.height = GH; tmp.getContext("2d").putImageData(img, 0, 0);
        b.imageSmoothingEnabled = true; b.drawImage(tmp, 0, 0, bg.width, bg.height); b.scale(bg.width / GW, bg.height / GH);
        const seg = lvl => { b.beginPath();
          for (let j = 0; j < GH; j++) for (let i = 0; i < GW; i++) {
            const A = val[j * (GW + 1) + i] - lvl, B = val[j * (GW + 1) + i + 1] - lvl, C = val[(j + 1) * (GW + 1) + i + 1] - lvl, D = val[(j + 1) * (GW + 1) + i] - lvl, P = [];
            if ((A > 0) !== (B > 0)) P.push([i + A / (A - B), j]); if ((B > 0) !== (C > 0)) P.push([i + 1, j + B / (B - C)]);
            if ((C > 0) !== (D > 0)) P.push([i + 1 - C / (C - D), j + 1]); if ((D > 0) !== (A > 0)) P.push([i, j + 1 - D / (D - A)]);
            if (P.length >= 2) { b.moveTo(P[0][0], P[0][1]); b.lineTo(P[1][0], P[1][1]); } }
          b.stroke(); };
        b.lineWidth = 0.35; b.strokeStyle = "rgba(200,220,245,0.38)"; for (let lvl = M.lv[0]; lvl <= M.lv[1] + 1e-9; lvl += M.lv[2]) seg(lvl);
        b.lineWidth = 0.6; b.strokeStyle = "rgba(255,255,255,0.8)"; b.setLineDash([2, 2]); seg(M.sep); b.setLineDash([]);
        bgKey = key;
      }
      c.drawImage(bg, 0, 0, W, H);
      // axes
      c.strokeStyle = "rgba(220,226,236,0.35)"; c.lineWidth = 1; c.beginPath(); c.moveTo(0, sy(0)); c.lineTo(W, sy(0)); c.moveTo(sx(0), 0); c.lineTo(sx(0), H); c.stroke();
      font(c, 12.5, 500, "IBM Plex Mono, monospace"); c.fillStyle = TEXT; c.textAlign = "right"; c.fillText(M.lab[0], W - 8, sy(0) - 7); c.textAlign = "left"; c.fillText(M.lab[1], sx(0) + 7, 16);
      if (M.vort) for (const [y, ccw] of [[1, true], [-1, false]]) { const col = ccw ? TEAL : AMBER; c.fillStyle = col; c.beginPath(); c.arc(sx(0), sy(y), 4, 0, TAU); c.fill(); spinMark(c, sx(0), sy(y), 12, ccw, col, t * 2); }
      // move everything by Hamilton's rule
      const sub = 6, h = dt / sub;
      if (dt) for (let k = 0; k < sub; k++) { for (const d of dots) { const n = rk4(d[0], d[1], h); d[0] = n[0]; d[1] = n[1]; } hiker = rk4(hiker[0], hiker[1], h); for (let i = 0; i < blob.length; i++) blob[i] = rk4(blob[i][0], blob[i][1], h); refine(); }
      clock += dt; if (clock > 16 || blob.length > 6000) resetBlob();
      for (const d of dots) { d[2] -= dt; if (d[2] < 0 || Math.abs(d[0]) > XW + 0.3 || Math.abs(d[1]) > YW + 0.3) { d[0] = Math.random() * 2 * XW - XW; d[1] = Math.random() * 2 * YW - YW; d[2] = 4 + 6 * Math.random(); }
        c.fillStyle = "rgba(210,230,255,0.75)"; c.beginPath(); c.arc(sx(d[0]), sy(d[1]), 1.6, 0, TAU); c.fill(); }
      c.fillStyle = "rgba(255,79,139,0.42)"; c.strokeStyle = "rgba(255,120,170,0.95)"; c.lineWidth = 1.2; c.beginPath(); blob.forEach((p, i) => i ? c.lineTo(sx(p[0]), sy(p[1])) : c.moveTo(sx(p[0]), sy(p[1]))); c.closePath(); c.fill(); c.stroke();
      // the hiker, with its velocity split into the two parts of the rule
      if (Math.abs(hiker[0]) > XW || Math.abs(hiker[1]) > YW) hiker = M.hiker.slice();
      const [u, v] = M.f(hiker[0], hiker[1]), g = 0.55 * S / Math.max(1, Math.hypot(u, v) / 1.6), X = sx(hiker[0]), Y = sy(hiker[1]);
      c.lineWidth = 2; c.strokeStyle = TEAL; c.fillStyle = TEAL; arrow(c, X, Y, X + u * g, Y, 6); c.strokeStyle = AMBER; c.fillStyle = AMBER; arrow(c, X, Y, X, Y - v * g, 6);
      c.strokeStyle = "#FFFFFF"; c.fillStyle = "#FFFFFF"; arrow(c, X, Y, X + u * g, Y - v * g, 6);
      c.beginPath(); c.arc(X, Y, 5, 0, TAU); c.fill();
      font(c, 12.5, 600, "IBM Plex Mono, monospace"); c.textAlign = u >= 0 ? "left" : "right"; c.fillStyle = TEAL; c.fillText(M.parts[0], X + u * g + (u >= 0 ? 6 : -6), Y + 16);
      c.textAlign = "left"; c.fillStyle = AMBER; c.fillText(M.parts[1], X + 8, Y - v * g + (v >= 0 ? -4 : 14));
      out.innerHTML = `patch area <b>${(100 * areaOf(blob) / A0).toFixed(1)}%</b>`;
    });
    const set = m => { mode = m; M = MODES[m]; btns.forEach(b => b.setAttribute("aria-pressed", String(b.dataset.ham === m))); cap.textContent = M.cap; reset(); fig.redraw(); };
    btns.forEach(b => b.onclick = () => set(b.dataset.ham)); set("pend");
  }

  figDip(); figLoop(); figLines(); figRiver(); figStretch(); figFade(); figHam();
})();

