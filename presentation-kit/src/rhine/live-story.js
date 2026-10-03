/* Real footage bookends; every mathematical model remains explicitly labelled. */
window.RHINE_STORY = [
{
  title: 'A small dent. A hidden motion.', label: 'Rendered illustration · not field footage', seconds: 40, view: 'observe',
  claim: 'Start with the surface, then look underneath the model.',
  prompt: 'Which little marks would you associate with a hidden swirl?',
  intervention: 'Find a dent. Press “Reveal the spins”, then “View from above”.',
  reveal: 'The marked model vortices coincide with small surface depressions.',
  establish: 'A dimple can be a clue to spin. This illustration is not an observation or reconstruction of the Rhine.',
  notes: 'Ask for a prediction before revealing the arrows. All water shown here is rendered from ideal smooth-core vortices. This model panel is not field footage. The illustration connects a surface clue with its known model cause; it does not identify a cause in a real river.'
},
{
  title: 'How deep should the dent be?', label: 'Ideal smooth-core model · not a measurement', seconds: 45, view: 'dip',
  claim: 'Keep the core radius fixed and change only circulation.',
  prompt: 'Double circulation from 40 to 80. Does the dip double?',
  intervention: 'Move Γ to 40, then to 80. Compare the displayed depth.',
  reveal: 'The dip becomes four times as deep in this model: depth scales as Γ².',
  establish: 'The inward pressure force needed for circular motion gives lower pressure and a lower surface at the centre.',
  notes: 'Use 40 then 80 cm²/s so the doubling fits the slider. Pressure is higher outside the core and pushes inward. The free surface adjusts to the pressure difference. The vertical profile is exaggerated; this is an ideal model, not a fit to river measurements.'
},
{
  title: 'Measure the spin with a loop.', label: 'Circulation integral · frozen velocity field', seconds: 55, view: 'loop',
  claim: 'Γ = ∮ u · dl adds tangential velocity around a closed path.',
  prompt: 'What happens when one loop surrounds two opposite spins?',
  intervention: 'Select “Opposite pair”. Centre the loop at x = 0 and set radius to 3.',
  reveal: 'The two signed contributions cancel for a symmetric loop, although the water is moving.',
  establish: 'Circulation is a signed integral. This frozen measuring contour does not demonstrate Kelvin’s conservation in a moving material loop.',
  notes: 'First move the loop around one smooth core; its circulation changes continuously because the vorticity is spread out. Then select the opposite pair and enclose both symmetrically. Zero net circulation does not mean no motion. Keep spatial measurement separate from conservation through time.'
},
{
  title: 'Two dimples can be one tube.', label: 'Schematic geometry · not a river reconstruction', seconds: 45, view: 'ring',
  claim: 'Follow the direction around one connected tube of spin.',
  prompt: 'If a vortex arch meets the surface twice, do its ends spin the same way?',
  intervention: 'Compare “Closed ring” with “Surface arch”. Follow the arrows.',
  reveal: 'Viewed from above, the two surface ends of the arch turn in opposite senses.',
  establish: 'One connected tube can account for a pair. It does not follow that every visible dimple has a visible partner.',
  notes: 'Use the closed ring to establish continuous direction, then switch to the surface arch. Real surface attachment involves deformation and reconnection. The geometry shows a possibility, not the origin of a particular river dimple. The loose-end control illustrates the geometric constraint.'
},
{
  title: 'Survival and visibility are different.', label: '3D mechanism + controlled optical illustration', seconds: 65, view: 'keep',
  claim: 'Hold the drawn depression fixed while changing its reflection.',
  prompt: 'If a dimple fades from view, must its vortex have vanished?',
  intervention: 'Sweep “Reflection position” from side to side. Watch the dashed outline.',
  reveal: 'Contrast changes while the model depression stays fixed.',
  establish: 'Visible lifetime is not vortex lifetime. Real downwelling can stretch spin; the separate flat model preserves area only by idealization.',
  notes: 'Compare three-dimensional stretching with the ideal area-preserving flat flow above. A nearly level real surface can converge and sink. In the optical panel below, only the reflected light pattern moves. A fading mark alone cannot tell us that circulation has disappeared.'
},
{
  title: 'A clue, with an evidence boundary.', label: 'Published research · different observables', seconds: 50, view: 'evidence',
  claim: 'Compare what the two studies actually measured.',
  prompt: 'Could we turn one visible dimple into a local downwelling measurement?',
  intervention: 'Compare regional counts with combined dimple-and-scar area coverage.',
  reveal: 'The studies report regional statistical links. Counts and covered area are different observables.',
  establish: 'A dimple is a clue, not a calibrated local meter. These studies do not reconstruct the Rhine flow or determine its oxygen-transfer rate.',
  notes: 'The 2023 study used simulations and regional dimple counts; the 2026 laboratory study used combined dimple-and-scar coverage and subsurface divergence. Mean-square divergence combines convergence and spreading. The June 2026 preprint reports a nonlocal link. Finish with the boundary: an illustration plus regional research cannot diagnose one river mark.'
}
];

// Use footage narration only after the video has actually loaded.
window.RHINE_STORY[0].fallback = { ...window.RHINE_STORY[0] };
Object.assign(window.RHINE_STORY[0], {
  label: 'Our boat footage · Büsingen · 1 June 2026',
  claim: 'Watch the actual surface before comparing it with a model.',
  prompt: 'Which small marks suggest hidden motion beneath the surface?',
  intervention: 'Watch the normal-speed clip, then press “Compare with illustration” and reveal the model spins.',
  reveal: 'The clip shows the surface. The illustration supplies a possible mechanism, not a measurement of the flow beneath it.',
  establish: 'Observation starts the question. A model can explain a mechanism without reconstructing this particular river.',
  notes: 'This is Ben’s recovered boat footage from 1 June 2026, at normal speed, with no synthetic imagery or frame interpolation. Ask the audience to find a small dent. Then compare with the clearly labelled smooth-core illustration. Only the illustration exposes its model spin: we cannot see the complete subsurface flow in the clip.'
});
window.RHINE_STORY[5].fallback = { ...window.RHINE_STORY[5], label: 'Published research · closing field clip unavailable' };
window.RHINE_STORY[5].notes += ' Return to the actual river in the closing clip: we can now ask better questions, but the unmeasured flow remains hidden.';
