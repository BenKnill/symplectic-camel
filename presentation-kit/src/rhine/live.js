/* Presentation controls. Figures remain in the original figs.js. No network dependency. */
(() => {
  'use strict';
  const $ = id => document.getElementById(id), story = window.RHINE_STORY;
  const labels = ['Observe', 'Pressure', 'Circulation', 'One tube', 'Survival / visibility', 'Evidence'];
  const views = [...document.querySelectorAll('[data-view]')], vids = [$('opening'), $('closing')];
  let beat = 0, t = 0, playing = !matchMedia('(prefers-reduced-motion: reduce)').matches;
  let auto = false, last = performance.now(), lastLight = null;
  let water = null, waterAttempted = false, waterStep = 0, waterEpoch = -1, waterSys = null, showSpins = false, topView = false;
  const scratch = document.createElement('canvas'); scratch.width = 480; scratch.height = 95;

  function markMissing(v) {
    v.hidden = true; $(v.id + '-missing').hidden = false;
    if (v.id === 'opening') { $('opening-illustration').hidden = false; $('opening-tools').hidden = false; $('illustrationToggle').hidden = true; }
    $(v.id + '-status').textContent = 'Illustration only · original field footage not included';
    applySceneText();
  }
  function markLoaded(v) {
      v.hidden = false; $(v.id + '-missing').hidden = true;
      if (v.id === 'opening') { $('opening-illustration').hidden = true; $('opening-tools').hidden = true; $('illustrationToggle').hidden = false; }
      sync();
      $(v.id + '-status').textContent = 'Ben’s boat footage · 1 June 2026 · normal speed · no synthetic imagery or interpolation.';
      applySceneText();
  }
  for (const v of vids) {
    v.addEventListener('error', () => markMissing(v));
    v.addEventListener('loadeddata', () => markLoaded(v));
    // Cached media can succeed or fail before this script attaches listeners.
    if (v.error) markMissing(v);
    else if (v.readyState >= 2) markLoaded(v);
  }
  function sync() {
    $('pause').textContent = playing ? 'Pause motion' : 'Resume motion';
    $('pause').setAttribute('aria-pressed', String(!playing));
    $('tour').textContent = auto ? 'Stop rehearsal' : 'Start 5-minute rehearsal';
    $('tour').setAttribute('aria-pressed', String(auto));
    for (const v of vids) {
      if (playing && !document.hidden && !v.closest('[data-view]').hidden && !v.hidden) {
        try { const request = v.play(); if (request && request.catch) request.catch(() => {}); } catch (_) { /* Native controls remain available. */ }
      } else v.pause();
    }
  }
  function loopControls() {
    const loop = window.LOOP_STATE;
    $('loopX').value = loop.x; $('loopRadius').value = loop.r;
    $('loopXOut').textContent = loop.x.toFixed(2) + ' cm';
    $('loopRadiusOut').textContent = loop.r.toFixed(2) + ' cm';
  }
  function draw() {
    const id = { dip: 'figDip', loop: 'figLoop', ring: 'figLines', keep: 'figStretch' }[story[beat].view];
    if (id && window.FIGS[id]) window.FIGS[id].at(t);
    if (story[beat].view === 'keep') visibility();
    if (story[beat].view === 'observe' && !$('opening-illustration').hidden) renderOpening();
    const time = n => Math.floor(n / 60) + ':' + String(Math.floor(n % 60)).padStart(2, '0');
    $('clock').textContent = time(t) + ' / ' + time(story[beat].seconds);
  }
  function applySceneText() {
    const b = story[beat], unavailable = (beat === 0 && $('opening').hidden) || (beat === 5 && $('closing').hidden);
    const text = unavailable && b.fallback ? { ...b, ...b.fallback } : b;
    $('eyebrow').textContent = (beat + 1) + ' / 6 · ' + text.label;
    $('title').textContent = text.title; $('claim').textContent = text.claim;
    $('prompt').textContent = text.prompt; $('narration').textContent = text.notes;
    $('intervention').textContent = text.intervention;
    $('consequence').textContent = text.reveal; $('establish').textContent = text.establish;
  }
  function select(n, options = {}) {
    const candidate = Number.isFinite(n) ? Math.trunc(n) : 0;
    beat = Math.max(0, Math.min(story.length - 1, candidate)); t = 0; last = performance.now();
    if (!options.keepTour) { auto = false; playing = !matchMedia('(prefers-reduced-motion: reduce)').matches; }
    const b = story[beat]; views.forEach(v => { v.hidden = v.dataset.view !== b.view; });
    applySceneText();
    $('result').hidden = true; $('reveal-result').setAttribute('aria-expanded', 'false');
    document.querySelectorAll('#beats button').forEach((v, i) => {
      v.setAttribute('aria-pressed', String(i === beat));
      if (i === beat) v.setAttribute('aria-current', 'step'); else v.removeAttribute('aria-current');
    });
    $('prev').disabled = beat === 0; $('next').disabled = beat === story.length - 1;
    $('dipG').value = 60; $('light').value = 50; lastLight = null;
    showSpins = false; topView = false; waterSys = null; waterStep = 0;
    if ($('opening').readyState >= 2 && !$('opening').error) {
      $('opening').hidden = false; $('opening-illustration').hidden = true; $('opening-tools').hidden = true;
      $('illustrationToggle').setAttribute('aria-pressed', 'false'); $('illustrationToggle').textContent = 'Compare with illustration';
      $('opening-status').textContent = 'Ben’s boat footage · 1 June 2026 · normal speed · no synthetic imagery or interpolation.';
      applySceneText();
    }
    $('showSpins').setAttribute('aria-pressed', 'false'); $('waterView').setAttribute('aria-pressed', 'false');
    Object.values(window.FIGS).forEach(f => f.reset()); loopControls();
    vids.forEach(v => { if (v.readyState) { try { v.currentTime = 0; } catch (_) {} } });
    if (beat === 3) document.querySelector('[data-line="ring"]').click();
    sync(); draw();
    if (!options.fromHash) { try { history.replaceState(null, '', '#' + (beat + 1)); } catch (_) { /* Optional URL state may be restricted in local-file viewers. */ } }
  }
  labels.forEach((label, i) => {
    const b = document.createElement('button'); b.type = 'button';
    b.innerHTML = '0' + (i + 1) + '<span>' + label + '</span>'; b.onclick = () => select(i); $('beats').append(b);
  });
  $('prev').onclick = () => select(beat - 1); $('next').onclick = () => select(beat + 1);
  $('restart').onclick = () => select(beat);
  $('reveal-result').onclick = () => {
    $('result').hidden = !$('result').hidden;
    $('reveal-result').setAttribute('aria-expanded', String(!$('result').hidden));
  };
  $('pause').onclick = () => { playing = !playing; last = performance.now(); sync(); };
  $('tour').onclick = () => {
    auto = !auto;
    if (auto) { playing = true; select(0, { keepTour: true }); }
    last = performance.now(); sync();
  };
  $('full').onclick = async () => {
    try {
      if (document.fullscreenElement) { if (document.exitFullscreen) await document.exitFullscreen(); }
      else if (document.documentElement.requestFullscreen) await document.documentElement.requestFullscreen();
      else $('status').textContent = 'Fullscreen is unavailable here. The presentation still works in this window.';
    } catch (_) { $('status').textContent = 'Fullscreen was not enabled. Continue in this window or use your browser’s fullscreen control.'; }
  };
  $('illustrationToggle').onclick = () => {
    const model = $('opening-illustration').hidden;
    $('opening-illustration').hidden = !model; $('opening-tools').hidden = !model; $('opening').hidden = model;
    $('illustrationToggle').setAttribute('aria-pressed', String(model));
    $('illustrationToggle').textContent = model ? 'Return to field footage' : 'Compare with illustration';
    $('opening-status').textContent = model ? 'Rendered illustration · not a reconstruction or field measurement.' : 'Ben’s boat footage · 1 June 2026 · normal speed · no synthetic imagery or interpolation.';
    applySceneText(); sync(); draw();
  };
  $('showSpins').onclick = () => { showSpins = !showSpins; $('showSpins').setAttribute('aria-pressed', String(showSpins)); draw(); };
  $('waterView').onclick = () => { topView = !topView; $('waterView').setAttribute('aria-pressed', String(topView)); draw(); };
  $('opening-water').addEventListener('webglcontextlost', e => { e.preventDefault(); water = null; $('opening-water').hidden = true; draw(); });
  $('opening-water').addEventListener('webglcontextrestored', () => { waterAttempted = false; draw(); });
  $('loopX').addEventListener('input', () => { window.FIGS.figLoop.setLoop({ x: +$('loopX').value }); loopControls(); });
  $('loopRadius').addEventListener('input', () => { window.FIGS.figLoop.setLoop({ r: +$('loopRadius').value }); loopControls(); });
  window.FIGS.figLoop.onChange = loopControls;
  $('light').addEventListener('input', () => { visibility(); });
  window.addEventListener('hashchange', () => select((+location.hash.slice(1) || 1) - 1, { fromHash: true }));
  window.addEventListener('resize', draw);
  document.addEventListener('visibilitychange', () => { last = performance.now(); sync(); });
  window.addEventListener('keydown', e => {
    const tag = e.target.tagName;
    if (e.altKey || e.ctrlKey || e.metaKey || e.target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(tag)) return;
    const k = e.key.toLowerCase();
    if (k === ' ' && !['BUTTON', 'SUMMARY', 'VIDEO', 'A'].includes(tag)) { e.preventDefault(); $('pause').click(); }
    if (k === 'arrowright') { e.preventDefault(); select(beat + 1); }
    if (k === 'arrowleft') { e.preventDefault(); select(beat - 1); }
    if (/^[1-6]$/.test(k)) select(+k - 1);
    if (k === 'home') { e.preventDefault(); select(0); }
    if (k === 'end') { e.preventDefault(); select(story.length - 1); }
    if (k === 'n') $('notes').open = !$('notes').open;
    if (k === 'r') select(beat);
    if (k === 'f') $('full').click();
  });
  function renderOpening() {
    const cv = $('opening-water'), overlay = $('opening-overlay'), r = $('opening-illustration').getBoundingClientRect();
    const W = Math.max(1, Math.round(r.width)), H = Math.max(1, Math.round(r.height));
    // Limit render size for mobile GPUs. The optical renderer already antialiases its surface.
    for (const canvas of [cv, overlay]) if (canvas.width !== W || canvas.height !== H) { canvas.width = W; canvas.height = H; }
    if (!waterAttempted) {
      waterAttempted = true;
      try { water = new window.WaterRenderer(cv, { gridX: 280, gridY: 180, causticW: 720, causticH: 460, dyeSide: 4, dyeW: 4, dyeH: 4 }); cv.hidden = false; }
      catch (_) { water = null; cv.hidden = true; }
    }
    const V = window.Vortex, modelTime = t % 12, epoch = Math.floor(t / 12), target = Math.floor(modelTime * 60);
    if (!waterSys || epoch !== waterEpoch || target < waterStep) {
      waterSys = V.makeSystem({ a: 0.6 }); waterStep = 0; waterEpoch = epoch;
      [[-10, 5, 55], [-10, 1, -55], [10, 8, -40], [10, 4, 40], [0, -5, 35], [0, -9, -35]].forEach(p => V.add(waterSys, ...p));
    }
    while (waterStep < target) { V.step(waterSys, 1 / 60); waterStep++; }
    const vortices = waterSys.x.map((x, i) => [x, waterSys.y[i], waterSys.G[i]]);
    const cam = { pos: [0, -27, 12], target: [0, 4, 0], fov: W < 560 ? 49 : 37 };
    const scale = (W < 560 ? 30 : 48) / W;
    const c = overlay.getContext('2d'); c.clearRect(0, 0, W, H);
    if (water) {
      try { water.render({ vortices, a: 0.6, time: modelTime, ripple: 0.004, k: 3, exaggerate: 1,
        camera: topView ? undefined : cam, scale, causticWin: [-40, -28, 40, 65], sunShift: [-1.4, -1.8], slopeVis: 2, glint: 0.75, murk: 0.035 }); }
      catch (_) { water = null; cv.hidden = true; }
    }
    if (!water) {
      // Explicit schematic fallback for browsers without WebGL2; never presented as footage.
      c.fillStyle = '#153f4e'; c.fillRect(0, 0, W, H);
      for (let j = 0; j < 32; j++) {
        c.strokeStyle = j % 3 ? '#245361' : '#39747a'; c.lineWidth = 2; c.beginPath();
        for (let i = 0; i <= 100; i++) { const x = i / 100 * W, y = j / 31 * H + 6 * Math.sin(i * .12 + j + modelTime * .3); i ? c.lineTo(x, y) : c.moveTo(x, y); } c.stroke();
      }
      $('render-mode').textContent = '2D schematic fallback · WebGL water unavailable';
    } else $('render-mode').textContent = 'Rendered smooth-core model · not a reconstruction';
    for (const [x, y, G] of vortices) {
      const p = water && !topView ? window.WaterRenderer.project(cam, W, H, x, y, 0) : [W / 2 + x / scale, H / 2 - y / scale];
      if (!p) continue;
      const [X, Y] = p;
      if (!water) { c.fillStyle = '#082f3b'; c.beginPath(); c.ellipse(X, Y, 14, 7, 0, 0, Math.PI * 2); c.fill(); c.strokeStyle = '#8bb6b3'; c.lineWidth = 1.5; c.stroke(); }
      if (showSpins) { c.fillStyle = G > 0 ? '#57debe' : '#ffbf67'; c.font = 'bold 24px system-ui'; c.textAlign = 'center'; c.fillText(G > 0 ? '↺' : '↻', X, Y - 12); }
    }
  }
  function visibility() {
    const cv = $('visibility'), c = cv.getContext('2d'), value = +$('light').value;
    if (lastLight !== value) {
      lastLight = value; const g = scratch.getContext('2d'), im = g.createImageData(480, 95), d = im.data, light = value / 100 * 1200 - 120;
      for (let y = 0; y < 95; y++) for (let x = 0; x < 480; x++) {
        const xx = x * 2, yy = y * 2, dx = (xx - 480) / 65, dy = (yy - 90) / 58;
        const sourceX = xx + 95 * dx * Math.exp(-dx * dx - dy * dy);
        const bright = Math.exp(-Math.pow((sourceX - light) / 100, 2)), o = 4 * (y * 480 + x);
        d[o] = 16 + 145 * bright; d[o + 1] = 42 + 145 * bright; d[o + 2] = 54 + 135 * bright; d[o + 3] = 255;
      }
      g.putImageData(im, 0, 0);
    }
    c.fillStyle = '#102a36'; c.fillRect(0, 0, 960, 230); c.drawImage(scratch, 0, 15, 960, 190);
    c.strokeStyle = '#57debe70'; c.setLineDash([4, 6]); c.beginPath(); c.ellipse(480, 105, 70, 35, 0, 0, Math.PI * 2); c.stroke(); c.setLineDash([]);
  }
  function frame(now) {
    // Rehearsal uses elapsed foreground time, rather than a capped simulation timestep.
    const dt = Math.max(0, (now - last) / 1000); last = now;
    if (playing && !document.hidden) t += dt;
    while (auto && t >= story[beat].seconds) {
      const overflow = t - story[beat].seconds;
      if (beat === story.length - 1) { t = story[beat].seconds; auto = false; playing = false; sync(); break; }
      select(beat + 1, { keepTour: true }); t = overflow; last = now;
    }
    draw(); requestAnimationFrame(frame);
  }
  window.RhineLive = { select, getState: () => ({ beat, t, playing, auto, revealed: !$('result').hidden, showSpins, topView, gamma: +$('dipG').value, light: +$('light').value, loop: window.FIGS.figLoop.getState() }) };
  select((+location.hash.slice(1) || 1) - 1); requestAnimationFrame(frame);
})();
