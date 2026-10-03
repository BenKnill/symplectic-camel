// A soap film between two plates, seen from above: straight film walls joining pins (terminals) and free
// junctions (Steiner points). Surface tension pulls every wall shorter, so the network does gradient descent on
// its total length. Like a real film it changes topology when a wall shrinks to nothing:
//  - junction–junction wall vanishes → T1 flip (the four neighbours re-pair the other way that is shorter);
//  - junction–pin wall vanishes → the junction is absorbed by the pin (allowed when the pin's angle is ≥ 120°);
//  - two walls leave a pin at less than 120° → they peel off into a new junction.
// The result is a *locally* shortest network: every junction has three walls at 120°, but it need not be the
// global Steiner minimal tree. That is the point.
(function (root) {
  const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
  function Network(pins, rnd = Math.random) {
    const net = { pins: pins.map(p => ({ x: p.x, y: p.y })), jx: [], edges: [], rnd, events: [] };
    const n = pins.length;
    // nodes: 0..n-1 pins, n.. junctions (net.jx[k] is node n+k); edges are [a, b] node pairs
    net.P = i => i < n ? net.pins[i] : net.jx[i - n];
    net.isPin = i => i < n;
    net.nbrs = i => net.edges.filter(e => e[0] === i || e[1] === i).map(e => e[0] === i ? e[1] : e[0]);
    net.length = () => net.edges.reduce((s, [a, b]) => s + dist(net.P(a), net.P(b)), 0);
    // a random full Steiner topology: grow a tree by splitting random edges
    net.dip = () => {
      net.jx = []; net.edges = []; net.events = [];
      if (n < 2) return net; if (n === 2) { net.edges = [[0, 1]]; return net; }
      const order = [...Array(n).keys()].sort(() => rnd() - 0.5);
      const cx = net.pins.reduce((s, p) => s + p.x, 0) / n, cy = net.pins.reduce((s, p) => s + p.y, 0) / n;
      const newJ = () => { net.jx.push({ x: cx + (rnd() - 0.5) * 0.3, y: cy + (rnd() - 0.5) * 0.3 }); return n + net.jx.length - 1; };
      const j0 = newJ(); net.edges.push([order[0], j0], [order[1], j0], [order[2], j0]);
      for (let k = 3; k < n; k++) { const e = net.edges.splice(Math.floor(rnd() * net.edges.length), 1)[0], j = newJ(); net.edges.push([e[0], j], [e[1], j], [order[k], j]); }
      // start each junction near the mean of its neighbours, so the first frames look like a film snapping taut
      for (let it = 0; it < 3; it++) net.jx.forEach((J, k) => { const nb = net.nbrs(n + k).map(net.P); J.x = nb.reduce((s, q) => s + q.x, 0) / nb.length + (rnd() - 0.5) * 0.05; J.y = nb.reduce((s, q) => s + q.y, 0) / nb.length + (rnd() - 0.5) * 0.05; });
      return net;
    };
    const EPS = 1e-3;
    const removeJ = k => {                                   // delete junction node n+k and renumber
      const id = n + k; net.jx.splice(k, 1);
      net.edges = net.edges.filter(e => e[0] !== id && e[1] !== id).map(e => e.map(v => v > id ? v - 1 : v));
    };
    const angleAt = (c, a, b) => { const u = [a.x - c.x, a.y - c.y], v = [b.x - c.x, b.y - c.y]; return Math.acos(Math.max(-1, Math.min(1, (u[0] * v[0] + u[1] * v[1]) / (Math.hypot(...u) * Math.hypot(...v) + 1e-12)))); };
    // one relaxation step; returns the largest junction move
    net.step = (alpha = 0.6) => {
      let moved = 0;
      net.jx.forEach((J, k) => {                              // damped Weiszfeld step toward the length-minimising point for fixed neighbours
        const nb = net.nbrs(n + k).map(net.P); let sx = 0, sy = 0, sw = 0;
        for (const q of nb) { const w = 1 / Math.max(dist(J, q), 1e-9); sx += q.x * w; sy += q.y * w; sw += w; }
        const nx = J.x + alpha * (sx / sw - J.x), ny = J.y + alpha * (sy / sw - J.y); moved = Math.max(moved, Math.hypot(nx - J.x, ny - J.y)); J.x = nx; J.y = ny;
      });
      net.fixTopology(); return moved;
    };
    net.fixTopology = () => {
      let changed = true, guard = 0;
      while (changed && guard++ < 50) {
        changed = false;
        // junction–pin collapse: absorb the junction into the pin
        for (let k = 0; k < net.jx.length && !changed; k++) {
          const id = n + k, nb = net.nbrs(id), pin = nb.find(v => net.isPin(v) && dist(net.P(v), net.jx[k]) < EPS * 5);
          if (pin === undefined) continue;
          const others = nb.filter(v => v !== pin); removeJ(k);
          const ren = v => v > id ? v - 1 : v; for (const o of others) net.edges.push([pin, ren(o)]);
          net.events.push({ type: "absorb", at: { ...net.pins[pin] } }); changed = true;
        }
        // junction–junction collapse: T1 flip to the shorter re-pairing
        for (let ei = 0; ei < net.edges.length && !changed; ei++) {
          const [a, b] = net.edges[ei]; if (net.isPin(a) || net.isPin(b)) continue;
          const A = net.P(a), B = net.P(b); if (dist(A, B) > EPS) continue;
          const na = net.nbrs(a).filter(v => v !== b), nbb = net.nbrs(b).filter(v => v !== a); if (na.length !== 2 || nbb.length !== 2) continue;
          const pairings = [[[na[0], nbb[0]], [na[1], nbb[1]]], [[na[0], nbb[1]], [na[1], nbb[0]]]];
          const mid = { x: (A.x + B.x) / 2, y: (A.y + B.y) / 2 };
          const cost = ([[p1, q1], [p2, q2]]) => { const c1 = { x: (net.P(p1).x + net.P(q1).x + mid.x) / 3, y: (net.P(p1).y + net.P(q1).y + mid.y) / 3 }, c2 = { x: (net.P(p2).x + net.P(q2).x + mid.x) / 3, y: (net.P(p2).y + net.P(q2).y + mid.y) / 3 };
            return dist(c1, net.P(p1)) + dist(c1, net.P(q1)) + dist(c2, net.P(p2)) + dist(c2, net.P(q2)) + dist(c1, c2); };
          const best = cost(pairings[0]) < cost(pairings[1]) ? pairings[0] : pairings[1];
          net.edges = net.edges.filter(e => !(e.includes(a) || e.includes(b)));
          const [[p1, q1], [p2, q2]] = best, Pa = net.P(a), Pb = net.P(b);
          Pa.x = (net.P(p1).x + net.P(q1).x + mid.x * 4) / 6; Pa.y = (net.P(p1).y + net.P(q1).y + mid.y * 4) / 6;
          Pb.x = (net.P(p2).x + net.P(q2).x + mid.x * 4) / 6; Pb.y = (net.P(p2).y + net.P(q2).y + mid.y * 4) / 6;
          net.edges.push([a, p1], [a, q1], [b, p2], [b, q2], [a, b]);
          net.events.push({ type: "flip", at: mid }); changed = true;
        }
        // two walls leaving a pin at under 120°: peel them off into a new junction
        for (let p = 0; p < n && !changed; p++) {
          const nb = net.nbrs(p); if (nb.length < 2) continue;
          const P = net.pins[p], ang = nb.map(v => Math.atan2(net.P(v).y - P.y, net.P(v).x - P.x)), ord = nb.map((v, i) => i).sort((i, j) => ang[i] - ang[j]);
          for (let t = 0; t < ord.length && !changed; t++) {
            const i = ord[t], j = ord[(t + 1) % ord.length]; if (nb.length === 2 && t === 1) break;
            let da = ang[j] - ang[i]; if (da < 0) da += 2 * Math.PI;
            if (da < 2 * Math.PI / 3 - 0.02) {
              const bis = ang[i] + da / 2, off = 0.02; net.jx.push({ x: P.x + off * Math.cos(bis), y: P.y + off * Math.sin(bis) }); const J = n + net.jx.length - 1;
              net.edges = net.edges.filter(e => !((e[0] === p && (e[1] === nb[i] || e[1] === nb[j])) || (e[1] === p && (e[0] === nb[i] || e[0] === nb[j]))));
              net.edges.push([J, nb[i]], [J, nb[j]], [J, p]); net.events.push({ type: "peel", at: { ...P } }); changed = true;
            }
          }
        }
      }
    };
    net.relax = (maxIt = 4000, tol = 1e-7) => { for (let i = 0; i < maxIt; i++) if (net.step() < tol) break; return net.length(); };
    net.snapshot = () => ({ jx: net.jx.map(J => ({ ...J })), edges: net.edges.map(e => [...e]) });
    net.restore = s => { net.jx = s.jx.map(J => ({ ...J })); net.edges = s.edges.map(e => [...e]); };
    net.shake = (amp = 0.25) => { net.jx.forEach(J => { J.x += (rnd() - 0.5) * amp; J.y += (rnd() - 0.5) * amp; }); };
    return net;
  }
  const mst = pins => {                                        // Prim's minimum spanning tree length (the network with no junctions)
    const n = pins.length, inT = new Array(n).fill(false), d = new Array(n).fill(Infinity); d[0] = 0; let L = 0;
    for (let k = 0; k < n; k++) { let u = -1; for (let i = 0; i < n; i++) if (!inT[i] && (u < 0 || d[i] < d[u])) u = i; inT[u] = true; L += d[u]; for (let v = 0; v < n; v++) if (!inT[v]) d[v] = Math.min(d[v], dist(pins[u], pins[v])); }
    return L;
  };
  const bestOf = (pins, tries = 200, rnd = Math.random) => { let best = null; for (let t = 0; t < tries; t++) { const net = Network(pins, rnd).dip(); const L = net.relax(); if (!best || L < best.L - 1e-9) best = { L, snap: net.snapshot() }; } return best; };
  root.Steiner = { Network, mst, bestOf };
})(typeof window !== "undefined" ? window : globalThis);
