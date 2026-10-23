'use strict';
const fs = require('node:fs');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const source = fs.readFileSync(new URL('../texturing.js', `file://${__filename}`), 'utf8');

function bodyOf(name, nextName) {
  const start = source.indexOf(`function ${name}(`);
  assert.notEqual(start, -1, `missing ${name}`);
  const end = source.indexOf(`function ${nextName}(`, start + 1);
  assert.notEqual(end, -1, `missing boundary ${nextName}`);
  return source.slice(start, end);
}

const cpuBody = bodyOf('frameBodyCPU', 'frameBody');
const gl1Body = bodyOf('frameBodyGL1', 'frameBody');
assert.doesNotMatch(cpuBody, /P\s*=\s*buildParams\(\)/, 'CPU fallback reuses parameters between settings changes');
assert.doesNotMatch(gl1Body, /P\s*=\s*buildParams\(\)/, 'WebGL1 fallback reuses parameters between settings changes');
assert.match(cpuBody, /P\s*=\s*P\s*\|\|\s*buildParams\(\)/);
assert.match(gl1Body, /P\s*=\s*P\s*\|\|\s*buildParams\(\)/);
assert.match(gl1Body, /if\s*\(c\.controlsDirty\)/);
assert.match(gl1Body, /texSubImage2D\(gl\.TEXTURE_2D,0,0,0,gl\.RGBA,gl\.UNSIGNED_BYTE,v\)/);
assert.match(source, /const pendingAnalysisBuf=new Uint8Array\(AW\*AH\*4\),pendingEnergyBuf=new Uint8Array\(AW\*AH\*4\)/);
assert.doesNotMatch(source, /queueUpdate\(ana\.buf\.slice\(\)/);

for (const name of ['u1f', 'u1i', 'u2f', 'u3f', 'u1fv', 'u3fv']) {
  assert.ok(source.includes(`function ${name}(`), `${name} cache helper exists`);
}
assert.match(source, /let uniformValueCache=new WeakMap\(\)/);
assert.match(source, /function u1f\(loc,x\)\{if\(loc===null\|\|loc===undefined\)return;/);
assert.match(source, /function u1f\(loc,x\).*?if\(c&&c\.a===x\)return/s);
assert.equal((source.match(/gl\.uniform1f\(/g) || []).length, 1, 'only the cache helper directly calls gl.uniform1f');
// Exercise the actual cache helpers against a tiny WebGL stub: unchanged values must not be re-sent.
const helperStart = source.indexOf('let uniformValueCache=new WeakMap();');
const helperEnd = source.indexOf('function pass(pr,target,w,h,bind)', helperStart);
assert.ok(helperStart >= 0 && helperEnd > helperStart, 'uniform helper block has stable boundaries');
const calls = [];
const fakeGL = Object.fromEntries(['uniform1f','uniform1i','uniform2f','uniform3f','uniform1fv','uniform3fv'].map(name => [name, (...args) => calls.push([name, ...args])]));
const sandbox = { gl: fakeGL, WeakMap, Array, Math };
vm.runInNewContext(source.slice(helperStart, helperEnd), sandbox);
const loc = {};
sandbox.u1f(loc, 0.5); sandbox.u1f(loc, 0.5); sandbox.u1f(loc, 0.75);
assert.equal(calls.filter(c => c[0] === 'uniform1f').length, 2, 'scalar cache skips identical values and forwards changes');
const loc2 = {};
sandbox.u2f(loc2, 1, 2); sandbox.u2f(loc2, 1, 2); sandbox.u2f(loc2, 1, 3);
assert.equal(calls.filter(c => c[0] === 'uniform2f').length, 2, 'pair cache skips identical values');
const loc3 = {};
sandbox.u1fv(loc3, new Float32Array([1, 2])); sandbox.u1fv(loc3, new Float32Array([1, 2])); sandbox.u1fv(loc3, new Float32Array([1, 3]));
assert.equal(calls.filter(c => c[0] === 'uniform1fv').length, 2, 'array cache compares element values');
sandbox.u1f(null, 9);
assert.equal(calls.filter(c => c[0] === 'uniform1f').length, 2, 'null optimized-out uniform locations are ignored');

console.log('texturing performance regression tests passed');
