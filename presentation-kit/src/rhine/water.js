// WebGL2 renderer: a sunlit shallow river with vortex dimples and dye, seen from above or at an angle.
//
// Surface: the vortex dips (Scully profile) plus a spectrum of small ripples.
// Looking at it: each pixel's view ray meets the water; the reflected ray picks up the sky, clouds
//   and the far bank, the refracted ray goes down to the riverbed, and Fresnel's law mixes the two.
// Caustics: a fine grid of sunrays is refracted through the surface onto the bed. A ray entering
//   where the slope is grad(eta) lands k grad(eta) away (k = depth (1 - 1/n)), plus an offset for
//   the sun's angle. Each grid triangle is drawn where it lands with brightness
//   (area before) / (area after), and the results are added, so where the light folds over itself
//   the bed shows sharp caustic curves. A small blur stands in for the size of the sun's disk.
// Dye: a cloud of tracer particles carried by the same velocity field as the vortices; their
//   density tints the light that passes through the water (like rhodamine tracer dye).
(function (root) {
  const COMMON = `
  uniform int uN; uniform vec4 uV[64]; uniform float uA2, uAmp, uRipple, uTime, uU, uWall, uRipSpeed;
  float h1(float n) { return fract(sin(n * 12.9898 + 78.233) * 43758.5453); }
  void surf(vec2 p, float fp, out float eta, out vec2 gr) {    // fp: pixel footprint (cm), to filter ripples
    eta = 0.0; gr = vec2(0);
    for (int j = 0; j < 64; j++) { if (j >= uN) break;
      vec4 v = uV[j]; float A = v.z * v.z * uAmp * v.w; vec2 d = p - v.xy; float s = dot(d, d) + uA2;
      eta -= A / s; gr += A * 2.0 * d / (s * s); }
    if (uRipple > 0.0) for (int i = 0; i < 24; i++) {           // capillary-gravity ripples from all directions
      float fi = float(i), ang = fi * 2.39996 + 0.5 * h1(fi + 3.0); vec2 dir = vec2(cos(ang), sin(ang));
      float kw = 1.3 + 2.4 * h1(fi + 11.0), keep = smoothstep(1.6, 0.8, kw * fp); if (keep <= 0.0) continue;
      float w = sqrt(981.0 * kw + 73.0 * kw * kw * kw) * uRipSpeed;
      float amp = keep * uRipple * (0.6 + 0.8 * h1(fi + 17.0)) / (kw * kw);    // similar curvature per wave
      float ph = kw * (dot(dir, p) - dir.x * uU * uTime) - w * uTime + 6.2832 * h1(fi + 5.0);
      eta += amp * sin(ph); gr += amp * kw * cos(ph) * dir; }
  }`;
  const VEL = `
  vec2 vel(vec2 p) {                                           // same field as vortex.js
    vec2 u = vec2(uU, 0.0);
    for (int j = 0; j < 64; j++) { if (j >= uN) break;
      vec4 v = uV[j]; float g = v.z / 6.28318530718; vec2 d = p - v.xy; float s = dot(d, d) + uA2;
      u += g * vec2(-d.y, d.x) / s;
      if (uWall < 1e8) { vec2 di = p - vec2(v.x, 2.0 * uWall - v.y); float si = dot(di, di) + uA2; u -= g * vec2(-di.y, di.x) / si; } }
    return u; }`;
  const CAUSTIC_VS = `#version 300 es
  precision highp float; in vec2 uv; uniform vec2 uMin, uMax, uShift; uniform float uK; ${COMMON}
  out vec2 vP; out vec2 vQ;
  void main() { vec2 p = uMin - uShift + uv * (uMax - uMin); float e; vec2 g; surf(p, 0.0, e, g); vec2 q = p + uShift + uK * g;
    vP = p; vQ = q; gl_Position = vec4((q - uMin) / (uMax - uMin) * 2.0 - 1.0, 0.0, 1.0); }`;
  const CAUSTIC_FS = `#version 300 es
  precision highp float; in vec2 vP; in vec2 vQ; out vec4 frag;
  float cr(vec2 a, vec2 b) { return abs(a.x * b.y - a.y * b.x); }
  void main() { float a0 = cr(dFdx(vP), dFdy(vP)), a1 = cr(dFdx(vQ), dFdy(vQ));
    frag = vec4(min(a0 / max(a1, 1e-12), 30.0), 0.0, 0.0, 1.0); }`;
  const QUAD_VS = `#version 300 es
  in vec2 p; void main() { gl_Position = vec4(p, 0.0, 1.0); }`;
  const BLUR_FS = `#version 300 es
  precision highp float; uniform sampler2D uSrc; uniform vec2 uStep; uniform float uSigma; out vec4 frag;
  void main() { vec2 t = gl_FragCoord.xy / vec2(textureSize(uSrc, 0)); float c = texture(uSrc, t).r, wsum = 1.0;
    for (int i = 1; i <= 12; i++) { float fi = float(i); if (fi > 2.5 * uSigma + 1.0) break; float w = exp(-0.5 * fi * fi / (uSigma * uSigma));
      c += w * (texture(uSrc, t + fi * uStep).r + texture(uSrc, t - fi * uStep).r); wsum += 2.0 * w; }
    frag = vec4(c / wsum, 0.0, 0.0, 1.0); }`;
  const ADVECT_FS = `#version 300 es
  precision highp float; uniform sampler2D uPos; uniform float uDt; ${COMMON} ${VEL}
  out vec4 frag;
  void main() { vec4 s = texelFetch(uPos, ivec2(gl_FragCoord.xy), 0);
    if (s.w < 0.5) { frag = s; return; }
    vec2 x = s.xy, xm = x + 0.5 * uDt * vel(x); frag = vec4(x + uDt * vel(xm), 0.0, 1.0); }`;
  const SPLAT_VS = `#version 300 es
  precision highp float; uniform sampler2D uPos; uniform vec2 uMin, uMax; uniform int uSide;
  void main() { ivec2 t = ivec2(gl_VertexID % uSide, gl_VertexID / uSide); vec4 s = texelFetch(uPos, t, 0);
    gl_PointSize = 1.0; gl_Position = s.w < 0.5 ? vec4(2.0, 2.0, 0.0, 1.0) : vec4((s.xy - uMin) / (uMax - uMin) * 2.0 - 1.0, 0.0, 1.0); }`;
  const SPLAT_FS = `#version 300 es
  precision highp float; uniform float uW; out vec4 frag; void main() { frag = vec4(uW, 0.0, 0.0, 1.0); }`;
  const MAIN_FS = `#version 300 es
  precision highp float;
  uniform vec2 uRes, uCenter, uCMin, uCMax, uDMin, uDMax;
  uniform float uScale, uPersp, uTanH, uDepth, uK, uGlint, uCausticOn, uDyeOn, uDebug, uSlopeVis, uMurk;
  uniform vec3 uCamPos, uCamF, uCamR, uCamU, uSunDir, uDyeT, uWaterCol;
  uniform sampler2D uCaustic, uDens; ${COMMON}
  out vec4 frag;
  vec2 hash2(vec2 p) { p = vec2(dot(p, vec2(127.1, 311.7)), dot(p, vec2(269.5, 183.3))); return fract(sin(p) * 43758.5453); }
  float hash1(vec2 p) { return fract(sin(dot(p, vec2(41.3, 289.1))) * 43758.5453); }
  float vnoise(vec2 p) { vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
    return mix(mix(hash1(i), hash1(i + vec2(1, 0)), f.x), mix(hash1(i + vec2(0, 1)), hash1(i + vec2(1, 1)), f.x), f.y); }
  float fbm(vec2 p) { float s = 0.0, a = 0.5; for (int i = 0; i < 5; i++) { s += a * vnoise(p); p = p * 2.03 + vec2(1.7, 9.2); a *= 0.5; } return s; }
  // riverbed: rounded pebbles of two sizes lying in sand
  vec3 pebbleCol(float h) {
    vec3 c = mix(vec3(0.58, 0.52, 0.42), vec3(0.70, 0.64, 0.52), h);
    c = mix(c, vec3(0.50, 0.50, 0.49), smoothstep(0.55, 0.62, h));
    c = mix(c, vec3(0.60, 0.44, 0.32), smoothstep(0.82, 0.88, h));
    return mix(c, vec3(0.36, 0.36, 0.35), smoothstep(0.94, 0.97, h)); }
  vec4 pebbles(vec2 q, float cell, float density) {
    vec2 c = q / cell, i = floor(c), f = fract(c); vec4 best = vec4(0);
    for (int y = -1; y <= 1; y++) for (int x = -1; x <= 1; x++) {
      vec2 g = vec2(x, y), id = i + g, o = 0.2 + 0.6 * hash2(id);
      if (hash1(id + 21.7) > density) continue;
      float h = hash1(id + 7.1), ang = 6.283 * hash1(id + 3.3), r = 0.30 + 0.16 * hash1(id + 9.2);
      vec2 d = g + o - f; float ca = cos(ang), sa = sin(ang);
      vec2 e = vec2(ca * d.x + sa * d.y, -sa * d.x + ca * d.y) / vec2(r * 1.25, r * 0.85);
      float rr = dot(e, e);
      if (rr < 1.0) { float z = sqrt(1.0 - rr); vec3 nrm = normalize(vec3(e * 0.8, z)), L = normalize(vec3(0.3, 0.4, 1.0));
        vec3 col = mix(vec3(0.58, 0.54, 0.45), pebbleCol(h), 0.75) * (0.68 + 0.4 * max(dot(nrm, L), 0.0)) * (0.9 + 0.2 * vnoise(q * 6.0 + h * 10.0));
        float cov = smoothstep(1.0, 0.82, rr); if (cov > best.a) best = vec4(col, cov); } }
    return best; }
  vec3 bed(vec2 q, float fp) {                                // fp: footprint, to fade detail we can't resolve
    vec3 avg = vec3(0.55, 0.53, 0.45); if (fp > 0.9) return avg;
    vec3 sand = vec3(0.60, 0.55, 0.44) * (0.82 + 0.25 * vnoise(q * 7.0) + 0.1 * vnoise(q * 31.0) * smoothstep(0.2, 0.05, fp));
    vec4 small = pebbles(q + 13.7, 0.9, 0.45), big = pebbles(q, 2.6, 0.28);
    vec3 col = mix(sand, small.rgb, small.a * 0.9 * smoothstep(0.6, 0.25, fp));
    col *= 1.0 - 0.18 * big.a * (1.0 - smoothstep(0.0, 0.5, big.a));
    return mix(mix(col, big.rgb, big.a), avg, smoothstep(0.35, 0.9, fp)); }
  // what the water reflects: sky with clouds, the sun, and a wooded far bank at the horizon
  vec3 env(vec3 r, float full) {                              // full = 0: cheap sky only (for faint reflections)
    float el = r.z;
    vec3 sky = mix(vec3(0.80, 0.86, 0.92), vec3(0.33, 0.53, 0.83), pow(clamp(el, 0.0, 1.0), 0.55));
    float sd = max(dot(r, uSunDir), 0.0);
    sky += vec3(1.0, 0.95, 0.86) * (pow(sd, 900.0) * 60.0 * uGlint + pow(sd, 10.0) * 0.18);
    if (full < 0.5) return sky;
    vec2 cp = r.xy / (max(el, 0.0) + 0.14) * 0.9 + vec2(uTime * 0.004, 0.0);
    float cl = smoothstep(0.50, 0.78, fbm(cp)) * smoothstep(0.02, 0.2, el);
    sky = mix(sky, vec3(0.96, 0.96, 0.97), cl * 0.8);
    float az = atan(r.y, r.x), s = abs(sin(az));
    float top = 0.003 + s * s * (0.026 + 0.022 * vnoise(vec2(az * 9.0, 1.0)) + 0.010 * vnoise(vec2(az * 40.0, 2.0)) + 0.004 * vnoise(vec2(az * 160.0, 3.0)));
    if (el < top) {
      float emb = 0.0015 + 0.004 * s, f = clamp((el - emb) / max(top - emb, 1e-4), 0.0, 1.0);
      vec3 c = el < emb ? vec3(0.30, 0.30, 0.27) * (0.85 + 0.25 * vnoise(vec2(az * 300.0, 3.0)))
                        : mix(vec3(0.05, 0.09, 0.05), vec3(0.16, 0.24, 0.12), f * 0.7 + 0.5 * vnoise(vec2(az * 160.0, el * 900.0)) - 0.2);
      return mix(c, vec3(0.70, 0.76, 0.80), 0.22 * (1.0 - s));
    }
    return sky; }
  vec3 tone(vec3 c) { return pow(clamp(c, 0.0, 1.0), vec3(1.0 / 1.1)); }
  void main() {
    vec3 rd; vec2 p; float fp, dist = 0.0;
    if (uPersp > 0.5) {
      vec2 ndc = (gl_FragCoord.xy - 0.5 * uRes) / (0.5 * uRes.y);
      rd = normalize(uCamF + uTanH * (ndc.x * uCamR + ndc.y * uCamU));
      if (rd.z > -0.0015) { frag = vec4(tone(env(normalize(vec3(rd.xy, max(rd.z, 0.0))), 1.0)), 1.0); return; }
      float t = -uCamPos.z / rd.z; p = uCamPos.xy + t * rd.xy; dist = t;
      fp = t * uTanH / (0.5 * uRes.y) / max(-rd.z, 0.04);
    } else { p = uCenter + (gl_FragCoord.xy - 0.5 * uRes) * uScale; rd = vec3(0.0, 0.0, -1.0); fp = uScale; }
    float eta; vec2 gr; surf(p, fp, eta, gr);
    vec3 n0 = normalize(vec3(-gr, 1.0)), nv = normalize(vec3(-gr * uSlopeVis, 1.0));
    vec3 tr = refract(rd, n0, 0.75); float tb = uDepth / max(-tr.z, 0.05); vec2 q = p + tb * tr.xy;
    float irr = 1.0;
    if (uCausticOn > 0.5) { vec2 tc = (q - uCMin) / (uCMax - uCMin); float edge = smoothstep(0.0, 0.05, min(min(tc.x, 1.0 - tc.x), min(tc.y, 1.0 - tc.y)));
      irr = mix(1.0, texture(uCaustic, tc).r, edge); }
    else if (uPersp < 0.5) {                                 // fallback without float targets: local lens strength
      float hxx = 0.0, hxy = 0.0, hyy = 0.0;
      for (int j = 0; j < 64; j++) { if (j >= uN) break; vec4 v = uV[j]; float A = v.z * v.z * uAmp * v.w; vec2 d = p - v.xy; float s = dot(d, d) + uA2, s2 = s * s, s3 = s2 * s;
        hxx += 2.0 * A / s2 - 8.0 * A * d.x * d.x / s3; hyy += 2.0 * A / s2 - 8.0 * A * d.y * d.y / s3; hxy -= 8.0 * A * d.x * d.y / s3; }
      float det = (1.0 + uK * hxx) * (1.0 + uK * hyy) - uK * uK * hxy * hxy; irr = clamp(1.0 / max(abs(det), 0.16), 0.0, 5.0); }
    if (uDebug > 0.5) { frag = vec4(vec3(irr * 0.25), 1.0); return; }
    irr = irr / (1.0 + 0.035 * irr) * 1.035;
    vec3 tint = vec3(0.70, 0.80, 0.66);
    vec3 under = bed(q, uPersp > 0.5 ? fp * 1.5 : fp) * tint * (0.36 + 0.66 * irr) + vec3(0.03, 0.05, 0.04);
    under = mix(under, vec3(0.20, 0.27, 0.22) * (0.5 + 0.5 * irr), 0.16);        // a little turbidity
    under = mix(uWaterCol, under, exp(-uMurk * max(tb - uDepth * 0.6, 0.0)));  // longer paths: the river's own colour
    if (uDyeOn > 0.5) {                                                           // dye near the surface absorbs light
      vec2 t = (p - uDMin) / (uDMax - uDMin), px = 1.0 / vec2(textureSize(uDens, 0));
      if (t.x > 0.0 && t.y > 0.0 && t.x < 1.0 && t.y < 1.0) {
        float d = texture(uDens, t).r * 0.36 + (texture(uDens, t + vec2(px.x, 0)).r + texture(uDens, t - vec2(px.x, 0)).r + texture(uDens, t + vec2(0, px.y)).r + texture(uDens, t - vec2(0, px.y)).r) * 0.16;
        d = min(d, 1.6);
        under = under * pow(uDyeT, vec3(d * 1.5)) + vec3(0.30, 0.04, 0.10) * (1.0 - exp(-d * 1.5)) * 0.35; }
    }
    vec3 r = reflect(rd, nv); float F = 0.02 + 0.98 * pow(1.0 - clamp(dot(-rd, nv), 0.0, 1.0), 5.0);
    vec3 refl = r.z > 0.0 ? env(normalize(r), F > 0.035 ? 1.0 : 0.0)                 // a reflected ray heading down meets water again
                          : mix(env(normalize(vec3(r.xy, 0.02 - r.z)), 0.0) * 0.55, uWaterCol, 0.5);
    vec3 col = mix(under, refl, F);
    if (dist > 0.0) col = mix(col, vec3(0.74, 0.80, 0.84), 1.0 - exp(-dist / 3000.0));
    frag = vec4(tone(col), 1.0);
  }`;

  const norm3 = a => { const m = Math.hypot(a[0], a[1], a[2]) || 1; return [a[0] / m, a[1] / m, a[2] / m]; };
  const cross3 = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
  // camera {pos, target, fov (vertical, degrees)} -> basis; project / unproject in canvas pixels
  function cameraBasis(cam) {
    const F = norm3([cam.target[0] - cam.pos[0], cam.target[1] - cam.pos[1], cam.target[2] - cam.pos[2]]), R = norm3(cross3(F, [0, 0, 1])), U = cross3(R, F);
    return { pos: cam.pos, F, R, U, tanH: Math.tan(cam.fov * Math.PI / 360) };
  }
  function project(cam, W, H, x, y, z = 0) {
    const b = cameraBasis(cam), d = [x - b.pos[0], y - b.pos[1], z - b.pos[2]], zc = d[0] * b.F[0] + d[1] * b.F[1] + d[2] * b.F[2];
    if (zc <= 0.1) return null;
    const xs = (d[0] * b.R[0] + d[1] * b.R[1] + d[2] * b.R[2]) / (zc * b.tanH), ys = (d[0] * b.U[0] + d[1] * b.U[1] + d[2] * b.U[2]) / (zc * b.tanH);
    return [W / 2 + xs * H / 2, H / 2 - ys * H / 2, zc];
  }
  function unproject(cam, W, H, X, Y) {                      // where a pixel's ray meets the water
    const b = cameraBasis(cam), nx = (X - W / 2) / (H / 2), ny = -(Y - H / 2) / (H / 2);
    const rd = [0, 1, 2].map(i => b.F[i] + b.tanH * (nx * b.R[i] + ny * b.U[i]));
    if (rd[2] >= -1e-4) return null; const t = -b.pos[2] / rd[2]; return [b.pos[0] + t * rd[0], b.pos[1] + t * rd[1]];
  }

  function WaterRenderer(canvas, opts = {}) {
    const gl = canvas.getContext("webgl2", { antialias: false, preserveDrawingBuffer: !!opts.preserve, premultipliedAlpha: false });
    if (!gl) throw new Error("WebGL2 unavailable");
    const floatOK = !!gl.getExtension("EXT_color_buffer_float");
    const sh = (t, src) => { const s = gl.createShader(t); gl.shaderSource(s, src); gl.compileShader(s); if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s)); return s; };
    const prog = (vs, fs) => { const p = gl.createProgram(); gl.attachShader(p, sh(gl.VERTEX_SHADER, vs)); gl.attachShader(p, sh(gl.FRAGMENT_SHADER, fs));
      gl.bindAttribLocation(p, 0, "p"); gl.linkProgram(p); if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(p)); p.u = {}; return p; };
    const U = (p, n) => p.u[n] ?? (p.u[n] = gl.getUniformLocation(p, n));
    const pMain = prog(QUAD_VS, MAIN_FS);
    const pCaustic = floatOK ? prog(CAUSTIC_VS, CAUSTIC_FS) : null, pBlur = floatOK ? prog(QUAD_VS, BLUR_FS) : null;
    const pAdvect = floatOK ? prog(QUAD_VS, ADVECT_FS) : null, pSplat = floatOK ? prog(SPLAT_VS, SPLAT_FS) : null;
    this.caustics = floatOK; this.dyeSupported = floatOK;

    const quad = gl.createVertexArray(); gl.bindVertexArray(quad);
    gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer()); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
    gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
    const empty = gl.createVertexArray();
    const tex = (w, h, ifmt, fmt, type, filter) => { const t = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, t);
      gl.texImage2D(gl.TEXTURE_2D, 0, ifmt, w, h, 0, fmt, type, null);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, filter); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, filter);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE); return t; };
    const fbo = t => { const f = gl.createFramebuffer(); gl.bindFramebuffer(gl.FRAMEBUFFER, f); gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, t, 0); gl.bindFramebuffer(gl.FRAMEBUFFER, null); return f; };

    // caustic mesh and targets (a window of the riverbed, in world cm)
    const GX = opts.gridX || 1100, GY = opts.gridY || 620, CW = opts.causticW || 1600, CH = opts.causticH || 900;
    let mesh = null, nIdx = GX * GY * 6, cTex = null, cFbo = null, bTex = null, bFbo = null;
    if (floatOK) {
      mesh = gl.createVertexArray(); gl.bindVertexArray(mesh);
      const uvs = new Float32Array((GX + 1) * (GY + 1) * 2);
      for (let j = 0; j <= GY; j++) for (let i = 0; i <= GX; i++) { const o = 2 * (j * (GX + 1) + i); uvs[o] = i / GX; uvs[o + 1] = j / GY; }
      const idx = new Uint32Array(nIdx); let q = 0;
      for (let j = 0; j < GY; j++) for (let i = 0; i < GX; i++) { const a = j * (GX + 1) + i, b = a + 1, c = a + GX + 1, d = c + 1; idx[q++] = a; idx[q++] = b; idx[q++] = c; idx[q++] = b; idx[q++] = d; idx[q++] = c; }
      gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer()); gl.bufferData(gl.ARRAY_BUFFER, uvs, gl.STATIC_DRAW);
      const ml = gl.getAttribLocation(pCaustic, "uv"); gl.enableVertexAttribArray(ml); gl.vertexAttribPointer(ml, 2, gl.FLOAT, false, 0, 0);
      gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, gl.createBuffer()); gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, idx, gl.STATIC_DRAW);
      cTex = tex(CW, CH, gl.R16F, gl.RED, gl.HALF_FLOAT, gl.LINEAR); cFbo = fbo(cTex); bTex = tex(CW, CH, gl.R16F, gl.RED, gl.HALF_FLOAT, gl.LINEAR); bFbo = fbo(bTex);
    }
    gl.bindVertexArray(null);

    // dye particles: positions in a float texture, updated by ping-pong; density splatted in a world window
    const SIDE = opts.dyeSide || 512, NP = SIDE * SIDE, DW = opts.dyeW || 2048, DH = opts.dyeH || 1400;
    let pTex = null, pFbo = null, pCur = 0, dyeOn = false, dyeWeight = 0, dTex = null, dFbo = null;
    if (floatOK) { pTex = [0, 1].map(() => tex(SIDE, SIDE, gl.RGBA32F, gl.RGBA, gl.FLOAT, gl.NEAREST)); pFbo = pTex.map(fbo); dTex = tex(DW, DH, gl.R16F, gl.RED, gl.HALF_FLOAT, gl.LINEAR); dFbo = fbo(dTex); }
    const vbuf = new Float32Array(64 * 4);
    const setCommon = (p, o, vs) => {
      gl.uniform1f(U(p, "uA2"), (o.a ?? 0.6) ** 2); gl.uniform1f(U(p, "uAmp"), (o.exaggerate ?? 1) / (8 * Math.PI * Math.PI * 981));
      gl.uniform1f(U(p, "uRipple"), o.ripple ?? 0.004); gl.uniform1f(U(p, "uTime"), o.time ?? 0); gl.uniform1f(U(p, "uRipSpeed"), o.ripSpeed ?? 0.22);
      gl.uniform1f(U(p, "uU"), o.U ?? 0); gl.uniform1f(U(p, "uWall"), o.wall ?? 1e9);
      vs = vs || o.vortices || []; const n = Math.min(64, vs.length);
      for (let i = 0; i < n; i++) { vbuf[4 * i] = vs[i][0]; vbuf[4 * i + 1] = vs[i][1]; vbuf[4 * i + 2] = vs[i][2]; vbuf[4 * i + 3] = vs[i][3] ?? 1; }
      gl.uniform1i(U(p, "uN"), n); gl.uniform4fv(U(p, "uV"), vbuf);
    };

    // dye: xs, ys are particle positions (cm); each particle stands for `area / count` cm^2
    this.setDye = function (xs, ys, area) {
      if (!floatOK) return;
      const n = Math.min(NP, xs.length), data = new Float32Array(NP * 4);
      for (let i = 0; i < n; i++) { data[4 * i] = xs[i]; data[4 * i + 1] = ys[i]; data[4 * i + 3] = 1; }
      for (const t of pTex) { gl.bindTexture(gl.TEXTURE_2D, t); gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, SIDE, SIDE, gl.RGBA, gl.FLOAT, data); }
      dyeOn = n > 0; dyeWeight = area / n;
    };
    this.clearDye = function () { dyeOn = false; };
    this.dyeCapacity = NP;
    // one step of dt for the dye; `mid` = vortex positions [[x, y, G], ...] at the middle of the step
    this.stepDye = function (dt, mid, o) {
      if (!dyeOn) return;
      gl.useProgram(pAdvect); gl.bindVertexArray(quad); setCommon(pAdvect, o, mid); gl.uniform1f(U(pAdvect, "uDt"), dt);
      gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, pTex[pCur]); gl.uniform1i(U(pAdvect, "uPos"), 0);
      gl.bindFramebuffer(gl.FRAMEBUFFER, pFbo[1 - pCur]); gl.viewport(0, 0, SIDE, SIDE); gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
      gl.bindFramebuffer(gl.FRAMEBUFFER, null); pCur = 1 - pCur;
    };

    // o: {scale, cx, cy} for a straight-down view, or {camera: {pos, target, fov}} for a perspective one
    this.render = function (o) {
      const W = canvas.width, H = canvas.height, k = o.k ?? 6.2, depth = k / (1 - 1 / 1.333);
      const sc = o.scale ?? 0.03, cx = o.cx ?? 0, cy = o.cy ?? 0, m = 1.0;
      const cwin = o.causticWin || [cx - W / 2 * sc - m, cy - H / 2 * sc - m, cx + W / 2 * sc + m, cy + H / 2 * sc + m];
      const dwin = o.dyeWin || cwin;
      if (floatOK && o.caustics !== false) {
        gl.bindFramebuffer(gl.FRAMEBUFFER, cFbo); gl.viewport(0, 0, CW, CH); gl.clearColor(0, 0, 0, 1); gl.clear(gl.COLOR_BUFFER_BIT);
        gl.useProgram(pCaustic); gl.bindVertexArray(mesh); setCommon(pCaustic, o);
        gl.uniform2f(U(pCaustic, "uMin"), cwin[0], cwin[1]); gl.uniform2f(U(pCaustic, "uMax"), cwin[2], cwin[3]);
        const shf = o.sunShift || [0, 0]; gl.uniform2f(U(pCaustic, "uShift"), shf[0], shf[1]); gl.uniform1f(U(pCaustic, "uK"), k);
        gl.enable(gl.BLEND); gl.blendFunc(gl.ONE, gl.ONE); gl.drawElements(gl.TRIANGLES, nIdx, gl.UNSIGNED_INT, 0); gl.disable(gl.BLEND);
        const sig = Math.max(0.6, (o.sunBlur ?? 0.045) / ((cwin[2] - cwin[0]) / CW));      // sun's disk, in texels
        gl.useProgram(pBlur); gl.bindVertexArray(quad); gl.uniform1f(U(pBlur, "uSigma"), sig); gl.uniform1i(U(pBlur, "uSrc"), 0); gl.activeTexture(gl.TEXTURE0);
        gl.bindFramebuffer(gl.FRAMEBUFFER, bFbo); gl.bindTexture(gl.TEXTURE_2D, cTex); gl.uniform2f(U(pBlur, "uStep"), 1 / CW, 0); gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
        gl.bindFramebuffer(gl.FRAMEBUFFER, cFbo); gl.bindTexture(gl.TEXTURE_2D, bTex); gl.uniform2f(U(pBlur, "uStep"), 0, (cwin[2] - cwin[0]) / CW / (cwin[3] - cwin[1])); gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
      }
      if (floatOK) {
        if (dyeOn && o.dye !== false) {
          gl.bindFramebuffer(gl.FRAMEBUFFER, dFbo); gl.viewport(0, 0, DW, DH); gl.clearColor(0, 0, 0, 0); gl.clear(gl.COLOR_BUFFER_BIT);
          gl.useProgram(pSplat); gl.bindVertexArray(empty); gl.enable(gl.BLEND); gl.blendFunc(gl.ONE, gl.ONE);
          gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, pTex[pCur]); gl.uniform1i(U(pSplat, "uPos"), 0);
          gl.uniform2f(U(pSplat, "uMin"), dwin[0], dwin[1]); gl.uniform2f(U(pSplat, "uMax"), dwin[2], dwin[3]); gl.uniform1i(U(pSplat, "uSide"), SIDE);
          gl.uniform1f(U(pSplat, "uW"), dyeWeight / ((dwin[2] - dwin[0]) / DW * (dwin[3] - dwin[1]) / DH)); gl.drawArrays(gl.POINTS, 0, NP);
          gl.disable(gl.BLEND);
        }
      }
      gl.bindFramebuffer(gl.FRAMEBUFFER, null); gl.viewport(0, 0, W, H);
      gl.useProgram(pMain); gl.bindVertexArray(quad); setCommon(pMain, o);
      gl.uniform2f(U(pMain, "uRes"), W, H); gl.uniform2f(U(pMain, "uCenter"), cx, cy); gl.uniform1f(U(pMain, "uScale"), sc);
      if (o.camera) { const b = cameraBasis(o.camera); gl.uniform1f(U(pMain, "uPersp"), 1); gl.uniform3fv(U(pMain, "uCamPos"), b.pos); gl.uniform3fv(U(pMain, "uCamF"), b.F); gl.uniform3fv(U(pMain, "uCamR"), b.R); gl.uniform3fv(U(pMain, "uCamU"), b.U); gl.uniform1f(U(pMain, "uTanH"), b.tanH); }
      else gl.uniform1f(U(pMain, "uPersp"), 0);
      const sd = norm3(o.sunDir || [0.106, 0.141, 1]); gl.uniform3f(U(pMain, "uSunDir"), sd[0], sd[1], sd[2]);
      gl.uniform1f(U(pMain, "uDepth"), depth); gl.uniform1f(U(pMain, "uMurk"), o.murk ?? 0.025); const wc = o.waterColor || [0.07, 0.12, 0.10]; gl.uniform3f(U(pMain, "uWaterCol"), wc[0], wc[1], wc[2]); gl.uniform1f(U(pMain, "uK"), k);
      gl.uniform1f(U(pMain, "uGlint"), o.glint ?? 1); gl.uniform1f(U(pMain, "uDebug"), o.debug ? 1 : 0); gl.uniform1f(U(pMain, "uSlopeVis"), o.slopeVis ?? (o.camera ? 1.3 : 3));
      gl.uniform2f(U(pMain, "uCMin"), cwin[0], cwin[1]); gl.uniform2f(U(pMain, "uCMax"), cwin[2], cwin[3]);
      gl.uniform2f(U(pMain, "uDMin"), dwin[0], dwin[1]); gl.uniform2f(U(pMain, "uDMax"), dwin[2], dwin[3]);
      gl.uniform1f(U(pMain, "uCausticOn"), floatOK && o.caustics !== false ? 1 : 0);
      gl.uniform1f(U(pMain, "uDyeOn"), floatOK && dyeOn && o.dye !== false ? 1 : 0);
      const T = o.dyeTransmit || [0.92, 0.16, 0.42]; gl.uniform3f(U(pMain, "uDyeT"), T[0], T[1], T[2]);
      gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, cTex); gl.uniform1i(U(pMain, "uCaustic"), 0);
      gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D, dTex); gl.uniform1i(U(pMain, "uDens"), 1);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    };
  }
  WaterRenderer.project = project; WaterRenderer.unproject = unproject;

  // fill a polygon [[x, y], ...] with about n jittered sample points (for dye)
  WaterRenderer.fillPolygon = function (poly, n, seed = 1) {
    let area = 0, x0 = 1e9, x1 = -1e9, y0 = 1e9, y1 = -1e9;
    for (let i = 0; i < poly.length; i++) { const [ax, ay] = poly[i], [bx, by] = poly[(i + 1) % poly.length]; area += ax * by - bx * ay;
      x0 = Math.min(x0, ax); x1 = Math.max(x1, ax); y0 = Math.min(y0, ay); y1 = Math.max(y1, ay); }
    area = Math.abs(area) / 2; const h = Math.sqrt(area / n), xs = [], ys = [];
    let s = seed >>> 0; const rnd = () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
    for (let y = y0 + h / 2; y < y1; y += h) {
      const cuts = [];
      for (let i = 0; i < poly.length; i++) { const [ax, ay] = poly[i], [bx, by] = poly[(i + 1) % poly.length];
        if ((ay > y) !== (by > y)) cuts.push(ax + (y - ay) / (by - ay) * (bx - ax)); }
      cuts.sort((a, b) => a - b);
      for (let c = 0; c + 1 < cuts.length; c += 2)
        for (let x = Math.ceil((cuts[c] - x0) / h) * h + x0; x < cuts[c + 1]; x += h) { xs.push(x + (rnd() - 0.5) * h); ys.push(y + (rnd() - 0.5) * h); }
    }
    return { xs, ys, area };
  };
  root.WaterRenderer = WaterRenderer;
})(typeof globalThis !== 'undefined' ? globalThis : this);
