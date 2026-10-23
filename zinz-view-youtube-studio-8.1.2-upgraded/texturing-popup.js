(()=>{'use strict';
/* Stage 6: Lighting / Auto Color / engine controls. Writes the same zinzTexturing key texturing.js already reads (partial merge there). */
const KEY='zinzTexturing';
const D={gl:true,hud:false,light:{on:true,shadow:1,illum:1,rolloff:1,noise:1},auto:{on:false,strength:.6,wb:1,chroma:1,sep:1,skin:.7,shadowKeep:.7,hiKeep:.7,speed:1},clean:{deband:0,dither:1,gf:.6,sharp:.4,up:1,temporal:.6},perf:{ingest:1,lock:0,bench:1,watchdog:1,allowSoft:0}};
const merge=(o,n)=>({...o,...n,light:{...o.light,...(n&&n.light)},auto:{...o.auto,...(n&&n.auto)},clean:{...o.clean,...(n&&n.clean)},perf:{...o.perf,...(n&&n.perf)}});
const S=[['auto','strength','Auto Color strength',0,1,.05,'x'],['auto','wb','White balance correction',0,2,.05,'x'],['auto','chroma','Adaptive chroma (vibrance)',0,2,.05,'x'],['auto','sep','Shadow / highlight color separation',0,2,.05,'x'],['auto','skin','Skin-tone protection',0,1,.05,'x'],['auto','shadowKeep','Keep shadows dark',0,1,.05,'x'],['auto','hiKeep','Keep highlights intact',0,1,.05,'x'],['auto','speed','Adaptation speed',.25,3,.05,'x'],
 ['light','shadow','Shadow definition',0,2,.05,'x'],['light','illum','Local light balance',0,2,.05,'x'],['light','rolloff','Highlight roll-off',0,2,.05,'x'],['light','noise','Noise-aware restraint',0,2,.05,'x'],
 ['clean','deband','Debanding (smooth flat gradients)',0,1,.05,'x'],['clean','dither','Output dither (hides 8-bit steps)',0,1,.05,'x'],
 ['clean','up','Edge-aware upscale (0 off / 1 on)',0,1,1,'x'],['clean','sharp','Upscale sharpening',0,1,.05,'x'],['clean','gf','Halo protection for local contrast (0 = off)',0,1,.05,'x'],['clean','temporal','Temporal denoise (motion-adaptive, 0 = off)',0,1,.05,'x'],
 ['perf','lock','Lock quality — never auto-reduce (1 = on)',0,1,1,'x'],['perf','ingest','GPU frame ingest (1 = on; try 0 if video upload is slow)',0,1,1,'x'],['perf','bench','Auto-pick fastest video upload method (1 = on)',0,1,1,'x'],['perf','watchdog','Auto-reduce render resolution if sustained lag (WebGL stays on)',0,1,1,'x']];
let c=merge(D,{});
const save=()=>browser.storage.local.set({[KEY]:c});
const el=id=>document.getElementById(id);
function draw(){el('glOn').checked=c.gl;el('hudOn').checked=c.hud;el('lightOn').checked=c.light.on;el('autoOn').checked=c.auto.on;
 for(const [g,k] of S){el(`tx-${g}-${k}`).value=c[g][k];el(`txv-${g}-${k}`).textContent=(+c[g][k]).toFixed(2)}}
const box=el('txControls');
for(const [g,k,label,min,max,step] of S){const r=document.createElement('div');r.className='effect';
 r.innerHTML=`<header><label for="tx-${g}-${k}">${label}</label><output id="txv-${g}-${k}"></output></header><input type="range" min="${min}" max="${max}" step="${step}" id="tx-${g}-${k}">`;
 box.append(r);r.querySelector('input').oninput=e=>{c[g][k]=+e.target.value;draw();save()}}
el('glOn').onchange=e=>{c.gl=e.target.checked;save()};el('hudOn').onchange=e=>{c.hud=e.target.checked;save()};
el('lightOn').onchange=e=>{c.light.on=e.target.checked;save()};el('autoOn').onchange=e=>{c.auto.on=e.target.checked;save()};
el('txReset').onclick=()=>{c=merge(D,{});draw();save()};
browser.storage.local.get(KEY).then(v=>{c=merge(D,v[KEY]);draw()});
browser.storage.onChanged.addListener((changes,area)=>{if(area!=='local'||!changes[KEY])return;c=merge(D,changes[KEY].newValue);draw()});
})();
