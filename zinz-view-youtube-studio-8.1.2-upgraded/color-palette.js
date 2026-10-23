/* Shared selective-color palette. 74 spectral targets + dedicated skin and earth masks. */
(()=>{'use strict';
const BASE=[
    {key:"red",name:"Red",color:"#ff0000",hue:0.000000},
    {key:"scarlet",name:"Scarlet",color:"#ff4e32",hue:8.195122},
    {key:"orange",name:"Orange",color:"#ff812f",hue:23.653846},
    {key:"amber",name:"Amber",color:"#ffac38",hue:34.974874},
    {key:"gold",name:"Gold",color:"#ffd13b",hue:45.918367},
    {key:"yellow",name:"Yellow",color:"#eff044",hue:60.348837},
    {key:"lime",name:"Lime",color:"#b4ec4a",hue:80.740741},
    {key:"chartreuse",name:"Chartreuse",color:"#77df57",hue:105.882353},
    {key:"green",name:"Green",color:"#36ce73",hue:144.078947},
    {key:"emerald",name:"Emerald",color:"#26bfa0",hue:167.843137},
    {key:"teal",name:"Teal",color:"#29c8bd",hue:175.849057},
    {key:"cyan",name:"Cyan",color:"#31dce7",hue:183.626374},
    {key:"sky",name:"Sky",color:"#45c5ff",hue:198.709677},
    {key:"azure",name:"Azure",color:"#448cff",hue:216.898396},
    {key:"blue",name:"Blue",color:"#4e67ff",hue:231.525424},
    {key:"indigo",name:"Indigo",color:"#6850ec",hue:249.230769},
    {key:"violet",name:"Violet",color:"#9255ed",hue:264.078947},
    {key:"purple",name:"Purple",color:"#b04ce2",hue:280.000000},
    {key:"orchid",name:"Orchid",color:"#d45ed4",hue:300.000000},
    {key:"magenta",name:"Magenta",color:"#e84ba8",hue:324.458599},
    {key:"fuchsia",name:"Fuchsia",color:"#fb4386",hue:338.152174},
    {key:"rose",name:"Rose",color:"#ff7395",hue:345.428571},
    {key:"crimson",name:"Crimson",color:"#bd254f",hue:343.421053},
    {key:"vermilion",name:"Vermilion",color:"#f05240",hue:6.136364}
];
const spectrum=[
    {key:'spectrum_01',name:"Hue 012.1\u00b0",color:"#f64d23",hue:12.059803,fine:true},
    {key:'spectrum_02',name:"Hue 015.9\u00b0",color:"#f65b23",hue:15.924484,fine:true},
    {key:'spectrum_03',name:"Hue 019.8\u00b0",color:"#f66823",hue:19.789165,fine:true},
    {key:'spectrum_04',name:"Hue 029.3\u00b0",color:"#f68a23",hue:29.314360,fine:true},
    {key:'spectrum_05',name:"Hue 040.4\u00b0",color:"#f6b123",hue:40.446621,fine:true},
    {key:'spectrum_06',name:"Hue 053.1\u00b0",color:"#f6de23",hue:53.133602,fine:true},
    {key:'spectrum_07',name:"Hue 065.4\u00b0",color:"#e3f623",hue:65.446813,fine:true},
    {key:'spectrum_08',name:"Hue 070.5\u00b0",color:"#d1f623",hue:70.544789,fine:true},
    {key:'spectrum_09',name:"Hue 075.6\u00b0",color:"#bff623",hue:75.642765,fine:true},
    {key:'spectrum_10',name:"Hue 087.0\u00b0",color:"#97f623",hue:87.026144,fine:true},
    {key:'spectrum_11',name:"Hue 093.3\u00b0",color:"#81f623",hue:93.311547,fine:true},
    {key:'spectrum_12',name:"Hue 099.6\u00b0",color:"#6af623",hue:99.596950,fine:true},
    {key:'spectrum_13',name:"Hue 110.7\u00b0",color:"#44f623",hue:110.656927,fine:true},
    {key:'spectrum_14',name:"Hue 115.4\u00b0",color:"#33f623",hue:115.431502,fine:true},
    {key:'spectrum_15',name:"Hue 120.2\u00b0",color:"#23f623",hue:120.206076,fine:true},
    {key:'spectrum_16',name:"Hue 125.0\u00b0",color:"#23f634",hue:124.980650,fine:true},
    {key:'spectrum_17',name:"Hue 129.8\u00b0",color:"#23f645",hue:129.755224,fine:true},
    {key:'spectrum_18',name:"Hue 134.5\u00b0",color:"#23f656",hue:134.529799,fine:true},
    {key:'spectrum_19',name:"Hue 139.3\u00b0",color:"#23f667",hue:139.304373,fine:true},
    {key:'spectrum_20',name:"Hue 150.0\u00b0",color:"#23f68c",hue:150.019995,fine:true},
    {key:'spectrum_21',name:"Hue 156.0\u00b0",color:"#23f6a1",hue:155.961042,fine:true},
    {key:'spectrum_22',name:"Hue 161.9\u00b0",color:"#23f6b6",hue:161.902090,fine:true},
    {key:'spectrum_23',name:"Hue 171.8\u00b0",color:"#23f6d9",hue:171.846097,fine:true},
    {key:'spectrum_24',name:"Hue 179.7\u00b0",color:"#23f6f5",hue:179.737715,fine:true},
    {key:'spectrum_25',name:"Hue 187.4\u00b0",color:"#23dcf6",hue:187.397200,fine:true},
    {key:'spectrum_26',name:"Hue 191.2\u00b0",color:"#23cff6",hue:191.168026,fine:true},
    {key:'spectrum_27',name:"Hue 194.9\u00b0",color:"#23c1f6",hue:194.938851,fine:true},
    {key:'spectrum_28',name:"Hue 203.3\u00b0",color:"#23a4f6",hue:203.256857,fine:true},
    {key:'spectrum_29',name:"Hue 207.8\u00b0",color:"#2394f6",hue:207.804037,fine:true},
    {key:'spectrum_30',name:"Hue 212.4\u00b0",color:"#2384f6",hue:212.351216,fine:true},
    {key:'spectrum_31',name:"Hue 220.6\u00b0",color:"#2367f6",hue:220.555153,fine:true},
    {key:'spectrum_32',name:"Hue 224.2\u00b0",color:"#235af6",hue:224.211910,fine:true},
    {key:'spectrum_33',name:"Hue 227.9\u00b0",color:"#234df6",hue:227.868667,fine:true},
    {key:'spectrum_34',name:"Hue 236.0\u00b0",color:"#2331f6",hue:235.951760,fine:true},
    {key:'spectrum_35',name:"Hue 240.4\u00b0",color:"#2423f6",hue:240.378096,fine:true},
    {key:'spectrum_36',name:"Hue 244.8\u00b0",color:"#3423f6",hue:244.804433,fine:true},
    {key:'spectrum_37',name:"Hue 252.9\u00b0",color:"#5023f6",hue:252.942814,fine:true},
    {key:'spectrum_38',name:"Hue 256.7\u00b0",color:"#5d23f6",hue:256.654858,fine:true},
    {key:'spectrum_39',name:"Hue 260.4\u00b0",color:"#6a23f6",hue:260.366903,fine:true},
    {key:'spectrum_40',name:"Hue 268.1\u00b0",color:"#8523f6",hue:268.059211,fine:true},
    {key:'spectrum_41',name:"Hue 272.0\u00b0",color:"#9323f6",hue:272.039474,fine:true},
    {key:'spectrum_42',name:"Hue 276.0\u00b0",color:"#a123f6",hue:276.019737,fine:true},
    {key:'spectrum_43',name:"Hue 285.0\u00b0",color:"#c123f6",hue:285.000000,fine:true},
    {key:'spectrum_44',name:"Hue 290.0\u00b0",color:"#d323f6",hue:290.000000,fine:true},
    {key:'spectrum_45',name:"Hue 295.0\u00b0",color:"#e423f6",hue:295.000000,fine:true},
    {key:'spectrum_46',name:"Hue 306.1\u00b0",color:"#f623e0",hue:306.114650,fine:true},
    {key:'spectrum_47',name:"Hue 312.2\u00b0",color:"#f623cb",hue:312.229299,fine:true},
    {key:'spectrum_48',name:"Hue 318.3\u00b0",color:"#f623b5",hue:318.343949,fine:true},
    {key:'spectrum_49',name:"Hue 331.3\u00b0",color:"#f62388",hue:331.305386,fine:true},
    {key:'spectrum_50',name:"Hue 359.0\u00b0",color:"#f62326",hue:358.950535,fine:true}
];
const SPECIAL=[
    {key:'skin',name:'Skin Tones',color:'#c99571',hue:55,special:'skin'},
    {key:'earth',name:'Browns & Tans',color:'#95613f',hue:53,special:'earth'}
];
const ALL=[...BASE,...SPECIAL,...spectrum];
const HUE_TARGETS=[...BASE,...spectrum].sort((a,b)=>a.hue-b.hue);
const UI_TARGETS=[...HUE_TARGETS,...SPECIAL];
const byKey=Object.fromEntries(ALL.map((x,i)=>[x.key,{...x,index:i}]));
const api={BASE,SPECIAL,SPECTRUM:spectrum,ALL,HUE_TARGETS,UI_TARGETS,byKey,hueCount:HUE_TARGETS.length,total:ALL.length};
if(typeof module==='object'&&module.exports)module.exports=api;
globalThis.ZVColorPalette=api;
})();
