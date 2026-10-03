// A small WebGL2 renderer for soap films: triangle meshes shaded by thin-film interference (the colour of each
// point comes from the film's thickness there and the angle we see it at), metal wire frames as tubes, and
// optional triple lines and junction markers. Orbit with a drag.
(function (root) {
  const VS = `#version 300 es
  in vec3 aP; in vec3 aN; in float aD; uniform mat4 uM; out vec3 vP; out vec3 vN; out float vD;
  void main() { vP = aP; vN = aN; vD = aD; gl_Position = uM * vec4(aP, 1.0); }`;
  const FS_FILM = `#version 300 es
  precision highp float; in vec3 vP; in vec3 vN; in float vD; uniform vec3 uEye; uniform sampler2D uLUT; uniform float uDMax, uGain, uAlpha; out vec4 o;
  void main() {
    vec3 v = normalize(uEye - vP), n = normalize(vN); float c = abs(dot(n, v));
    float ct = sqrt(max(0.0, 1.0 - (1.0 - c * c) / (1.33 * 1.33)));            // cos of the refracted angle inside the film
    vec3 col = texture(uLUT, vec2(clamp(vD * ct / uDMax, 0.0, 1.0), 0.5)).rgb;
    float fres = 0.35 + 0.65 * pow(1.0 - c, 3.0);
    o = vec4(col * uGain * (0.55 + 0.45 * fres), uAlpha * (0.45 + 0.55 * fres));
  }`;
  const FS_SOLID = `#version 300 es
  precision highp float; in vec3 vP; in vec3 vN; in float vD; uniform vec3 uEye, uCol; out vec4 o;
  void main() { vec3 v = normalize(uEye - vP), n = normalize(vN); float d = abs(dot(n, v)); vec3 L = normalize(vec3(0.4, 0.8, 0.6)); float diff = abs(dot(n, L));
    vec3 h = normalize(L + v); float spec = pow(abs(dot(n, h)), 40.0); o = vec4(uCol * (0.25 + 0.6 * diff) + vec3(spec * 0.7), 1.0); }`;
  const mat = {
    persp: (fov, asp, n, f) => { const t = 1 / Math.tan(fov / 2); return [t / asp, 0, 0, 0, 0, t, 0, 0, 0, 0, (f + n) / (n - f), -1, 0, 0, 2 * f * n / (n - f), 0]; },
    look: (e, c, u) => { const z = norm(sub(e, c)), x = norm(cross(u, z)), y = cross(z, x); return [x[0], y[0], z[0], 0, x[1], y[1], z[1], 0, x[2], y[2], z[2], 0, -dot(x, e), -dot(y, e), -dot(z, e), 1]; },
    mul: (a, b) => { const o = new Array(16).fill(0); for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) for (let k = 0; k < 4; k++) o[j * 4 + i] += a[k * 4 + i] * b[j * 4 + k]; return o; }
  };
  const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]], cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]], dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
  const norm = a => { const l = Math.hypot(a[0], a[1], a[2]) || 1; return [a[0] / l, a[1] / l, a[2] / l]; };
  // a tube along a polyline (for wires and triple lines)
  function tubeMesh(pts, r, seg = 10, closed = false) {
    const P = [], N = [], I = []; const n = pts.length;
    for (let i = 0; i < n; i++) {
      const a = pts[Math.max(0, i - 1)], b = pts[Math.min(n - 1, i + 1)], T = norm(sub(b, a)), ref = Math.abs(T[1]) < 0.9 ? [0, 1, 0] : [1, 0, 0], U = norm(cross(T, ref)), W = cross(T, U);
      for (let k = 0; k < seg; k++) { const th = 2 * Math.PI * k / seg, d = [U[0] * Math.cos(th) + W[0] * Math.sin(th), U[1] * Math.cos(th) + W[1] * Math.sin(th), U[2] * Math.cos(th) + W[2] * Math.sin(th)]; P.push(pts[i][0] + r * d[0], pts[i][1] + r * d[1], pts[i][2] + r * d[2]); N.push(...d); }
    }
    for (let i = 0; i < n - 1; i++) for (let k = 0; k < seg; k++) { const a = i * seg + k, b = i * seg + (k + 1) % seg, c = (i + 1) * seg + k, d = (i + 1) * seg + (k + 1) % seg; I.push(a, b, c, b, d, c); }
    return { P: new Float32Array(P), N: new Float32Array(N), I: new Uint32Array(I) };
  }
  function Renderer(canvas, opts = {}) {
    const gl = canvas.getContext("webgl2", { antialias: true, premultipliedAlpha: false, preserveDrawingBuffer: !!opts.preserve }); if (!gl) throw new Error("WebGL2 unavailable");
    const sh = (t, s) => { const o = gl.createShader(t); gl.shaderSource(o, s); gl.compileShader(o); if (!gl.getShaderParameter(o, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(o)); return o; };
    const prog = fs => { const p = gl.createProgram(); gl.attachShader(p, sh(gl.VERTEX_SHADER, VS)); gl.attachShader(p, sh(gl.FRAGMENT_SHADER, fs)); gl.bindAttribLocation(p, 0, "aP"); gl.bindAttribLocation(p, 1, "aN"); gl.bindAttribLocation(p, 2, "aD"); gl.linkProgram(p); p.u = n => gl.getUniformLocation(p, n); return p; };
    const pFilm = prog(FS_FILM), pSolid = prog(FS_SOLID);
    const lutTex = gl.createTexture(); let lutInfo = null;
    const setLight = (light = "day") => { lutInfo = FilmColor.filmLUT(512, 1600, light); gl.bindTexture(gl.TEXTURE_2D, lutTex); gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 512, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, lutInfo.data); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); };
    setLight("day");
    const mkMesh = () => { const vao = gl.createVertexArray(), bP = gl.createBuffer(), bN = gl.createBuffer(), bD = gl.createBuffer(), bI = gl.createBuffer(); return { vao, bP, bN, bD, bI, n: 0 }; };
    const upload = (m, P, N, D, I) => {
      gl.bindVertexArray(m.vao);
      gl.bindBuffer(gl.ARRAY_BUFFER, m.bP); gl.bufferData(gl.ARRAY_BUFFER, P, gl.DYNAMIC_DRAW); gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 3, gl.FLOAT, false, 0, 0);
      gl.bindBuffer(gl.ARRAY_BUFFER, m.bN); gl.bufferData(gl.ARRAY_BUFFER, N, gl.DYNAMIC_DRAW); gl.enableVertexAttribArray(1); gl.vertexAttribPointer(1, 3, gl.FLOAT, false, 0, 0);
      if (D) { gl.bindBuffer(gl.ARRAY_BUFFER, m.bD); gl.bufferData(gl.ARRAY_BUFFER, D, gl.DYNAMIC_DRAW); gl.enableVertexAttribArray(2); gl.vertexAttribPointer(2, 1, gl.FLOAT, false, 0, 0); } else { gl.disableVertexAttribArray(2); gl.vertexAttrib1f(2, 500); }
      if (I) { gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, m.bI); gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, I, gl.DYNAMIC_DRAW); m.n = I.length; }
      gl.bindVertexArray(null);
    };
    const R = { gl, canvas, yaw: opts.yaw ?? 0.6, pitch: opts.pitch ?? 0.35, dist: opts.dist ?? 5.2, target: opts.target || [0, 0, 0], fov: opts.fov ?? 0.7, auto: opts.auto ?? 0.12, dragging: false, setLight, meshes: [] };
    R.film = mkMesh(); R.wire = mkMesh(); R.lines = mkMesh(); R.dots = mkMesh();
    R.setFilm = (P, N, D, I) => upload(R.film, P, N, D, I);
    R.setWires = (segs, r = 0.03) => { const parts = segs.map(s => tubeMesh(s, r, 12)); upload(R.wire, ...merge(parts)); };
    R.setLines = (polys, r = 0.012) => { if (!polys.length) { R.lines.n = 0; return; } upload(R.lines, ...merge(polys.map(s => tubeMesh(s, r, 6)))); };
    R.setDots = (pts, r = 0.035) => { if (!pts.length) { R.dots.n = 0; return; } upload(R.dots, ...merge(pts.map(p => sphere(p, r)))); };
    const merge = parts => { let nv = 0, ni = 0; for (const p of parts) { nv += p.P.length; ni += p.I.length; } const P = new Float32Array(nv), N = new Float32Array(nv), I = new Uint32Array(ni); let ov = 0, oi = 0;
      for (const p of parts) { P.set(p.P, ov); N.set(p.N, ov); for (let k = 0; k < p.I.length; k++) I[oi + k] = p.I[k] + ov / 3; ov += p.P.length; oi += p.I.length; } return [P, N, null, I]; };
    const sphere = (c, r) => { const P = [], N = [], I = [], S = 10; for (let i = 0; i <= S; i++) for (let j = 0; j <= S; j++) { const th = Math.PI * i / S, ph = 2 * Math.PI * j / S, d = [Math.sin(th) * Math.cos(ph), Math.cos(th), Math.sin(th) * Math.sin(ph)]; P.push(c[0] + r * d[0], c[1] + r * d[1], c[2] + r * d[2]); N.push(...d); }
      for (let i = 0; i < S; i++) for (let j = 0; j < S; j++) { const a = i * (S + 1) + j, b = a + 1, c2 = a + S + 1, d = c2 + 1; I.push(a, c2, b, b, c2, d); } return { P: new Float32Array(P), N: new Float32Array(N), I: new Uint32Array(I) }; };
    // orbit controls
    let last = null;
    canvas.addEventListener("pointerdown", e => { R.dragging = true; last = [e.clientX, e.clientY]; canvas.setPointerCapture(e.pointerId); });
    canvas.addEventListener("pointermove", e => { if (!R.dragging) return; R.yaw -= (e.clientX - last[0]) * 0.008; R.pitch = Math.max(-1.3, Math.min(1.3, R.pitch + (e.clientY - last[1]) * 0.008)); last = [e.clientX, e.clientY]; });
    canvas.addEventListener("pointerup", () => { R.dragging = false; });
    canvas.addEventListener("wheel", e => { e.preventDefault(); R.dist = Math.max(2.5, Math.min(12, R.dist * (1 + e.deltaY * 0.001))); }, { passive: false });
    R.eye = () => [R.target[0] + R.dist * Math.cos(R.pitch) * Math.sin(R.yaw), R.target[1] + R.dist * Math.sin(R.pitch), R.target[2] + R.dist * Math.cos(R.pitch) * Math.cos(R.yaw)];
    R.draw = (dt = 0, o = {}) => {
      if (!R.dragging) R.yaw += R.auto * dt;
      const dpr = Math.min(2, window.devicePixelRatio || 1), w = Math.round(canvas.clientWidth * dpr), h = Math.round(canvas.clientHeight * dpr); if (canvas.width !== w || canvas.height !== h) { canvas.width = w; canvas.height = h; }
      gl.viewport(0, 0, w, h); gl.clearColor(...(o.bg || [0.03, 0.035, 0.05]), 1); gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
      const eye = R.eye(), M = mat.mul(mat.persp(R.fov, w / h, 0.05, 50), mat.look(eye, R.target, [0, 1, 0]));
      const solid = (m, col) => { if (!m.n) return; gl.useProgram(pSolid); gl.uniformMatrix4fv(pSolid.u("uM"), false, M); gl.uniform3fv(pSolid.u("uEye"), eye); gl.uniform3fv(pSolid.u("uCol"), col); gl.bindVertexArray(m.vao); gl.drawElements(gl.TRIANGLES, m.n, gl.UNSIGNED_INT, 0); };
      gl.enable(gl.DEPTH_TEST); gl.depthMask(true); gl.disable(gl.BLEND);
      solid(R.wire, o.wireCol || [0.55, 0.57, 0.62]); if (o.lines !== false) solid(R.lines, o.lineCol || [0.95, 0.92, 0.8]); if (o.dots !== false) solid(R.dots, o.dotCol || [1.0, 0.7, 0.3]);
      if (R.film.n) { gl.enable(gl.BLEND); gl.blendFunc(gl.SRC_ALPHA, gl.ONE); gl.depthMask(false); gl.disable(gl.CULL_FACE);
        gl.useProgram(pFilm); gl.uniformMatrix4fv(pFilm.u("uM"), false, M); gl.uniform3fv(pFilm.u("uEye"), eye); gl.uniform1f(pFilm.u("uDMax"), lutInfo.dMax); gl.uniform1f(pFilm.u("uGain"), o.gain ?? 1.0); gl.uniform1f(pFilm.u("uAlpha"), o.alpha ?? 0.8);
        gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, lutTex); gl.uniform1i(pFilm.u("uLUT"), 0); gl.bindVertexArray(R.film.vao); gl.drawElements(gl.TRIANGLES, R.film.n, gl.UNSIGNED_INT, 0); gl.depthMask(true); gl.disable(gl.BLEND); }
      R.M = M;
    };
    R.project = p => { const M = R.M; if (!M) return null; const x = M[0] * p[0] + M[4] * p[1] + M[8] * p[2] + M[12], y = M[1] * p[0] + M[5] * p[1] + M[9] * p[2] + M[13], w = M[3] * p[0] + M[7] * p[1] + M[11] * p[2] + M[15]; if (w <= 0) return null; return [(x / w * 0.5 + 0.5) * canvas.clientWidth, (1 - (y / w * 0.5 + 0.5)) * canvas.clientHeight]; };
    return R;
  }
  // mesh arrays from a Surface.Film, with a film-thickness field in nm: thicker low down (drainage) plus slow swirls
  function filmArrays(film, t = 0, thick = {}) {
    const V = film.V, n = V.length, P = new Float32Array(n * 3), N = new Float32Array(n * 3), D = new Float32Array(n), I = new Uint32Array(film.tris.length * 3);
    let ymin = Infinity, ymax = -Infinity; for (const v of V) { ymin = Math.min(ymin, v[1]); ymax = Math.max(ymax, v[1]); }
    const top = thick.top ?? 250, bottom = thick.bottom ?? 1100, sw = thick.swirl ?? 90;
    const pid = thick.fn ? film.patchOf || (film.patchOf = (() => { const pv = new Int32Array(n).fill(-1); film.tris.forEach((tr, k) => tr.forEach(q => { if (pv[q] < 0) pv[q] = film.triPatch[k]; })); return pv; })()) : null;
    for (let i = 0; i < n; i++) { const v = V[i]; P.set(v, 3 * i); const u = (ymax - v[1]) / (ymax - ymin + 1e-9);
      if (thick.fn) { D[i] = thick.fn(0.5 + 0.22 * (v[0] + 0.6 * v[2]) + 0.31 * pid[i], 1 - u); continue; }      // thickness from a live film-flow simulation: bands from drainage, plumes, swirls
      D[i] = top + (bottom - top) * Math.pow(u, 1.6) + sw * Math.sin(3.1 * v[0] + 1.3 * t + 2.0 * Math.sin(2.3 * v[2] - 0.7 * t)) * Math.sin(2.7 * v[2] + 0.9 * t + 1.7 * Math.sin(1.9 * v[1] + 0.5 * t)); }
    film.tris.forEach(([a, b, c], k) => { I[3 * k] = a; I[3 * k + 1] = b; I[3 * k + 2] = c; const e1 = sub(V[b], V[a]), e2 = sub(V[c], V[a]), nn = cross(e1, e2); for (const q of [a, b, c]) { N[3 * q] += nn[0]; N[3 * q + 1] += nn[1]; N[3 * q + 2] += nn[2]; } });
    return [P, N, D, I];
  }
  // polylines of the triple lines (chains of triple edges) for drawing
  function tripleLines(film) {
    const adj = new Map(); film.tripleEdges.forEach(([a, b]) => { (adj.get(a) || adj.set(a, []).get(a)).push(b); (adj.get(b) || adj.set(b, []).get(b)).push(a); });
    const used = new Set(), polys = [], ek = (a, b) => a < b ? a + "," + b : b + "," + a;
    const ends = [...adj.keys()].filter(v => adj.get(v).length !== 2 || film.fixed[v]);
    for (const s of ends) for (const nb of adj.get(s)) { if (used.has(ek(s, nb))) continue; const chain = [s]; let prev = s, cur = nb; used.add(ek(s, nb));
      while (true) { chain.push(cur); const nx = (adj.get(cur) || []).filter(x => x !== prev); if (nx.length !== 1 || film.fixed[cur] && cur !== s && chain.length > 1 && adj.get(cur).length !== 2) break; if (used.has(ek(cur, nx[0]))) break; used.add(ek(cur, nx[0])); prev = cur; cur = nx[0]; }
      polys.push(chain.map(i => film.V[i])); }
    return polys;
  }
  root.Film3D = { Renderer, filmArrays, tripleLines, tubeMesh };
})(typeof window !== "undefined" ? window : globalThis);
