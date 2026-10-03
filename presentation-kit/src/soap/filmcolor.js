// Soap-film colours from thin-film interference.
// A film of water (n = 1.33) of thickness d in air reflects light that bounced off its front and back faces.
// The two reflections interfere with phase difference 4π n d cosθt / λ (plus π from the front face), so each
// wavelength is reflected with Airy reflectance R(λ) = F sin²(δ/2) / (1 + F sin²(δ/2)), F = 4r²/(1 − r²)².
// We integrate R(λ) against the CIE 1931 colour-matching functions (multi-lobe Gaussian fit of Wyman, Sloan &
// Shirley 2013) under a flat illuminant, convert XYZ → linear sRGB, and tone the result for display.
(function (root) {
  const N_WATER = 1.33, r = (N_WATER - 1) / (N_WATER + 1), F = 4 * r * r / ((1 - r * r) ** 2);
  const g = (x, mu, s1, s2) => { const t = (x - mu) / (x < mu ? s1 : s2); return Math.exp(-0.5 * t * t); };
  const cmf = l => [1.056 * g(l, 599.8, 37.9, 31.0) + 0.362 * g(l, 442.0, 16.0, 26.7) - 0.065 * g(l, 501.1, 20.4, 26.2),
                    0.821 * g(l, 568.8, 46.9, 40.5) + 0.286 * g(l, 530.9, 16.3, 31.1),
                    1.217 * g(l, 437.0, 11.8, 36.0) + 0.681 * g(l, 459.0, 26.0, 13.8)];
  const L0 = 380, L1 = 780, NL = 81, dl = (L1 - L0) / (NL - 1);
  const TABLE = Array.from({ length: NL }, (_, i) => { const l = L0 + i * dl; return [l, ...cmf(l)]; });
  const Ynorm = TABLE.reduce((s, t) => s + t[2], 0);
  // reflectance spectrum of a film of thickness d (nm), seen at cos(θ) inside the film = ct → XYZ (normalised so a perfect mirror has Y = 1)
  function filmXYZ(d, ct = 1) {
    let X = 0, Y = 0, Z = 0;
    for (const [l, x, y, z] of TABLE) { const s = Math.sin(2 * Math.PI * N_WATER * d * ct / l), R = F * s * s / (1 + F * s * s); X += R * x; Y += R * y; Z += R * z; }
    return [X / Ynorm, Y / Ynorm, Z / Ynorm];
  }
  const xyz2rgb = ([X, Y, Z]) => [3.2406 * X - 1.5372 * Y - 0.4986 * Z, -0.9689 * X + 1.8758 * Y + 0.0415 * Z, 0.0557 * X - 0.2040 * Y + 1.0570 * Z];
  const gamma = v => v <= 0.0031308 ? 12.92 * v : 1.055 * Math.pow(v, 1 / 2.4) - 0.055;
  // display colour: a film reflects at most ~8 % (Rmax = F/(1+F)), so we expose by 1/Rmax·gain and soft-clip
  const RMAX = F / (1 + F);
  function filmRGB(d, ct = 1, gain = 0.9) {
    const lin = xyz2rgb(filmXYZ(d, ct)).map(v => Math.max(0, v) / RMAX * gain);
    return lin.map(v => gamma(1 - Math.exp(-1.6 * v)));
  }
  // under a sodium lamp there is one wavelength (the D line, 589.3 nm): each thickness is just bright or dark, so
  // the rainbow becomes stripes, one per λ/(2n) ≈ 221 nm of extra thickness, and the thinnest film is dark
  const NA_RGB = [1.0, 0.72, 0.16];
  function sodiumRGB(d, ct = 1, gain = 1.0) {
    const s = Math.sin(2 * Math.PI * N_WATER * d * ct / 589.3), R = F * s * s / (1 + F * s * s), k = Math.min(1, R / RMAX * gain);   // linear: fringes stay sinusoidal
    return NA_RGB.map(v => gamma(v * k));
  }
  // a lookup table, thickness 0..dMax nm, for canvases and WebGL textures (RGBA8)
  function filmLUT(n = 512, dMax = 1600, light = "day") {
    const out = new Uint8Array(n * 4), fn = light === "sodium" ? sodiumRGB : filmRGB;
    for (let i = 0; i < n; i++) { const c = fn(i / (n - 1) * dMax); out[4 * i] = Math.round(255 * c[0]); out[4 * i + 1] = Math.round(255 * c[1]); out[4 * i + 2] = Math.round(255 * c[2]); out[4 * i + 3] = 255; }
    return { data: out, n, dMax, light };
  }
  root.FilmColor = { filmXYZ, filmRGB, sodiumRGB, filmLUT, N_WATER, RMAX, FRINGE_NM: 589.3 / (2 * N_WATER) };
})(typeof window !== "undefined" ? window : globalThis);
