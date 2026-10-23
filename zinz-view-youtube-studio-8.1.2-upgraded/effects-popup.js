(()=>{'use strict';
const KEY='zinzVelvetEffects';
const TEXTURE_KEY='zinzTexturing';
const BANDS=globalThis.ZVColorPalette.UI_TARGETS;
const blankTargets=()=>Object.fromEntries(BANDS.map(b=>[b.key,{hue:0,sat:0,lum:0}]));
const def={enabled:false,preset:'Natural',sharp:0,contrast:0,saturation:0,brightness:0,gamma:0,highlights:0,shadows:0,warmth:0,tint:0,redBalance:0,greenBalance:0,blueBalance:0,blackPoint:0,whitePoint:0,fade:0,targetColors:blankTargets()};
const fields=[['sharp','Spatial detail',0,100],['saturation','Overall saturation',-80,80],['contrast','Contrast',-60,60],['brightness','Brightness',-60,60],['gamma','Gamma',-60,60],['highlights','Highlights',-60,60],['shadows','Shadows',-60,60],['warmth','Temperature',-60,60],['tint','Tint',-60,60],['redBalance','Red channel balance',-60,60],['greenBalance','Green channel balance',-60,60],['blueBalance','Blue channel balance',-60,60],['blackPoint','Black point',-40,40],['whitePoint','White point',-40,40],['fade','Matte black lift',0,60]];
const presets={
 Natural:{sharp:12,contrast:4,saturation:0},
 Cinema:{sharp:8,contrast:9,saturation:-7,highlights:-8,shadows:5,warmth:8},
 Animation:{sharp:15,contrast:7,saturation:12},
 Detail:{sharp:32,contrast:6,saturation:0},
 'Teal & Amber':{sharp:8,contrast:8,saturation:3,warmth:3},
 Vivid:{sharp:10,contrast:8,saturation:18},
 'Soft Pastel':{sharp:5,contrast:-7,saturation:-10,fade:10}
};
let s={...def},selected='orange',saveChain=Promise.resolve(),saveTimer=null,pendingState=null,rendererEnsurePromise=null;
const el=id=>document.getElementById(id),box=el('effectControls');
const preset=document.createElement('select');preset.id='fxPreset';preset.setAttribute('aria-label','Video look preset');
for(const name of Object.keys(presets))preset.add(new Option(name,name));preset.add(new Option('Custom','Custom'));box.before(preset);
function mergeState(raw={}){const result={...def,...raw,targetColors:blankTargets()};for(const b of BANDS)result.targetColors[b.key]={hue:0,sat:0,lum:0,...(raw.targetColors&&raw.targetColors[b.key]||{})};return result}
function writePending(){if(saveTimer!==null){clearTimeout(saveTimer);saveTimer=null}const snapshot=pendingState||JSON.parse(JSON.stringify(s));pendingState=null;saveChain=saveChain.then(()=>browser.storage.local.set({[KEY]:snapshot})).catch(()=>{});return saveChain}
function save(immediate=false){if(s.enabled)ensureColorRenderer();pendingState=JSON.parse(JSON.stringify(s));if(saveTimer!==null)clearTimeout(saveTimer);if(immediate)return writePending();saveTimer=setTimeout(()=>{saveTimer=null;writePending()},55)}
window.addEventListener('pagehide',()=>save(true));
function ensureColorRenderer(){if(rendererEnsurePromise)return rendererEnsurePromise;rendererEnsurePromise=browser.storage.local.get(TEXTURE_KEY).then(raw=>{const cfg=raw[TEXTURE_KEY]||{};if(cfg.gl===true)return;return browser.storage.local.set({[TEXTURE_KEY]:{...cfg,gl:true}})}).catch(()=>{rendererEnsurePromise=null});return rendererEnsurePromise}
let depthLinkChain=Promise.resolve();
function linkMaterialDepth(on){depthLinkChain=depthLinkChain.then(async()=>{const raw=await browser.storage.local.get('zinzMaterialDepth');const md={enabled:false,preset:'Natural Depth',depth:8,micro:18,structure:12,edge:12,local:8,highlight:5,protection:70,stability:60,...(raw.zinzMaterialDepth||{})};
  if(on){if(!md.enabled){md.enabled=true;md._enabledByEffects=true;md._manualOff=false;await browser.storage.local.set({zinzMaterialDepth:md})}else if(md._manualOff){md._manualOff=false;await browser.storage.local.set({zinzMaterialDepth:md})}}
  else if(md._enabledByEffects){md.enabled=false;md._enabledByEffects=false;md._manualOff=false;await browser.storage.local.set({zinzMaterialDepth:md})}
}).catch(()=>{});return depthLinkChain}
function hasAnyAdjustment(){return fields.every(([key])=>Math.abs(+s[key]||0)<.001)&&BANDS.every(b=>{const t=s.targetColors[b.key];return Math.abs(t.hue)<.001&&Math.abs(t.sat)<.001&&Math.abs(t.lum)<.001})}
function syncGlobalControls(skipKey=null){preset.value=s.preset||'Custom';for(const [k] of fields){if(k===skipKey)continue;const x=globalControls[k];x.input.value=s[k]||0;x.show(x.input.value)}}
function activateEffects(activeGlobalKey=null){const wasEnabled=!!s.enabled;if(!wasEnabled&&hasAnyAdjustment())s=mergeState({...s,...presets.Natural,preset:'Natural',enabled:true});else s.enabled=true;el('fxEnabled').checked=true;if(!wasEnabled){syncGlobalControls(activeGlobalKey);ensureColorRenderer();linkMaterialDepth(true)}}
function makeRange(parent,{id,label,min,max,step=1,readout}){const row=document.createElement('div');row.className='effect';row.innerHTML=`<header><label for="${id}">${label}</label><output id="${id}-value">0</output></header><input type="range" id="${id}" min="${min}" max="${max}" step="${step}" value="0">`;parent.append(row);const input=row.querySelector('input'),out=row.querySelector('output');const show=v=>{out.textContent=readout?readout(+v):((+v>0?'+':'')+v)};input.addEventListener('input',()=>{const value=Number(input.value);const isGlobal=id.startsWith('fx-');const key=isGlobal?id.slice(3):null;activateEffects(key);s.preset='Custom';preset.value='Custom';if(isGlobal){s[key]=value;input.value=String(value);show(value)}else{const [,targetKey,prop]=id.split('-');if(s.targetColors[targetKey])s.targetColors[targetKey][prop]=value;updateTargetStatus();show(value)}save()});input.addEventListener('change',()=>save(true));return {input,out,show}}
const globalControls={};for(const [key,label,min,max] of fields)globalControls[key]=makeRange(box,{id:`fx-${key}`,label,min,max,readout:v=>(v>0?'+':'')+v});
const lab=document.createElement('details');lab.className='color-lab';lab.innerHTML=`<summary><span class="lab-orb" aria-hidden="true"></span><span class="lab-summary-copy"><strong>Targeted Color Lab</strong><small>76 targets · full spectrum + skin & earth tones</small></span><span class="lab-chevron">＋</span></summary><div class="lab-body"><p class="lab-intro">Choose from 74 finely spaced spectrum targets or edit Skin Tones / Browns & Tans separately. Hue, saturation and lightness work independently of Auto Color.</p><input id="targetSearch" class="target-search" type="search" placeholder="Find a color or hue (e.g. 145° or skin)" aria-label="Find a color target"><div class="hue-swatches" id="hueSwatches" role="group" aria-label="Choose a color family"></div><div class="target-panel"><div class="target-heading"><span id="targetDot" class="target-dot"></span><div><strong id="targetName">Orange</strong><small>Selected color range</small></div><span id="targetStatus" class="target-status">NEUTRAL</span></div><div id="targetControls"></div><div class="target-actions"><button type="button" id="resetTarget">Reset color</button><button type="button" id="resetTargets">Clear all</button></div></div><p class="lab-footnote">WebGL2 uses a 360-sample hue profile so all 74 spectrum targets stay smooth without a per-pixel 74-target loop. WebGL1 and Canvas 2D retain compatible color controls when supported. Auto Color is optional. DRM-protected or unreadable video cannot be selectively graded.</p></div>`;
box.after(lab);
const swatchBox=el('hueSwatches'),targetControls=el('targetControls'),targetInputs={};
for(const b of BANDS){const btn=document.createElement('button');btn.type='button';btn.className='hue-chip';btn.dataset.key=b.key;btn.dataset.search=(b.name+' '+b.key+' '+(b.hue??'')).toLowerCase();btn.title=`Target ${b.name}${b.hue!==undefined?` · ${b.hue.toFixed(1)}° hue`:''}`;btn.setAttribute('aria-label',`Target ${b.name}`);btn.innerHTML=`<span class="hue-chip-color" style="--hue-color:${b.color}"></span><span>${b.name}</span>`;btn.addEventListener('click',()=>{selected=b.key;drawTarget()});swatchBox.append(btn)}
const targetSearch=el('targetSearch');targetSearch.addEventListener('input',()=>{const q=targetSearch.value.trim().toLowerCase();swatchBox.querySelectorAll('.hue-chip').forEach(btn=>{btn.hidden=!!q&&!btn.dataset.search.includes(q)})});
const targetDefs=[['hue','Hue shift',-100,100,v=>(v>0?'+':'')+Math.round(v*.45)+'°'],['sat','Saturation',-100,100,v=>(v>0?'+':'')+v+'%'],['lum','Lightness',-100,100,v=>(v>0?'+':'')+v+'%']];
// Rebuild the three compact sliders when a swatch changes so every slider is bound to exactly one hue family.
function updateTargetStatus(){const t=s.targetColors[selected],active=!!(t.hue||t.sat||t.lum);el('targetStatus').textContent=active?'CUSTOM':'NEUTRAL';el('targetStatus').classList.toggle('is-active',active)}
function drawTarget(){const b=BANDS.find(x=>x.key===selected)||BANDS[1];el('targetName').textContent=b.name;el('targetDot').style.setProperty('--hue-color',b.color);swatchBox.querySelectorAll('.hue-chip').forEach(btn=>{const active=btn.dataset.key===selected;btn.classList.toggle('active',active);btn.setAttribute('aria-pressed',String(active))});
 targetControls.replaceChildren();for(const [prop,label,min,max,readout] of targetDefs){const id=`target-${selected}-${prop}`;const c=makeRange(targetControls,{id,label,min,max,readout});targetInputs[prop]=c;c.input.value=s.targetColors[selected][prop]||0;c.show(c.input.value)}updateTargetStatus()}
// Override global range save behavior so sliders update their own value only and automatically enable effects.
function draw(){el('fxEnabled').checked=!!s.enabled;preset.value=s.preset||'Custom';for(const [k] of fields){const x=globalControls[k];x.input.value=s[k]||0;x.show(x.input.value)}drawTarget()}
preset.addEventListener('change',()=>{const name=preset.value;if(name==='Custom'){s.preset='Custom';save(true);return}s=mergeState({...def,...presets[name],preset:name,enabled:true});if(name==='Teal & Amber'){s.targetColors.orange={hue:-5,sat:18,lum:3};s.targetColors.cyan={hue:8,sat:15,lum:-4};s.targetColors.blue={hue:4,sat:8,lum:-2}}else if(name==='Vivid'){for(const b of BANDS)s.targetColors[b.key].sat=10}else if(name==='Soft Pastel'){for(const b of BANDS){s.targetColors[b.key].sat=-8;s.targetColors[b.key].lum=3}}draw();if(s.enabled)linkMaterialDepth(true);save(true)});
el('fxEnabled').addEventListener('change',e=>{const was=s.enabled;s.enabled=e.target.checked;if(s.enabled&&!was&&hasAnyAdjustment())s=mergeState({...s,...presets.Natural,preset:'Natural',enabled:true});if(s.enabled){ensureColorRenderer();linkMaterialDepth(true)}else linkMaterialDepth(false);draw();save(true)});
el('fxReset').addEventListener('click',()=>{const on=s.enabled;s=mergeState({...def,enabled:on});draw();save(true)});
el('fxNatural').addEventListener('click',()=>{s=mergeState({...def,...presets.Natural,preset:'Natural',enabled:true});draw();ensureColorRenderer();linkMaterialDepth(true);save(true)});
el('resetTarget').addEventListener('click',()=>{s.targetColors[selected]={hue:0,sat:0,lum:0};activateEffects();drawTarget();save(true)});
el('resetTargets').addEventListener('click',()=>{s.targetColors=blankTargets();activateEffects();drawTarget();save(true)});
// Hydrate legacy settings while keeping all newly introduced target channels initialized.
browser.storage.local.get(KEY).then(v=>{s=mergeState(v[KEY]||{});draw();if(s.enabled)ensureColorRenderer()}).catch(()=>draw());
})();
