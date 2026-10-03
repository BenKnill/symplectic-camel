/* Live story/controller. Numerical engines stay in the repository's existing files. */
(() => {
  'use strict';
  const $ = id => document.getElementById(id), M = SoapModels;
  const scenes = [
    { beat: 'PREDICT', title: 'Can soap always find the shortest route?', prompt: 'Six pins. A film between two plates. Predict: will one dip find the shortest connected network?', side: 'Make your prediction.', copy: 'Surface tension pulls a film toward less area. Between parallel plates, that means a shorter network.', cue: 'Ask for a show of hands: always shortest, or can get stuck? Reveal one dip. Its junctions look balanced. That alone cannot tell us whether another network is shorter.' },
    { beat: 'INTERVENE', title: 'Same pins. Another answer.', prompt: 'Keep every pin fixed. Change the starting network, then let the same solver settle.', side: 'Try the second dip.', copy: 'Different starting connections can lead to different settled networks. The pin positions and the numerical rule stay the same.', cue: 'Show the five-side competitor first. A shorter connected network disproves global optimality of the first result. Then try the second dip: the overlay clears so its five-edge network can be seen on its own. These two chosen seeds demonstrate possibility, not a success rate.' },
    { beat: 'REVEAL', title: 'The junctions have rules.', prompt: 'A tetrahedron frame. Predict: how many films share a line, and how many of those lines meet at a point?', side: 'Look inside the frame.', copy: 'Rotate the film, then reveal its triple lines and central junction. The sheets are translucent; the wire boundary is grey.', cue: 'Reveal the junctions. Bright lines mark three sheets meeting; the gold point marks four triple lines meeting. Name the 120-degree and tetrahedral-angle rules. The mesh connections were supplied to the numerical model; this is not a computational discovery of Taylor’s theorem.' },
    { beat: 'ESTABLISH', title: 'Local laws. No global oracle.', prompt: 'A new wire boundary changes the whole film. The allowed interior junction types stay the same.', side: 'What is established?', copy: 'Plateau’s junction laws have a mathematical foundation. The film on screen is an illustration of that result.', cue: 'State Taylor’s 1976 result for ideal films in three dimensions, away from the wire. Smooth sheet, Y, T. Switch frame to reconnect the theorem with the picture. End: energy can guide a system to a good answer without certifying the best answer.' }
  ];
  let scene = 0, revealed = false, dip = 0, comparison = false, highlighted = false, kind = 'tetrahedron';
  let ready = false, error = null, renderer = null, filmData = null, drawCount = 0, raf = 0;
  const camera = { yaw: .63, pitch: .34, dist: 5.6 };
  const networkCanvas = $('network'), ctx = networkCanvas.getContext('2d');
  const rounded = n => Number(n.toFixed(8));
  const setText = (id, text) => { $(id).textContent = text; };
  function fit2D() {
    const dpr = Math.min(devicePixelRatio || 1, 2), w = networkCanvas.clientWidth, h = networkCanvas.clientHeight;
    networkCanvas.width = Math.round(w * dpr); networkCanvas.height = Math.round(h * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0); return [w, h];
  }
  function drawNetwork() {
    const [w, h] = fit2D(), scale = Math.min(w - 86, h - 88) / 2, cx = w / 2, cy = h / 2 - 5;
    const point = p => [cx + p.x * scale, cy - p.y * scale];
    ctx.fillStyle = '#080e15'; ctx.fillRect(0, 0, w, h);
    function edges(list, getPoint, color, width, dashed = false) {
      ctx.strokeStyle = color; ctx.lineWidth = width; ctx.lineCap = 'round'; ctx.setLineDash(dashed ? [8, 7] : []);
      ctx.beginPath(); list.forEach(([a, b]) => { ctx.moveTo(...point(getPoint(a))); ctx.lineTo(...point(getPoint(b))); }); ctx.stroke(); ctx.setLineDash([]);
    }
    if (comparison) edges(M.referenceEdges, i => M.pins[i], '#e6a3d4', 7, true);
    if (revealed || scene === 1) {
      const net = M.network(dip); edges(net.edges, net.P, '#82ead1', 3.5);
      ctx.fillStyle = '#ffd48a';
      net.jx.forEach(p => { ctx.beginPath(); ctx.arc(...point(p), 4, 0, Math.PI * 2); ctx.fill(); });
    }
    M.pins.forEach((p, i) => {
      const [x, y] = point(p); ctx.fillStyle = '#edf6fa'; ctx.beginPath(); ctx.arc(x, y, 6.5, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#b6ccd5'; ctx.font = '14px system-ui'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(String(i + 1), x + p.x * 22, y - p.y * 22);
    });
    drawCount++;
  }
  function ensureRenderer() {
    if (!renderer) renderer = Film3D.Renderer($('film'), { ...camera, auto: 0, preserve: true });
    return renderer;
  }
  function resetCamera() {
    if (renderer) Object.assign(renderer, camera, { dragging: false, auto: 0 });
  }
  function loadFilm() {
    const R = ensureRenderer(); filmData = M.film(kind);
    R.setFilm(...Film3D.filmArrays(filmData.model, 0));
    R.setWires(filmData.model.wires, .025);
    R.setLines(Film3D.tripleLines(filmData.model), .014);
    R.setDots(filmData.model.junctions.map(i => filmData.model.V[i]), .05);
  }
  function draw() {
    raf = 0;
    try {
      if (scene < 2) drawNetwork();
      else { renderer.draw(0, { lines: highlighted, dots: highlighted, alpha: .58, gain: .72, bg: [.031, .055, .082] }); drawCount++; }
      ready = true;
    } catch (e) { error = String(e.message || e); ready = false; setText('consequence', 'Rendering unavailable: ' + error); }
  }
  function requestDraw() { if (!raf) raf = requestAnimationFrame(draw); }
  function update() {
    const S = scenes[scene];
    document.body.dataset.sceneIndex = scene;
    setText('scene-label', `${String(scene + 1).padStart(2, '0')} / 04 · ${S.beat}`);
    setText('scene-count', `${scene + 1} / 4`); setText('scene-title', S.title); setText('scene-prompt', S.prompt);
    setText('side-title', S.side); setText('side-copy', S.copy); setText('cue', S.cue);
    $('scene-prev').disabled = scene === 0; $('scene-next').disabled = scene === 3;
    setText('scene-next', ['Intervene →', 'Reveal →', 'Establish →', 'Complete'][scene]);
    $('network-panel').hidden = scene >= 2; $('film-panel').hidden = scene < 2;
    $('soap-reveal').hidden = scene !== 0; $('soap-reveal').disabled = revealed;
    $('soap-dip').hidden = scene !== 1; $('soap-compare').hidden = scene !== 1;
    $('soap-highlight').hidden = scene !== 2; $('soap-frame').hidden = scene !== 3;
    $('soap-compare').setAttribute('aria-pressed', String(comparison)); $('soap-highlight').setAttribute('aria-pressed', String(highlighted));
    setText('soap-compare', comparison ? 'Hide the comparison' : 'Compare five-side network');
    setText('soap-dip', dip === 0 ? 'Try a second dip' : 'Return to the first dip');
    setText('soap-highlight', highlighted ? 'Hide the junction marks' : 'Reveal the junctions');
    setText('soap-frame', kind === 'cube' ? 'Try a tetrahedron' : 'Try a cube');
    $('metric').hidden = scene >= 2 || !revealed;
    $('laws').hidden = scene !== 2 || !highlighted; $('theorem').hidden = scene !== 3;
    setText('claim-kind', scene === 3 ? 'THEOREM + ILLUSTRATION' : 'NUMERICAL ILLUSTRATION');
    if (scene < 2) {
      if (revealed) {
        const length = M.network(dip).length();
        setText('metric-label', dip === 0 ? 'First dip · network length' : 'Second dip · network length');
        setText('metric-value', length.toFixed(3));
        const firstLength = M.network(0).length();
        const difference = (a, b) => Math.abs(a - b) <= 1e-6
          ? 'equal length within numerical tolerance'
          : `${(Math.abs(a - b) / b * 100).toFixed(2)}% ${a > b ? 'longer' : 'shorter'}`;
        const firstComparison = dip === 1 ? `First dip: ${firstLength.toFixed(3)}. This dip is ${difference(length, firstLength)}.` : '';
        const referenceComparison = comparison ? `Five-side network: ${M.referenceLength.toFixed(3)}. ${Math.abs(length - M.referenceLength) <= 1e-6 ? 'The two networks have equal length within numerical tolerance.' : `This dip is ${difference(length, M.referenceLength)}.`}` : '';
        setText('metric-detail', [firstComparison, referenceComparison].filter(Boolean).join(' ') || 'Computed from all edges of this numerical network.');
      }
      setText('visual-caption', comparison ? 'Mint: this dip. Pink dashes: five sides connecting all six pins.' : 'White: fixed pins. Mint: film walls. Gold: free junctions.');
      setText('consequence', scene === 0 ? (revealed ? 'A balanced-looking network. Can you find a shorter way to connect the same pins?' : 'Pause for the audience before revealing a result.') : (dip === 1 ? 'The second start reaches a shorter network. One settled answer is not a certificate of the best answer.' : comparison ? 'The dashed competitor is shorter. This first dip cannot be a global minimum.' : 'Before dipping again, reveal a competitor you can check by counting five unit edges.'));
      setText('boundary', 'Numerical illustration: the existing network solver uses local length relaxation and connection changes. Two fixed seeds make this demonstration reproducible; they do not measure success rates or prove convergence.');
    } else {
      setText('frame-label', `${kind === 'cube' ? 'CUBE' : 'TETRAHEDRON'} FRAME · DRAG TO ROTATE`);
      setText('visual-caption', highlighted ? 'Bright lines: three sheets. Gold points: four triple lines. Grey: the wire boundary.' : 'Drag to rotate. Wheel to zoom. Reveal the marks to separate the junctions from the wire.');
      setText('consequence', scene === 2 ? (highlighted ? 'Plateau’s laws: 120° along a Y junction; the tetrahedral angle where four Y-lines meet.' : 'Which lines belong to the wire, and which are held up by the film itself?') : 'The theorem classifies local geometry. This mesh shows a selected topology after finite numerical relaxation.');
      setText('boundary', 'Theorem: ideal area-minimizing films in 3D, away from the wire boundary. Illustration: 600 area-relaxation steps on prescribed mesh connections. Rendering: a chosen thickness field colours the surface; neither this solver nor these pixels are a proof.');
    }
    requestDraw();
  }
  function resetScene(next = scene) {
    scene = Math.max(0, Math.min(3, next)); ready = false; error = null;
    revealed = scene === 1; dip = 0; comparison = false; highlighted = scene === 3; kind = scene === 3 ? 'cube' : 'tetrahedron';
    $('narration').open = false;
    try { if (scene >= 2) loadFilm(); resetCamera(); } catch (e) { error = String(e.message || e); }
    update();
  }
  $('scene-prev').addEventListener('click', () => resetScene(scene - 1));
  $('scene-next').addEventListener('click', () => resetScene(scene + 1));
  $('scene-reset').addEventListener('click', () => resetScene());
  $('soap-reveal').addEventListener('click', () => { revealed = true; update(); });
  $('soap-dip').addEventListener('click', () => { dip = 1 - dip; comparison = false; update(); });
  $('soap-compare').addEventListener('click', () => { comparison = !comparison; update(); });
  $('soap-highlight').addEventListener('click', () => { highlighted = !highlighted; update(); });
  $('soap-frame').addEventListener('click', () => { kind = kind === 'cube' ? 'tetrahedron' : 'cube'; ready = false; loadFilm(); resetCamera(); update(); });
  for (const type of ['pointerdown', 'pointermove', 'pointerup', 'wheel']) $('film').addEventListener(type, requestDraw);
  $('film').addEventListener('pointercancel', () => { if (renderer) renderer.dragging = false; requestDraw(); });
  function fullscreen() { if (document.fullscreenElement) document.exitFullscreen?.(); else document.documentElement.requestFullscreen?.().catch(() => {}); }
  $('full').addEventListener('click', fullscreen);
  document.addEventListener('keydown', e => {
    if (e.altKey || e.ctrlKey || e.metaKey || /INPUT|TEXTAREA|SELECT/.test(e.target.tagName) || e.target.isContentEditable) return;
    const key = e.key.toLowerCase();
    if (key === 'arrowright') { e.preventDefault(); resetScene(scene + 1); }
    else if (key === 'arrowleft') { e.preventDefault(); resetScene(scene - 1); }
    else if (key === 'r') { e.preventDefault(); resetScene(); }
    else if (key === 'n') { $('narration').open = !$('narration').open; }
    else if (key === 'f') fullscreen();
  });
  addEventListener('resize', requestDraw);
  new ResizeObserver(requestDraw).observe(document.querySelector('.visual'));
  function getState() {
    const net = M.network(dip), model = scene >= 2 ? filmData?.model : null;
    return {
      scene, sceneCount: 4, ready, error, playing: false, revealed, dip, seed: M.seeds[dip], comparison, highlighted,
      model: scene < 2 ? {
        type: 'steiner', pins: M.pins.map(p => [rounded(p.x), rounded(p.y)]), edges: net.edges.map(e => [...e]), junctions: net.jx.map(p => [rounded(p.x), rounded(p.y)]),
        length: rounded(net.length()), referenceLength: rounded(M.referenceLength), referenceEdges: M.referenceEdges.map(e => [...e]),
        digest: M.digest([...net.pins, ...net.jx].map(p => [p.x, p.y]).concat(net.edges))
      } : model ? {
        type: 'surface', frame: kind, vertices: model.V.length, triangles: model.tris.length, tripleEdges: model.tripleEdges.length, junctions: model.junctions.length,
        initialArea: rounded(filmData.initialArea), area: rounded(model.area()), relaxationSteps: filmData.steps, lastMove: rounded(filmData.lastMove), digest: M.digest(model.V)
      } : null,
      camera: scene >= 2 && renderer ? { yaw: rounded(renderer.yaw), pitch: rounded(renderer.pitch), dist: rounded(renderer.dist), dragging: renderer.dragging } : null,
      renderer: scene >= 2 ? 'webgl2' : 'canvas2d'
    };
  }
  window.SoapLive = { getState, reset: () => resetScene(), go: resetScene, getDiagnostics: () => ({ drawCount, webgl: !!renderer, drawingBuffer: renderer ? [renderer.gl.drawingBufferWidth, renderer.gl.drawingBufferHeight] : null }) };
  window.presentationState = getState;
  resetScene(0);
})();
