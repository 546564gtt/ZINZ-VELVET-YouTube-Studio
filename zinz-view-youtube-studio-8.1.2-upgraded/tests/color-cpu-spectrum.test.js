/* Regression tests for all 50 fine-spectrum targets in the non-WebGL color backend. */
'use strict';
const assert = require('node:assert/strict');
const palette = require('../color-palette.js');
globalThis.ZVColorPalette = palette;
const cpu = require('../color-cpu.js');

function hexPixel(hex) {
  const h = hex.replace('#', '');
  return new Uint8ClampedArray([
    parseInt(h.slice(0, 2), 16),
    parseInt(h.slice(2, 4), 16),
    parseInt(h.slice(4, 6), 16),
    255
  ]);
}
function params(count) {
  return {
    hueShift: new Float32Array(count),
    hueSat: new Float32Array(count),
    hueLum: new Float32Array(count),
    sat: 1, bright: 1, contrast: 1, gamma: 1,
    mul: [1, 1, 1], bias: 0,
    curve: [0, .25, .5, .75, 1],
    A: 0, B: 0, width: 0
  };
}

assert.equal(palette.SPECTRUM.length, 50, 'palette contains all 50 fine-spectrum targets');
for (const target of palette.SPECTRUM) {
  const index = palette.ALL.findIndex(item => item.key === target.key);
  assert.ok(index >= 26, `${target.key} has a palette index after the 24 named colors and two special masks`);
  const p = params(palette.ALL.length);
  p.hueShift[index] = 100;
  const before = hexPixel(target.color);
  const after = new Uint8ClampedArray(before);
  cpu.grade(after, p);
  assert.notDeepEqual(
    Array.from(after.slice(0, 3)),
    Array.from(before.slice(0, 3)),
    `${target.key} hue control changes its own representative color in CPU mode`
  );
}

console.log('CPU full-spectrum color regression tests passed');
