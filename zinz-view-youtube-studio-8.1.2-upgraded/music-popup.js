(()=>{'use strict';
const KEY='zinzVelvetMusic',defaults={enabled:true,compact:false,focus:false,sharp:false};
const controls={enabled:'musicEnabled',compact:'musicCompact',sharp:'musicSharp'};
let state={...defaults};
function draw(){for(const [key,id]of Object.entries(controls)){const el=document.getElementById(id);if(el)el.checked=!!state[key]}}
function save(){browser.storage.local.set({[KEY]:state}).catch(()=>{})}
browser.storage.local.get(KEY).then(value=>{state={...defaults,...(value[KEY]||{})};draw()}).catch(draw);
for(const [key,id]of Object.entries(controls)){const el=document.getElementById(id);if(el)el.addEventListener('change',()=>{state[key]=el.checked;save()})}
})();