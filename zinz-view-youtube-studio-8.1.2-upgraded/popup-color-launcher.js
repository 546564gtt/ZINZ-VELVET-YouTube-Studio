(()=>{'use strict';
function openStudio(section){const url=browser.runtime.getURL('color-studio.html')+'#'+(section==='music'?'music':'youtube');browser.tabs.create({url}).catch(()=>{});}
for(const [id,section] of [['openColorStudioYt','youtube'],['openColorStudioYt2','youtube'],['openColorStudioMusic','music']]){
 const button=document.getElementById(id);if(button)button.addEventListener('click',()=>openStudio(section));
}
})();
