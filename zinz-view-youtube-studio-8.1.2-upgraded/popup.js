(()=>{'use strict';
const KEY='zinzVelvetZen';
const defaults={enabled:true,accent:'#a77af4',separateShorts:true,clean:false,sharp:false,lowfx:false,hidePlayables:true,quiet:true,watchFocus:false};
const colors=['#a77af4','#7d58b6','#c58bc7','#7c90d8','#d4a36e','#6da69c'];
const visible=['enabled','separateShorts','hidePlayables','quiet','watchFocus','lowfx'];
let state={...defaults};
function draw(){
 for(const key of visible){const input=document.getElementById(key);if(input)input.checked=!!state[key]}
 document.documentElement.style.setProperty('--accent',state.accent);
 const host=document.getElementById('colors');if(!host)return;
 host.replaceChildren();
 for(const color of colors){const button=document.createElement('button');button.type='button';button.className='color'+(state.accent===color?' active':'');button.style.setProperty('--c',color);button.title=color;button.setAttribute('aria-label','Select accent '+color);button.setAttribute('aria-pressed',String(state.accent===color));button.addEventListener('click',()=>{state.accent=color;save()});host.append(button)}
}
function save(){browser.storage.local.set({[KEY]:state}).then(draw).catch(()=>{})}
browser.storage.local.get(KEY).then(value=>{state={...defaults,...(value[KEY]||{})};draw()}).catch(draw);
for(const key of visible){const input=document.getElementById(key);if(input)input.addEventListener('change',()=>{state[key]=input.checked;save()})}
})();