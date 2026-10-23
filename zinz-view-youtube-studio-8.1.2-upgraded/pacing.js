(()=>{'use strict';
/* Stage 10a — frame-pacing instrumentation and the quality governor (pure logic, unit-tested in tests/test_pace.js). */
const pct=(arr,n,p)=>{n=Math.min(n,arr.length);if(!n)return 0;const a=Array.from(arr.subarray?arr.subarray(0,n):arr.slice(0,n)).sort((x,y)=>x-y);return a[Math.min(n-1,Math.floor(n*p))]};
class Ring{constructor(n=240){this.a=new Float32Array(n);this.k=0}push(x){this.a[this.k++%this.a.length]=x}get n(){return Math.min(this.k,this.a.length)}
  p(q){return pct(this.a,this.n,q)}max(){let m=0;for(let i=0;i<this.n;i++)if(this.a[i]>m)m=this.a[i];return m}avg(){let s=0;for(let i=0;i<this.n;i++)s+=this.a[i];return this.n?s/this.n:0}}
class Pace{constructor(){this.cpu=new Ring();this.up=new Ring();this.ivl=new Ring();this.reset()}
  reset(){this.lastCb=0;this.presented=0;this.missed=0;this.frames=0;this.t0=0;this.n0=0;this.fps=0;this.cpu.k=this.up.k=this.ivl.k=0}
  /* call from the requestVideoFrameCallback: counts video frames the browser presented that this page never got a callback for */
  note(now,meta){if(this.lastCb)this.ivl.push(now-this.lastCb);this.lastCb=now;
    if(meta&&typeof meta.presentedFrames==='number'){const g=meta.presentedFrames-this.presented;if(this.presented&&g>1)this.missed+=g-1;this.presented=meta.presentedFrames}
    this.frames++;if(!this.t0){this.t0=now;this.n0=this.frames}else if(now-this.t0>=1000){this.fps=(this.frames-this.n0)*1000/(now-this.t0);this.t0=now;this.n0=this.frames}}
  missedPct(){const t=this.frames+this.missed;return t?100*this.missed/t:0}}
/* Governor: steps quality down only when OUR measured render cost is high (or the decoder drops frames while we are not cheap), needs two bad checks in a row and >=6 s between steps; steps back up only after 30 s clean and cheap. lock=true never changes the level. */
function decide(g,i){if(i.lock)return 0;const over=i.p95>6.5||(i.dropDelta>8&&i.p95>3);
  if(over){g.bad=(g.bad||0)+1;g.cleanSince=i.now;if(g.bad>=2&&i.level<2&&i.now-(g.lastStep||-1e9)>6000){g.bad=0;g.lastStep=i.now;return 1}return 0}
  g.bad=0;if(i.level>0&&i.now-(g.cleanSince||0)>30000&&i.p95<3.5){g.cleanSince=i.now;return -1}return 0}
/* Watchdog: after ~90 frames, the overlay is "too slow" if the median render costs >22 ms or the page missed >35% of presented video frames. The caller falls back to the lightweight CSS path rather than stutter. */
function isSlow(pace){return pace.frames>=90&&(pace.cpu.p(.5)>22||(pace.frames>=120&&pace.missedPct()>35))}
const isSoftwareGL=r=>/swiftshader|llvmpipe|softpipe|software|warp|basic render|microsoft basic/i.test(String(r||''));
/* Ingest benchmark: median per method; switch away from the default only if it is slow in absolute terms (>4 ms) and a rival is clearly faster (<80%). */
function chooseIngest(ms,def='video'){const med=a=>{if(!a||!a.length)return Infinity;const b=[...a].sort((x,y)=>x-y);return b[Math.floor(b.length/2)]};
  const m={};for(const k of Object.keys(ms))m[k]=med(ms[k]);const d=m[def];let best=def;
  if(d>4)for(const k of Object.keys(m))if(m[k]<m[best]&&m[k]<.8*d)best=k;return {method:best,med:m}}
globalThis.ZVPace={pct,Ring,Pace,decide,isSlow,isSoftwareGL,chooseIngest};
if(typeof module!=='undefined')module.exports=globalThis.ZVPace;
})();
