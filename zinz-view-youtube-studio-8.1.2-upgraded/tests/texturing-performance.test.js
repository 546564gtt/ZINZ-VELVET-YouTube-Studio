'use strict';
const fs = require('node:fs');
const assert = require('node:assert/strict');
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
console.log('texturing performance regression tests passed');
