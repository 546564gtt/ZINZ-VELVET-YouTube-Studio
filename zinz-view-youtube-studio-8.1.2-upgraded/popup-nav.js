(()=>{'use strict';
/* Wire the popup's visible navigation selectors to the actual content panes. */
const tabs=[...document.querySelectorAll('.tab[data-tab]')];
const panes=[...document.querySelectorAll('.pane[id]')];
if(!tabs.length||!panes.length)return;
const byId=new Map(panes.map(p=>[p.id,p]));
const available=tabs.filter(t=>byId.has(t.dataset.tab));
if(!available.length)return;
const tablist=available[0].parentElement;
if(tablist&&!tablist.hasAttribute('role'))tablist.setAttribute('role','tablist');
for(const tab of available){
  tab.type='button';
  tab.setAttribute('role','tab');
  tab.setAttribute('aria-controls',tab.dataset.tab);
  const pane=byId.get(tab.dataset.tab);
  pane.setAttribute('role','tabpanel');
  pane.setAttribute('aria-labelledby',tab.id||(tab.id=`tab-${tab.dataset.tab}`));
  tab.addEventListener('click',()=>activate(tab));
  tab.addEventListener('keydown',e=>{
    let i=available.indexOf(tab),next=null;
    if(e.key==='ArrowRight'||e.key==='ArrowDown')next=available[(i+1)%available.length];
    else if(e.key==='ArrowLeft'||e.key==='ArrowUp')next=available[(i-1+available.length)%available.length];
    else if(e.key==='Home')next=available[0];
    else if(e.key==='End')next=available[available.length-1];
    if(next){e.preventDefault();activate(next);next.focus()}
  });
}
function activate(chosen){
  for(const tab of available){
    const active=tab===chosen;
    tab.classList.toggle('active',active);
    tab.setAttribute('aria-selected',String(active));
    tab.tabIndex=active?0:-1;
    const pane=byId.get(tab.dataset.tab);
    pane.classList.toggle('active',active);
    pane.hidden=!active;
  }
}
const initial=available.find(t=>t.classList.contains('active'))||available[0];
activate(initial);
})();
