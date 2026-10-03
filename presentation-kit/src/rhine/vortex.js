// Point vortices on a water surface (units: cm, s).
//
// Each vortex has circulation G (cm^2/s, positive = counterclockwise) and a smooth core of
// radius a (the Scully profile): swirl speed G r / (2 pi (r^2 + a^2)). The same profile gives
// the surface dip by cyclostrophic balance, eta(r) = -G^2 / (8 pi^2 g (r^2 + a^2)).
//
// Kirchhoff's equations are Hamiltonian with each vortex's (x, y) a conjugate pair weighted
// by G. We integrate them with the implicit midpoint rule, which is symplectic and keeps the
// linear and angular impulse exactly. Tracers (dust, dye) have zero circulation: they are
// carried by the flow but do not push back.
(function (root) {
  const TWO_PI = 2 * Math.PI, G_ACC = 981;

  function makeSystem(opts = {}) {
    return { x: [], y: [], G: [], a: opts.a ?? 0.6, U: opts.U ?? 0, wall: opts.wall ?? null };
  }
  function add(sys, x, y, G) { sys.x.push(x); sys.y.push(y); sys.G.push(G); return sys.x.length - 1; }

  // velocity at (px, py) induced by vortices at positions X, Y (skip index `self`)
  function velAt(sys, X, Y, px, py, self) {
    let u = sys.U, v = 0; const a2 = sys.a * sys.a, n = X.length;
    for (let j = 0; j < n; j++) {
      const g = sys.G[j] / TWO_PI;
      if (j !== self) { const dx = px - X[j], dy = py - Y[j], s = dx * dx + dy * dy + a2; u -= g * dy / s; v += g * dx / s; }
      if (sys.wall !== null) {                           // mirror image across the bank y = wall
        const iy = 2 * sys.wall - Y[j], dx = px - X[j], dy = py - iy, s = dx * dx + dy * dy + a2;
        u += g * dy / s; v -= g * dx / s;
      }
    }
    return [u, v];
  }

  // one implicit-midpoint step for vortices and tracers together
  function step(sys, dt, tracers) {
    const n = sys.x.length, X0 = sys.x.slice(), Y0 = sys.y.slice();
    let X1 = X0.slice(), Y1 = Y0.slice();
    const Xm = new Array(n), Ym = new Array(n);
    for (let it = 0; it < 6; it++) {
      for (let k = 0; k < n; k++) { Xm[k] = 0.5 * (X0[k] + X1[k]); Ym[k] = 0.5 * (Y0[k] + Y1[k]); }
      const nx = new Array(n), ny = new Array(n);
      for (let k = 0; k < n; k++) { const [u, v] = velAt(sys, Xm, Ym, Xm[k], Ym[k], k); nx[k] = X0[k] + dt * u; ny[k] = Y0[k] + dt * v; }
      X1 = nx; Y1 = ny;
    }
    for (let k = 0; k < n; k++) { Xm[k] = 0.5 * (X0[k] + X1[k]); Ym[k] = 0.5 * (Y0[k] + Y1[k]); }
    if (tracers) for (const tr of tracers) {
      const px = tr.x, py = tr.y, m = px.length;
      for (let i = 0; i < m; i++) {
        let x1 = px[i], y1 = py[i];
        for (let it = 0; it < 5; it++) { const [u, v] = velAt(sys, Xm, Ym, 0.5 * (px[i] + x1), 0.5 * (py[i] + y1), -1); x1 = px[i] + dt * u; y1 = py[i] + dt * v; }
        px[i] = x1; py[i] = y1;
      }
      if (tr.contour) refine(tr, sys, Xm, Ym);
    }
    sys.x = X1; sys.y = Y1;
    return { Xm, Ym };                                     // vortex positions at mid-step (for GPU tracers)
  }

  // closed dye contour: insert points where the boundary stretches, so the outline stays faithful
  // start from the polygon itself, subdivided linearly so its straight edges stay straight
  function makeContour(pts, maxSeg = 0.2) {
    const x = [], y = [];
    for (let i = 0; i < pts.length; i++) {
      const [x0, y0] = pts[i], [x1, y1] = pts[(i + 1) % pts.length], k = Math.max(1, Math.ceil(Math.hypot(x1 - x0, y1 - y0) / (0.5 * maxSeg)));
      for (let j = 0; j < k; j++) { x.push(x0 + (x1 - x0) * j / k); y.push(y0 + (y1 - y0) * j / k); }
    }
    return { x, y, contour: true, maxSeg };
  }
  function refine(tr) {
    if (tr.maxPts && tr.x.length > tr.maxPts) return;
    const X = tr.x, Y = tr.y, nx = [], ny = [];
    for (let i = 0; i < X.length; i++) {
      const j = (i + 1) % X.length; nx.push(X[i]); ny.push(Y[i]);
      const d = Math.hypot(X[j] - X[i], Y[j] - Y[i]);
      if (d > tr.maxSeg) {                                // quadratic-ish midpoint through neighbours
        const h = (i - 1 + X.length) % X.length, k = (j + 1) % X.length;
        nx.push((9 * (X[i] + X[j]) - (X[h] + X[k])) / 16); ny.push((9 * (Y[i] + Y[j]) - (Y[h] + Y[k])) / 16);
      }
    }
    tr.x = nx; tr.y = ny;
  }
  function area(tr) { let s = 0; const X = tr.x, Y = tr.y, n = X.length; for (let i = 0; i < n; i++) { const j = (i + 1) % n; s += X[i] * Y[j] - X[j] * Y[i]; } return 0.5 * s; }

  // conserved quantities (free space, no current): energy, impulse, angular impulse
  function invariants(sys) {
    let H = 0, Px = 0, Py = 0, Lz = 0; const n = sys.x.length, a2 = sys.a * sys.a;
    for (let i = 0; i < n; i++) {
      Px += sys.G[i] * sys.x[i]; Py += sys.G[i] * sys.y[i]; Lz += sys.G[i] * (sys.x[i] ** 2 + sys.y[i] ** 2);
      for (let j = i + 1; j < n; j++) H -= sys.G[i] * sys.G[j] / (4 * Math.PI) * Math.log((sys.x[i] - sys.x[j]) ** 2 + (sys.y[i] - sys.y[j]) ** 2 + a2);
    }
    return { H, Px, Py, Lz };
  }
  // stream function (the flow's Hamiltonian) at a point
  function psi(sys, px, py) {
    let s = sys.U * py; const a2 = sys.a * sys.a;
    for (let j = 0; j < sys.x.length; j++) {
      s -= sys.G[j] / (4 * Math.PI) * Math.log((px - sys.x[j]) ** 2 + (py - sys.y[j]) ** 2 + a2);
      if (sys.wall !== null) s += sys.G[j] / (4 * Math.PI) * Math.log((px - sys.x[j]) ** 2 + (py - (2 * sys.wall - sys.y[j])) ** 2 + a2);
    }
    return s;
  }
  const dipDepth = (G, a) => G * G / (8 * Math.PI * Math.PI * G_ACC * a * a);   // cm, at the centre

  root.Vortex = { makeSystem, add, velAt, step, makeContour, area, invariants, psi, dipDepth, G_ACC };
})(typeof globalThis !== 'undefined' ? globalThis : this);
