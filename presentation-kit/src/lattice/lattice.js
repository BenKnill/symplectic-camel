// Exact lattice standard map on the 256 x 256 torus, plus the float64 map it approximates.
// Mirrors kernel/lattice_echo.S byte for byte: pts is a Uint8Array of (x, p) pairs.
(function (root) {
  const N = 256;
  function kickTable(K) {            // kick[x] = round(N K/(2 pi) sin(2 pi x/N)) mod N
    const t = new Uint8Array(N);
    for (let x = 0; x < N; x++) {
      const v = Math.round(N * K / (2 * Math.PI) * Math.sin(2 * Math.PI * x / N));
      t[x] = ((v % N) + N) % N;
    }
    return t;
  }
  function fwd(pts, kick) {          // p <- p + kick[x]; x <- x + p
    for (let i = 0; i < pts.length; i += 2) {
      const p = (pts[i + 1] + kick[pts[i]]) & 255;
      pts[i + 1] = p; pts[i] = (pts[i] + p) & 255;
    }
  }
  function bwd(pts, kick) {          // x <- x - p; p <- p - kick[x]
    for (let i = 0; i < pts.length; i += 2) {
      const x = (pts[i] - pts[i + 1]) & 255;
      pts[i] = x; pts[i + 1] = (pts[i + 1] - kick[x]) & 255;
    }
  }
  function floatFwd(xs, ys, K) {     // unit torus: y <- y + K/(2 pi) sin(2 pi x); x <- x + y
    const a = K / (2 * Math.PI);
    for (let i = 0; i < xs.length; i++) {
      let y = ys[i] + a * Math.sin(2 * Math.PI * xs[i]); y -= Math.floor(y);
      let x = xs[i] + y; x -= Math.floor(x);
      xs[i] = x; ys[i] = y;
    }
  }
  function floatBwd(xs, ys, K) {
    const a = K / (2 * Math.PI);
    for (let i = 0; i < xs.length; i++) {
      let x = xs[i] - ys[i]; x -= Math.floor(x);
      let y = ys[i] - a * Math.sin(2 * Math.PI * x); y -= Math.floor(y);
      xs[i] = x; ys[i] = y;
    }
  }
  // Whole-cell shears. shearP is exactly lattice_fwd(T) followed by lattice_bwd(zero table);
  // shearX is the same with the two bytes of each point swapped.
  function shearP(pts, T) { for (let i = 0; i < pts.length; i += 2) pts[i + 1] = (pts[i + 1] + T[pts[i]]) & 255; }
  function shearX(pts, T) { for (let i = 0; i < pts.length; i += 2) pts[i] = (pts[i] + T[pts[i + 1]]) & 255; }
  const neg = T => T.map(v => (256 - v) & 255);
  // Rotation by deg (counterclockwise on screen) as three shears (Paeth), about the display centre.
  // x runs 0..255 with centre 127.5; p is centred so that display row 127.5 is p = -0.5.
  function rotationTables(deg) {
    const th = deg * Math.PI / 180, A = new Uint8Array(N), B = new Uint8Array(N);
    for (let v = 0; v < N; v++) {
      const ps = (v >= N / 2 ? v - N : v) + 0.5;
      A[v] = ((Math.round(-Math.tan(th / 2) * ps) % N) + N) % N;
      B[v] = ((Math.round(Math.sin(th) * (v - 127.5)) % N) + N) % N;
    }
    return { A, B, nA: neg(A), nB: neg(B) };
  }
  function rotate(pts, R) { shearX(pts, R.A); shearP(pts, R.B); shearX(pts, R.A); }
  function unrotate(pts, R) { shearX(pts, R.nA); shearP(pts, R.nB); shearX(pts, R.nA); }
  // Display convention: column = x, row = (N/2 - 1 - p) mod N, so the elliptic island sits mid-frame.
  function initialPoints() {         // one point per pixel, in display order
    const pts = new Uint8Array(2 * N * N);
    for (let r = 0; r < N; r++) for (let c = 0; c < N; c++) {
      const i = 2 * (r * N + c); pts[i] = c; pts[i + 1] = (N / 2 - 1 - r + N) % N;
    }
    return pts;
  }
  root.Lattice = { N, kickTable, fwd, bwd, floatFwd, floatBwd, initialPoints, shearP, shearX, rotationTables, rotate, unrotate };
})(typeof globalThis !== 'undefined' ? globalThis : this);
