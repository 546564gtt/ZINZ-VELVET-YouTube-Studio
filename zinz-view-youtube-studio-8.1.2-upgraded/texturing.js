/* TEXTURING Stage 2 — WebGL2 renderer.
 * Draws the video into an overlay canvas through a GPU pipeline that implements the existing
 * Effects / Material Depth settings (the SVG filter was never applied to the video, so most of them did nothing).
 * Compatibility: WebGL1 and Canvas 2D preserve core tone, selective color and fine/mid spatial detail when WebGL2 is unavailable.
 * Advanced temporal denoise, guided filtering and edge-aware upscaling remain WebGL2-only. If pixel access is blocked, native CSS filters are preserved.
 * Keys: Alt+B bypass (A/B on the same canvas) · Alt+I cycle view (final / fine-detail / mid-detail / split)
 *       Alt+H stats HUD · Alt+G renderer on/off (persisted) */
(()=>{'use strict';
const CFG_KEY='zinzTexturing',MIGRATION_KEY='zinzV76UnifiedEffectsMigration';
const COLOR_PALETTE=globalThis.ZVColorPalette;
if(!COLOR_PALETTE)throw new Error('VELVET color-palette.js must load before texturing.js');
const COLOR_TARGETS=COLOR_PALETTE.ALL.map(x=>x.key);
const HUE_TARGET_COUNT=COLOR_PALETTE.HUE_TARGETS.length;
const TARGET_INDEX=new Map(COLOR_TARGETS.map((k,i)=>[k,i]));
const makeTargetColors=()=>Object.fromEntries(COLOR_TARGETS.map(k=>[k,{hue:0,sat:0,lum:0}]));
const FXD={enabled:false,sharp:0,contrast:0,saturation:0,brightness:0,gamma:0,highlights:0,shadows:0,warmth:0,tint:0,redBalance:0,greenBalance:0,blueBalance:0,blackPoint:0,whitePoint:0,fade:0,targetColors:makeTargetColors()};
const MDD={enabled:false,depth:8,micro:18,structure:12,edge:12,local:8,highlight:5,protection:70,stability:60};
let fx={...FXD},md={...MDD},cfg={gl:true,hud:false,light:{on:true,shadow:1,illum:1,rolloff:1,noise:1},auto:{on:false,strength:.6,wb:1,chroma:1,sep:1,skin:.7,shadowKeep:.7,hiKeep:.7,speed:1},clean:{deband:0,dither:1,gf:.6,sharp:.4,up:1,temporal:.6},perf:{ingest:0,lock:0,bench:0,watchdog:1,allowSoft:0}};
let bypass=false,view=0,dirty=true,newFrame=true,level=0,state='idle';// idle|on|failed
let vid=null,canvas=null,gl=null,hud=null,P=null,ready=false,lastW=0,lastH=0;
const pace=new ZVPace.Pace(),gov={bad:0,lastStep:0,cleanSince:0};
globalThis.__ZVDebug={get ingest(){return ingestM},get benchDone(){return benchDone},get bench(){return benchRes},get renderer(){return glRenderer},get rendererMode(){return rendererMode},get cpuTargetCap(){return cpuTargetCap},get state(){return state},get level(){return level},get pace(){return pace},get colorTargetCount(){return COLOR_TARGETS.length},get gpuMs(){return gpuMs},get gpuTimerAvailable(){return !!gpuTimerExt}};/* read-only hook for tests/smoke_texturing.js */
let failWhy='',ingestM='video',benchDone=false,benchIdx=0,bench={video:[],c2d:[],vf:[]},benchRes=null,c2dC=null,c2dX=null,glRenderer='',slowStrikes=0,slowFails=0;
let rendererMode='gl',cpu2d=null,cpuTargetCap=(navigator.hardwareConcurrency||4)>=8?480:420,cpuSlow=0,cpuFast=0,cpuFrameAvg=0,compatGL1=null;
let hueLutDirty=true,videoTexW=2,videoTexH=2,uploadTextureSize=null,gpuTimerExt=null,gpuTimerActive=null,gpuTimerQueue=[],gpuMs=0;const gpuSamples=[];
let layoutDirty=true,lastOn=null,mo=null,probeTries=0,srcW=0,srcH=0,upMs=0,lastLayoutPoke=0,pendingU=false,pendingEnergy=false,uScheduled=false;
let tdIdx=0,histValid=false,lastCutSeen=0,tdOn=false,tdStr=0,hfOK=false,upOn=false,lastCW=0,lastCH=0,useGF=false;let probeList=[],probeDone=false,probeFbo=null,lastProbe=0,analysisReadbackReady=false,failSrc='',rvfcId=0,hasRvfc=false,lastT=-1,ro=null;
let lastHud=0,progs={},tex={},fbo={},vao=null,frameMs=0,rendered=0,lastDrop=0,lastCheck=0,cleanSince=0;
// Video start-up includes shader compilation, framebuffer allocation and texture warm-up. Exclude it from steady-state lag scoring.
const QUALITY_WARMUP_MS=8000,QUALITY_WARMUP_FRAMES=120;let qualityWarmupAt=0,qualityWarmupDone=false;
const mergeCfg=(o,n)=>({...o,...n,light:{...o.light,...(n&&n.light)},auto:{...o.auto,...(n&&n.auto)},clean:{...o.clean,...(n&&n.clean)},perf:{...o.perf,...(n&&n.perf)}});
const clamp=(v,a,b)=>Math.min(b,Math.max(a,Number(v)||0));
const SEL='video.html5-main-video, ytmusic-player video';

/* ---- parameters (baseline sat/brightness/contrast keep the exact CSS mapping the user already saw) ---- */
function buildParams(){
  const f=fx.enabled,m=md.enabled;
  const sat=f?Math.max(0,1+clamp(fx.saturation,-80,80)/100):1;
  const bright=f?Math.max(.2,1+clamp(fx.brightness,-60,60)/180):1;
  const contrast=(f?Math.max(.3,1+clamp(fx.contrast,-60,60)/150):1)*(m?1+clamp(md.depth,0,100)/1000:1);
  const warm=f?clamp(fx.warmth,-100,100)/100:0,tint=f?clamp(fx.tint,-100,100)/100:0;
  const bp=f?clamp(fx.blackPoint,-40,40)/100:0,wp=f?clamp(fx.whitePoint,-40,40)/100:0,fade=f?clamp(fx.fade,0,60)/100:0;
  const span=Math.max(.3,1+wp-bp),bias=-bp*.35+fade*.12;
  const bal=k=>1+(f?clamp(fx[k],-60,60):0)/300;
  const mul=[(1+warm*.10+tint*.025)*span*bal('redBalance'),(1-tint*.06)*span*bal('greenBalance'),(1-warm*.10+tint*.025)*span*bal('blueBalance')];
  const gamma=f?Math.max(.4,1+clamp(fx.gamma,-70,70)/100):1;
  const sh=f?clamp(fx.shadows,-60,60)/100:0,hi=f?clamp(fx.highlights,-60,60)/100:0;
  const curve=[0,.25+sh*.12,.5+(sh+hi)*.035,.75+hi*.12,1].map(x=>clamp(x,0,1));
  const micro=m?clamp(md.micro,0,100)/100:0,medium=m?clamp(md.structure,0,100)/100:0,sharp=f?clamp(fx.sharp,0,100)/100:0;
  const protect=m?clamp(md.protection,0,100)/100:0,edge=m?clamp(md.edge,0,100)/100:0,local=m?clamp(md.local,0,100)/100:0;
  const high=m?clamp(md.highlight,0,100)/100:0,stable=m?clamp(md.stability,0,100)/100:0,depth=m?clamp(md.depth,0,100)/100:0;
  const A=Math.min(.55,(micro*.24+sharp*.20+edge*.13)*(1-protect*.45)*(1-stable*.16));
  const B=Math.min(.4,(medium*.17+depth*.07+local*.09+high*.035)*(1-protect*.22));
  const targets=fx.targetColors||{};
  const hueShift=new Float32Array(COLOR_TARGETS.length),hueSat=new Float32Array(COLOR_TARGETS.length),hueLum=new Float32Array(COLOR_TARGETS.length);
  COLOR_TARGETS.forEach((key,i)=>{const t=f?(targets[key]||{}):{};hueShift[i]=clamp(t.hue,-100,100);hueSat[i]=clamp(t.sat,-100,100);hueLum[i]=clamp(t.lum,-100,100)});
  const specialControl=key=>{const i=TARGET_INDEX.get(key);return [hueShift[i]/100,hueSat[i]/100,hueLum[i]/100]};
  const skinCtrl=specialControl('skin'),earthCtrl=specialControl('earth');
  const hasSkin=skinCtrl.some(v=>Math.abs(v)>.001),hasEarth=earthCtrl.some(v=>Math.abs(v)>.001);
  const hasTargets=COLOR_PALETTE.HUE_TARGETS.some(t=>{const i=TARGET_INDEX.get(t.key);return Math.abs(hueShift[i])>.001||Math.abs(hueSat[i])>.001||Math.abs(hueLum[i])>.001})||hasSkin||hasEarth;
  return {active:f||m,sat,bright,contrast,mul,bias,gamma,curve,A,B,core:.003+protect*.012,soft:.10,midSigma:2+local*1.5,gain:span*contrast,hueShift,hueSat,hueLum,hasTargets,hasSkin,hasEarth,skinCtrl,earthCtrl};
}

/* ---- GL helpers ---- */
const VS=`#version 300 es
out vec2 v;void main(){vec2 p=vec2((gl_VertexID<<1)&2,gl_VertexID&2);v=p;gl_Position=vec4(p*2.-1.,0.,1.);}`;
const BLUR=`#version 300 es
precision highp float;in vec2 v;out vec4 o;uniform sampler2D t;uniform vec2 dir;uniform float sigma,lum;
float sampleValue(float x){vec3 c=texture(t,v+dir*x).rgb;return lum>.5?dot(c,vec3(.2126,.7152,.0722)):c.r;}
void main(){float s=max(1.,sigma/1.5),a=0.,w=0.;
 /* The fine band uses sigma 0.7: taps beyond +/-2 contribute <0.02% of the kernel, so do five fetches instead of nine. Keep the full nine-tap kernel for the wider mid band. */
 if(sigma<1.){for(int i=-2;i<=2;i++){float x=float(i)*s,k=exp(-x*x/(2.*sigma*sigma));a+=k*sampleValue(x);w+=k;}}
 else{for(int i=-4;i<=4;i++){float x=float(i)*s,k=exp(-x*x/(2.*sigma*sigma));a+=k*sampleValue(x);w+=k;}}
 o=vec4(vec3(a/w),1.);}`;
const FINAL=`#version 300 es
precision highp float;in vec2 v;out vec4 o;
uniform sampler2D uSrc,uFine,uMid,uIll;uniform float uSat,uBright,uContrast,uGamma,uCurve[5],uA,uB,uCore,uSoft,uGain,uHasFine,uHasMid,uBypass,uSplit;
uniform vec3 uMul;uniform float uBias;uniform int uView;uniform float uDeband,uDbR,uDbT,uDither,uFrame;
float ign(vec2 p){return fract(52.9829189*fract(dot(p,vec2(.06711056,.00583715))));}
/* Debanding: 4 randomly oriented tap pairs; a pair contributes only if BOTH taps are within threshold of the centre on every channel, so real edges and texture stay untouched. */
vec3 deband(vec3 s){vec2 px=1./vec2(textureSize(uSrc,0));float n=ign(gl_FragCoord.xy+uFrame*5.588238);vec3 acc=s;float ws=1.;
 for(int k=0;k<4;k++){float a=6.2831853*fract(n+float(k)*.25+.0625),r=uDbR*(.3+.7*fract(n*float(k+2)*7.31+float(k)*.37));vec2 o=vec2(cos(a),sin(a))*r*px;
  vec3 p1=texture(uSrc,v+o).rgb,p2=texture(uSrc,v-o).rgb;vec3 d1=abs(p1-s),d2=abs(p2-s);
  float w=(1.-smoothstep(.5*uDbT,uDbT,max(d1.r,max(d1.g,d1.b))))*(1.-smoothstep(.5*uDbT,uDbT,max(d2.r,max(d2.g,d2.b))));acc+=w*(p1+p2);ws+=2.*w;}
 return mix(s,acc/ws,clamp(uDeband,0.,1.));}
uniform float uHead,uShadow,uAnchor,uIllAmt,uIllTarget,uHasIll,uKnee,uW,uP;
uniform float uAuto,uVibr,uSep,uDomW,uMeanL,uSkin,uShadowKeep,uHiKeep;uniform vec2 uWB,uDom;
uniform sampler2D uHueLut;uniform vec3 uSkinCtrl,uEarthCtrl;uniform float uHasTargets,uHasSkin,uHasEarth;
const vec3 LUM=vec3(.2126,.7152,.0722);
float shape(float x){float ax=abs(x);return x*smoothstep(uCore,uCore*3.,ax)*uSoft/(uSoft+ax);}
float curve(float x){if(x>1.)return x;float p=clamp(x,0.,1.)*4.;int i=int(min(floor(p),3.));return mix(uCurve[i],uCurve[i+1],p-float(i));}
vec3 tone(vec3 c){float hm=uHead>.5?2.:1.;float y=dot(c,vec3(.213,.715,.072));c=mix(vec3(y),c,uSat);c=clamp(c*uBright,0.,hm);c=clamp((c-.5)*uContrast+.5,0.,hm);
c=clamp(c*uMul+uBias,0.,hm);c=pow(c,vec3(1./uGamma));return vec3(curve(c.r),curve(c.g),curve(c.b));}
vec3 toLin(vec3 c){return mix(c/12.92,pow((c+.055)/1.055,vec3(2.4)),step(vec3(.04045),c));}
vec3 toSrgb(vec3 c){c=max(c,0.);return mix(c*12.92,1.055*pow(c,vec3(1./2.4))-.055,step(vec3(.0031308),c));}
vec3 toOk(vec3 c){float l=pow(max(.4122214708*c.r+.5363325363*c.g+.0514459929*c.b,0.),1./3.),m=pow(max(.2119034982*c.r+.6806995451*c.g+.1073969566*c.b,0.),1./3.),s=pow(max(.0883024619*c.r+.2817188376*c.g+.6299787005*c.b,0.),1./3.);
return vec3(.2104542553*l+.7936177850*m-.0040720468*s,1.9779984951*l-2.4285922050*m+.4505937099*s,.0259040371*l+.7827717662*m-.8086757660*s);}
vec3 fromOk(vec3 k){float l=k.x+.3963377774*k.y+.2158037573*k.z,m=k.x-.1055613458*k.y-.0638541728*k.z,s=k.x-.0894841775*k.y-1.2914855480*k.z;l=l*l*l;m=m*m*m;s=s*s*s;
return vec3(4.0767416621*l-3.3077115913*m+.2309699292*s,-1.2684380046*l+2.6097574011*m-.3413193965*s,-.0041960863*l-.7034186147*m+1.7076147010*s);}
bool inGamut(vec3 c){return all(greaterThanEqual(c,vec3(-.002)))&&all(lessThanEqual(c,vec3(1.002)));}
/* Auto Color: OKLab white-balance nudge + vibrance-style chroma + dominant-hue lightness separation, skin-protected, with chroma-only gamut compression */
vec3 autoColor(vec3 c0){
 vec3 lab=toOk(toLin(clamp(c0,0.,1.)));float L=lab.x;vec2 ab=lab.yz;float C=length(ab);
 float hd=degrees(atan(ab.y,ab.x));if(hd<0.)hd+=360.;
 float skin=(1.-smoothstep(18.,32.,abs(hd-52.)))*smoothstep(.03,.06,C)*(1.-smoothstep(.14,.20,C))*smoothstep(.30,.45,L)*(1.-smoothstep(.92,.98,L));
 float prot=1.-uSkin*skin;
 float tn=mix(1.,smoothstep(.08,.30,L),uShadowKeep)*mix(1.,1.-smoothstep(.88,.99,L),uHiKeep);
 ab+=uWB*tn*prot;C=length(ab);
 ab*=1.+uVibr*(1.-smoothstep(.06,.22,C))*smoothstep(.008,.04,C)*tn*prot;C=length(ab);
 float cd=C>1e-4?dot(ab/C,uDom):0.;
 float band=smoothstep(.5,.95,cd)*smoothstep(.02,.06,C)*uDomW;
 L+=uSep*band*(L-uMeanL)*.5*tn;
 vec3 rgb=fromOk(vec3(L,ab));
 if(!inGamut(rgb)){float lo=0.,hi=1.;for(int i=0;i<7;i++){float mid=.5*(lo+hi);if(inGamut(fromOk(vec3(L,ab*mid))))lo=mid;else hi=mid;}rgb=fromOk(vec3(L,ab*lo));}
 return toSrgb(clamp(rgb,0.,1.));}
float fastHue(vec3 c){float mx=max(c.r,max(c.g,c.b)),mn=min(c.r,min(c.g,c.b)),d=mx-mn;if(d<1e-5)return 0.;float h;if(mx==c.r)h=60.*mod((c.g-c.b)/d,6.);else if(mx==c.g)h=60.*((c.b-c.r)/d+2.);else h=60.*((c.r-c.g)/d+4.);return mod(h+360.,360.);}
float hueDist(float a,float b){return abs(mod(a-b+540.,360.)-180.);}
vec3 targetedColor(vec3 c0){
 if(uHasTargets<.5)return c0;
 float hue=fastHue(c0),mx=max(c0.r,max(c0.g,c0.b)),mn=min(c0.r,min(c0.g,c0.b)),ch=mx-mn,yy=dot(c0,LUM);
 /* One 360x1 LUT sample replaces 24/74 conditional hue calculations per pixel. Neutral pixels exit before expensive OKLab math. */
 vec3 packed=texture(uHueLut,vec2((hue+.5)/360.,.5)).rgb;
 vec3 ctrl=(packed*255.-vec3(128.))/127.;
 bool skinCandidate=uHasSkin>.5&&(hue<76.||hue>345.)&&ch>.018&&mx<.995&&mx>.025&&yy<.97;
 bool earthCandidate=uHasEarth>.5&&(hue<72.||hue>342.)&&ch>.012&&mx<.93;
 if(max(abs(ctrl.x),max(abs(ctrl.y),abs(ctrl.z)))<.0035&&!skinCandidate&&!earthCandidate)return c0;
 vec3 lab=toOk(toLin(clamp(c0,0.,1.)));float L=lab.x;vec2 ab=lab.yz;float C=length(ab);
 if(C<.006)return c0;
 float hd=degrees(atan(ab.y,ab.x));if(hd<0.)hd+=360.;
 float chromaGate=smoothstep(.008,.035,C),angle=radians(ctrl.x*45.)*chromaGate,satDelta=ctrl.y*chromaGate,lightDelta=ctrl.z*.12*chromaGate;
 /* Dedicated perceptual masks are only evaluated when their individual control is non-neutral. */
 if(uHasSkin>.5){float skinHue=1.-smoothstep(10.,52.,hueDist(hd,55.));float skinLum=smoothstep(.10,.23,L)*(1.-smoothstep(.94,.995,L));float skinChroma=smoothstep(.012,.035,C)*(1.-smoothstep(.18,.26,C));float w=skinHue*skinLum*skinChroma;angle+=radians(uSkinCtrl.x*45.)*w;satDelta+=uSkinCtrl.y*w;lightDelta+=uSkinCtrl.z*.12*w;}
 if(uHasEarth>.5){float earthHue=1.-smoothstep(12.,42.,hueDist(hd,53.));float earthLum=smoothstep(.07,.20,L)*(1.-smoothstep(.78,.91,L));float earthChroma=smoothstep(.009,.027,C)*(1.-smoothstep(.20,.29,C));float w=earthHue*earthLum*earthChroma;angle+=radians(uEarthCtrl.x*45.)*w;satDelta+=uEarthCtrl.y*w;lightDelta+=uEarthCtrl.z*.12*w;}
 if(abs(angle)+abs(satDelta)+abs(lightDelta)<.0001)return c0;
 angle=clamp(angle,-1.5707963,1.5707963);satDelta=clamp(satDelta,-1.,2.);lightDelta=clamp(lightDelta,-.30,.30);
 float ca=cos(angle),sa=sin(angle);ab=vec2(ab.x*ca-ab.y*sa,ab.x*sa+ab.y*ca)*clamp(1.+satDelta,0.,3.);
 L=clamp(L+lightDelta,0.,1.);vec3 rgb=fromOk(vec3(L,ab));
 if(!inGamut(rgb)){float lo=0.,hi=1.;for(int i=0;i<4;i++){float mid=.5*(lo+hi);if(inGamut(fromOk(vec3(L,ab*mid))))lo=mid;else hi=mid;}rgb=fromOk(vec3(L,ab*lo));}
 return toSrgb(clamp(rgb,0.,1.));
}
void main(){vec3 s0=texture(uSrc,v).rgb;vec3 s=uDeband>.001?deband(s0):s0;
 bool raw=uBypass>.5||(uView==3&&v.x<uSplit);
 float y=dot(s,LUM),yf=uHasFine>.5?texture(uFine,v).r:y,ym=uHasMid>.5?texture(uMid,v).r:yf;
 float d1=shape(y-yf),d2=shape(yf-ym);
 if(uView==1){o=vec4(vec3(.5+4.*d1),1.);return;}
 if(uView==2){o=vec4(vec3(.5+4.*d2),1.);return;}
 if(raw){o=vec4(s0,1.);if(uView==3&&abs(v.x-uSplit)<.0015)o=vec4(1.);return;}
 vec3 c=tone(s);float yt=dot(c,LUM);
 float w=mix(.35,1.,smoothstep(0.,.1,yt))*(1.-.65*smoothstep(.82,1.,yt));
 c+=(uA*d1+uB*d2)*uGain*w;
 if(uHead>.5){
  yt=max(dot(c,LUM),1e-4);
  if(uHasIll>.5){float ill=dot(texture(uIll,v).rgb,LUM);float g=clamp(pow(uIllTarget/max(ill,.04),uIllAmt),.96,1.3);g=mix(1.,g,1.-smoothstep(.55,.9,yt));c*=g;yt=max(yt*g,1e-4);}
  float b=smoothstep(uAnchor,uAnchor+.10,yt)*(1.-smoothstep(uAnchor+.15,uAnchor+.45,yt));c*=(yt+uShadow*b)/yt;
  float yr=max(dot(c,LUM),1e-4);
  if(uKnee<.999&&yr>uKnee){float x=min(1.,(yr-uKnee)/max(uW-uKnee,1e-3));c*=(uKnee+(1.-uKnee)*(1.-pow(1.-x,uP)))/yr;}
 }
 if(uAuto>.5)c=autoColor(c);
 c=targetedColor(c);
 c=clamp(c,0.,1.);
 /* Output dither: 1-LSB triangular noise (same on all channels, no colour noise) hides 8-bit steps; skipped at pure black/white so letterbox bars stay clean. */
 if(uDither>0.){float m=max(c.r,max(c.g,c.b)),f=smoothstep(.5/255.,2.5/255.,m)*(1.-smoothstep(253./255.,254.5/255.,m));vec2 q=gl_FragCoord.xy+uFrame*5.588238;c=clamp(c+(ign(q)+ign(q+vec2(19.19,7.77))-1.)*uDither*f/255.,0.,1.);}
 o=vec4(c,1.);if(uView==3&&abs(v.x-uSplit)<.0015)o=vec4(1.);}`;
const UP=`#version 300 es
precision highp float;precision highp sampler2D;in vec2 v;out vec4 o;uniform sampler2D uT;uniform float uBypass,uSplit;uniform int uView;
/* Catmull-Rom bicubic in 9 bilinear taps, then clamped to the 2x2 source neighbourhood (no ringing/halos, still steeper than bilinear). */
void main(){
 if(uBypass>.5||(uView==3&&v.x<uSplit)){o=vec4(texture(uT,v).rgb,1.);return;}
 vec2 size=vec2(textureSize(uT,0)),pos=v*size,c=floor(pos-.5)+.5,f=pos-c;
 vec2 w0=f*(-.5+f*(1.-.5*f)),w1=1.+f*f*(-2.5+1.5*f),w2=f*(.5+f*(2.+(-1.5)*f)),w3=f*f*(-.5+.5*f),w12=w1+w2,o12=w2/w12;
 vec2 t0=(c-1.)/size,t3=(c+2.)/size,t12=(c+o12)/size;
 vec3 r=texture(uT,vec2(t0.x,t0.y)).rgb*w0.x*w0.y+texture(uT,vec2(t12.x,t0.y)).rgb*w12.x*w0.y+texture(uT,vec2(t3.x,t0.y)).rgb*w3.x*w0.y
  +texture(uT,vec2(t0.x,t12.y)).rgb*w0.x*w12.y+texture(uT,vec2(t12.x,t12.y)).rgb*w12.x*w12.y+texture(uT,vec2(t3.x,t12.y)).rgb*w3.x*w12.y
  +texture(uT,vec2(t0.x,t3.y)).rgb*w0.x*w3.y+texture(uT,vec2(t12.x,t3.y)).rgb*w12.x*w3.y+texture(uT,vec2(t3.x,t3.y)).rgb*w3.x*w3.y;
 ivec2 sz=ivec2(size),i0=ivec2(c-.5);
 vec3 a=texelFetch(uT,clamp(i0,ivec2(0),sz-1),0).rgb,b=texelFetch(uT,clamp(i0+ivec2(1,0),ivec2(0),sz-1),0).rgb,d=texelFetch(uT,clamp(i0+ivec2(0,1),ivec2(0),sz-1),0).rgb,e=texelFetch(uT,clamp(i0+ivec2(1,1),ivec2(0),sz-1),0).rgb;
 o=vec4(clamp(r,min(min(a,b),min(d,e)),max(max(a,b),max(d,e))),1.);}`;
const CAS=`#version 300 es
precision highp float;precision highp sampler2D;in vec2 v;out vec4 o;uniform sampler2D uT;uniform float uAmt,uK,uDither,uFrame,uBypass,uSplit;uniform int uView;
float ign(vec2 p){return fract(52.9829189*fract(dot(p,vec2(.06711056,.00583715))));}
/* Contrast-adaptive sharpen (CAS-style): weight shrinks where local contrast is already high or near 0/1, so no clipping; overshoot limited to uK of the local range. Dither is applied here, last. */
void main(){vec2 px=1./vec2(textureSize(uT,0));vec3 e=texture(uT,v).rgb;
 if(uBypass>.5||(uView==3&&v.x<uSplit)){o=vec4(e,1.);return;}
 vec3 b=texture(uT,v+vec2(0.,-px.y)).rgb,d=texture(uT,v+vec2(-px.x,0.)).rgb,f=texture(uT,v+vec2(px.x,0.)).rgb,h=texture(uT,v+vec2(0.,px.y)).rgb;
 vec3 mn=min(min(min(d,e),min(f,b)),h),mx=max(max(max(d,e),max(f,b)),h);
 vec3 amp=sqrt(clamp(min(mn,1.-mx)/max(mx,vec3(1e-3)),0.,1.));vec3 w=amp*(-.2)*clamp(uAmt,0.,1.);
 vec3 c=(w*(b+d+f+h)+e)/(1.+4.*w);vec3 rg=mx-mn;c=clamp(c,mn-uK*rg,mx+uK*rg);c=clamp(c,0.,1.);
 if(uDither>0.){float m=max(c.r,max(c.g,c.b)),fd=smoothstep(.5/255.,2.5/255.,m)*(1.-smoothstep(253./255.,254.5/255.,m));vec2 q=gl_FragCoord.xy+uFrame*5.588238;c=clamp(c+(ign(q)+ign(q+vec2(19.19,7.77))-1.)*uDither*fd/255.,0.,1.);}
 o=vec4(c,1.);if(uView==3&&abs(v.x-uSplit)<.0015)o=vec4(1.);}`;
/* Guided filter (He & Sun), self-guided on luma at half resolution: edge-preserving base layer for the mid-band local contrast, so big edges do not get halos. 4 passes: box(y,y^2) -> a,b -> box(a,b) -> q=mean_a*y+mean_b. Needs float targets. */
const GFH0=`#version 300 es
precision highp float;precision highp sampler2D;out vec4 o;uniform sampler2D uT;uniform vec2 uOut;uniform int uR;const vec3 LUM=vec3(.2126,.7152,.0722);
void main(){ivec2 p=ivec2(gl_FragCoord.xy);float m1=0.,m2=0.;
 for(int i=-uR;i<=uR;i++){vec2 q=(vec2(float(clamp(p.x+i,0,int(uOut.x)-1)),float(p.y))+.5)/uOut;float y=dot(texture(uT,q).rgb,LUM);m1+=y;m2+=y*y;}
 float n=float(2*uR+1);o=vec4(m1/n,m2/n,0.,1.);}`;
const BOXH=`#version 300 es
precision highp float;precision highp sampler2D;out vec4 o;uniform sampler2D uT;uniform int uR;
void main(){ivec2 p=ivec2(gl_FragCoord.xy),sz=textureSize(uT,0);vec2 m=vec2(0.);
 for(int i=-uR;i<=uR;i++)m+=texelFetch(uT,ivec2(clamp(p.x+i,0,sz.x-1),p.y),0).rg;
 o=vec4(m/float(2*uR+1),0.,1.);}`;
const GFV1=`#version 300 es
precision highp float;precision highp sampler2D;out vec4 o;uniform sampler2D uT;uniform int uR;uniform float uEps;
void main(){ivec2 p=ivec2(gl_FragCoord.xy),sz=textureSize(uT,0);vec2 m=vec2(0.);
 for(int j=-uR;j<=uR;j++)m+=texelFetch(uT,ivec2(p.x,clamp(p.y+j,0,sz.y-1)),0).rg;
 m/=float(2*uR+1);float var=max(m.y-m.x*m.x,0.),a=var/(var+uEps);o=vec4(a,(1.-a)*m.x,0.,1.);}`;
const GFV2=`#version 300 es
precision highp float;precision highp sampler2D;out vec4 o;uniform sampler2D uT,uS;uniform int uR;const vec3 LUM=vec3(.2126,.7152,.0722);
void main(){ivec2 p=ivec2(gl_FragCoord.xy),sz=textureSize(uT,0);vec2 m=vec2(0.);
 for(int j=-uR;j<=uR;j++)m+=texelFetch(uT,ivec2(p.x,clamp(p.y+j,0,sz.y-1)),0).rg;
 m/=float(2*uR+1);float y=dot(texture(uS,(vec2(p)+.5)/vec2(sz)).rgb,LUM);o=vec4(vec3(m.x*y+m.y),1.);}`;
const INGEST=`#version 300 es
precision highp float;precision highp sampler2D;in vec2 v;out vec4 o;uniform sampler2D uT;
/* GPU-side vertical flip of the uploaded video frame (avoids UNPACK_FLIP_Y_WEBGL on the video upload, which can force a slower copy path in some browsers). */
void main(){o=vec4(texture(uT,vec2(v.x,1.-v.y)).rgb,1.);}`;
const TD=`#version 300 es
precision highp float;precision highp sampler2D;in vec2 v;out vec4 o;uniform sampler2D uCur,uHist;uniform float uStr,uT0,uReset;const vec3 LUM=vec3(.2126,.7152,.0722);
/* Motion-adaptive temporal denoise: blend the current frame with the previous denoised frame; history weight collapses where the 3x3-averaged luma difference (relative to the measured noise level uT0) or any single-channel difference says "this changed for real". */
void main(){vec3 c=texture(uCur,v).rgb;if(uReset>.5||uStr<=0.){o=vec4(c,1.);return;}
 vec3 h=texture(uHist,v).rgb;vec2 px=1./vec2(textureSize(uCur,0));float d=0.;
 for(int j=-1;j<=1;j++)for(int i=-1;i<=1;i++){vec2 q=v+vec2(float(i),float(j))*px;d+=abs(dot(texture(uCur,q).rgb-texture(uHist,q).rgb,LUM));}
 d/=9.;vec3 cd=abs(c-h);float pk=max(cd.r,max(cd.g,cd.b));
 float k=uStr*(1.-smoothstep(uT0,uT0*3.5,d))*(1.-smoothstep(uT0*3.,uT0*8.,pk));
 o=vec4(mix(c,h,k),1.);}`;
const ENE=`#version 300 es
precision highp float;out vec4 o;uniform sampler2D uSrc,uFine;uniform vec2 grid;
void main(){ivec2 sz=textureSize(uFine,0);vec2 cell=vec2(sz)/grid;vec2 c=floor(gl_FragCoord.xy);float e=0.;
for(int j=0;j<8;j++)for(int i=0;i<8;i++){ivec2 p=min(ivec2(floor(c*cell+(vec2(float(i),float(j))+.5)*cell/8.)),sz-ivec2(1));vec2 uv=(vec2(p)+.5)/vec2(sz);float y=dot(texture(uSrc,uv).rgb,vec3(.2126,.7152,.0722));e+=abs(y-texelFetch(uFine,p,0).r);}
o=vec4(vec3(clamp(e/64.*8.,0.,1.)),1.);}`;
const ILL=`#version 300 es
precision highp float;in vec2 v;out vec4 o;uniform sampler2D uRaw,uPrev;uniform float uA;
void main(){o=vec4(mix(texture(uPrev,v).rgb,texture(uRaw,v).rgb,uA),1.);}`;
const ANA=`#version 300 es
precision highp float;in vec2 v;out vec4 o;uniform sampler2D t;uniform vec2 grid;
void main(){vec2 c=floor(gl_FragCoord.xy);vec3 a=vec3(0.);float mx=0.;
for(int j=0;j<8;j++)for(int i=0;i<8;i++){vec2 uv=(c+(vec2(float(i),float(j))+.5)/8.)/grid;vec3 s=texture(t,uv).rgb;a+=pow(s,vec3(2.2));mx=max(mx,dot(s,vec3(.2126,.7152,.0722)));}
o=vec4(pow(a/64.,vec3(1./2.2)),mx);}`;
const AW=64,AH=36;let ana={fence:null,pbo:null,buf:new Uint8Array(AW*AH*4),ebuf:new Uint8Array(AW*AH*4),tick:0,valid:false,illI:0,illInit:false,snap:false,lastCut:0,eneFresh:false};const pendingAnalysisBuf=new Uint8Array(AW*AH*4),pendingEnergyBuf=new Uint8Array(AW*AH*4);let lp=null,illTex=null;
function sh(type,src){const s=gl.createShader(type);gl.shaderSource(s,src);gl.compileShader(s);if(!gl.getShaderParameter(s,gl.COMPILE_STATUS))throw new Error(gl.getShaderInfoLog(s));return s}
function prog(fs){const p=gl.createProgram();gl.attachShader(p,sh(gl.VERTEX_SHADER,VS));gl.attachShader(p,sh(gl.FRAGMENT_SHADER,fs));gl.linkProgram(p);if(!gl.getProgramParameter(p,gl.LINK_STATUS))throw new Error(gl.getProgramInfoLog(p));const u={};const n=gl.getProgramParameter(p,gl.ACTIVE_UNIFORMS);for(let i=0;i<n;i++){const raw=gl.getActiveUniform(p,i).name;const nm=raw.replace(/\[0\]$/,'');/* Query array uniforms by their explicit [0] name. Some WebGL drivers return null for the bare array name, silently disabling curves/color bands. */u[nm]=gl.getUniformLocation(p,raw)}return {p,u}}
function mkTex(w,h,hf){const t=gl.createTexture();gl.bindTexture(gl.TEXTURE_2D,t);const fmt=hf==='f32'&&hfOK?gl.RGBA32F:(hf&&hfOK?gl.RGBA16F:gl.RGBA8);gl.texStorage2D(gl.TEXTURE_2D,1,fmt,w,h);for(const [k,v] of [[gl.TEXTURE_MIN_FILTER,gl.LINEAR],[gl.TEXTURE_MAG_FILTER,gl.LINEAR],[gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE],[gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE]])gl.texParameteri(gl.TEXTURE_2D,k,v);if(hf==='f32'&&hfOK){gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.NEAREST);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.NEAREST)}return t}
function makeHueLut(P){const nodes=COLOR_PALETTE.HUE_TARGETS.map(d=>{const i=TARGET_INDEX.get(d.key);return {h:d.hue,shift:P.hueShift[i]/100,sat:P.hueSat[i]/100,lum:P.hueLum[i]/100}}).sort((a,b)=>a.h-b.h);const out=new Uint8Array(360*4);const enc=v=>Math.max(1,Math.min(255,128+Math.round(clamp(v,-1,1)*127)));for(let h=0;h<360;h++){let ri=nodes.findIndex(n=>n.h>h),a,b,ah,bh,hh=h;if(ri===-1){a=nodes[nodes.length-1];b=nodes[0];ah=a.h;bh=b.h+360;}else if(ri===0){a=nodes[nodes.length-1];b=nodes[0];ah=a.h-360;bh=b.h;}else{a=nodes[ri-1];b=nodes[ri];ah=a.h;bh=b.h;}const t=clamp((hh-ah)/Math.max(.001,bh-ah),0,1),k=h*4;out[k]=enc(a.shift+(b.shift-a.shift)*t);out[k+1]=enc(a.sat+(b.sat-a.sat)*t);out[k+2]=enc(a.lum+(b.lum-a.lum)*t);out[k+3]=255;}return out}
function initHueLutTexture(unit){const t=gl.createTexture();gl.activeTexture(gl.TEXTURE0+unit);gl.bindTexture(gl.TEXTURE_2D,t);gl.texStorage2D(gl.TEXTURE_2D,1,gl.RGBA8,360,1);for(const [k,v] of [[gl.TEXTURE_MIN_FILTER,gl.LINEAR],[gl.TEXTURE_MAG_FILTER,gl.LINEAR],[gl.TEXTURE_WRAP_S,gl.REPEAT],[gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE]])gl.texParameteri(gl.TEXTURE_2D,k,v);gl.texSubImage2D(gl.TEXTURE_2D,0,0,0,360,1,gl.RGBA,gl.UNSIGNED_BYTE,makeHueLut(P||buildParams()));return t}
function syncHueLut(texture,unit,P0){if(!texture||!hueLutDirty)return;gl.activeTexture(gl.TEXTURE0+unit);gl.bindTexture(gl.TEXTURE_2D,texture);gl.texSubImage2D(gl.TEXTURE_2D,0,0,0,360,1,gl.RGBA,gl.UNSIGNED_BYTE,makeHueLut(P0||P||buildParams()));hueLutDirty=false}
function ensureVideoTexture(w,h){if(tex.vid&&videoTexW===w&&videoTexH===h)return;try{if(tex.vid)gl.deleteTexture(tex.vid)}catch(_){}tex.vid=gl.createTexture();gl.bindTexture(gl.TEXTURE_2D,tex.vid);gl.texStorage2D(gl.TEXTURE_2D,1,gl.RGBA8,w,h);for(const [k,v] of [[gl.TEXTURE_MIN_FILTER,gl.LINEAR],[gl.TEXTURE_MAG_FILTER,gl.LINEAR],[gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE],[gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE]])gl.texParameteri(gl.TEXTURE_2D,k,v);videoTexW=w;videoTexH=h}
function mkTarget(name,w,h,hf){if(fbo[name]){gl.deleteFramebuffer(fbo[name]);gl.deleteTexture(tex[name])}tex[name]=mkTex(w,h,hf);fbo[name]=gl.createFramebuffer();gl.bindFramebuffer(gl.FRAMEBUFFER,fbo[name]);gl.framebufferTexture2D(gl.FRAMEBUFFER,gl.COLOR_ATTACHMENT0,gl.TEXTURE_2D,tex[name],0);
  if(hf&&hfOK&&gl.checkFramebufferStatus(gl.FRAMEBUFFER)!==gl.FRAMEBUFFER_COMPLETE){hfOK=false;mkTarget(name,w,h,false)}}
function initGL(){uniformValueCache=new WeakMap();gl=canvas.getContext('webgl2',{alpha:false,antialias:false,depth:false,stencil:false,preserveDrawingBuffer:false,powerPreference:'high-performance'});if(!gl)throw new Error('WebGL2 unavailable');hfOK=!!gl.getExtension('EXT_color_buffer_float');
  {const dbg=gl.getExtension('WEBGL_debug_renderer_info');glRenderer=dbg?String(gl.getParameter(dbg.UNMASKED_RENDERER_WEBGL)):'hidden by browser';
   if(ZVPace.isSoftwareGL(glRenderer)&&!cfg.perf.allowSoft)throw new Error('WebGL is running on the CPU ('+glRenderer+'). Enable hardware acceleration (about:preferences > Performance) and check about:support')}

 gpuTimerExt=gl.getExtension('EXT_disjoint_timer_query_webgl2');if(!gpuTimerExt||!gpuTimerExt.TIME_ELAPSED_EXT)gpuTimerExt=null;gpuTimerActive=null;gpuTimerQueue=[];gpuSamples.length=0;gpuMs=0;
 progs.blur=prog(BLUR);progs.final=prog(FINAL);progs.ana=prog(ANA);progs.ene=prog(ENE);progs.ill=prog(ILL);progs.up=prog(UP);progs.cas=prog(CAS);progs.gfh0=prog(GFH0);progs.boxh=prog(BOXH);progs.gfv1=prog(GFV1);progs.gfv2=prog(GFV2);progs.td=prog(TD);progs.ingest=prog(INGEST);ana.fence=null;ana.valid=false;ana.illInit=false;ana.pbo=gl.createBuffer();gl.bindBuffer(gl.PIXEL_PACK_BUFFER,ana.pbo);gl.bufferData(gl.PIXEL_PACK_BUFFER,AW*AH*8,gl.STREAM_READ);gl.bindBuffer(gl.PIXEL_PACK_BUFFER,null);vao=gl.createVertexArray();gl.bindVertexArray(vao);
 tex.src=mkTex(2,2);tex.vid=mkTex(2,2);videoTexW=videoTexH=2;tex.hueLut=initHueLutTexture(4);hueLutDirty=true;mkTarget('ana',AW,AH);mkTarget('ene',AW,AH);mkTarget('illA',AW,AH);mkTarget('illB',AW,AH);gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL,true);lastW=lastH=0;lastCW=lastCH=0;upOn=false;srcW=srcH=0}
function sizeTargets(){const cap=[2560,1920,1280][level];const sc=Math.min(1,cap/vid.videoWidth);const w=Math.max(2,Math.round(vid.videoWidth*sc)),h=Math.max(2,Math.round(vid.videoHeight*sc));
 /* Stage 8: if the video is shown larger than its buffer, render the final image at display resolution (capped) through the edge-aware upscaler instead of letting the browser stretch it bilinearly */
 let cw=w,ch=h,up=false;
 if(cfg.clean.up&&level<2){const dw=Math.round(vid.offsetWidth*(window.devicePixelRatio||1)),tw=Math.min(dw,level?1920:2560);if(tw>w*1.15){up=true;cw=tw;ch=Math.max(2,Math.round(h*tw/w))}}
 const bufChanged=w!==lastW||h!==lastH;
 if(bufChanged){lastW=w;lastH=h;mkTarget('fH',w,h,true);mkTarget('fV',w,h,true);const hw=Math.max(2,w>>1),hh=Math.max(2,h>>1);mkTarget('mH',hw,hh,true);mkTarget('mV',hw,hh,true);
  histValid=false;if(hfOK){mkTarget('tdA',w,h,true);mkTarget('tdB',w,h,true);mkTarget('gA',hw,hh,'f32');mkTarget('gB',hw,hh,'f32');mkTarget('gC',hw,hh,'f32');mkTarget('gV',hw,hh,true)}}
 if(bufChanged||up!==upOn||cw!==lastCW||ch!==lastCH){upOn=up;lastCW=cw;lastCH=ch;canvas.width=cw;canvas.height=ch;if(up){mkTarget('fin',w,h,true);mkTarget('up',cw,ch,true)}dirty=true}}

/* ---- render ---- */
/* Cache uniforms by WebGLUniformLocation: uniform values persist per linked program, so unchanged values need no repeat JS/driver call. */
let uniformValueCache=new WeakMap();
function u1f(loc,x){if(loc===null||loc===undefined)return;let c=uniformValueCache.get(loc);if(c&&c.a===x)return;if(!c){c={a:x};uniformValueCache.set(loc,c)}else c.a=x;gl.uniform1f(loc,x)}
function u1i(loc,x){if(loc===null||loc===undefined)return;let c=uniformValueCache.get(loc);if(c&&c.a===x)return;if(!c){c={a:x};uniformValueCache.set(loc,c)}else c.a=x;gl.uniform1i(loc,x)}
function u2f(loc,x,y){if(loc===null||loc===undefined)return;let c=uniformValueCache.get(loc);if(c&&c.a===x&&c.b===y)return;if(!c){c={a:x,b:y};uniformValueCache.set(loc,c)}else{c.a=x;c.b=y}gl.uniform2f(loc,x,y)}
function u3f(loc,x,y,z){if(loc===null||loc===undefined)return;let c=uniformValueCache.get(loc);if(c&&c.a===x&&c.b===y&&c.c===z)return;if(!c){c={a:x,b:y,c:z};uniformValueCache.set(loc,c)}else{c.a=x;c.b=y;c.c=z}gl.uniform3f(loc,x,y,z)}
function u1fv(loc,v){if(loc===null||loc===undefined)return;let c=uniformValueCache.get(loc),same=!!c&&c.length===v.length;if(same){for(let i=0;i<v.length;i++)if(c.values[i]!==v[i]){same=false;break}}if(same)return;if(!c||c.length!==v.length){c={length:v.length,values:Array.from(v)};uniformValueCache.set(loc,c)}else for(let i=0;i<v.length;i++)c.values[i]=v[i];gl.uniform1fv(loc,v)}
function u3fv(loc,v){if(loc===null||loc===undefined)return;let c=uniformValueCache.get(loc),same=!!c&&c.length===v.length;if(same){for(let i=0;i<v.length;i++)if(c.values[i]!==v[i]){same=false;break}}if(same)return;if(!c||c.length!==v.length){c={length:v.length,values:Array.from(v)};uniformValueCache.set(loc,c)}else for(let i=0;i<v.length;i++)c.values[i]=v[i];gl.uniform3fv(loc,v)}
function pass(pr,target,w,h,bind){gl.bindFramebuffer(gl.FRAMEBUFFER,target);gl.viewport(0,0,w,h);gl.useProgram(pr.p);bind(pr.u);gl.drawArrays(gl.TRIANGLES,0,3)}
function bindTex(unit,t,loc){gl.activeTexture(gl.TEXTURE0+unit);gl.bindTexture(gl.TEXTURE_2D,t);u1i(loc,unit)}
function blur(srcTex,tgt,w,h,dx,dy,sigma,lum){pass(progs.blur,fbo[tgt],w,h,u=>{bindTex(0,srcTex,u.t);u2f(u.dir,dx,dy);u1f(u.sigma,sigma);u1f(u.lum,lum)})}
/* Shared analysis: tiny GPU downsample -> async PBO readback (fence-polled, never stalls the frame) -> ZVAnalysis.update() */
function startAnalysis(withEnergy){pass(progs.ana,fbo.ana,AW,AH,u=>{bindTex(0,tex.src,u.t);u2f(u.grid,AW,AH)});
  gl.bindFramebuffer(gl.FRAMEBUFFER,fbo.ana);gl.bindBuffer(gl.PIXEL_PACK_BUFFER,ana.pbo);gl.readPixels(0,0,AW,AH,gl.RGBA,gl.UNSIGNED_BYTE,0);
  ana.eneFresh=!!withEnergy;
  if(withEnergy){pass(progs.ene,fbo.ene,AW,AH,u=>{bindTex(0,tex.src,u.uSrc);bindTex(1,tex.fV,u.uFine);u2f(u.grid,AW,AH)});
    gl.bindFramebuffer(gl.FRAMEBUFFER,fbo.ene);gl.bindBuffer(gl.PIXEL_PACK_BUFFER,ana.pbo);gl.readPixels(0,0,AW,AH,gl.RGBA,gl.UNSIGNED_BYTE,AW*AH*4)}
  gl.bindBuffer(gl.PIXEL_PACK_BUFFER,null);ana.valid=true;ana.fence=gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE,0);gl.flush()}
function pollAnalysis(){if(!ana.fence||!gl)return;const st=gl.clientWaitSync(ana.fence,0,0);if(st===gl.TIMEOUT_EXPIRED)return;gl.deleteSync(ana.fence);ana.fence=null;
  if(st===gl.WAIT_FAILED)return;gl.bindBuffer(gl.PIXEL_PACK_BUFFER,ana.pbo);gl.getBufferSubData(gl.PIXEL_PACK_BUFFER,0,ana.buf);if(ana.eneFresh)gl.getBufferSubData(gl.PIXEL_PACK_BUFFER,AW*AH*4,ana.ebuf);gl.bindBuffer(gl.PIXEL_PACK_BUFFER,null);analysisReadbackReady=true;
  queueUpdate(ana.buf,ana.eneFresh?ana.ebuf:undefined)}
/* The statistics pass (~2 ms of JS) runs when the main thread is idle instead of inside the frame; newest result wins. */
/* The statistics pass runs when the main thread is idle. Reuse fixed buffers so analysis does not allocate fresh arrays for every sample. */
function queueUpdate(b,e){pendingAnalysisBuf.set(b);pendingEnergy=!!e;if(e)pendingEnergyBuf.set(e);pendingU=true;if(uScheduled)return;uScheduled=true;
  const run=()=>{uScheduled=false;if(!pendingU)return;pendingU=false;const Z=globalThis.ZVAnalysis;if(!Z||!gl)return;const S=Z.update(pendingAnalysisBuf,AW,AH,pendingEnergy?pendingEnergyBuf:undefined);if(S.cutCount!==ana.lastCut){ana.lastCut=S.cutCount;ana.snap=true}};
  if(typeof requestIdleCallback==='function')requestIdleCallback(run,{timeout:80});else setTimeout(run,0)}
const LK=['shadow','anchor','illAmt','illTarget','knee','core','damp'];
function toneWhite(){let w=0;for(let i=0;i<3;i++){let c=Math.min(2,P.bright);c=Math.min(2,Math.max(0,(c-.5)*P.contrast+.5));c=Math.min(2,Math.max(0,c*P.mul[i]+P.bias));c=Math.pow(c,1/P.gamma);w=Math.max(w,c)}return w}
/* Per-frame effective parameters: scene-adaptive lighting targets, smoothed (snap on scene cut) so nothing pumps */
const AKEYS=['wbA','wbB','vibr','sep','domCos','domSin','domW','meanL'];let ap=null;
function effectiveAuto(){const Z=globalThis.ZVAnalysis;if(!Z)return null;Z.state.rate=Math.max(.25,Math.min(3,cfg.auto.speed||1));const T=Z.autoColor(Z.state.sm,cfg.auto);
  if(!T){ap=null;return null}
  if(!ap||Z.state.cutCount!==ap.cut)ap={...T,cut:Z.state.cutCount};else{const k=Math.min(1,.05*(cfg.auto.speed||1));for(const n of AKEYS)ap[n]+=(T[n]-ap[n])*k;ap.skin=T.skin;ap.shadowKeep=T.shadowKeep;ap.hiKeep=T.hiKeep;ap.scene=T.scene}
  const dl=Math.hypot(ap.domCos,ap.domSin)||1;return {...ap,domCos:ap.domCos/dl,domSin:ap.domSin/dl}}
function effective(){const Z=globalThis.ZVAnalysis,T=Z?.lighting(Z.state.sm,cfg.light);
  if(!T){lp=null;return {A:P.A,B:P.B,core:P.core,head:0,shadow:0,anchor:0,illAmt:0,illTarget:.3,knee:1,W:1,p:1}}
  if(!lp||Z.state.cutCount!==lp.cut)lp={...T,cut:Z.state.cutCount};else for(const k of LK)lp[k]+=(T[k]-lp[k])*.06;
  const W=Math.max(1,toneWhite());return {A:P.A*lp.damp,B:P.B*lp.damp,core:Math.max(P.core,lp.core),head:1,shadow:lp.shadow,anchor:lp.anchor,illAmt:lp.illAmt,illTarget:lp.illTarget,knee:lp.knee,W,p:Z.shoulderP(lp.knee,W)}}
function guided(hw,hh,S){const g=clamp(cfg.clean.gf,0,1),eps=.02*(1-g)+.002,R=Math.max(2,Math.min(8,Math.round(P.midSigma/2*1.73)));
  pass(progs.gfh0,fbo.gA,hw,hh,u=>{bindTex(0,S,u.uT);u2f(u.uOut,hw,hh);u1i(u.uR,R)});
  pass(progs.gfv1,fbo.gB,hw,hh,u=>{bindTex(0,tex.gA,u.uT);u1i(u.uR,R);u1f(u.uEps,eps)});
  pass(progs.boxh,fbo.gC,hw,hh,u=>{bindTex(0,tex.gB,u.uT);u1i(u.uR,R)});
  pass(progs.gfv2,fbo.gV,hw,hh,u=>{bindTex(0,tex.gC,u.uT);bindTex(1,S,u.uS);u1i(u.uR,R)})}
function notice(why){try{if(!vid||!vid.parentElement)return;const n=document.createElement('div');n.id='zv-notice';n.textContent='VELVET renderer: '+why;n.style.cssText='position:absolute;left:12px;top:12px;z-index:60;max-width:60%;padding:8px 12px;border-radius:8px;background:rgba(20,20,24,.88);color:#fff;font:12px/1.4 system-ui,sans-serif;pointer-events:none';vid.parentElement.append(n);setTimeout(()=>n.remove(),9000)}catch(_){}}
function ingestSource(m){if(m==='c2d'){/* 2D canvas copy: in some Firefox setups drawImage(video) is GPU-fast where texImage2D(video) is not */
    const W=Math.min(vid.videoWidth,2560),H=Math.max(2,Math.round(vid.videoHeight*W/vid.videoWidth));if(!c2dC){c2dC=document.createElement('canvas');c2dX=c2dC.getContext('2d',{alpha:false,desynchronized:true})}
    if(c2dC.width!==W||c2dC.height!==H){c2dC.width=W;c2dC.height=H}c2dX.drawImage(vid,0,0,W,H);return c2dC}
  if(m==='vf')return new VideoFrame(vid);return vid}
function pollGpuTimer(){if(!gl||!gpuTimerExt)return;for(let i=gpuTimerQueue.length-1;i>=0;i--){const q=gpuTimerQueue[i];if(!gl.getQueryParameter(q,gl.QUERY_RESULT_AVAILABLE))continue;gpuTimerQueue.splice(i,1);if(!gl.getParameter(gpuTimerExt.GPU_DISJOINT_EXT)){gpuMs=gl.getQueryParameter(q,gl.QUERY_RESULT)/1e6;gpuSamples.push(gpuMs);if(gpuSamples.length>40)gpuSamples.shift()}gl.deleteQuery(q)}}
function beginGpuTimer(){if(!gl||!gpuTimerExt)return;pollGpuTimer();if(gpuTimerActive||rendered%20!==0)return;const q=gl.createQuery();gpuTimerActive=q;gl.beginQuery(gpuTimerExt.TIME_ELAPSED_EXT,q)}
function endGpuTimer(){if(!gl||!gpuTimerExt||!gpuTimerActive)return;gl.endQuery(gpuTimerExt.TIME_ELAPSED_EXT);gpuTimerQueue.push(gpuTimerActive);gpuTimerActive=null}
function render(){
  const t0=performance.now();beginGpuTimer();
  const uploaded=newFrame||!ready;upMs=0;
  if(uploaded){const tU=performance.now();
    if(cfg.perf.ingest){
      const bm=ingestM;let so=null,sw=vid.videoWidth,sh=vid.videoHeight;
      try{so=ingestSource(bm);if(bm==='c2d'){sw=c2dC.width;sh=c2dC.height}else if(bm==='vf'){sw=so.displayWidth||so.codedWidth||vid.videoWidth;sh=so.displayHeight||so.codedHeight||vid.videoHeight}
        ensureVideoTexture(sw,sh);gl.activeTexture(gl.TEXTURE0);gl.bindTexture(gl.TEXTURE_2D,tex.vid);gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL,false);gl.texSubImage2D(gl.TEXTURE_2D,0,0,0,gl.RGBA,gl.UNSIGNED_BYTE,so);
        if(bm==='vf')so.close();
      }catch(e){try{if(bm==='vf'&&so)so.close()}catch(_){}if(bm==='video')throw e;ingestM='video';sw=vid.videoWidth;sh=vid.videoHeight;ensureVideoTexture(sw,sh);gl.activeTexture(gl.TEXTURE0);gl.bindTexture(gl.TEXTURE_2D,tex.vid);gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL,false);gl.texSubImage2D(gl.TEXTURE_2D,0,0,0,gl.RGBA,gl.UNSIGNED_BYTE,vid)}
      if(!fbo.src||srcW!==sw||srcH!==sh){srcW=sw;srcH=sh;mkTarget('src',srcW,srcH,false);probeFbo=null;histValid=false}
      pass(progs.ingest,fbo.src,srcW,srcH,u=>{bindTex(0,tex.vid,u.uT)})
    }else{
      const sw=vid.videoWidth,sh=vid.videoHeight;if(!fbo.src||srcW!==sw||srcH!==sh){srcW=sw;srcH=sh;mkTarget('src',srcW,srcH,false);probeFbo=null;histValid=false}
      gl.activeTexture(gl.TEXTURE0);gl.bindTexture(gl.TEXTURE_2D,tex.src);gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL,true);gl.texSubImage2D(gl.TEXTURE_2D,0,0,0,gl.RGBA,gl.UNSIGNED_BYTE,vid)
    }
    upMs=performance.now()-tU}
  sizeTargets();const w=lastW,h=lastH,hw=Math.max(2,w>>1),hh=Math.max(2,h>>1);
  const aut=effectiveAuto(),eff=effective(),doAna=uploaded&&!!globalThis.ZVAnalysis&&!ana.fence&&++ana.tick%(level>1?12:6)===0;
  let S=tex.src;tdOn=hfOK&&level<1&&cfg.clean.temporal>.01&&!!tex.tdA&&!!fbo.tdB;
  if(tdOn){if(uploaded||!histValid){const Z=globalThis.ZVAnalysis,cuts=Z?Z.state.cutCount:0,reset=!histValid||cuts!==lastCutSeen;lastCutSeen=cuts;
      const nf=Z?.state?.sm?.noiseFloor??.004;tdStr=Z?Z.temporalStrength(Z.state,cfg.clean.temporal):cfg.clean.temporal*.5;const dst=tdIdx^1;
      pass(progs.td,fbo[dst?'tdB':'tdA'],w,h,u=>{bindTex(0,tex.src,u.uCur);bindTex(1,tex[tdIdx?'tdB':'tdA'],u.uHist);u1f(u.uStr,tdStr);u1f(u.uT0,clamp(nf*2,.004,.03));u1f(u.uReset,reset?1:0)});tdIdx=dst;histValid=true}
    S=tex[tdIdx?'tdB':'tdA']}
  const wantFine=level<2&&(eff.A>.001||view===1||doAna),wantMid=level<1&&(eff.B>.001||view===2);
  if(wantFine){blur(S,'fH',w,h,1/w,0,.7,1);blur(tex.fH,'fV',w,h,0,1/h,.7,0)}
  useGF=wantMid&&hfOK&&cfg.clean.gf>.01&&!!tex.gV;
  if(useGF)guided(hw,hh,S);else if(wantMid){const s=P.midSigma/2;blur(S,'mH',hw,hh,1/w,0,s,1);blur(tex.mH,'mV',hw,hh,0,1/hh,s,0)}
  if(eff.head&&ana.valid){const latest=ana.illI?'illB':'illA',next=ana.illI?'illA':'illB',a=(ana.snap||!ana.illInit)?1:.05;ana.snap=false;
    pass(progs.ill,fbo[next],AW,AH,u=>{bindTex(0,tex.ana,u.uRaw);bindTex(1,tex[latest],u.uPrev);u1f(u.uA,a)});ana.illI^=1;ana.illInit=true;illTex=tex[next]}
  syncHueLut(tex.hueLut,4,P);
  pass(progs.final,upOn?fbo.fin:null,w,h,u=>{bindTex(0,S,u.uSrc);bindTex(1,tex.fV,u.uFine);bindTex(2,useGF?tex.gV:tex.mV,u.uMid);bindTex(3,illTex||tex.src,u.uIll);bindTex(4,tex.hueLut,u.uHueLut);
    u1f(u.uSat,P.sat);u1f(u.uBright,P.bright);u1f(u.uContrast,P.contrast);u1f(u.uGamma,P.gamma);u1fv(u.uCurve,P.curve);
    u1f(u.uA,eff.A);u1f(u.uB,eff.B);u1f(u.uCore,eff.core);u1f(u.uSoft,P.soft);u1f(u.uGain,P.gain);
    u1f(u.uHasFine,wantFine?1:0);u1f(u.uHasMid,wantMid?1:0);u1f(u.uBypass,bypass?1:0);u1f(u.uSplit,.5);u1i(u.uView,view);
    u3fv(u.uMul,P.mul);u1f(u.uBias,P.bias);
    u1f(u.uHead,eff.head);u1f(u.uShadow,eff.shadow);u1f(u.uAnchor,eff.anchor);u1f(u.uIllAmt,eff.illAmt);u1f(u.uIllTarget,eff.illTarget);
    u1f(u.uHasIll,(eff.head&&ana.valid&&eff.illAmt>0)?1:0);u1f(u.uKnee,eff.knee);u1f(u.uW,eff.W);u1f(u.uP,eff.p);
    u1f(u.uDeband,level<2?clamp(cfg.clean.deband,0,1):0);u1f(u.uDbR,Math.max(4,Math.min(20,w/120)));u1f(u.uDbT,3.5/255);u1f(u.uDither,upOn?0:clamp(cfg.clean.dither,0,1.5));u1f(u.uFrame,rendered%64);
    const a=aut||{wbA:0,wbB:0,vibr:0,sep:0,domCos:1,domSin:0,domW:0,meanL:.5,skin:0,shadowKeep:0,hiKeep:0};
    u1f(u.uAuto,aut?1:0);u2f(u.uWB,a.wbA,a.wbB);u1f(u.uVibr,a.vibr);u1f(u.uSep,a.sep);u2f(u.uDom,a.domCos,a.domSin);u1f(u.uDomW,a.domW);u1f(u.uMeanL,a.meanL);u1f(u.uSkin,a.skin);u1f(u.uShadowKeep,a.shadowKeep);u1f(u.uHiKeep,a.hiKeep);
    u1f(u.uHasTargets,P.hasTargets?1:0);u1f(u.uHasSkin,P.hasSkin?1:0);u1f(u.uHasEarth,P.hasEarth?1:0);u3f(u.uSkinCtrl,P.skinCtrl[0],P.skinCtrl[1],P.skinCtrl[2]);u3f(u.uEarthCtrl,P.earthCtrl[0],P.earthCtrl[1],P.earthCtrl[2])});
  if(upOn){const rawU=u=>{u1f(u.uBypass,bypass?1:0);u1f(u.uSplit,.5);u1i(u.uView,view)};
    pass(progs.up,fbo.up,lastCW,lastCH,u=>{bindTex(0,tex.fin,u.uT);rawU(u)});
    const damp=lp?Math.max(0,Math.min(1,lp.damp)):1;
    pass(progs.cas,null,lastCW,lastCH,u=>{bindTex(0,tex.up,u.uT);rawU(u);u1f(u.uAmt,clamp(cfg.clean.sharp,0,1)*damp);u1f(u.uK,.15);u1f(u.uDither,clamp(cfg.clean.dither,0,1.5));u1f(u.uFrame,rendered%64)})}
  if(doAna)startAnalysis(wantFine);
  endGpuTimer();
  {const dt=performance.now()-t0;frameMs=frameMs*.9+dt*.1;pace.cpu.push(dt);if(uploaded)pace.up.push(upMs)}rendered++;newFrame=false;dirty=false;
}

/* ---- WebGL 1 compatibility renderer ----
 * Preserves global tone, all 26 selective color targets and lightweight fine/mid spatial detail.
 * Temporal denoise, guided filtering and edge-aware upscaling remain WebGL2-only. Canvas 2D is the final pixel path. */
const GL1_VS=`attribute vec2 aPosition; varying vec2 vUv; void main(){gl_Position=vec4(aPosition,0.0,1.0);vUv=aPosition*0.5+0.5;}`;
const GL1_FS=`precision highp float; varying vec2 vUv; uniform sampler2D uVideo,uControls; uniform float uSat,uBright,uContrast,uGamma,uBias,uShadow,uHighlights,uHasTargets,uDetailFine,uDetailMid; uniform vec2 uTexel; uniform vec3 uMul;
const vec3 LUM=vec3(.2126,.7152,.0722);
vec3 toLin(vec3 c){return mix(c/12.92,pow((c+.055)/1.055,vec3(2.4)),step(vec3(.04045),c));}
vec3 toSrgb(vec3 c){c=max(c,0.);return mix(c*12.92,1.055*pow(c,vec3(1./2.4))-.055,step(vec3(.0031308),c));}
vec3 toOk(vec3 c){float l=pow(max(.4122214708*c.r+.5363325363*c.g+.0514459929*c.b,0.),1./3.),m=pow(max(.2119034982*c.r+.6806995451*c.g+.1073969566*c.b,0.),1./3.),s=pow(max(.0883024619*c.r+.2817188376*c.g+.6299787005*c.b,0.),1./3.);return vec3(.2104542553*l+.7936177850*m-.0040720468*s,1.9779984951*l-2.4285922050*m+.4505937099*s,.0259040371*l+.7827717662*m-.8086757660*s);}
vec3 fromOk(vec3 k){float l=k.x+.3963377774*k.y+.2158037573*k.z,m=k.x-.1055613458*k.y-.0638541728*k.z,s=k.x-.0894841775*k.y-1.2914855480*k.z;l=l*l*l;m=m*m*m;s=s*s*s;return vec3(4.0767416621*l-3.3077115913*m+.2309699292*s,-1.2684380046*l+2.6097574011*m-.3413193965*s,-.0041960863*l-.7034186147*m+1.7076147010*s);}
bool inGamut(vec3 c){return all(greaterThanEqual(c,vec3(-.002)))&&all(lessThanEqual(c,vec3(1.002)));}
float ss(float a,float b,float x){float t=clamp((x-a)/(b-a),0.,1.);return t*t*(3.-2.*t);}
float hd(float a,float b){return abs(mod(a-b+540.,360.)-180.);}
float hc(int i){
 if(i==0)return 29.234;if(i==1)return 31.585;if(i==2)return 44.767;if(i==3)return 66.565;
 if(i==4)return 84.076;if(i==5)return 107.004;if(i==6)return 128.425;if(i==7)return 137.773;
 if(i==8)return 142.495;if(i==9)return 147.199;if(i==10)return 166.546;if(i==11)return 201.746;
 if(i==12)return 237.847;if(i==13)return 258.030;if(i==14)return 264.197;if(i==15)return 267.393;
 if(i==16)return 286.688;if(i==17)return 307.027;if(i==18)return 322.776;if(i==19)return 338.327;
 if(i==20)return 353.543;if(i==21)return 13.177;if(i==22)return 25.054;return 34.524;
}
vec3 tone(vec3 c){float y=dot(c,LUM);c=mix(vec3(y),c,uSat);c=clamp(c*uBright,0.,1.);c=clamp((c-.5)*uContrast+.5,0.,1.);c=clamp(c*uMul+uBias,0.,1.);c=pow(max(c,0.),vec3(1./uGamma));float l=dot(c,LUM);c+=vec3(uShadow*.10*(1.-ss(.05,.5,l))-uHighlights*.10*ss(.55,1.,l));return clamp(c,0.,1.);}
vec3 target(vec3 c0){if(uHasTargets<.5)return c0;vec3 lab=toOk(toLin(clamp(c0,0.,1.)));float L=lab.x;vec2 ab=lab.yz;float C=length(ab);if(C<.006)return c0;float h=degrees(atan(ab.y,ab.x));if(h<0.)h+=360.;float cg=ss(.008,.035,C),angle=0.,sd=0.,ld=0.;
 for(int i=0;i<24;i++){vec3 q=texture2D(uControls,vec2((float(i)+.5)/26.,.5)).rgb*2.-1.;if(abs(q.r)+abs(q.g)+abs(q.b)>.015){float d=hd(h,hc(i));float w=(1.-ss(7.5,17.,d))*cg;angle+=radians(clamp(q.r*100.,-100.,100.)*.45)*w;sd+=q.g*w;ld+=q.b*.12*w;}}
 float skinH=1.-ss(10.,52.,hd(h,55.)),skinL=ss(.10,.23,L)*(1.-ss(.94,.995,L)),skinC=ss(.012,.035,C)*(1.-ss(.18,.26,C)),sw=skinH*skinL*skinC;
 vec3 sk=texture2D(uControls,vec2(24.5/26.,.5)).rgb*2.-1.;angle+=radians(clamp(sk.r*100.,-100.,100.)*.45)*sw;sd+=sk.g*sw;ld+=sk.b*.12*sw;
 float earthH=1.-ss(12.,42.,hd(h,53.)),earthL=ss(.07,.20,L)*(1.-ss(.78,.91,L)),earthC=ss(.009,.027,C)*(1.-ss(.20,.29,C)),ew=earthH*earthL*earthC;
 vec3 er=texture2D(uControls,vec2(25.5/26.,.5)).rgb*2.-1.;angle+=radians(clamp(er.r*100.,-100.,100.)*.45)*ew;sd+=er.g*ew;ld+=er.b*.12*ew;
 angle=clamp(angle,-1.5707963,1.5707963);sd=clamp(sd,-1.,2.);ld=clamp(ld,-.30,.30);float ca=cos(angle),sa=sin(angle);ab=vec2(ab.x*ca-ab.y*sa,ab.x*sa+ab.y*ca)*clamp(1.+sd,0.,3.);L=clamp(L+ld,0.,1.);vec3 lin=fromOk(vec3(L,ab));if(!inGamut(lin)){float lo=0.,hi=1.;for(int j=0;j<7;j++){float mid=.5*(lo+hi);if(inGamut(fromOk(vec3(L,ab*mid))))lo=mid;else hi=mid;}lin=fromOk(vec3(L,ab*lo));}return toSrgb(clamp(lin,0.,1.));}
void main(){vec3 src=texture2D(uVideo,vUv).rgb;vec3 c=target(tone(src));float y=dot(src,LUM);float yf=(dot(texture2D(uVideo,vUv+vec2(uTexel.x,0.)).rgb,LUM)+dot(texture2D(uVideo,vUv-vec2(uTexel.x,0.)).rgb,LUM)+dot(texture2D(uVideo,vUv+vec2(0.,uTexel.y)).rgb,LUM)+dot(texture2D(uVideo,vUv-vec2(0.,uTexel.y)).rgb,LUM))*.25;vec2 r=uTexel*2.;float ym=(dot(texture2D(uVideo,vUv+vec2(r.x,0.)).rgb,LUM)+dot(texture2D(uVideo,vUv-vec2(r.x,0.)).rgb,LUM)+dot(texture2D(uVideo,vUv+vec2(0.,r.y)).rgb,LUM)+dot(texture2D(uVideo,vUv-vec2(0.,r.y)).rgb,LUM))*.25;float delta=(y-yf)*uDetailFine+(yf-ym)*uDetailMid;float sy=max(y+delta,0.)/max(y,.001);c=clamp(c*sy,0.,1.);gl_FragColor=vec4(c,1.);}`;
function initGL1Fallback(v,reason){
  uniformValueCache=new WeakMap();
  try{gl?.getExtension('WEBGL_lose_context')?.loseContext()}catch(_){}
  try{canvas?.remove()}catch(_){}
  canvas=document.createElement('canvas');canvas.id='zv-gl';canvas.style.display='none';v.after(canvas);
  gl=canvas.getContext('webgl',{alpha:false,antialias:false,depth:false,stencil:false,preserveDrawingBuffer:false,powerPreference:'high-performance'})||canvas.getContext('experimental-webgl');
  if(!gl)throw new Error('WebGL1 context unavailable');
  const compile=(type,src)=>{const shd=gl.createShader(type);gl.shaderSource(shd,src);gl.compileShader(shd);if(!gl.getShaderParameter(shd,gl.COMPILE_STATUS))throw new Error(gl.getShaderInfoLog(shd)||'WebGL1 shader compile failed');return shd};
  const program=gl.createProgram();gl.attachShader(program,compile(gl.VERTEX_SHADER,GL1_VS));gl.attachShader(program,compile(gl.FRAGMENT_SHADER,GL1_FS));gl.linkProgram(program);if(!gl.getProgramParameter(program,gl.LINK_STATUS))throw new Error(gl.getProgramInfoLog(program)||'WebGL1 program link failed');
  gl.useProgram(program);const buffer=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,buffer);gl.bufferData(gl.ARRAY_BUFFER,new Float32Array([-1,-1,3,-1,-1,3]),gl.STATIC_DRAW);
  const aPos=gl.getAttribLocation(program,'aPosition');gl.enableVertexAttribArray(aPos);gl.vertexAttribPointer(aPos,2,gl.FLOAT,false,0,0);
  const videoTex=gl.createTexture();gl.activeTexture(gl.TEXTURE0);gl.bindTexture(gl.TEXTURE_2D,videoTex);for(const [k,val] of [[gl.TEXTURE_MIN_FILTER,gl.LINEAR],[gl.TEXTURE_MAG_FILTER,gl.LINEAR],[gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE],[gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE]])gl.texParameteri(gl.TEXTURE_2D,k,val);u1i(gl.getUniformLocation(program,'uVideo'),0);
  const controls=new Uint8Array(26*4);for(let i=0;i<26;i++){controls[i*4]=128;controls[i*4+1]=128;controls[i*4+2]=128;controls[i*4+3]=255}
  const ctrlTex=gl.createTexture();gl.activeTexture(gl.TEXTURE1);gl.bindTexture(gl.TEXTURE_2D,ctrlTex);for(const [k,val] of [[gl.TEXTURE_MIN_FILTER,gl.NEAREST],[gl.TEXTURE_MAG_FILTER,gl.NEAREST],[gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE],[gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE]])gl.texParameteri(gl.TEXTURE_2D,k,val);gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,26,1,0,gl.RGBA,gl.UNSIGNED_BYTE,controls);u1i(gl.getUniformLocation(program,'uControls'),1);
  const uniforms={};for(const n of ['uSat','uBright','uContrast','uGamma','uBias','uShadow','uHighlights','uMul','uHasTargets','uDetailFine','uDetailMid','uTexel'])uniforms[n]=gl.getUniformLocation(program,n);
  compatGL1={program,buffer,aPos,videoTex,ctrlTex,controls,controlsDirty:true,videoW:0,videoH:0,uniforms,textureMax:Number(gl.getParameter(gl.MAX_TEXTURE_SIZE))||4096};rendererMode='webgl1';cpu2d=null;lastW=lastH=lastCW=lastCH=0;ready=false;dirty=true;newFrame=true;
  notice('WebGL2 is unavailable; using the WebGL1 Color Lab. All 26 selective targets work without WebGL2. '+reason);
  console.info('[ZV TEXTURING] WebGL1 selective-color renderer active:',reason);
}
function frameBodyGL1(now){
  const v=vid;if(state!=='on'||rendererMode!=='webgl1'||!compatGL1)return;P=P||buildParams();
  if(!P.active||v.readyState<2||!v.videoWidth){setOn(false);return}
  if(!hasRvfc&&v.currentTime!==lastT){lastT=v.currentTime;newFrame=true}if(!newFrame&&!dirty&&ready)return;
  const t0=performance.now();try{
    if(layoutDirty){layout();layoutDirty=false}
    const cap=Math.min(2560,compatGL1.textureMax),w=Math.max(2,Math.min(v.videoWidth,cap)),h=Math.max(2,Math.round(v.videoHeight*w/v.videoWidth));
    if(canvas.width!==w||canvas.height!==h){canvas.width=w;canvas.height=h;lastW=w;lastH=h;lastCW=w;lastCH=h}
    const c=compatGL1;gl.viewport(0,0,w,h);gl.useProgram(c.program);gl.activeTexture(gl.TEXTURE0);gl.bindTexture(gl.TEXTURE_2D,c.videoTex);gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL,true);
    if(c.videoW!==v.videoWidth||c.videoH!==v.videoHeight){gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,gl.RGBA,gl.UNSIGNED_BYTE,v);c.videoW=v.videoWidth;c.videoH=v.videoHeight}else gl.texSubImage2D(gl.TEXTURE_2D,0,0,0,gl.RGBA,gl.UNSIGNED_BYTE,v);
    if(c.controlsDirty){for(let i=0;i<26;i++){c.controls[i*4]=Math.round((clamp(P.hueShift[i],-100,100)+100)*255/200);c.controls[i*4+1]=Math.round((clamp(P.hueSat[i],-100,100)+100)*255/200);c.controls[i*4+2]=Math.round((clamp(P.hueLum[i],-100,100)+100)*255/200);c.controls[i*4+3]=255}
      gl.activeTexture(gl.TEXTURE1);gl.bindTexture(gl.TEXTURE_2D,c.ctrlTex);gl.texSubImage2D(gl.TEXTURE_2D,0,0,0,26,1,gl.RGBA,gl.UNSIGNED_BYTE,c.controls);c.controlsDirty=false;}
    const u=c.uniforms;u1f(u.uSat,P.sat);u1f(u.uBright,P.bright);u1f(u.uContrast,P.contrast);u1f(u.uGamma,P.gamma);u1f(u.uBias,P.bias);u3f(u.uMul,P.mul[0],P.mul[1],P.mul[2]);u1f(u.uShadow,clamp(fx.shadows,-60,60)/100);u1f(u.uHighlights,clamp(fx.highlights,-60,60)/100);u1f(u.uHasTargets,P.hasTargets?1:0);u1f(u.uDetailFine,P.A);u1f(u.uDetailMid,P.B);u2f(u.uTexel,1/w,1/h);gl.drawArrays(gl.TRIANGLES,0,3);
    if(!probeDone&&now-lastProbe>=1000&&v.currentTime>0){lastProbe=now;probeTries++;let mx=0;const pix=new Uint8Array(4*4*4);for(const [px,py] of [[.25,.25],[.75,.25],[.5,.5],[.25,.75],[.75,.75]]){gl.readPixels(Math.max(0,Math.floor(w*px)-2),Math.max(0,Math.floor(h*py)-2),4,4,gl.RGBA,gl.UNSIGNED_BYTE,pix);for(let j=0;j<pix.length;j+=4)mx=Math.max(mx,pix[j],pix[j+1],pix[j+2])}probeList.push({t:v.currentTime,max:mx});if(probeList.length>12)probeList.shift();const verdict=globalThis.ZVAnalysis?.probeVerdict?.(probeList,!!v.mediaKeys);if(verdict==='black')throw new Error(v.mediaKeys?'protected video (EME) renders black':'video samples remain black; disabled overlay to preserve native playback');if(verdict==='ok'||probeTries>=12)probeDone=true}
    const dt=performance.now()-t0;frameMs=frameMs*.9+dt*.1;pace.cpu.push(dt);rendered++;setOn(true);ready=true;if(now-lastHud>500||!hud){lastHud=now;updateHud()}newFrame=false;dirty=false;
  }catch(e){fail(e.name==='SecurityError'?'video pixels blocked by DRM/cross-origin policy':'WebGL1 color render failed: '+e.message)}
}
/* ---- lifecycle ---- */
const css=document.createElement('style');css.id='zv-gl-css';
css.textContent='html[data-zv-gl="on"] video.html5-main-video,html[data-zv-gl="on"] ytmusic-player video{filter:none !important}#zv-gl{position:absolute;z-index:1;pointer-events:none;max-width:none;max-height:none}#zv-hud{position:absolute;left:8px;top:8px;z-index:9999;font:11px/1.4 monospace;color:#fff;background:rgba(0,0,0,.6);padding:4px 7px;border-radius:4px;pointer-events:none;white-space:pre}';
function setOn(on){if(on===lastOn)return;lastOn=on;document.documentElement.dataset.zvGl=on?'on':'off';if(canvas)canvas.style.display=on?'':'none'}
function teardown(){uniformValueCache=new WeakMap();mo?.disconnect();mo=null;lastOn=null;if(vid&&rvfcId&&vid.cancelVideoFrameCallback)try{vid.cancelVideoFrameCallback(rvfcId)}catch(_){}rvfcId=0;ro?.disconnect();ro=null;probeFbo=null;ana.fence=null;ana.pbo=null;ana.valid=false;ana.illInit=false;lp=null;illTex=null;canvas?.remove();hud?.remove();canvas=hud=gl=null;cpu2d=null;compatGL1=null;rendererMode='gl';progs={};tex={};fbo={};gpuTimerExt=null;gpuTimerActive=null;gpuTimerQueue=[];videoTexW=videoTexH=2;hueLutDirty=true;ready=false;state='idle';setOn(false)}
function fail(why){try{if(gl&&gpuTimerActive){gl.endQuery(gpuTimerExt?.TIME_ELAPSED_EXT||gl.TIME_ELAPSED_EXT);gpuTimerQueue.push(gpuTimerActive);gpuTimerActive=null}}catch(_){}failWhy=String(why);notice('Video pixel processing is unavailable; native global filters remain active. '+why);failSrc=vid?vid.currentSrc||'':'';console.warn('[ZV TEXTURING] Renderer unavailable, falling back to native CSS filters:',why);teardown();state='failed:'+why}
function initCPUFallback(v,reason){
  try{gl?.getExtension('WEBGL_lose_context')?.loseContext()}catch(_){}
  try{canvas?.remove()}catch(_){}
  gl=null;progs={};tex={};fbo={};vao=null;hfOK=false;
  canvas=document.createElement('canvas');canvas.id='zv-gl';canvas.style.display='none';v.after(canvas);
  cpu2d=canvas.getContext('2d',{alpha:false,desynchronized:true,willReadFrequently:true});
  if(!cpu2d)throw new Error('Canvas 2D context unavailable');
  rendererMode='2d';lastW=lastH=lastCW=lastCH=0;ready=false;dirty=true;newFrame=true;cpuSlow=cpuFast=0;cpuFrameAvg=0;
  notice('WebGL2 unavailable; using the CPU Canvas 2D Color Lab. Selective color needs readable video pixels. '+reason);
  console.info('[ZV TEXTURING] Canvas 2D selective-color fallback active:',reason);
}
function attach(v,forceCPU=false){vid=v;state='idle';ready=false;level=0;lastDrop=0;benchDone=true;benchIdx=0;bench={video:[],c2d:[],vf:[]};ingestM='video';slowStrikes=0;qualityWarmupAt=performance.now();qualityWarmupDone=false;lastCheck=qualityWarmupAt;gov.bad=0;gov.cleanSince=0;gov.lastStep=0;gpuSamples.length=0;probeList=[];probeDone=false;lastProbe=0;analysisReadbackReady=false;probeTries=0;lastT=-1;histValid=false;layoutDirty=true;lastOn=null;pace.reset();canvas=document.createElement('canvas');canvas.id='zv-gl';canvas.style.display='none';v.after(canvas);
  rendererMode='gl';
  if(forceCPU){try{initCPUFallback(v,'CPU color mode selected; custom WebGL is reserved for Material Depth')}catch(cpuErr){return fail('Canvas 2D color processor unavailable: '+cpuErr.message)}}
  else try{initGL()}catch(e){try{if(/running on the CPU/.test(e.message))throw new Error('Software GL path refused by performance guard');initGL1Fallback(v,e.message)}catch(gl1Err){try{initCPUFallback(v,e.message+'; WebGL1 unavailable: '+gl1Err.message)}catch(cpuErr){return fail(e.message+'; WebGL1 fallback: '+gl1Err.message+'; Canvas 2D fallback unavailable: '+cpuErr.message)}}}
  v.addEventListener('emptied',()=>{histValid=false;lastOn=null;globalThis.ZVAnalysis?.reset();ana.valid=false;ana.illInit=false;lp=null;ready=false;if(canvas)canvas.style.display='none'});
  hasRvfc='requestVideoFrameCallback' in v;if(hasRvfc){/* Render INSIDE the frame callback: every presented video frame gets its own render in the same frame cycle (no flag that can coalesce two frames into one). */
    const cb=(now,meta)=>{newFrame=true;pace.note(now,meta);rvfcId=v.requestVideoFrameCallback(cb);if(v===vid&&canvas&&state==='on'&&!document.hidden)frameBody(now)};rvfcId=v.requestVideoFrameCallback(cb)}/* no rVFC (Firefox <132): loop() polls currentTime instead */
  if(typeof ResizeObserver!=='undefined'){ro=new ResizeObserver(()=>{dirty=true;layoutDirty=true});ro.observe(v)}
  mo=new MutationObserver(()=>{dirty=true;layoutDirty=true});mo.observe(v,{attributes:true,attributeFilter:['style','class']});
  v.addEventListener('seeked',()=>{newFrame=true;dirty=true;histValid=false});state='on'}
function layout(){const v=vid,s=canvas.style;s.left=v.offsetLeft+'px';s.top=v.offsetTop+'px';s.width=v.offsetWidth+'px';s.height=v.offsetHeight+'px';s.objectFit=getComputedStyle(v).objectFit}
function updateHud(){if(!cfg.hud){hud?.remove();hud=null;return}if(!hud){hud=document.createElement('div');hud.id='zv-hud';vid.parentElement.append(hud)}
  if(rendererMode==='webgl1'){hud.textContent=`TEXTURING WEBGL1 · compatibility mode\nprocessed frame ${lastW}×${lastH} · 76 targets active on WebGL2 (compatibility modes may be reduced)\nframe ${frameMs.toFixed(2)} ms · frames ${rendered}\nGlobal tone, selective color and fine/mid detail active. Temporal denoise/upscale need WebGL2.`;return}if(rendererMode==='2d'){hud.textContent=`TEXTURING CANVAS 2D · CPU color + detail active\nprocessed frame ${lastW}×${lastH} · adaptive CPU width ${cpuTargetCap}px\nCPU frame ${frameMs.toFixed(2)} ms · frames ${rendered}\nCompatibility color and fine/mid detail active. Full 76-target profile is optimized for WebGL2. Protected video may block pixels.`;return}
  hud.textContent=`TEXTURING GL · ${['final','fine detail','mid detail','split'][view]}${bypass?' · BYPASS':''}\nbuffer ${lastW}×${lastH} · quality L${level} · ${hfOK?'half-float':'8-bit'} targets · deband ${level<2?cfg.clean.deband.toFixed(2):'off'} · dither ${cfg.clean.dither.toFixed(2)}\nbuffer→canvas ${lastW}×${lastH}→${lastCW}×${lastCH} ${upOn?'· EDGE-AWARE UPSCALE':'· 1:1/browser scaling'} · mid band ${useGF?'guided filter':'gaussian'} · temporal ${tdOn?'history '+tdStr.toFixed(2):'off'}\nCPU submit ${frameMs.toFixed(2)} ms · GPU ${gpuMs?gpuMs.toFixed(2)+' ms async':'timer n/a'} · frames ${rendered}\nAlt+B bypass · Alt+I view · Alt+L lighting · Alt+C auto color · Alt+H hud · Alt+G off${analysisHud()}${lightHud()}${autoHud()}${paceHud()}`}
function paceHud(){const f=(x,n=1)=>x.toFixed(n);const warn=gpuMs>16.7?' ⚠ GPU render >16.7 ms':pace.up.p(.95)>5?' ⚠ video upload (texSubImage2D) is the bottleneck':pace.cpu.p(.95)>6.5?' ⚠ render CPU cost high':pace.missedPct()>2?' ⚠ page missed video frames (main thread busy)':'';
  return `\npace: video ${f(pace.fps)} fps · frames missed by page ${pace.missed} (${f(pace.missedPct(),2)}%) · render cpu avg ${f(pace.cpu.avg(),2)} p95 ${f(pace.cpu.p(.95),2)} max ${f(pace.cpu.max(),2)} ms · upload p95 ${f(pace.up.p(.95),2)} ms · callback gap p95 ${f(pace.ivl.p(.95))} ms · ingest ${cfg.perf.ingest?'GPU flip':'FLIP_Y upload'} · quality ${cfg.perf.lock?'LOCKED':'auto'}${warn}\ningest ${ingestM}${' (persistent texture storage)'} · GL: ${glRenderer} · WebGPU ${typeof navigator!=='undefined'&&navigator.gpu?'present':'not exposed here'}`}
function autoHud(){if(!cfg.auto.on)return '\nauto color: OFF';if(!ap)return '\nauto color: waiting';const f=(x,n=3)=>x.toFixed(n),sc=ap.scene;return `\nauto ON ×${cfg.auto.strength} · wb Δa${f(ap.wbA)} Δb${f(ap.wbB)} · vibr ${f(ap.vibr,2)} · sep ${f(ap.sep,2)}×${f(ap.domW,2)}\nscene night ${f(sc.night,2)} neon ${f(sc.neon,2)} flat ${f(sc.flat,2)} · skin prot ${cfg.auto.skin}`}
function lightHud(){const m=globalThis.ZVAnalysis?.state?.sm;if(!cfg.light.on)return '\nadaptive lighting: OFF';if(!lp||!m)return '\nadaptive lighting: waiting';return `\nlight ON · shadow +${lp.shadow.toFixed(3)} @${lp.anchor.toFixed(2)} · illum ${lp.illAmt.toFixed(2)}→${lp.illTarget.toFixed(2)} · knee ${lp.knee.toFixed(2)}\nnoise floor ${m.noiseFloor.toFixed(4)} · coring ${lp.core.toFixed(3)} · detail x${lp.damp.toFixed(2)}`}
function analysisHud(){const S=globalThis.ZVAnalysis?.state,m=S?.sm;if(!m)return '\nanalysis: waiting';const f=(x,n=2)=>x.toFixed(n);
  return `\nY ${f(m.meanY)} p1 ${f(m.p1)} p99 ${f(m.p99)} peak ${f(m.peak99)} clip ${f(m.clipFrac*100,1)}% crush ${f(m.crushFrac*100,1)}%\nC ${f(m.meanC,3)} hue ${m.dominantHue} ${f(m.hueMax*100,0)}% neutral ${f(m.neutralFrac*100,0)}%\ncast a${f(m.castA,3)} b${f(m.castB,3)} conf ${f(m.castConf)} · motion ${f(S.motion,3)} · cuts ${S.cutCount}`}
function probe(now){if(probeDone||now-lastProbe<1000||vid.paused||vid.currentTime<=0||!analysisReadbackReady)return;lastProbe=now;if(++probeTries>12){probeDone=true;return}const Z=globalThis.ZVAnalysis;if(!Z?.probeVerdict){probeDone=true;return}let max=0;const px=ana.buf;for(let i=0;i<px.length;i+=4)max=Math.max(max,px[i],px[i+1],px[i+2]);probeList.push({t:vid.currentTime,max});if(probeList.length>12)probeList.shift();const verdict=Z.probeVerdict(probeList,!!vid.mediaKeys);if(verdict==='ok')probeDone=true;else if(verdict==='black')throw new Error(vid.mediaKeys?'protected video (EME) renders black':'video renders black')}
function checkQuality(now){
  if(!vid?.getVideoPlaybackQuality)return;
  // Ignore startup measurements until both wall-clock warm-up and a useful sample of presented frames have elapsed.
  // Reset metrics once at warm-up end so shader/FBO stalls cannot poison later steady-state decisions.
  if(!qualityWarmupDone){
    if(now-qualityWarmupAt<QUALITY_WARMUP_MS||pace.frames<QUALITY_WARMUP_FRAMES)return;
    qualityWarmupDone=true;pace.reset();gpuSamples.length=0;gov.bad=0;gov.cleanSince=0;slowStrikes=0;
    lastDrop=vid.getVideoPlaybackQuality().droppedVideoFrames;lastCheck=now;
    console.info('[ZV TEXTURING] Performance governor armed after video warm-up');return;
  }
  if(now-lastCheck<2000)return;lastCheck=now;
  // Sustained load may lower processing resolution, but never destroys the WebGL context.
  if(cfg.perf.watchdog&&ZVPace.isSlow(pace)){
    if(++slowStrikes>=3){slowStrikes=0;if(level<2&&now-(gov.lastStep||-1e9)>6000){level=Math.min(2,level+1);gov.lastStep=now;dirty=true;console.info('[ZV TEXTURING] Sustained load; reduced render resolution to level',level,'without disabling WebGL')}}
  }else slowStrikes=0;
  const d=vid.getVideoPlaybackQuality().droppedVideoFrames,dropDelta=Math.max(0,d-lastDrop);lastDrop=d;
  const gpuP95=gpuSamples.length?gpuSamples.slice().sort((a,b)=>a-b)[Math.floor((gpuSamples.length-1)*.95)]:0;const step=ZVPace.decide(gov,{now,level,p95:Math.max(pace.cpu.p(.95),gpuP95),dropDelta,lock:!!cfg.perf.lock});
  if(step){level=Math.max(0,Math.min(2,level+step));dirty=true}}

function needsCpuColor(f){
  if(!f?.enabled)return false;
  const pixelControls=['sharp','gamma','highlights','shadows','warmth','tint','redBalance','greenBalance','blueBalance','blackPoint','whitePoint','fade'];
  if(pixelControls.some(k=>Math.abs(Number(f[k])||0)>.001))return true;
  return Object.values(f.targetColors||{}).some(t=>Math.abs(Number(t?.hue)||0)>.001||Math.abs(Number(t?.sat)||0)>.001||Math.abs(Number(t?.lum)||0)>.001);
}
function maintain(){
  // Basic brightness/contrast/saturation stay on the browser's native video filter path.
  // Selective/advanced color grading uses the CPU backend; WebGL is reserved for Material Depth.
  if(!md.enabled&&!needsCpuColor(fx)){if(canvas)teardown();return null}
  if(document.hidden)return null;
  const v=document.querySelector(SEL);if(!v){if(canvas)teardown();return null}
  if(state.startsWith('failed')&&v.currentSrc&&v.currentSrc!==failSrc&&v.readyState>=1&&slowFails<2&&!/CPU/.test(failWhy))state='idle';/* new video: retry once */
  const wantGL=!!md.enabled&&!!cfg.gl;
  const modeMismatch=wantGL?(rendererMode==='2d'&&state!=='on'):rendererMode!=='2d';
  if(v!==vid||!canvas||modeMismatch){if(canvas)teardown();attach(v,!wantGL)}
  return v}
/* The per-frame work. Called from the video-frame callback (one call per presented frame) and from the rAF loop (settings changes, resizes, paused video). */
function frameBodyCPU(now){
  const v=vid;if(state!=='on'||rendererMode!=='2d'||!cpu2d)return;
  P=P||buildParams();
  if(!P.active||v.readyState<2||!v.videoWidth){setOn(false);return}
  if(!hasRvfc&&v.currentTime!==lastT){lastT=v.currentTime;newFrame=true}
  if(!newFrame&&!dirty&&ready)return;
  const t0=performance.now();
  try{
    if(layoutDirty){layout();layoutDirty=false}
    const w=Math.max(2,Math.min(v.videoWidth,cpuTargetCap)),h=Math.max(2,Math.round(v.videoHeight*w/v.videoWidth));
    if(canvas.width!==w||canvas.height!==h){canvas.width=w;canvas.height=h;lastW=w;lastH=h;lastCW=w;lastCH=h}
    cpu2d.drawImage(v,0,0,w,h);
    const frame=cpu2d.getImageData(0,0,w,h);
    // Some protected streams return an opaque black canvas without throwing SecurityError.
    // Probe over real playback time before painting the overlay so we can fall back instead of hiding video with black pixels.
    if(!probeDone&&now-lastProbe>=1000&&v.currentTime>0){
      lastProbe=now;probeTries++;let mx=0;const d=frame.data;
      for(let i=0;i<d.length;i+=48)mx=Math.max(mx,d[i],d[i+1],d[i+2]);
      probeList.push({t:v.currentTime,max:mx});if(probeList.length>12)probeList.shift();
      const verdict=globalThis.ZVAnalysis?.probeVerdict?.(probeList,!!v.mediaKeys);
      if(verdict==='black')throw new Error(v.mediaKeys?'protected video (EME) blocks CPU pixel access':'video pixel samples remain black; disabled overlay to preserve native playback');
      if(verdict==='ok'||probeTries>=12)probeDone=true;
    }
    const worker=globalThis.ZVColorCPU;
    if(!worker?.grade)throw new Error('Canvas 2D color processor not loaded');
    P.width=w;worker.grade(frame.data,P);cpu2d.putImageData(frame,0,0);
    const dt=performance.now()-t0;cpuFrameAvg=cpuFrameAvg?cpuFrameAvg*.88+dt*.12:dt;pace.cpu.push(dt);frameMs=cpuFrameAvg;rendered++;
    if(dt>24){cpuSlow++;cpuFast=0}else{cpuSlow=0;if(dt<10)cpuFast++;else cpuFast=0}
    // Keep playback responsive on slower CPUs: reduce processed width when grading overruns,
    // and only raise resolution after a long period of inexpensive frames.
    if(cpuSlow>=5&&cpuTargetCap>420){cpuTargetCap=Math.max(420,Math.round(cpuTargetCap*.78/20)*20);cpuSlow=0;dirty=true;console.info('[ZV TEXTURING] CPU Color Lab lowered processing width to',cpuTargetCap)}
    else if(cpuFast>=360&&cpuTargetCap<((navigator.hardwareConcurrency||4)>=8?960:720)){cpuTargetCap=Math.min((navigator.hardwareConcurrency||4)>=8?960:720,cpuTargetCap+120);cpuFast=0;dirty=true}
    setOn(true);if(!ready){ready=true;console.info('[ZV TEXTURING] Canvas 2D Color Lab ready at',w+'x'+h)}
    if(now-lastHud>500||!hud){lastHud=now;updateHud()}
    newFrame=false;dirty=false;
  }catch(e){fail(e.name==='SecurityError'?'video pixels blocked by DRM/cross-origin policy':e.message)}
}
function frameBody(now){if(rendererMode==='2d')return frameBodyCPU(now);if(rendererMode==='webgl1')return frameBodyGL1(now);const v=vid;if(state!=='on')return;pollAnalysis();P=P||buildParams();
  if(!P.active||v.readyState<2||!v.videoWidth){setOn(false);return}
  if(!hasRvfc&&v.currentTime!==lastT){lastT=v.currentTime;newFrame=true}
  if(!newFrame&&!dirty&&ready)return;
  try{if(layoutDirty){layout();layoutDirty=false}render();if(!ready){ready=true}setOn(true);probe(now);if(now-lastHud>500||!hud){lastHud=now;updateHud()}checkQuality(now)}
  catch(e){fail(e.name==='SecurityError'?'tainted video (DRM/cross-origin)':e.message)}}
function loop(now){requestAnimationFrame(loop);if(!maintain())return;if(now-lastLayoutPoke>500){lastLayoutPoke=now;layoutDirty=true}frameBody(now)}
function neutralFxState(f){
  const keys=['sharp','contrast','saturation','brightness','gamma','highlights','shadows','warmth','tint','redBalance','greenBalance','blueBalance','blackPoint','whitePoint','fade'];
  return keys.every(k=>Math.abs(Number(f[k])||0)<.001)&&Object.values(f.targetColors||{}).every(t=>Math.abs(Number(t?.hue)||0)<.001&&Math.abs(Number(t?.sat)||0)<.001&&Math.abs(Number(t?.lum)||0)<.001);
}
function load(){document.documentElement.append(css);const keys=['zinzVelvetEffects','zinzMaterialDepth',CFG_KEY,MIGRATION_KEY];
  browser.storage.local.get(keys).then(r=>{
    fx={...FXD,...r.zinzVelvetEffects,targetColors:{...FXD.targetColors,...(r.zinzVelvetEffects?.targetColors||{})}};md={...MDD,...r.zinzMaterialDepth};cfg=mergeCfg(cfg,r[CFG_KEY]);cfg.perf.bench=0;cfg.perf.ingest=0;benchDone=true;hueLutDirty=true;
    // One-time upgrade for older installs where Effects were saved as on but all sliders were neutral.
    // Previously that configuration selected an identity transform and looked like a dead switch.
    if(!r[MIGRATION_KEY]){
      const migration={[MIGRATION_KEY]:true};
      if(fx.enabled&&!md.enabled&&neutralFxState(fx)){
        fx={...fx,sharp:12,contrast:4,preset:'Natural'};
        md={...md,enabled:true,preset:md.preset||'Natural Depth',_enabledByEffects:true,_manualOff:false};
        migration.zinzVelvetEffects=fx;migration.zinzMaterialDepth=md;
      }
      browser.storage.local.set(migration).catch(()=>{});
    }
    
    P=buildParams();requestAnimationFrame(loop)
  }).catch(()=>requestAnimationFrame(loop));
  browser.storage.onChanged.addListener((c,a)=>{if(a!=='local')return;if(c.zinzVelvetEffects)fx={...FXD,...c.zinzVelvetEffects.newValue,targetColors:{...FXD.targetColors,...(c.zinzVelvetEffects.newValue?.targetColors||{})}};if(c.zinzMaterialDepth)md={...MDD,...c.zinzMaterialDepth.newValue};if(c[CFG_KEY]){cfg=mergeCfg(cfg,c[CFG_KEY].newValue);cfg.perf.bench=0;cfg.perf.ingest=0}if(c.zinzVelvetEffects||c.zinzMaterialDepth){hueLutDirty=true;if(compatGL1)compatGL1.controlsDirty=true;}P=buildParams();dirty=true});
  document.addEventListener('visibilitychange',()=>{if(!document.hidden){histValid=false;globalThis.ZVAnalysis?.reset();ana.valid=false;ana.illInit=false;analysisReadbackReady=false;lp=null;newFrame=true;dirty=true}});
  document.addEventListener('fullscreenchange',()=>{dirty=true;newFrame=true;layoutDirty=true});window.addEventListener('resize',()=>{dirty=true;layoutDirty=true});
  document.addEventListener('keydown',e=>{if(!e.altKey||e.ctrlKey||e.metaKey)return;const k=e.code;
    if(k==='KeyB')bypass=!bypass;else if(k==='KeyI')view=(view+1)%4;else if(k==='KeyH'){cfg.hud=!cfg.hud;browser.storage.local.set({[CFG_KEY]:cfg})}else if(k==='KeyC'){cfg.auto.on=!cfg.auto.on;browser.storage.local.set({[CFG_KEY]:cfg})}else if(k==='KeyL'){cfg.light.on=!cfg.light.on;browser.storage.local.set({[CFG_KEY]:cfg})}else if(k==='KeyG'){cfg.gl=!cfg.gl;browser.storage.local.set({[CFG_KEY]:cfg})}else return;
    e.preventDefault();dirty=true;if(vid&&canvas)updateHud()},true)}
if(document.documentElement)load();else document.addEventListener('DOMContentLoaded',load,{once:true});
})();
