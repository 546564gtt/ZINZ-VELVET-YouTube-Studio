/* Dependency-free regression tests: run with `node tests/analysis.test.js`. */
'use strict';
const assert = require('node:assert/strict');
const analysis = require('../analysis.js');

function frame(r, g, b, w = 8, h = 4) {
  const px = new Uint8Array(w * h * 4);
  for (let i = 0; i < w * h; i++) {
    px[i * 4] = r; px[i * 4 + 1] = g; px[i * 4 + 2] = b; px[i * 4 + 3] = Math.max(r, g, b);
  }
  return { px, w, h };
}

analysis.reset();
const first = frame(120, 100, 90);
const state = analysis.update(first.px, first.w, first.h);
assert.equal(state.ticks, 1, 'valid frame advances scene state');
assert.ok(Number.isFinite(state.raw.meanY), 'luma statistic is finite');
assert.ok(Number.isFinite(state.sm.meanC), 'chroma statistic is finite');

const ticks = state.ticks;
analysis.update(null, 8, 4);
analysis.update(new Uint8Array(4), 8, 4);
analysis.update(first.px, 0, 4);
analysis.update(first.px, 8, 1.5);
assert.equal(state.ticks, ticks, 'invalid/incomplete frames do not corrupt temporal state');
const malformed = new Array(8 * 4 * 4).fill(128); malformed[3] = Number.NaN;
analysis.update(malformed, 8, 4);
assert.equal(state.ticks, ticks, 'non-finite pixel values reject the whole frame atomically');

const second = frame(80, 120, 180);
analysis.update(second.px, second.w, second.h);
assert.equal(state.ticks, ticks + 1, 'valid processing resumes after a skipped frame');
const resized = frame(80, 120, 180, 4, 2);
analysis.update(resized.px, resized.w, resized.h);
assert.ok(Number.isFinite(state.motion), 'resolution changes reset incompatible motion history');
assert.ok(Number.isFinite(state.raw.meanY), 'resized frames retain finite scene statistics');
assert.equal(analysis.probeVerdict([], false), 'wait');
assert.equal(analysis.probeVerdict([{ t: 0, max: 20 }, { t: 1, max: 0 }], false), 'ok');
assert.ok(analysis.temporalStrength({ avgMotion: 0, motion: 0, sinceCut: 4 }, 0.5) >= 0);
console.log('analysis tests passed');
