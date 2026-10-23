/* VELVET shared CPU colour + spatial-detail backend.
 * Uses the same OKLab colour masks as the WebGL renderers so selectors behave consistently.
 * Canvas 2D is a compatibility backend, not a protected-video bypass: unreadable frames must remain untouched.
 */
(function(root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.ZVColorCPU = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function() {
  'use strict';
  const clamp=(v,a,b)=>Math.min(b,Math.max(a,Number(v)||0));
  const smoothstep=(a,b,x)=>{const t=clamp((x-a)/(b-a),0,1);return t*t*(3-2*t)};
  // OKLab hue angles produced by the representative HSL hues for the 24 named selectors.
  // These centres match the WebGL shader; the skin and earth masks are evaluated separately.
  const HUE_CENTERS=[29.234,31.585,44.767,66.565,84.076,107.004,128.425,137.773,142.495,147.199,166.546,201.746,237.847,258.030,264.197,267.393,286.688,307.027,322.776,338.327,353.543,13.177,25.054,34.524];
  const wrapDistance=(a,b)=>Math.abs(((a-b+540)%360)-180);
  function toOK(r,g,b) {
    const lin=x=>x<=.04045?x/12.92:Math.pow((x+.055)/1.055,2.4);r=lin(r);g=lin(g);b=lin(b);
    const l=Math.cbrt(Math.max(.4122214708*r+.5363325363*g+.0514459929*b,0)),m=Math.cbrt(Math.max(.2119034982*r+.6806995451*g+.1073969566*b,0)),s=Math.cbrt(Math.max(.0883024619*r+.2817188376*g+.6299787005*b,0));
    return [.2104542553*l+.7936177850*m-.0040720468*s,1.9779984951*l-2.4285922050*m+.4505937099*s,.0259040371*l+.7827717662*m-.8086757660*s];
  }
  // Keep the 24 established named-color centres stable, then add every fine-spectrum
  // target using the actual OKLab hue of its palette swatch. Palette indices are the
  // shared contract with texturing.js: base targets, skin/earth, then spectrum targets.
  const palette=globalThis.ZVColorPalette;
  const hueTargets=HUE_CENTERS.map((h,i)=>({i,h}));
  if(palette?.SPECTRUM&&palette?.ALL){
    for(const t of palette.SPECTRUM){
      const i=palette.ALL.findIndex(x=>x.key===t.key);
      if(i<26)continue;
      const hex=String(t.color||'').replace('#','');
      if(!/^[0-9a-f]{6}$/i.test(hex))continue;
      const rgb=[0,2,4].map(k=>parseInt(hex.slice(k,k+2),16)/255);
      const lab=toOK(rgb[0],rgb[1],rgb[2]);
      let h=Math.atan2(lab[2],lab[1])*180/Math.PI;if(h<0)h+=360;
      hueTargets.push({i,h});
    }
  }
  hueTargets.sort((a,b)=>a.h-b.h);
  for(let i=0;i<hueTargets.length;i++){
    const prev=hueTargets[(i+hueTargets.length-1)%hueTargets.length].h;
    const next=hueTargets[(i+1)%hueTargets.length].h;
    hueTargets[i].radius=Math.max(2.2,Math.min(9,Math.min(wrapDistance(hueTargets[i].h,prev),wrapDistance(next,hueTargets[i].h))*.95));
  }
  const NEARBY=Array.from({length:360},(_,h)=>hueTargets.filter(t=>wrapDistance(h,t.h)<=t.radius));
  function fromOKRaw(L,a,b){const l=L+.3963377774*a+.2158037573*b,m=L-.1055613458*a-.0638541728*b,s=L-.0894841775*a-1.2914855480*b,l3=l*l*l,m3=m*m*m,s3=s*s*s;const lin=[4.0767416621*l3-3.3077115913*m3+.2309699292*s3,-1.2684380046*l3+2.6097574011*m3-.3413193965*s3,-.0041960863*l3-.7034186147*m3+1.7076147010*s3];return lin.map(x=>x<=.0031308?12.92*x:1.055*Math.pow(Math.max(0,x),1/2.4)-.055)}
  function fromOK(L,a,b){return fromOKRaw(L,a,b).map(x=>clamp(x,0,1))}
  function hueWeights(rgb,active,p,activeHueCenters){
    // Most pixels do not belong to a user-selected color band. Use a cheap RGB hue
    // prefilter first; the wide guard band accounts for RGB/OKLab hue differences.
    // Pixels near a selected band still go through the precise OKLab masks below.
    if(activeHueCenters&&activeHueCenters.length>0&&activeHueCenters.length<50){
      const r=rgb[0],g=rgb[1],b=rgb[2],mx=Math.max(r,g,b),mn=Math.min(r,g,b),d=mx-mn;
      if(d>.008){
        let rh=mx===r?60*(((g-b)/d)%6):mx===g?60*((b-r)/d+2):60*((r-g)/d+4);
        if(rh<0)rh+=360;
        let possible=false;
        for(let i=0;i<activeHueCenters.length;i++){
          if(wrapDistance(rh,activeHueCenters[i])<=52){possible=true;break}
        }
        if(!possible)return rgb;
      }else return rgb;
    }
    const lab=toOK(rgb[0],rgb[1],rgb[2]),a=lab[1],b=lab[2],C=Math.hypot(a,b);let L=lab[0];
    if(C<.006)return rgb;
    let h=Math.atan2(b,a)*180/Math.PI;if(h<0)h+=360;
    const chromaGate=smoothstep(.008,.035,C);let angle=0,satDelta=0,lightDelta=0;
    const near=NEARBY[Math.round(h)%360];
    for(let n=0;n<near.length;n++){
      const target=near[n],i=target.i;if(!active[i])continue;
      const w=(1-smoothstep(target.radius*.35,target.radius,wrapDistance(h,target.h)))*chromaGate;
      angle+=clamp(p.hueShift[i],-100,100)*.45*Math.PI/180*w;
      satDelta+=(p.hueSat[i]/100)*w;lightDelta+=(p.hueLum[i]/100)*.12*w;
    }
    // Dedicated Skin Tones and Browns & Tans masks use perceptual hue/chroma/luminance,
    // so both light and deep tones are editable without scene analysis or Auto Color.
    const skinW=(1-smoothstep(10,52,wrapDistance(h,55)))*smoothstep(.012,.035,C)*(1-smoothstep(.18,.26,C))*smoothstep(.10,.23,L)*(1-smoothstep(.94,.995,L));
    if(active[24]){angle+=clamp(p.hueShift[24],-100,100)*.45*Math.PI/180*skinW;satDelta+=(p.hueSat[24]/100)*skinW;lightDelta+=(p.hueLum[24]/100)*.12*skinW}
    const earthW=(1-smoothstep(12,42,wrapDistance(h,53)))*smoothstep(.009,.027,C)*(1-smoothstep(.20,.29,C))*smoothstep(.07,.20,L)*(1-smoothstep(.78,.91,L));
    if(active[25]){angle+=clamp(p.hueShift[25],-100,100)*.45*Math.PI/180*earthW;satDelta+=(p.hueSat[25]/100)*earthW;lightDelta+=(p.hueLum[25]/100)*.12*earthW}
    angle=clamp(angle,-Math.PI/2,Math.PI/2);satDelta=clamp(satDelta,-1,2);lightDelta=clamp(lightDelta,-.30,.30);
    if(Math.abs(angle)<.00001&&Math.abs(satDelta)<.00001&&Math.abs(lightDelta)<.00001)return rgb;
    const ca=Math.cos(angle),sa=Math.sin(angle);let aa=(a*ca-b*sa)*clamp(1+satDelta,0,3),bb=(a*sa+b*ca)*clamp(1+satDelta,0,3);L=clamp(L+lightDelta,0,1);
    let out=fromOKRaw(L,aa,bb);const inGamut=out.every(x=>x>=-.002&&x<=1.002);
    if(!inGamut){let lo=0,hi=1;for(let j=0;j<7;j++){const mid=(lo+hi)*.5,q=fromOKRaw(L,aa*mid,bb*mid);if(q.every(x=>x>=-.002&&x<=1.002))lo=mid;else hi=mid}out=fromOKRaw(L,aa*lo,bb*lo)}
    return out.map(x=>clamp(x,0,1));
  }
  const luma=(data,i)=>.2126*data[i]/255+.7152*data[i+1]/255+.0722*data[i+2]/255;
  const detailShape=(x,core,soft)=>{const ax=Math.abs(x);return x*smoothstep(core,core*3,ax)*soft/(soft+ax)};
  function applySpatialDetail(data,p){
    const A=clamp(p.A||0,0,.55),B=clamp(p.B||0,0,.4);if(A<.001&&B<.001)return data;
    const count=data.length/4,w=Math.max(1,Math.round(p.width||0));
    // Width is attached by the frame renderer; infer a safe row width if called by tests/tools.
    const width=w>0&&w<count?w:Math.max(1,Math.floor(Math.sqrt(count)));if(count%width!==0)return data;
    const height=count/width,src=new Uint8ClampedArray(data),core=clamp(p.core??.008,.001,.05),soft=clamp(p.soft??.10,.02,.5),gain=clamp(p.gain??1,.2,3);
    const R=Math.max(2,Math.min(6,Math.round(p.midSigma||2)));
    const sample=(x,y)=>luma(src,(clamp(y,0,height-1)*width+clamp(x,0,width-1))*4);
    for(let y=0;y<height;y++)for(let x=0;x<width;x++){
      const i=(y*width+x)*4,yy=sample(x,y);let fine=(sample(x-1,y)+sample(x+1,y)+sample(x,y-1)+sample(x,y+1))*.25;
      let mid=(sample(x-R,y)+sample(x+R,y)+sample(x,y-R)+sample(x,y+R)+sample(x-R,y-R)+sample(x+R,y-R)+sample(x-R,y+R)+sample(x+R,y+R))*.125;
      const d1=detailShape(yy-fine,core,soft),d2=detailShape(fine-mid,core,soft),weight=(.35+.65*smoothstep(0,.1,yy))*(1-.65*smoothstep(.82,1,yy));
      const delta=(A*d1+B*d2)*gain*weight,newY=clamp(yy+delta,0,1),scale=yy>.002?newY/yy:1;
      if(scale!==1){data[i]=Math.round(clamp(src[i]/255*scale,0,1)*255);data[i+1]=Math.round(clamp(src[i+1]/255*scale,0,1)*255);data[i+2]=Math.round(clamp(src[i+2]/255*scale,0,1)*255)}
    }
    return data;
  }
  function grade(data,p){
    if(!data||typeof data.length!=='number'||data.length%4)throw new TypeError('Expected RGBA pixel data');
    const targetCount=Math.max(26,globalThis.ZVColorPalette?.ALL?.length||p.hueShift?.length||26);
    const active=new Uint8Array(targetCount),activeHueCenters=[];let anyTarget=false;
    for(let i=0;i<targetCount;i++){active[i]=Math.abs(p.hueShift[i]||0)>.001||Math.abs(p.hueSat[i]||0)>.001||Math.abs(p.hueLum[i]||0)>.001?1:0;anyTarget=anyTarget||!!active[i]}
    if(anyTarget){
      for(const t of hueTargets)if(active[t.i])activeHueCenters.push(t.h);
      if(active[24])activeHueCenters.push(55);
      if(active[25])activeHueCenters.push(53);
    }
    const sat=p.sat,bright=p.bright,contrast=p.contrast,gamma=p.gamma,mul=p.mul,bias=p.bias,curve=p.curve;
    const curveIdentity=curve[0]===0&&curve[1]===.25&&curve[2]===.5&&curve[3]===.75&&curve[4]===1;
    const gammaIdentity=Math.abs(gamma-1)<1e-8,satIdentity=Math.abs(sat-1)<1e-8,brightIdentity=Math.abs(bright-1)<1e-8,contrastIdentity=Math.abs(contrast-1)<1e-8,mulIdentity=mul[0]===1&&mul[1]===1&&mul[2]===1&&bias===0;
    for(let k=0;k<data.length;k+=4){
      if(data[k+3]===0)continue;
      let r=data[k]/255,g=data[k+1]/255,b=data[k+2]/255;
      if(!satIdentity){const y=.2126*r+.7152*g+.0722*b;r=y+(r-y)*sat;g=y+(g-y)*sat;b=y+(b-y)*sat}
      if(!brightIdentity){r=clamp(r*bright,0,1);g=clamp(g*bright,0,1);b=clamp(b*bright,0,1)}
      if(!contrastIdentity){r=clamp((r-.5)*contrast+.5,0,1);g=clamp((g-.5)*contrast+.5,0,1);b=clamp((b-.5)*contrast+.5,0,1)}
      if(!mulIdentity){r=clamp(r*mul[0]+bias,0,1);g=clamp(g*mul[1]+bias,0,1);b=clamp(b*mul[2]+bias,0,1)}
      if(!gammaIdentity){const inv=1/gamma;r=Math.pow(Math.max(0,r),inv);g=Math.pow(Math.max(0,g),inv);b=Math.pow(Math.max(0,b),inv)}
      if(!curveIdentity){let q=clamp(r,0,1)*4,i=Math.min(Math.floor(q),3);r=curve[i]+(curve[i+1]-curve[i])*(q-i);q=clamp(g,0,1)*4;i=Math.min(Math.floor(q),3);g=curve[i]+(curve[i+1]-curve[i])*(q-i);q=clamp(b,0,1)*4;i=Math.min(Math.floor(q),3);b=curve[i]+(curve[i+1]-curve[i])*(q-i)}
      r=clamp(r,0,1);g=clamp(g,0,1);b=clamp(b,0,1);
      if(anyTarget){const out=hueWeights([r,g,b],active,p,activeHueCenters);r=out[0];g=out[1];b=out[2]}
      data[k]=Math.round(clamp(r,0,1)*255);data[k+1]=Math.round(clamp(g,0,1)*255);data[k+2]=Math.round(clamp(b,0,1)*255);
    }
    if(p.width&&((p.A||0)>.001||(p.B||0)>.001))applySpatialDetail(data,p);
    return data;
  }
  return {grade,toOK,fromOK,HUE_CENTERS,smoothstep,applySpatialDetail};
});
