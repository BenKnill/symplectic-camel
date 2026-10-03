// Soap films on wire frames: a set of film patches (quads or triangles) that share edges. Vertices on a wire are
// fixed; every other vertex moves downhill on total area (the film's energy is surface tension × area).
// Where three patches share an edge, that edge is a free "triple line"; the area gradient there is the sum of
// three pulls, and at equilibrium they balance only at 120° — Plateau's first rule, emerging, not imposed.
// Where four triple lines meet, the vertex settles at the tetrahedral angle (≈109.47°) — Plateau's second rule.
(function (root) {
  const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]], add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]], mul = (a, s) => [a[0] * s, a[1] * s, a[2] * s];
  const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]], dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2], len = a => Math.hypot(a[0], a[1], a[2]);
  const lerp3 = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
  function Film(wires, N = 16) {
    // wires: list of [p, q] segments (the frame). Vertices lying on a wire are pinned.
    const V = [], key = new Map(), tris = [], triPatch = [], patches = [];
    const vid = p => { const k = p.map(v => Math.round(v * 1e5)).join(","); let i = key.get(k); if (i === undefined) { i = V.length; V.push([...p]); key.set(k, i); } return i; };
    const onWire = p => wires.some(([a, b]) => { const ab = sub(b, a), t = Math.max(0, Math.min(1, dot(sub(p, a), ab) / dot(ab, ab))); return len(sub(p, add(a, mul(ab, t)))) < 1e-6; });
    const film = { V, tris, triPatch, patches, wires };
    film.quad = (a, b, c, d) => {                              // corners in order around the patch
      const P = patches.length, g = []; patches.push({ kind: "quad", corners: [a, b, c, d] });
      for (let j = 0; j <= N; j++) { g.push([]); for (let i = 0; i <= N; i++) g[j].push(vid(lerp3(lerp3(a, b, i / N), lerp3(d, c, i / N), j / N))); }
      for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) { const q = [g[j][i], g[j][i + 1], g[j + 1][i + 1], g[j + 1][i]]; tris.push([q[0], q[1], q[2]], [q[0], q[2], q[3]]); triPatch.push(P, P); }
      return film;
    };
    film.tri = (a, b, c) => {
      const P = patches.length, g = {}; patches.push({ kind: "tri", corners: [a, b, c] });
      const at = (i, j) => { const k = N - i - j; return vid([(a[0] * k + b[0] * i + c[0] * j) / N, (a[1] * k + b[1] * i + c[1] * j) / N, (a[2] * k + b[2] * i + c[2] * j) / N]); };
      for (let j = 0; j < N; j++) for (let i = 0; i < N - j; i++) { tris.push([at(i, j), at(i + 1, j), at(i, j + 1)]); triPatch.push(P); if (i + j < N - 1) { tris.push([at(i + 1, j), at(i + 1, j + 1), at(i, j + 1)]); triPatch.push(P); } }
      return film;
    };
    film.finish = () => {
      film.fixed = V.map(onWire);
      // how many patches meet at each vertex, and the triple-line edges (edges used by 3+ patches)
      const vp = V.map(() => new Set()); tris.forEach((t, k) => t.forEach(v => vp[v].add(triPatch[k])));
      film.patchCount = vp.map(s => s.size);
      const edgeP = new Map(); tris.forEach((t, k) => { for (let e = 0; e < 3; e++) { const a = t[e], b = t[(e + 1) % 3], kk = a < b ? a + "," + b : b + "," + a; if (!edgeP.has(kk)) edgeP.set(kk, new Set()); edgeP.get(kk).add(triPatch[k]); } });
      film.tripleEdges = [...edgeP.entries()].filter(([, s]) => s.size >= 3).map(([k]) => k.split(",").map(Number)).filter(([a, b]) => !(film.fixed[a] && film.fixed[b]));
      film.junctions = V.map((_, i) => i).filter(i => !film.fixed[i] && film.patchCount[i] >= 5);   // tetrahedral points: six films meet there
      film.nbr = V.map(() => new Set()); tris.forEach(t => { for (let e = 0; e < 3; e++) { film.nbr[t[e]].add(t[(e + 1) % 3]); film.nbr[t[(e + 1) % 3]].add(t[e]); } });
      // vertices on triple lines only smooth along the line
      const tripleNb = V.map(() => []); film.tripleEdges.forEach(([a, b]) => { tripleNb[a].push(b); tripleNb[b].push(a); }); film.tripleNb = tripleNb;
      return film;
    };
    film.normalAt = i => { let n = [0, 0, 0]; for (const [a, b, c] of tris) if (a === i || b === i || c === i) n = add(n, cross(sub(V[b], V[a]), sub(V[c], V[a]))); const l = len(n); return l > 1e-12 ? mul(n, 1 / l) : null; };
    film.area = () => tris.reduce((s, [a, b, c]) => s + 0.5 * len(cross(sub(V[b], V[a]), sub(V[c], V[a]))), 0);
    // one step of area descent (gradient scaled by the local area, ≈ mean-curvature flow) plus gentle tangential smoothing
    film.step = (tau = 0.1) => {                             // explicit stability for this triangulation needs tau below ~0.17
      const G = V.map(() => [0, 0, 0]), Nn = V.map(() => [0, 0, 0]);
      for (const [a, b, c] of tris) {
        const n = cross(sub(V[b], V[a]), sub(V[c], V[a])), l = len(n); if (l < 1e-14) continue; const u = mul(n, 1 / l);
        G[a] = add(G[a], mul(cross(u, sub(V[c], V[b])), 0.5)); G[b] = add(G[b], mul(cross(u, sub(V[a], V[c])), 0.5)); G[c] = add(G[c], mul(cross(u, sub(V[b], V[a])), 0.5));
        Nn[a] = add(Nn[a], n); Nn[b] = add(Nn[b], n); Nn[c] = add(Nn[c], n);
      }
      let maxMove = 0;
      for (let i = 0; i < V.length; i++) {
        if (film.fixed[i]) continue;
        const pc = film.patchCount[i], tl = film.tripleNb[i]; let d, sm = [0, 0, 0];
        if (pc === 1) {                                        // inside one film: move along the normal (mean-curvature flow), even out spacing in the tangent plane
          const nl = len(Nn[i]), nn = nl > 1e-14 ? mul(Nn[i], 1 / nl) : [0, 0, 1]; d = mul(nn, -tau * dot(G[i], nn));
          const nb = [...film.nbr[i]], avg = mul(nb.reduce((s, j) => add(s, V[j]), [0, 0, 0]), 1 / nb.length); sm = mul(sub(avg, V[i]), 0.2); sm = sub(sm, mul(nn, dot(sm, nn)));
        } else if (tl.length === 2) {                          // on a triple line: move across the line, even out spacing along it
          const T0 = sub(V[tl[1]], V[tl[0]]), T = mul(T0, 1 / Math.max(len(T0), 1e-14)); d = mul(sub(G[i], mul(T, dot(G[i], T))), -tau / pc);
          const avg = mul(add(V[tl[0]], V[tl[1]]), 0.5); sm = mul(T, 0.2 * dot(sub(avg, V[i]), T));
        } else d = mul(G[i], -tau / pc);                        // where four triple lines meet
        const m = add(d, sm); V[i] = add(V[i], m); maxMove = Math.max(maxMove, len(m));
      }
      return maxMove;
    };
    // angles between the three films at a triple-line vertex (for the 120° readout)
    film.tripleAngles = i => {                              // one unit direction per film leaving a triple-line vertex, perpendicular to the line
      const t = film.tripleNb[i]; if (t.length < 2) return null; const dir = sub(V[t[1]], V[t[0]]), T = mul(dir, 1 / len(dir)), byPatch = new Map();
      tris.forEach((tr, k) => { if (!tr.includes(i)) return; for (const j of tr) { if (j === i || t.includes(j)) continue; const v = sub(V[j], V[i]), p = sub(v, mul(T, dot(v, T))); const acc = byPatch.get(triPatch[k]) || [0, 0, 0]; byPatch.set(triPatch[k], add(acc, mul(p, 1 / Math.max(len(p), 1e-12)))); } });
      return [...byPatch.values()].map(v => mul(v, 1 / len(v)));
    };
    return film;
  }
  // frames ------------------------------------------------------------------
  function tetrahedron(N = 18) {
    const s = 1, P = [[s, s, s], [s, -s, -s], [-s, s, -s], [-s, -s, s]], E = [[0, 1], [0, 2], [0, 3], [1, 2], [1, 3], [2, 3]];
    const f = Film(E.map(([a, b]) => [P[a], P[b]]), N), c = [0.13, -0.08, 0.05];                     // start the junction off-centre; it finds the centre
    for (const [a, b] of E) f.tri(P[a], P[b], c);
    return f.finish();
  }
  function cube(N = 14, s0 = 0.34, axis = 2) {
    // the famous cube film: a small central square parallel to two faces, joined to the 12 edges by 12 films
    const perm = v => axis === 2 ? v : axis === 0 ? [v[2], v[0], v[1]] : [v[1], v[2], v[0]];
    const C = (x, y, z) => perm([x, y, z]), wires = [];
    for (const a of [-1, 1]) for (const b of [-1, 1]) { wires.push([C(a, b, -1), C(a, b, 1)], [C(a, -1, b), C(a, 1, b)], [C(-1, a, b), C(1, a, b)]); }
    const f = Film(wires, N), q = (x, y) => C(x * s0, y * s0, 0);
    f.quad(q(-1, -1), q(1, -1), q(1, 1), q(-1, 1));                                                   // the central square
    for (const x of [-1, 1]) for (const y of [-1, 1]) f.tri(C(x, y, -1), C(x, y, 1), q(x, y));         // films on the four edges parallel to the square's normal
    for (const z of [-1, 1]) {
      for (const x of [-1, 1]) f.quad(C(x, -1, z), C(x, 1, z), q(x, 1), q(x, -1));                     // films on the edges of the top/bottom faces
      for (const y of [-1, 1]) f.quad(C(-1, y, z), C(1, y, z), q(1, y), q(-1, y));
    }
    return f.finish();
  }
  root.Surface = { Film, tetrahedron, cube };
})(typeof window !== "undefined" ? window : globalThis);
