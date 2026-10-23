/* TEXTURING Stage 3 — shared scene analysis (pure JS, no DOM/GL; unit-testable in Node).
 * Input: 64x36 RGBA thumbnail from the GPU analysis pass: rgb = per-cell mean (averaged in ~linear light, stored gamma-2.2 encoded),
 *        alpha = per-cell max luma (gamma-encoded). Output: smoothed scene statistics reused by later passes (Auto Color, lighting).
 * Heuristics, not ground truth: cell means underestimate point highlights (alpha max compensates), and "cast" is a gray-world-style
 * estimate whose confidence collapses when the scene is dominated by one hue. */
(()=>{'use strict';
const BINS=64,HUES=12,GAMMA=2.2;
const HUE_NAMES=['red','orange','amber','yellow','green','spring','cyan','azure','blue','violet','magenta','rose'];
function oklab(r,g,b){const l=.4122214708*r+.5363325363*g+.0514459929*b,m=.2119034982*r+.6806995451*g+.1073969566*b,s=.0883024619*r+.2817188376*g+.6299787005*b;
  const l_=Math.cbrt(l),m_=Math.cbrt(m),s_=Math.cbrt(s);
  return [.2104542553*l_+.7936177850*m_-.0040720468*s_,1.9779984951*l_-2.4285922050*m_+.4505937099*s_,.0259040371*l_+.7827717662*m_-.8086757660*s_]}
function pct(h,n,q){const t=n*q;let c=0;for(let i=0;i<h.length;i++){c+=h[i];if(c>=t)return (i+.5)/h.length}return 1}
const SMOOTH=['domCos','domSin','noiseFloor','texEnergy','meanY','p1','p5','p50','p95','p99','peak99','clipFrac','crushFrac','meanC','p95C','neutralFrac','castA','castB','castConf','meanL'];
const S={ticks:0,cutCount:0,sinceCut:0,cut:false,motion:0,avgMotion:0,rate:1,raw:null,sm:null,prevY:null,prevHist:null,frameWidth:0,frameHeight:0};
function reset(){S.ticks=0;S.cutCount=0;S.sinceCut=0;S.cut=false;S.motion=S.avgMotion=0;S.raw=S.sm=S.prevY=S.prevHist=null;S.frameWidth=S.frameHeight=0}
function update(px,w,h,ene){
  // Fail closed on incomplete GPU readbacks. A transient empty frame must not
  // poison the rolling scene state with NaN values or reset temporal history.
  if(!px||!Number.isInteger(w)||!Number.isInteger(h)||w<1||h<1)return S;
  const N=w*h;
  if(!Number.isSafeInteger(N)||N<1||N>4_194_304||typeof px.length!=='number'||px.length<N*4)return S;
  if(ene!=null&&(typeof ene.length!=='number'||ene.length<N*4))ene=null;
  // Resolution changes invalidate pixel-by-pixel motion history. Keep the smoothed
  // scene estimate, but avoid comparing arrays with different dimensions.
  if(S.frameWidth!==0&&(S.frameWidth!==w||S.frameHeight!==h)){S.prevY=S.prevHist=null;S.motion=S.avgMotion=0;S.sinceCut=0;S.cut=false}
  const Y=new Float32Array(N),C=new Float32Array(N),hist=new Float32Array(BINS),mxh=new Float32Array(BINS),hueW=new Float64Array(HUES),hs=new Float64Array(HUES),hc=new Float64Array(HUES);
  const eList=[];let sumY=0,sumL=0,sumC=0,clip=0,crush=0,neutral=0,ca=0,cb=0,cn=0,hueTot=0;
  for(let i=0;i<N;i++){
    const pr=px[i*4],pg=px[i*4+1],pb=px[i*4+2],pa=px[i*4+3];
    // Reject malformed frames atomically: never let NaN/Infinity poison scene state.
    if(!Number.isFinite(pr)||!Number.isFinite(pg)||!Number.isFinite(pb)||!Number.isFinite(pa))return S;
    const r=Math.min(255,Math.max(0,pr))/255,g=Math.min(255,Math.max(0,pg))/255,b=Math.min(255,Math.max(0,pb))/255,mx=Math.min(255,Math.max(0,pa))/255;
    const y=.2126*r+.7152*g+.0722*b;Y[i]=y;sumY+=y;hist[Math.min(BINS-1,y*BINS|0)]++;mxh[Math.min(BINS-1,mx*BINS|0)]++;
    if(ene&&y>.04&&y<.92)eList.push(ene[i*4]/255/8);if(mx>.98)clip++;if(y<.02)crush++;
    const [L,A,B]=oklab(Math.pow(r,GAMMA),Math.pow(g,GAMMA),Math.pow(b,GAMMA)),c=Math.hypot(A,B);C[i]=c;sumL+=L;sumC+=c;
    if(c<.03)neutral++;
    if(c>.02){const hr=Math.atan2(B,A);let hd=hr*180/Math.PI;if(hd<0)hd+=360;const bi=Math.min(HUES-1,hd/30|0);hueW[bi]+=c;hs[bi]+=c*Math.sin(hr);hc[bi]+=c*Math.cos(hr);hueTot+=c}
    if(L>.2&&L<.9&&c<.08){ca+=A;cb+=B;cn++}}
  const hueShares=Array.from(hueW,x=>hueTot>0?x/hueTot:0),maxShare=Math.max(...hueShares),Cs=Array.from(C).sort((a,b)=>a-b);
  eList.sort((a,b)=>a-b);const hasE=eList.length>=N*.1,prevSm=S.sm;
  const domAng=Math.atan2(hs[hueShares.indexOf(maxShare)],hc[hueShares.indexOf(maxShare)]),raw={domCos:Math.cos(domAng),domSin:Math.sin(domAng),noiseFloor:hasE?eList[Math.floor(eList.length*.15)]:(prevSm?prevSm.noiseFloor:.004),texEnergy:hasE?eList.reduce((a,b)=>a+b,0)/eList.length:(prevSm?prevSm.texEnergy:.01),meanY:sumY/N,meanL:sumL/N,p1:pct(hist,N,.01),p5:pct(hist,N,.05),p50:pct(hist,N,.5),p95:pct(hist,N,.95),p99:pct(hist,N,.99),peak99:pct(mxh,N,.99),
    clipFrac:clip/N,crushFrac:crush/N,meanC:sumC/N,p95C:Cs[Math.floor(N*.95)],neutralFrac:neutral/N,
    castA:cn>=N*.03?ca/cn:0,castB:cn>=N*.03?cb/cn:0,castConf:cn>=N*.03?Math.min(1,cn/(N*.2))*(1-maxShare*.5):0,hueShares,hueMax:maxShare,
    dominantHue:HUE_NAMES[hueShares.indexOf(maxShare)]};
  // motion + cut detection (luma thumbnail difference + histogram distance)
  let diff=0,hd=0;if(S.prevY){for(let i=0;i<N;i++)diff+=Math.abs(Y[i]-S.prevY[i]);diff/=N;for(let i=0;i<BINS;i++)hd+=Math.abs(hist[i]-S.prevHist[i]);hd/=2*N}
  const cut=!!S.prevY&&S.sinceCut>=4&&((diff>.10&&hd>.18)||diff>.25)&&diff>3*S.avgMotion+.04;
  S.motion=diff;S.cut=cut;S.ticks++;
  if(cut){S.cutCount++;S.sinceCut=0}else{S.sinceCut++;S.avgMotion=S.ticks<=2?diff:S.avgMotion*.9+diff*.1}
  // temporal smoothing: snap on cut, fast right after, slow afterwards (rate scales it; later stages expose it as "Scene Adaptation Speed")
  if(!S.sm||cut)S.sm={...raw,hueShares:hueShares.slice()};
  else{const a=Math.min(1,(S.sinceCut<6?.5:.12)*S.rate);for(const k of SMOOTH)S.sm[k]+=(raw[k]-S.sm[k])*a;S.sm.hueShares=S.sm.hueShares.map((x,i)=>x+(hueShares[i]-x)*a);
    const m=Math.max(...S.sm.hueShares);S.sm.hueMax=m;S.sm.dominantHue=HUE_NAMES[S.sm.hueShares.indexOf(m)]}
  S.raw=raw;S.prevY=Y;S.prevHist=hist;S.frameWidth=w;S.frameHeight=h;return S}
/* Lighting parameter targets from smoothed scene stats (pure; mirrored by the GLSL in texturing.js). L = {on,shadow,illum,rolloff,noise} in 0..1(+) */
const ss=(a,b,x)=>{const t=Math.min(1,Math.max(0,(x-a)/(b-a)));return t*t*(3-2*t)};
function lighting(m,L){if(!m||!L||!L.on)return null;const dark=1-ss(.15,.5,m.p50),nf=m.noiseFloor;
  return {shadow:L.shadow*(.03+.07*dark),anchor:Math.min(.12,Math.max(0,m.p1)),illAmt:.22*L.illum,illTarget:Math.min(.5,Math.max(.18,m.meanY)),
    knee:1-(1-(.82-.12*Math.min(1,m.clipFrac*8)))*L.rolloff,core:Math.min(.03,nf*1.5),damp:1-Math.min(.6,Math.max(0,(nf-.006)/.03))*L.noise}}
/* Highlight shoulder: maps [knee,W] -> [knee,1] with slope 1 at the knee and 0 at the top; W<=1 is the identity. */
function shoulderP(k,W){return W<=1?1:(W-k)/(1-k)}
function shoulder(y,k,W){if(k>=.999||y<=k)return y;const p=shoulderP(k,W),x=Math.min(1,(y-k)/(Math.max(W,1)-k));return k+(1-k)*(1-Math.pow(1-x,p))}
/* Auto Color targets (pure). C = {on,strength,wb,chroma,sep,skin,shadowKeep,hiKeep}, all 0..1 except on.
 * Conservative by construction: white-balance correction ignores small casts (dead zone), is capped, scaled by estimate confidence and halved in colourful scenes,
 * so intentional lighting (golden hour, neon, cinematic grade) survives. Chroma boost is vibrance-style (muted colours more than saturated ones). */
function autoColor(m,C){if(!m||!C||!C.on)return null;const s=C.strength,night=1-ss(.12,.30,m.p50),neon=night*ss(.10,.20,m.p95C),flat=1-ss(.03,.10,m.meanC);
  const conf=m.castConf*(m.meanC>.12?.5:1),mag=Math.hypot(m.castA,m.castB),over=Math.max(0,mag-.012),sc=mag>0?Math.min(over,.04)/mag:0,k=sc*conf*C.wb*s*.75;
  const castPen=Math.min(1,conf*ss(.012,.04,mag)*1.6),dl=Math.hypot(m.domCos,m.domSin)||1;
  return {wbA:-m.castA*k,wbB:-m.castB*k,vibr:s*C.chroma*(.10+.30*flat)*(1-.5*neon)*(1-.3*night)*(1-castPen),sep:s*C.sep*(.15+.35*ss(.3,.7,m.hueMax)),
    domCos:m.domCos/dl,domSin:m.domSin/dl,domW:ss(.35,.7,m.hueMax),meanL:m.meanL,skin:C.skin,shadowKeep:C.shadowKeep,hiKeep:C.hiKeep,scene:{night,neon,flat}}}
/* Protected/blank-video probe. list=[{t:currentTime(s), max:max RGB byte over a few sampled pixels}].
   Protected (EME) video can upload as solid black without any error, so black must persist over real playback time.
   Legit black (fade-in, intro) is tolerated: without EME keys we require 4 s of continuous black, with keys 1.5 s. */
function probeVerdict(list,hasKeys){if(!list||list.length<2)return 'wait';
  if(list.some(p=>p.max>8))return 'ok';
  const span=list[list.length-1].t-list[0].t,need=hasKeys?1.5:4;
  if(list.length>=3&&span>=need&&list.every(p=>p.max<=2))return 'black';
  return 'wait'}
/* Stage 9: how much history the temporal denoiser may keep. Shut off right after a cut and during sustained global change (fades, dissolves AND camera/scene motion look the same at thumbnail level, so all of them reduce accumulation). Returns the history weight 0..0.75. */
function temporalStrength(st,base){const m=Math.max(st.avgMotion||0,.5*(st.motion||0));const g=1-ss(.006,.025,m),settle=Math.min(1,(st.sinceCut||0)/3);return Math.max(0,Math.min(.75,(base||0)*.9*g*settle))}
const api={update,reset,state:S,temporalStrength,HUE_NAMES,oklab,lighting,shoulder,shoulderP,autoColor,probeVerdict};
if(typeof module!=='undefined')module.exports=api;else globalThis.ZVAnalysis=api;
})();
