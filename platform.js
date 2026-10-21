// Капи-Ферма web platform layer: window.CapyWeb (used by Main.gd via JavaScriptBridge, only in the web export).
// Adapters: vk (VK Игры / OK via vk-bridge), fs (Фотострана iframe), web (plain browser: offline, no ads/pay).
// No secrets here: VK launch params (sign) and FS authKey=md5(appId_userId_SECRET) are verified by the server.
// Item keys/prices must match game_backend lb/vk_pay.py ITEMS["capyfarm"] and lb/fs_pay.py FS_ITEMS["capyfarm"].
(function(){
const W=window, tryf=(f,d)=>{try{return f()}catch(e){return d}};
const Q=tryf(()=>new URLSearchParams(location.search),new URLSearchParams(''));
const QS=location.search.slice(1);
let cb=null; const emit=(k,ok)=>{ try{ cb&&cb(k,!!ok); }catch(e){} };
const VB=W.vkBridge, isVK=!!(Q.get('vk_app_id')||Q.get('vk_platform'))&&!!VB;
const isFS=!isVK&&!!(Q.get('apiId')&&Q.get('viewerId')&&Q.get('authKey'));
const onOK=Q.get('vk_client')==='ok';
// Фотострана: audio unlock — track every AudioContext and resume it on any user gesture / when the tab is visible again
if(isFS){ const AC=W.AudioContext||W.webkitAudioContext, ctxs=[];
  if(AC){ W.__capyCtx=ctxs; const P=function(...a){ const c=new AC(...a); ctxs.push(c); return c; }; P.prototype=AC.prototype;
    tryf(()=>{ W.AudioContext=P; if(W.webkitAudioContext)W.webkitAudioContext=P; });
    const un=()=>ctxs.forEach(c=>{ if(c.state!=='running'&&c.state!=='closed') tryf(()=>c.resume().catch(()=>{})); });
    ['pointerdown','pointerup','mousedown','touchend','keydown','click'].forEach(e=>W.addEventListener(e,un,{capture:true,passive:true}));
    document.addEventListener('visibilitychange',()=>{ if(!document.hidden)un(); });
    W.addEventListener('focus',un); } }
// Фотострана iframe is 950x800: clamp the game viewport to it (Godot sizes the canvas from innerWidth/innerHeight), no page scroll
if(isFS){ const FH=800, FW=950;
  const ih=Object.getOwnPropertyDescriptor(W,'innerHeight'), iw=Object.getOwnPropertyDescriptor(W,'innerWidth');
  tryf(()=>{ Object.defineProperty(W,'innerHeight',{configurable:true,get:()=>Math.min(ih.get.call(W),FH)});
    Object.defineProperty(W,'innerWidth',{configurable:true,get:()=>Math.min(iw.get.call(W),FW)}); });
  const st=document.createElement('style');
  st.textContent='html,body{margin:0;padding:0;overflow:hidden!important;max-height:'+FH+'px;max-width:'+FW+'px}canvas{display:block}';
  document.head.appendChild(st); }
const VK_ITEMS=[['gc_3','3 золотые капи',5,'goldcapy'],['gc_10','10 золотых капи',15,'goldcapy'],['gc_25','25 золотых капи',30,'goldcapy']];
const OK_ITEMS=[['gc_3','3 золотые капи',35,'goldcapy'],['gc_10','10 золотых капи',100,'goldcapy'],['gc_25','25 золотых капи',200,'goldcapy']];
const FS_ITEMS=[['gc_3','3 золотые капи',35,'goldcapy',1],['gc_10','10 золотых капи',100,'goldcapy',2],['gc_25','25 золотых капи',200,'goldcapy',3],
  ['c_1500','1 500 монеток',15,'coin',4],['c_6000','6 000 монеток',50,'coin',5],['c_20000','20 000 монеток',120,'coin',6]];
const vsend=(m,p)=>{try{return VB.send(m,p||{}).catch(()=>null)}catch(e){return Promise.resolve(null)}};
let rw=false, bWant=false, bReady=false, bOn=false;
const vkCheck=()=>vsend('VKWebAppCheckNativeAds',{ad_format:'reward'}).then(r=>{rw=!!(r&&r.result)});
const bApply=()=>{ if(!isVK||!bReady||bWant===bOn)return; bOn=bWant;
  if(bOn)vsend('VKWebAppShowBannerAd',{banner_location:'bottom',layout_type:'resize',can_close:false}); else vsend('VKWebAppHideBannerAd'); };
// no banner right after launch: only after first tap or 30 s
const bGo=()=>{ if(bReady)return; bReady=true; bApply(); };
W.addEventListener('pointerdown',()=>setTimeout(bGo,1500),{once:true}); setTimeout(bGo,30000);
// --- Фотострана SDK (URL from GET fsapi, host whitelisted); FS_CFG {appId, clientKey(public)} from fs-config.js
let fsC=null, fsP=null; const fsPend=new Set();
const fsLoad=()=>fsP||(fsP=new Promise(res=>{
  const cfg=W.FS_CFG||{}; let u=null;
  try{ u=new URL(Q.get('fsapi')||''); if(u.protocol==='http:')u.protocol='https:'; }catch(e){}
  if(!u||!/(^|\.)(fotostrana\.ru|fsimg\.ru|fotocdn\.net)$/.test(u.hostname)||!cfg.clientKey) return res(null);
  const s=document.createElement('script'); s.src=u.href; s.async=true;
  s.onload=()=>{ try{ fsC=new W.fsapi(Q.get('apiId')||cfg.appId,cfg.clientKey); fsC.init(()=>{ fsPend.forEach(f=>f(false)); fsPend.clear(); }); res(fsC); }catch(e){ res(null); } };
  s.onerror=()=>res(null); document.head.appendChild(s);
}));
const IMG=(W.FS_CFG&&W.FS_CFG.imgBase)||'https://abuserfaq.github.io/capyfarm-vk/img/';
const appLink=isVK?('https://vk.com/app'+Q.get('vk_app_id')):'';
// server shop (signed /v2/config "shop": {vk|ok|fs:[{id,title,price,reward,fs_id?}]}, enabled items only)
let shop=null;
const items=()=>{
  const pl=isVK?(onOK?'ok':'vk'):(isFS?'fs':''), fb=isVK?(onOK?OK_ITEMS:VK_ITEMS):(isFS?FS_ITEMS:[]);
  const l=shop&&Array.isArray(shop[pl])?shop[pl]:null;
  if(!l)return fb;   // fallback only when config has no shop
  return l.filter(i=>i&&i.id&&+i.price>0).map(i=>[String(i.id),String(i.title||i.id),+i.price,(i.reward&&i.reward.coins)?'coin':'goldcapy',i.fs_id|0]);
};
W.CapyWeb={
  setCb:f=>{cb=f},
  setShop:j=>{ try{ shop=j?JSON.parse(j):null; }catch(e){ shop=null; } },
  platform:()=>isVK?(onOK?'ok':'vk'):(isFS?'fotostrana':'web'),
  // register payload for the server (s=""): it verifies the launch params, never a client secret
  reg:()=>JSON.stringify(isVK?{platform:onOK?'ok':'vk',vk:QS}:(isFS?{platform:'fotostrana',fs:QS}:{})),
  info:()=>JSON.stringify({id:W.CapyWeb.platform(), canPay:(isVK||isFS)&&items().length>0, canShare:isVK, canInvite:isVK,
    cur:isVK?(onOK?'ОК':'голосов'):(isFS?'ФМ':''), items:items()}),
  rwAvail:()=>isVK&&rw,
  showRw:()=>{ if(!isVK)return emit('ad',false);
    vsend('VKWebAppShowNativeAds',{ad_format:'reward'}).then(r=>{ emit('ad',!!(r&&r.result)); vkCheck(); }); },
  banner:on=>{ bWant=!!on; bApply(); },
  // no interstitials anywhere
  share:()=>{ if(isVK)vsend('VKWebAppShare',{link:appLink}); },
  invite:()=>{ if(isVK)vsend('VKWebAppShowInviteBox'); },
  pay:key=>{
    if(isVK) return vsend('VKWebAppShowOrderBox',{type:'item',item:key}).then(r=>emit('pay',r&&(r.success||r.status==='success')));
    if(isFS) return fsLoad().then(c=>{ const it=items().find(i=>i[0]===key); if(!c||!it)return emit('pay',false);
      const done=ok=>{ if(fsPend.delete(done))emit('pay',ok); }; fsPend.add(done);
      try{ c.event('buyItemCallback',r=>done(!!(r&&r.result==='success')),
        Object.assign({itemId:it[4],name:it[1],priceFmCents:Math.round(it[2]*100),amount:1,picUrl:IMG+it[3]+'.png'},
          ((W.FS_CFG&&W.FS_CFG.debugViewerIds)||[]).map(String).includes(String(Q.get('viewerId')))?{isDebug:1}:{})); }catch(e){ done(false); } });
    emit('pay',false);
  },
};
if(isVK) vsend('VKWebAppInit').then(vkCheck);
if(isFS){ fsLoad();
  // app permissions: ask for bit 32 once per session after the first click; a decline is remembered for 3 days
  const aps=parseInt(Q.get('apiSettings')||'0',10)||0; console.log('[fs] apiSettings',aps);
  const LK='capy_fs_perm32_ts', ago=+(tryf(()=>localStorage.getItem(LK),0)||0);
  if(!(aps&32)&&Date.now()-ago>3*864e5){ let asked=false;
    W.addEventListener('pointerdown',()=>{ if(asked)return; asked=true;
      fsLoad().then(c=>{ if(!c)return; tryf(()=>c.event('appSettings',r=>{ console.log('[fs] appSettings',r);
        const ok=r&&(r.result==='success'||((+r.settings||+r.apiSettings||0)&32)); if(!ok)tryf(()=>localStorage.setItem(LK,String(Date.now()))); },{request_permission:32})); }); },{capture:true}); }
  if(Q.get('hasNotifications')==='1') fsLoad().then(c=>{ if(c)tryf(()=>c.event('notifyPopup',r=>console.log('[fs] notifyPopup',r),{show:true,title:'Новые события'})); });
}
})();
