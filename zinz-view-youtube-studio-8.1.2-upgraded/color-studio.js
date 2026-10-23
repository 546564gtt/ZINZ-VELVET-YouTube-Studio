(()=>{'use strict';
const PROFILE_KEY='zvSavedProfiles';
const PALETTES_KEY='zvSavedColorPalettes';
const PROFILE_FORMAT='zinz-velvet-profile';
const PALETTE_FORMAT='zinz-color-palette';
const THEME_KEY='zvTheme',YT_KEY='zvYouTubeStudio',MUSIC_KEY='zvMusicStudio';
const themeDefaults={primary:'#a77af4',secondary:'#c6a5ff',background:'#0c0913',elevated:'#21172e',glass:'#30213f',text:'#f4edff',muted:'#b6a7c6',border:'#5b476e',active:'#a77af4',hover:'#654785',progress:'#a77af4'};
const ytDefaults={enabled:true,hideComments:false,hideRelated:false,hideSidebar:false,hideLiveChat:false,hideShorts:false,hideMetadata:false,hideHeader:false,hideDescription:false,hideAds:false,hideEndscreen:false,background:'#0b0a12',surface:'#16111f',panel:'#21182e',text:'#f5efff',titleText:'#fffaff',secondaryText:'#b7aac8',commentText:'#e6deef',link:'#c7a1ff',accent:'#b58cff',progress:'#b58cff',fontFace:'system',scrollMode:'smooth',thumbnailRatio:'16:9',density:'comfortable',columns:4,titleScale:100,textScale:100,radius:16,cardGap:16};
const musicDefaults={enabled:true,hideSidePanel:false,hideRecommendations:false,hideLyrics:false,hideSearch:false,hidePlayerBar:false,hideNavigation:false,compact:false,sharp:false,background:'#090710',surface:'#181222',panel:'#241b33',text:'#f6f0ff',titleText:'#fffaff',secondaryText:'#aaa0bb',link:'#d3b4ff',accent:'#b58cff',progress:'#b58cff',lyricsText:'#f6f0ff',fontFace:'system',layout:'comfortable',columns:5,textScale:100,artRadius:14,rowHeight:68,albumArtScale:100,playerBarHeight:82};
const effectsDefaults={enabled:false,preset:'Natural',sharp:0,contrast:0,saturation:0,brightness:0,gamma:0,highlights:0,shadows:0,warmth:0,tint:0,redBalance:0,greenBalance:0,blueBalance:0,blackPoint:0,whitePoint:0,fade:0,targetColors:{}};
const materialDefaults={enabled:false,preset:'Natural Depth',_enabledByEffects:false,_manualOff:false,depth:8,micro:18,structure:12,edge:12,local:8,highlight:5,protection:70,stability:60};
const texturingDefaults={gl:true,hud:false,light:{on:true,shadow:1,illum:1,rolloff:1,noise:1},auto:{on:false,strength:.6,wb:1,chroma:1,sep:1,skin:.7,shadowKeep:.7,hiKeep:.7,speed:1},clean:{deband:0,dither:1,gf:.6,sharp:.4,up:1,temporal:.6},perf:{ingest:1,lock:0,bench:1,watchdog:1,allowSoft:0}};
const defaults={
 zinzVelvetZen:{enabled:true,accent:'#a77af4',separateShorts:true,clean:false,sharp:false,lowfx:false,hidePlayables:true,quiet:true,watchFocus:false},
 zinzVelvetMusic:{enabled:true,compact:false,focus:false,sharp:false},
 zvTheme:themeDefaults,
 zvSavedThemes:{},
 zvYouTubeStudio:ytDefaults,
 zvMusicStudio:musicDefaults,
 zinzVelvetEffects:effectsDefaults,
 zinzMaterialDepth:materialDefaults,
 zinzTexturing:texturingDefaults,
 zvSavedColorPalettes:{}
};
const CONFIG_KEYS=Object.keys(defaults);
const themeFields=[
 ['primary','Primary / accent','Buttons, active controls and the main accent.'],['secondary','Secondary accent','Secondary highlights and decorative gradients.'],['background','Base background','The overall VELVET canvas.'],['elevated','Raised surface','Cards, raised areas and toolbar surfaces.'],['glass','Glass surface','Translucent panel color.'],['text','Main text','Text in VELVET surfaces.'],['muted','Muted text','Secondary labels and descriptions.'],['border','Borders','Outline and divider color.'],['active','Active selection','Selected navigation and controls.'],['hover','Hover surface','Hover state color.'],['progress','Progress bars','Playback or progress accents.']
];
const ytColorFields=[
 ['background','Page background','Main YouTube page canvas.'],['surface','Surface','Navigation and raised shelf surfaces.'],['panel','Cards & panels','Menus and secondary panels.'],['text','Main text','General YouTube interface copy.'],['titleText','Video titles','Primary titles and headings.'],['secondaryText','Secondary text','Views, upload age and metadata.'],['commentText','Comment text','Comment bodies and comment author labels.'],['link','Link color','Links and interactive text.'],['accent','Accent color','Selected chips and prominent controls.'],['progress','Playback progress','The played segment of the video progress bar.']
];
const musicColorFields=[
 ['background','Page background','Music browse and player background.'],['surface','Navigation surface','Sidebar and navigation surfaces.'],['panel','Cards & panels','Track rows, menus and elevated player panels.'],['text','Main text','General Music interface copy.'],['titleText','Track titles','Track titles and primary headings.'],['secondaryText','Secondary text','Artist names, album labels and metadata.'],['link','Link color','Links and interactive text.'],['accent','Accent color','Selected items and active controls.'],['progress','Playback progress','Track and seek progress.'],['lyricsText','Lyrics text','Lyrics display text.']
];
const themePresets={
 VELVET:{...themeDefaults},
 Obsidian:{...themeDefaults,primary:'#d0d0df',secondary:'#9696b8',background:'#090a10',elevated:'#191b25',glass:'#222431',text:'#f1f1f8',muted:'#a5a6bb',border:'#444657',active:'#d0d0df',hover:'#343647',progress:'#d0d0df'},
 Amethyst:{...themeDefaults,primary:'#c48dff',secondary:'#e3bbff',background:'#160b23',elevated:'#302044',glass:'#412e57',active:'#c48dff',hover:'#4a3063',progress:'#c48dff'},
 Nocturne:{...themeDefaults,primary:'#85b7e8',secondary:'#b1d9fa',background:'#090e1b',elevated:'#19243b',glass:'#253753',border:'#3e5373',active:'#85b7e8',hover:'#253e5c',progress:'#85b7e8'}
};
function pickDefaultColors(source,fields){const out={};for(const [key] of fields)out[key]=source[key];return out}
const builtInPalettes={
 VELVET:{zvTheme:{...themeDefaults},zvYouTubeStudio:pickDefaultColors(ytDefaults,ytColorFields),zvMusicStudio:pickDefaultColors(musicDefaults,musicColorFields)},
 OLED:{zvTheme:{primary:'#b8a2ff',secondary:'#e0d5ff',background:'#000000',elevated:'#101014',glass:'#17171e',text:'#ffffff',muted:'#b5b5c2',border:'#353541',active:'#b8a2ff',hover:'#292332',progress:'#b8a2ff'},zvYouTubeStudio:{background:'#000000',surface:'#08080c',panel:'#111117',text:'#f8f8ff',titleText:'#ffffff',secondaryText:'#a5a5b2',commentText:'#dedee8',link:'#c5afff',accent:'#b8a2ff',progress:'#b8a2ff'},zvMusicStudio:{background:'#000000',surface:'#08080c',panel:'#111117',text:'#f8f8ff',titleText:'#ffffff',secondaryText:'#a5a5b2',link:'#c5afff',accent:'#b8a2ff',progress:'#b8a2ff',lyricsText:'#f4f0ff'}},
 Ocean:{zvTheme:{primary:'#5dc9dc',secondary:'#9ae4ef',background:'#07131c',elevated:'#102633',glass:'#183545',text:'#eafaff',muted:'#9bbac7',border:'#315264',active:'#5dc9dc',hover:'#1e4759',progress:'#5dc9dc'},zvYouTubeStudio:{background:'#07131c',surface:'#102633',panel:'#153242',text:'#eafaff',titleText:'#ffffff',secondaryText:'#9bbac7',commentText:'#d9edf4',link:'#7de0ee',accent:'#5dc9dc',progress:'#5dc9dc'},zvMusicStudio:{background:'#07131c',surface:'#102633',panel:'#153242',text:'#eafaff',titleText:'#ffffff',secondaryText:'#9bbac7',link:'#7de0ee',accent:'#5dc9dc',progress:'#5dc9dc',lyricsText:'#eafaff'}},
 Ember:{zvTheme:{primary:'#ff9d67',secondary:'#ffd0a8',background:'#1a0c0a',elevated:'#311913',glass:'#47251b',text:'#fff3e9',muted:'#c5a091',border:'#694337',active:'#ff9d67',hover:'#532b1f',progress:'#ff9d67'},zvYouTubeStudio:{background:'#1a0c0a',surface:'#311913',panel:'#402118',text:'#fff3e9',titleText:'#fff9f2',secondaryText:'#c5a091',commentText:'#f2dcd0',link:'#ffb68e',accent:'#ff9d67',progress:'#ff9d67'},zvMusicStudio:{background:'#1a0c0a',surface:'#311913',panel:'#402118',text:'#fff3e9',titleText:'#fff9f2',secondaryText:'#c5a091',link:'#ffb68e',accent:'#ff9d67',progress:'#ff9d67',lyricsText:'#fff3e9'}},
 Forest:{zvTheme:{primary:'#79d5a5',secondary:'#b0f0ce',background:'#07140f',elevated:'#10271b',glass:'#193728',text:'#effff5',muted:'#a1c3ad',border:'#315943',active:'#79d5a5',hover:'#254b36',progress:'#79d5a5'},zvYouTubeStudio:{background:'#07140f',surface:'#10271b',panel:'#193728',text:'#effff5',titleText:'#ffffff',secondaryText:'#a1c3ad',commentText:'#dbeee1',link:'#9be9be',accent:'#79d5a5',progress:'#79d5a5'},zvMusicStudio:{background:'#07140f',surface:'#10271b',panel:'#193728',text:'#effff5',titleText:'#ffffff',secondaryText:'#a1c3ad',link:'#9be9be',accent:'#79d5a5',progress:'#79d5a5',lyricsText:'#effff5'}},
 Paper:{zvTheme:{primary:'#7153c5',secondary:'#937cdb',background:'#f4f1f8',elevated:'#ffffff',glass:'#eee8f7',text:'#231b30',muted:'#665b74',border:'#d5c9e2',active:'#7153c5',hover:'#e4daf2',progress:'#7153c5'},zvYouTubeStudio:{background:'#f4f1f8',surface:'#ffffff',panel:'#eee8f7',text:'#231b30',titleText:'#17111f',secondaryText:'#665b74',commentText:'#342941',link:'#6545ad',accent:'#7153c5',progress:'#7153c5'},zvMusicStudio:{background:'#f4f1f8',surface:'#ffffff',panel:'#eee8f7',text:'#231b30',titleText:'#17111f',secondaryText:'#665b74',link:'#6545ad',accent:'#7153c5',progress:'#7153c5',lyricsText:'#342941'}}
};
let current={},profiles={},palettes={};
const statusEl=document.getElementById('status');let statusTimer=null;
const $=id=>document.getElementById(id);
const clone=value=>JSON.parse(JSON.stringify(value));
const isPlain=value=>!!value&&typeof value==='object'&&!Array.isArray(value);
const safeHex=value=>typeof value==='string'&&/^#[0-9a-f]{6}$/i.test(value);
function notify(message,isError=false){statusEl.textContent=message;statusEl.classList.toggle('error',!!isError);statusEl.classList.add('show');clearTimeout(statusTimer);statusTimer=setTimeout(()=>statusEl.classList.remove('show'),3600)}
function mergeKnown(base,raw){
 if(!isPlain(base)||!isPlain(raw))return clone(base);
 if(Object.keys(base).length===0)return clone(raw);
 const out={};
 for(const [key,baseValue] of Object.entries(base)){
  const value=raw[key];
  if(isPlain(baseValue)){out[key]=isPlain(value)?mergeKnown(baseValue,value):clone(baseValue)}
  else if(typeof baseValue==='boolean'){out[key]=typeof value==='boolean'?value:baseValue}
  else if(typeof baseValue==='number'){out[key]=typeof value==='number'&&Number.isFinite(value)?value:baseValue}
  else if(typeof baseValue==='string'){out[key]=typeof value==='string'?value:baseValue}
  else out[key]=value===undefined?clone(baseValue):clone(value);
 }
 // Retain forward-compatible settings while avoiding special object-property names.
 for(const [key,value] of Object.entries(raw))if(!(key in base)&&!['__proto__','prototype','constructor'].includes(key))out[key]=clone(value);
 return out;
}
function cleanSettings(raw){const out={};for(const key of CONFIG_KEYS){const base=defaults[key];const candidate=isPlain(raw)?raw[key]:undefined;out[key]=candidate===undefined?clone(base):(isPlain(base)&&isPlain(candidate)?mergeKnown(base,candidate):clone(base))}return out}
function makeColorFields(hostId,storageKey,definitions){
 const host=$(hostId);host.replaceChildren();
 for(const [key,label,help] of definitions){
  const row=document.createElement('div');row.className='color-field';
  const lab=document.createElement('label');lab.textContent=label;lab.htmlFor=`picker-${storageKey}-${key}`;
  const picker=document.createElement('input');picker.type='color';picker.id=`picker-${storageKey}-${key}`;picker.dataset.storageKey=storageKey;picker.dataset.colorKey=key;picker.dataset.kind='picker';picker.setAttribute('aria-label',`${label} color`);
  const hex=document.createElement('input');hex.type='text';hex.maxLength=7;hex.autocomplete='off';hex.spellcheck=false;hex.value='#000000';hex.dataset.storageKey=storageKey;hex.dataset.colorKey=key;hex.dataset.kind='hex';hex.setAttribute('aria-label',`${label} hex value`);hex.title='Enter a hex color such as #c49aff';
  const reset=document.createElement('button');reset.type='button';reset.className='reset-color';reset.textContent='↺';reset.title=`Reset ${label}`;reset.setAttribute('aria-label',`Reset ${label}`);reset.dataset.resetStorageKey=storageKey;reset.dataset.resetColorKey=key;
  const helpEl=document.createElement('small');helpEl.className='help';helpEl.textContent=help;
  row.append(lab,picker,hex,reset,helpEl);host.append(row);
 }
}
function renderColorFields(options={}){
 const active=document.activeElement;
 document.querySelectorAll('[data-storage-key][data-color-key]').forEach(el=>{
  if(options.skipFocused&&el===active)return;
  const key=el.dataset.storageKey,colorKey=el.dataset.colorKey;
  const val=current[key]?.[colorKey];
  if(!safeHex(val))return;
  if(el.dataset.kind==='picker')el.value=val;
  else{el.value=val;el.classList.remove('invalid')}
 });
 updatePreviews();
}
function setPreviewVar(element,variable,value){element.style.setProperty(variable,value)}
function updatePreviews(){
 const t=mergeKnown(themeDefaults,current[THEME_KEY]||{}),y=mergeKnown(ytDefaults,current[YT_KEY]||{}),m=mergeKnown(musicDefaults,current[MUSIC_KEY]||{});
 const base=$('basePreview');for(const [prop,val] of [['--preview-primary',t.primary],['--preview-secondary',t.secondary],['--preview-bg',t.background],['--preview-elevated',t.elevated],['--preview-border',t.border],['--preview-text',t.text],['--preview-muted',t.muted],['--preview-active',t.active],['--preview-progress',t.progress]])setPreviewVar(base,prop,val);
 const yp=$('ytPreview');for(const [prop,val] of [['--site-bg',y.background],['--site-panel',y.panel],['--site-text',y.text],['--site-title',y.titleText],['--site-comment',y.commentText],['--site-link',y.link]])setPreviewVar(yp,prop,val);
 const mp=$('musicPreview');for(const [prop,val] of [['--music-bg',m.background],['--music-panel',m.panel],['--music-text',m.text],['--music-title',m.titleText],['--music-muted',m.secondaryText],['--music-lyrics',m.lyricsText],['--music-accent',m.accent],['--music-surface',m.surface]])setPreviewVar(mp,prop,val);
}
async function saveStorageKey(key){try{await browser.storage.local.set({[key]:clone(current[key])});return true}catch(e){notify(`Couldn't save ${key}: ${e?.message||e}`,true);return false}}
async function updateColor(storageKey,colorKey,value,source){
 if(!safeHex(value)){notify('Enter a valid six-digit hex color, such as #c49aff.',true);return false}
 if(!isPlain(current[storageKey]))current[storageKey]=clone(defaults[storageKey]||{});
 current[storageKey][colorKey]=value.toLowerCase();
 const selector=`[data-storage-key="${storageKey}"][data-color-key="${colorKey}"]`;
 for(const el of document.querySelectorAll(selector)){
  if(el===document.activeElement)continue;
  if(el.dataset.kind==='picker')el.value=value.toLowerCase();
  if(el.dataset.kind==='hex'){el.value=value.toLowerCase();el.classList.remove('invalid')}
 }
 updatePreviews();
 const ok=await saveStorageKey(storageKey);
 if(ok)notify('Color saved and applied to the site.');
 return ok;
}
function pickColorKeys(storageKey,obj){const definitions=storageKey===THEME_KEY?themeFields:storageKey===YT_KEY?ytColorFields:musicColorFields;const out={};for(const [key]of definitions)if(safeHex(obj?.[key]))out[key]=obj[key];return out}
async function captureSettings(){const live=await browser.storage.local.get(CONFIG_KEYS);const snapshot={};for(const key of CONFIG_KEYS){const raw=live[key]===undefined?current[key]??defaults[key]:live[key];snapshot[key]=isPlain(defaults[key])&&isPlain(raw)?mergeKnown(defaults[key],raw):clone(raw??defaults[key])}return cleanSettings(snapshot)}
async function getProfiles(){const v=await browser.storage.local.get(PROFILE_KEY);profiles=isPlain(v[PROFILE_KEY])?v[PROFILE_KEY]:{};return profiles}
async function getPalettes(){const v=await browser.storage.local.get(PALETTES_KEY);palettes=isPlain(v[PALETTES_KEY])?v[PALETTES_KEY]:{};return palettes}
function refreshProfileSelect(selected=''){const el=$('savedProfileSelect');el.replaceChildren();const names=Object.keys(profiles).sort((a,b)=>a.localeCompare(b));if(!names.length){const opt=new Option('No saved setups yet','');opt.disabled=true;el.add(opt);el.value='';return}el.add(new Option('Choose a saved setup…',''));for(const name of names)el.add(new Option(name,name));if(selected&&names.includes(selected))el.value=selected}
function refreshPaletteSelect(selected=''){const el=$('savedPaletteSelect');el.replaceChildren();const names=Object.keys(palettes).sort((a,b)=>a.localeCompare(b));if(!names.length){const opt=new Option('No saved palettes yet','');opt.disabled=true;el.add(opt);el.value='';return}el.add(new Option('Choose a palette…',''));for(const name of names)el.add(new Option(name,name));if(selected&&names.includes(selected))el.value=selected}
function getSelectedProfile(){const name=$('savedProfileSelect').value;return name&&profiles[name]?{name,entry:profiles[name]}:null}
function getSelectedPalette(){const name=$('savedPaletteSelect').value;return name&&palettes[name]?{name,entry:palettes[name]}:null}
function slug(value){return String(value||'zinz-export').trim().toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'').slice(0,60)||'zinz-export'}
function downloadJson(data,filename){const blob=new Blob([JSON.stringify(data,null,2)],{type:'application/json'});const url=URL.createObjectURL(blob);const anchor=document.createElement('a');anchor.href=url;anchor.download=filename;anchor.style.display='none';document.body.append(anchor);anchor.click();anchor.remove();setTimeout(()=>URL.revokeObjectURL(url),1500)}
function applyTab(tab){const isMusic=tab==='music';document.querySelectorAll('.studio-tab').forEach(btn=>{const active=btn.dataset.tab===(isMusic?'music':'youtube');btn.classList.toggle('active',active);btn.setAttribute('aria-selected',String(active))});$('youtubeTab').classList.toggle('active',!isMusic);$('musicTab').classList.toggle('active',isMusic);try{history.replaceState(null,'',isMusic?'#music':'#youtube')}catch{}}
async function buildPaletteSnapshot(){const live=await browser.storage.local.get([THEME_KEY,YT_KEY,MUSIC_KEY]);const colors={};for(const key of [THEME_KEY,YT_KEY,MUSIC_KEY]){const base=defaults[key],raw=live[key]===undefined?current[key]||base:live[key];const merged=isPlain(raw)?mergeKnown(base,raw):clone(base);colors[key]=pickColorKeys(key,merged)}return colors}
async function applyPaletteColors(colors){if(!isPlain(colors))throw new Error('This file does not contain a valid color palette.');const update={};for(const key of [THEME_KEY,YT_KEY,MUSIC_KEY]){const part=colors[key];if(!isPlain(part))continue;const merged=mergeKnown(defaults[key],current[key]||defaults[key]);for(const [colorKey,value] of Object.entries(part)){const validKeys=key===THEME_KEY?themeFields.map(x=>x[0]):key===YT_KEY?ytColorFields.map(x=>x[0]):musicColorFields.map(x=>x[0]);if(validKeys.includes(colorKey)&&safeHex(value))merged[colorKey]=value.toLowerCase()}current[key]=merged;update[key]=merged}
 if(!Object.keys(update).length)throw new Error('No recognized color settings were found in that palette.');await browser.storage.local.set(update);renderColorFields();}
async function saveProfileNamed(name,selectedName=''){
 const cleaned=name.trim().slice(0,60);if(!cleaned){notify('Give this setup a name before saving.',true);return false}
 const settings=await captureSettings();const time=new Date().toISOString();const previous=profiles[cleaned]||{};
 profiles={...profiles,[cleaned]:{format:PROFILE_FORMAT,version:1,name:cleaned,createdAt:previous.createdAt||time,updatedAt:time,settings}};
 await browser.storage.local.set({[PROFILE_KEY]:profiles});await getProfiles();refreshProfileSelect(cleaned);$('profileName').value=cleaned;notify(`Saved complete setup “${cleaned}”.`);return true;
}
async function loadProfileEntry(name,entry){
 if(!isPlain(entry)||entry.format!==PROFILE_FORMAT||!isPlain(entry.settings))throw new Error('That is not a valid ZINZ setup profile.');
 const sanitized=cleanSettings(entry.settings);await browser.storage.local.set(sanitized);current={...current,...sanitized};renderColorFields();$('profileName').value=name||entry.name||'';notify(`Loaded “${name||entry.name||'setup'}”. Effects, presets, and site settings have been restored.`);
}
async function importProfileFile(file){if(!file)return;if(file.size>10*1024*1024)throw new Error('That file is too large. Choose a ZINZ JSON export under 10 MB.');const parsed=JSON.parse(await file.text());if(parsed.format!==PROFILE_FORMAT||!isPlain(parsed.settings))throw new Error('Not a ZINZ setup file. Choose a complete setup JSON export.');const name=String(parsed.name||file.name.replace(/\.json$/i,'')||'Imported setup').trim().slice(0,60)||'Imported setup';const entry={format:PROFILE_FORMAT,version:1,name,createdAt:parsed.createdAt||new Date().toISOString(),updatedAt:new Date().toISOString(),settings:cleanSettings(parsed.settings)};profiles={...profiles,[name]:entry};await browser.storage.local.set({[PROFILE_KEY]:profiles});await loadProfileEntry(name,entry);await getProfiles();refreshProfileSelect(name);notify(`Imported and applied “${name}”.`)}
async function exportCurrentProfile(){const name=String($('profileName').value||'My ZINZ setup').trim().slice(0,60)||'My ZINZ setup';const entry={format:PROFILE_FORMAT,version:1,name,createdAt:new Date().toISOString(),updatedAt:new Date().toISOString(),settings:await captureSettings()};downloadJson(entry,`${slug(name)}-zinz-setup.json`);notify('Exported complete setup JSON. Share that file with your friend.')}
async function exportSelectedProfile(){const selected=getSelectedProfile();if(!selected){await exportCurrentProfile();return}const entry=selected.entry;if(!isPlain(entry.settings))throw new Error('The saved setup is incomplete.');downloadJson(entry,`${slug(selected.name)}-zinz-setup.json`);notify(`Exported “${selected.name}”.`)}
async function savePaletteNamed(name,colorsOverride){const cleaned=name.trim().slice(0,60);if(!cleaned){notify('Give this color palette a name before saving.',true);return false}const colors=colorsOverride||await buildPaletteSnapshot();const time=new Date().toISOString();palettes={...palettes,[cleaned]:{format:PALETTE_FORMAT,version:1,name:cleaned,createdAt:palettes[cleaned]?.createdAt||time,updatedAt:time,colors}};await browser.storage.local.set({[PALETTES_KEY]:palettes});await getPalettes();refreshPaletteSelect(cleaned);$('paletteName').value=cleaned;notify(`Saved color palette “${cleaned}”.`);return true}
async function applyPaletteEntry(name,entry){if(!isPlain(entry)||entry.format!==PALETTE_FORMAT||!isPlain(entry.colors))throw new Error('That is not a valid ZINZ color palette.');await applyPaletteColors(entry.colors);notify(`Applied color palette “${name||entry.name||'palette'}”. Effects and layout settings were left unchanged.`)}
async function exportPalette(){let name,entry;const selected=getSelectedPalette();if(selected){name=selected.name;entry=selected.entry}else{name=String($('paletteName').value||'My color palette').trim()||'My color palette';entry={format:PALETTE_FORMAT,version:1,name,createdAt:new Date().toISOString(),colors:await buildPaletteSnapshot()}}downloadJson(entry,`${slug(name)}-zinz-colors.json`);notify(`Exported color palette “${name}”.`)}
async function importPaletteFile(file){if(!file)return;if(file.size>5*1024*1024)throw new Error('That palette file is too large.');const parsed=JSON.parse(await file.text());if(parsed.format!==PALETTE_FORMAT||!isPlain(parsed.colors))throw new Error('Not a ZINZ color palette file.');const name=String(parsed.name||file.name.replace(/\.json$/i,'')||'Imported palette').trim().slice(0,60)||'Imported palette';const entry={format:PALETTE_FORMAT,version:1,name,createdAt:parsed.createdAt||new Date().toISOString(),updatedAt:new Date().toISOString(),colors:parsed.colors};await applyPaletteColors(entry.colors);palettes={...palettes,[name]:entry};await browser.storage.local.set({[PALETTES_KEY]:palettes});await getPalettes();refreshPaletteSelect(name);$('paletteName').value=name;notify(`Imported and applied color palette “${name}”.`)}
async function applyBuiltinPalette(name){const palette=builtInPalettes[name];if(!palette)throw new Error('Unknown built-in palette.');const colors={};for(const key of [THEME_KEY,YT_KEY,MUSIC_KEY]){const existing=await buildPaletteSnapshot();colors[key]={...existing[key],...(palette[key]||{})}}
 await applyPaletteColors(colors);$('themePreset').value=themePresets[name]?name:'Custom';notify(`Applied built-in “${name}” color palette.`)}
function parseFileInput(input,handler){input.addEventListener('change',async()=>{const file=input.files&&input.files[0];if(!file)return;try{await handler(file)}catch(e){notify(e?.message||'Could not read that file.',true)}finally{input.value=''}})}
function handleColorInput(target){const storageKey=target.dataset.storageKey,colorKey=target.dataset.colorKey;if(!storageKey||!colorKey)return;if(target.dataset.kind==='picker'){updateColor(storageKey,colorKey,target.value,'picker');return}const value=target.value.trim();const match=/^#?([0-9a-f]{6})$/i.exec(value);if(!match){target.classList.add('invalid');return}target.classList.remove('invalid');const hex='#'+match[1].toLowerCase();const picker=document.querySelector(`[data-storage-key="${storageKey}"][data-color-key="${colorKey}"][data-kind="picker"]`);if(picker&&picker!==document.activeElement)picker.value=hex;updateColor(storageKey,colorKey,hex,'hex')}
async function init(){
 makeColorFields('baseThemeColors',THEME_KEY,themeFields);makeColorFields('ytColors',YT_KEY,ytColorFields);makeColorFields('musicColors',MUSIC_KEY,musicColorFields);
 const stored=await browser.storage.local.get([...CONFIG_KEYS,PROFILE_KEY]);
 current=cleanSettings(stored);profiles=isPlain(stored[PROFILE_KEY])?stored[PROFILE_KEY]:{};
 await getPalettes();renderColorFields();refreshProfileSelect();refreshPaletteSelect();
 if(location.hash==='#music')applyTab('music');else applyTab('youtube');
 document.querySelectorAll('.studio-tab').forEach(btn=>btn.addEventListener('click',()=>applyTab(btn.dataset.tab)));
 document.addEventListener('input',e=>{const target=e.target;if(target?.dataset?.storageKey&&target?.dataset?.colorKey)handleColorInput(target)});
 document.addEventListener('change',e=>{const target=e.target;if(target?.dataset?.storageKey&&target?.dataset?.colorKey){if(target.dataset.kind==='hex'&&!safeHex(target.value)){const old=current[target.dataset.storageKey]?.[target.dataset.colorKey];target.value=old||'#000000';target.classList.remove('invalid');notify('Hex values must be six digits, for example #c49aff.',true)}else if(target.dataset.kind==='hex')handleColorInput(target);return}
  if(target.id==='themePreset'&&themePresets[target.value]){current[THEME_KEY]={...mergeKnown(themeDefaults,current[THEME_KEY]||{}),...themePresets[target.value]};saveStorageKey(THEME_KEY).then(ok=>{renderColorFields();if(ok)notify(`Applied ${target.value} base theme.`)})}
 });
 document.addEventListener('click',async e=>{
  const reset=e.target.closest('[data-reset-storage-key]');if(reset){const key=reset.dataset.resetStorageKey,colorKey=reset.dataset.resetColorKey;await updateColor(key,colorKey,defaults[key][colorKey],'reset');return}
  const id=e.target.closest('button')?.id;if(!id)return;
  try{
   if(id==='saveProfile')await saveProfileNamed($('profileName').value);
   else if(id==='loadProfile'){const selected=getSelectedProfile();if(!selected)throw new Error('Choose a saved setup first.');await loadProfileEntry(selected.name,selected.entry)}
   else if(id==='updateProfile'){const selected=getSelectedProfile();if(!selected)throw new Error('Choose a saved setup first.');await saveProfileNamed(selected.name,selected.name)}
   else if(id==='deleteProfile'){const selected=getSelectedProfile();if(!selected)throw new Error('Choose a saved setup first.');if(!confirm(`Delete the saved setup “${selected.name}”?`))return;delete profiles[selected.name];await browser.storage.local.set({[PROFILE_KEY]:profiles});refreshProfileSelect();notify(`Deleted setup “${selected.name}”.`)}
   else if(id==='exportSelectedProfile')await exportSelectedProfile();
   else if(id==='exportCurrentProfile')await exportCurrentProfile();
   else if(id==='savePalette')await savePaletteNamed($('paletteName').value);
   else if(id==='applyPalette'){const selected=getSelectedPalette();if(!selected)throw new Error('Choose a saved palette first.');await applyPaletteEntry(selected.name,selected.entry)}
   else if(id==='deletePalette'){const selected=getSelectedPalette();if(!selected)throw new Error('Choose a saved palette first.');if(!confirm(`Delete the color palette “${selected.name}”?`))return;delete palettes[selected.name];await browser.storage.local.set({[PALETTES_KEY]:palettes});refreshPaletteSelect();notify(`Deleted palette “${selected.name}”.`)}
   else if(id==='exportPalette')await exportPalette();
   else if(id==='applyBuiltinPalette')await applyBuiltinPalette($('builtinPalette').value);
   else if(id==='resetColors'){if(!confirm('Reset all three color palettes to the original VELVET defaults? Other layout and effect settings will stay unchanged. Saved color presets will remain available.'))return;for(const key of [THEME_KEY,YT_KEY,MUSIC_KEY]){const updated=mergeKnown(defaults[key],current[key]||defaults[key]);const fields=key===THEME_KEY?themeFields:key===YT_KEY?ytColorFields:musicColorFields;for(const [colorKey] of fields)updated[colorKey]=defaults[key][colorKey];current[key]=updated}await browser.storage.local.set({[THEME_KEY]:clone(current[THEME_KEY]),[YT_KEY]:clone(current[YT_KEY]),[MUSIC_KEY]:clone(current[MUSIC_KEY])});renderColorFields();$('themePreset').value='VELVET';notify('Color values reset. Layout and video effects were preserved.')}
  }catch(err){notify(err?.message||'That action could not be completed.',true)}
 });
 parseFileInput($('profileImport'),importProfileFile);parseFileInput($('paletteImport'),importPaletteFile);
 browser.storage.onChanged.addListener((changes,area)=>{
  if(area!=='local')return;
  for(const key of [THEME_KEY,YT_KEY,MUSIC_KEY])if(changes[key])current[key]=changes[key].newValue===undefined?clone(defaults[key]):mergeKnown(defaults[key],changes[key].newValue||{});
  if(changes.zvSavedProfiles){profiles=isPlain(changes.zvSavedProfiles.newValue)?changes.zvSavedProfiles.newValue:{};refreshProfileSelect($('savedProfileSelect').value)}
  if(changes[PALETTES_KEY]){palettes=isPlain(changes[PALETTES_KEY].newValue)?changes[PALETTES_KEY].newValue:{};refreshPaletteSelect($('savedPaletteSelect').value)}
  if(changes[THEME_KEY]||changes[YT_KEY]||changes[MUSIC_KEY])renderColorFields({skipFocused:true});
 });
}
init().catch(err=>notify(`Color Studio couldn't initialize: ${err?.message||err}`,true));
})();
