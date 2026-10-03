// Presentation adapters only. The existing Steiner and Surface solvers are unchanged.
(function (root) {
  const seeds = [1, 4];
  const pins = Array.from({ length: 6 }, (_, i) => ({ x: Math.cos(i * Math.PI / 3), y: Math.sin(i * Math.PI / 3) }));
  const referenceEdges = [[0, 1], [1, 2], [2, 3], [3, 4], [4, 5]];
  const referenceLength = referenceEdges.reduce((s, [a, b]) => s + Math.hypot(pins[a].x - pins[b].x, pins[a].y - pins[b].y), 0);
  const seeded = initial => { let state = initial; return () => { state = (Math.imul(state, 1664525) + 1013904223) >>> 0; return state / 4294967296; }; };
  const cache = new Map();
  function network(dip = 0) {
    const seed = seeds[dip % seeds.length], key = 'net-' + seed;
    if (!cache.has(key)) {
      const net = Steiner.Network(pins, seeded(seed)).dip();
      net.relax();
      cache.set(key, net);
    }
    return cache.get(key);
  }
  function film(kind = 'tetrahedron') {
    if (!cache.has(kind)) {
      const model = Surface[kind](8), initialArea = model.area();
      let lastMove = 0;
      for (let i = 0; i < 600; i++) lastMove = model.step();
      cache.set(kind, { model, initialArea, lastMove, steps: 600 });
    }
    return cache.get(kind);
  }
  function digest(values) {
    let hash = 2166136261;
    for (const value of values.flat(Infinity)) { hash ^= Math.round(value * 1e8); hash = Math.imul(hash, 16777619); }
    return (hash >>> 0).toString(16).padStart(8, '0');
  }
  root.SoapModels = { pins, referenceEdges, referenceLength, seeds, network, film, digest };
})(typeof window !== 'undefined' ? window : globalThis);
