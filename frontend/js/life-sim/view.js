/* Host-independent reader: AI authors every chapter; only valid snapshots commit. */
(function(root){
  'use strict';
  function mount(container,config){
    const A=root.LifeSimAI,M=root.LifeSimMap,t=config.text;
    const key=config.storageKey||'between-lives.v2',lang=(config.lang||'zh').startsWith('en')?'en':'zh';
    let state=null,raw=null,notice='',busy=false,error='',operation=null,destroyed=false,controller=null;
    let details=null,confirmation=null,playing=false,timer=null,introBusy=false,introError=false,introController=null;
    let mapSelected=null,mapBox=null,drag=null,dragged=false,globe=null;
    const intros=new Map(),markup=new WeakMap();
    let viewRoot=null;
    const esc=v=>String(v==null?'':v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
    const button=(action,label,cls='',disabled=false)=>'<button type="button" data-life-action="'+esc(action)+'" class="'+cls+'"'+(disabled?' disabled':'')+'>'+esc(label)+'</button>';
    const icons={people:'M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75',world:'M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0M3 12h18M12 3a17 17 0 0 1 0 18 17 17 0 0 1 0-18',map:'m3 6 6-3 6 3 6-3v15l-6 3-6-3-6 3V6M9 3v15M15 6v15',wealth:'M3 5h16v4H3zM3 9v11h18V9H3m12 4h6v4h-6z',memories:'M12 8v4l3 2M3 12a9 9 0 1 0 3-6.7M3 3v6h6',settings:'M4 5h16M4 12h16M4 19h16M8 3v4M16 10v4M10 17v4',close:'m6 6 12 12M18 6 6 18'};
    const icon=k=>'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">'+'<path d="'+icons[k]+'"/>'+'</svg>';
    const money=v=>new Intl.NumberFormat(config.lang||'zh-CN').format(v)+' '+t.lifePoints;
    const shell=()=>state?{world:state.world,origin:state.world.origin,region:state.world.places[state.chapter.locationIndex].id}:null;
    const place=id=>{const p=state.world.places.find(p=>p.id===id);return p?(lang==='en'?p.pathEn:p.path):'';};
    const current=()=>shell().region;
    try{
      raw=config.storage.getItem(key);
      if(raw){const value=JSON.parse(raw);if(A.valid(value))state=value;else notice=t.invalid;}
    }catch(_){notice=raw?t.invalid:t.saveError;}
    function save(next){
      state=next;
      try{const json=JSON.stringify(state);config.storage.setItem(key,json);raw=json;notice='';}
      catch(_){notice=t.saveError;}
    }
    function pause(){playing=false;clearTimeout(timer);timer=null;}
    function schedule(){clearTimeout(timer);if(playing&&state?.started&&!busy&&!error&&!details&&!confirmation&&state?.chapter.alive&&!document.hidden)timer=setTimeout(nextChapter,6500);}
    function loading(){return '<div class="life-loading" role="status" aria-live="polite"><span class="life-spinner" aria-hidden="true"></span><p>'+esc(t.timeLoading)+'</p></div>';}
    function story(){
      if(busy&&operation?.kind==='start')return birthScene();
      if(error&&(!state||operation?.kind==='start'))return '<section class="life-reading life-failure" role="alert"><h2>'+esc(t.aiFailedTitle)+'</h2><p>'+esc(t.aiRequiredError)+'</p>'+button('retry',t.retry,'life-primary')+(state?button('return',t.aiReturn):'')+'</section>';
      if(!state)return '<section class="life-reading life-welcome"><span class="life-kicker">'+esc(t.aiWelcomeKicker)+'</span><h1>'+esc(t.tagline)+'</h1><p>'+esc(t.aiWelcome)+'</p>'+button('begin',t.begin,'life-primary',!!raw)+'<small>'+esc(t.aiWelcomePrivacy)+'</small></section>';
      if(!state.started)return welcome();
      const c=state.chapter;
      return '<main class="life-reading"><div class="life-identity"><span class="life-year">'+c.age+'<small>'+esc(t.age)+'</small></span><div><strong>'+esc(c.name)+'</strong><button type="button" class="life-location" data-life-action="details:map">'+esc(place(current()))+' ↗</button></div></div><span class="life-kicker">'+(2026+c.age)+' · '+esc(t.moods[c.mood])+'</span><h1 id="life-moment" tabindex="-1">'+esc(c.title)+'</h1><p class="life-story-text">'+esc(c.body)+'</p><div class="life-reading-actions">'+button(error?'retry':c.alive?'next':'memories',busy?t.timeLoading:error?t.retry:c.alive?t.continueLife:t.memories,'life-primary'+(busy?' is-loading':''),busy)+'</div>'+(error?'<p class="life-inline-error" role="alert">'+esc(t.aiRequiredError)+'</p>':'')+'<small class="life-reading-status" role="status">'+esc(busy?t.aiWaitingHint:playing?t.aiAutoHint:c.alive?t.aiChapterHint:t.endText)+'</small></main>';
    }
    function welcome(){
      const c=state.chapter,value=intros.get(current())||(state.introduction?.regionId===current()?state.introduction:null);
      if(!mapBox)mapBox=M.locate(current(),shell());
      const country=lang==='en'?state.world.country.name:state.world.country.cname;
      return '<main class="life-arrival"><header class="life-arrival-heading"><span class="life-kicker">'+esc(t.welcomeEyebrow)+'</span><h1>'+esc(t.welcomeAs)+' <em>'+esc(c.name)+'</em></h1><p>'+esc(place(current()))+'<span>2026 · 0 '+esc(t.age)+'</span></p></header><section class="life-arrival-place"><div class="life-section-heading"><h2>'+esc(country)+'</h2><p>'+esc(t.welcomeCountryHint)+'</p></div>'+(value?'<div class="life-country-guide">'+['economy','ranking','environment','tourism'].map(k=>'<article><span>'+icon(k==='economy'?'wealth':k==='ranking'?'memories':k==='environment'?'world':'map')+'</span><h3>'+esc(t.countryGuideLabels[k])+'</h3><p>'+esc(value.country[k])+'</p></article>').join('')+'</div><div class="life-arrival-local"><h3>'+esc(value.title)+'</h3><p class="life-story-text">'+esc(value.body)+'</p></div><small class="life-muted">'+esc(t.welcomeGuideNote)+'</small>':introError?'<div class="life-arrival-error" role="alert"><p>'+esc(t.aiIntroError)+'</p>'+button('intro-retry',t.retry)+'</div>':loading())+'</section><section class="life-arrival-family"><div class="life-section-heading"><h2>'+esc(t.welcomeFamily)+'</h2><p>'+esc(t.welcomeFamilyHint)+'</p></div>'+people()+'<div class="life-arrival-money"><span>'+esc(c.finances.owner==='household'?t.aiHousehold:t.aiPersonal)+'</span><strong>'+esc(t.cash)+' · '+esc(money(c.finances.cash))+'</strong><small>'+esc(t.aiMoneyNote)+'</small></div></section><section class="life-arrival-geography"><div class="life-section-heading"><h2>'+esc(t.welcomeMap)+'</h2><p>'+esc(place(current()))+'</p></div><div class="life-map-frame">'+M.svg(mapBox,current(),shell(),t,esc,place)+'</div><p class="life-muted">'+esc(t.countryReferenceNote)+'</p>'+realEnvironment(current())+'<small class="life-muted">'+esc(t.mapAttribution)+' <a href="https://www.naturalearthdata.com/about/terms-of-use/" target="_blank" rel="noopener noreferrer">Natural Earth</a></small></section><footer class="life-arrival-start"><div><strong>'+esc(t.welcomeReady)+'</strong><small>'+esc(value?t.welcomeStartHint:introError?t.aiIntroError:t.timeLoading)+'</small></div>'+button('enter',value?t.welcomeEnter:t.timeLoading,'life-primary',!value)+'</footer></main>';
    }
    function birthScene(){return '<section class="life-birth" aria-label="'+esc(t.birthJourney)+'"><div class="life-birth-heading"><span class="life-kicker">'+esc(t.birthEyebrow)+'</span><h1>'+esc(t.birthJourney)+'</h1><p>'+esc(t.birthJourneyHint)+'</p></div><div class="life-globe-stage" aria-hidden="true"><i class="life-orbit-ring"></i><i class="life-orbit-ring second"></i><canvas class="life-birth-canvas"></canvas></div><div class="life-birth-status" role="status" aria-live="polite"><span class="life-birth-pulse"></span><p>'+esc(t.timeLoading)+'</p></div><div class="life-birth-destination" hidden><span>'+esc(t.birthFound)+'</span><strong></strong><small>'+esc(t.birthReference)+'</small></div></section>';}
    function people(){return '<div class="life-people">'+state.chapter.people.map(p=>'<article class="life-person'+(!p.alive?' is-departed':'')+'"><div class="life-person-top"><span class="life-avatar" aria-hidden="true">'+esc(Array.from(p.name)[0])+'</span><div><h3>'+esc(p.name)+'</h3><span class="life-relation">'+esc(p.relation)+'</span></div><small class="life-person-age">'+p.age+' '+esc(t.age)+(p.alive?'':' · '+esc(t.departed))+'</small></div><p class="life-person-note">'+esc(p.note)+'</p><div class="life-closeness"><span>'+esc(t.bond)+'</span><span>'+p.closeness+'<small> / 100</small></span><meter min="0" max="100" value="'+p.closeness+'" aria-label="'+esc(t.bond)+'"></meter></div></article>').join('')+'</div>';}
    function wealth(){
      const f=state.chapter.finances;
      return '<p class="life-muted">'+esc(f.owner==='household'?t.aiHousehold:t.aiPersonal)+'</p><div class="life-money-grid">'+['cash','debt','property','income','expenses'].map(k=>'<div><small>'+esc(t[k])+'</small><strong>'+esc(money(f[k]))+'</strong></div>').join('')+'</div><p class="life-muted">'+esc(t.aiMoneyNote)+'</p><ol class="life-timeline">'+state.history.slice().reverse().map(h=>'<li><span>'+h.age+' '+esc(t.age)+'</span><p>'+esc(t.cash)+': '+esc(money(h.finances.cash))+' · '+esc(t.debt)+': '+esc(money(h.finances.debt))+'</p></li>').join('')+'</ol>';
    }
    function memories(){return '<ol class="life-timeline">'+state.history.slice().reverse().map(h=>'<li><span>'+h.age+' '+esc(t.age)+'</span><h3>'+esc(h.title)+'</h3><p class="life-story-text">'+esc(h.body)+'</p></li>').join('')+'</ol>';}
    function realEnvironment(id){
      const links=M.realMaps(id,place(id),shell());
      const anchor=(url,label)=>'<a class="life-real-link" href="'+esc(url)+'" target="_blank" rel="noopener noreferrer">'+esc(label)+' ↗</a>';
      return '<section class="life-real-world"><h3>'+esc(t.mapProviders[links.provider])+' · '+esc(place(id))+'</h3><p>'+esc(t.realMapHints[links.provider])+'</p><div class="life-real-actions">'+anchor(links.map,t.openRealMap)+(links.satellite?anchor(links.satellite,t.openSatellite)+anchor(links.streetView,t.openStreetView):'')+'</div><small class="life-muted">'+esc(t.realMapNote)+'</small></section>';
    }
    function world(){
      const value=intros.get(current())||(state.introduction?.regionId===current()?state.introduction:null);
      return '<h3>'+esc(place(current()))+'</h3>'+(value?'<h3>'+esc(value.title)+'</h3><p class="life-story-text">'+esc(value.body)+'</p>':introError?'<p role="alert">'+esc(t.aiIntroError)+'</p>'+button('intro-retry',t.retry):loading())+realEnvironment(current())+'<p class="life-muted">'+esc(t.aiCaution)+'</p>';
    }
    async function requestIntro(){
      if(!state||introBusy||intros.has(current())||state.introduction?.regionId===current())return;
      const id=current(),p=state.world.places.find(p=>p.id===id);
      introBusy=true;introError=false;introController=new AbortController();const control=introController;
      const timeout=setTimeout(()=>control.abort(),40000);
      try{
        if(!config.services?.ai)throw new Error('unavailable');
        const value=await config.services.ai({kind:'intro',lang,location:{mode:p.mode,codes:p.codes}},control.signal);
        if(!A.intro({...value,regionId:id},state.world))throw new Error('invalid');
        if(!destroyed){intros.set(id,value);if(current()===id&&!state.started)save({...state,introduction:{...value,regionId:id}});}
      }catch(_){if(!destroyed)introError=true;}
      finally{clearTimeout(timeout);introBusy=false;if(!destroyed&&(details==='world'||state&&!state.started)){if(state&&current()!==id)requestIntro();render();}}
    }
    function map(){
      const s=shell(),id=mapSelected||s.region;
      if(!mapBox)mapBox=M.locate(id,s);
      return '<div class="life-map-toolbar">'+button('map:'+s.region,t.locateCurrent)+button('map:'+s.origin,t.locateOrigin)+button('map-world',t.worldView)+button('map-zoom:in',t.zoomIn)+button('map-zoom:out',t.zoomOut)+'</div><div class="life-map-frame">'+M.svg(mapBox,id,s,t,esc,place)+'</div><div class="life-map-places">'+state.world.places.map(p=>button('map:'+p.id,place(p.id))).join('')+'</div><p class="life-muted">'+esc(t.countryReferenceNote)+'</p>'+realEnvironment(id)+'<p class="life-muted">'+esc(t.mapAttribution)+' <a href="https://www.naturalearthdata.com/about/terms-of-use/" target="_blank" rel="noopener noreferrer">Natural Earth</a></p>';
    }
    function settings(){return (state?'<dl class="life-world-list">'+[['health',state.chapter.health],['happiness',state.chapter.happiness],['job',state.chapter.occupation],['school',state.chapter.education],['origin',place(state.world.origin)]].map(([k,v])=>'<div><dt>'+esc(t[k])+'</dt><dd>'+esc(v)+'</dd></div>').join('')+'</dl>':'')+'<div class="life-settings-actions">'+(state?.started&&state.chapter.alive?button('play',playing?t.pauseLife:t.playLife,'',busy):'')+button('export',t.export,'',!state&&!raw)+button('import',t.import,'',busy)+button('new',t.new,'',busy)+'</div><details class="life-policy"><summary>'+esc(t.aiAbout)+'</summary><p>'+esc(t.aiPrivacy)+'</p><p>'+esc(t.aiCaution)+'</p><p>'+esc(t.catalogSource)+'</p></details>';}
    function sheet(){
      const tabs=state?['people','world','map','wealth','memories','settings']:['settings'],c=state?.chapter;
      const profile=c?'<span class="life-dossier-avatar" aria-hidden="true">'+esc(Array.from(c.name)[0])+'</span><div class="life-dossier-identity"><span class="life-kicker">'+esc(t.aiDossier)+'</span><h2 id="life-sheet-title">'+esc(c.name)+'<small>'+c.age+' '+esc(t.age)+'</small></h2><p>'+esc(place(current()))+'</p></div>':'<div class="life-dossier-identity"><h2 id="life-sheet-title">'+esc(t.aiDetails)+'</h2></div>';
      const subtitle=details==='world'||details==='map'?state&&place(current()):(t.detailDescriptions||{})[details]||'';
      return {header:profile+'<button type="button" class="life-sheet-close" data-life-action="close" aria-label="'+esc(t.aiClose)+'">'+icon('close')+'</button>',nav:tabs.map(k=>'<button type="button" data-life-action="details:'+k+'">'+icon(k)+'<span>'+esc(t[k]||t.aiSettings)+'</span></button>').join(''),content:'<div class="life-section-heading"><h3>'+esc(t[details]||t.aiSettings)+'</h3><p>'+esc(subtitle)+'</p></div>'+(confirmation?'<section class="life-sheet-confirm" role="alert"><p>'+esc(confirmation==='new'?t.confirm:t.replace)+'</p>'+button('confirm',t.yes,'life-primary')+button('cancel',t.cancel)+'</section>':({people,world,map,wealth,memories,settings}[details])())};
    }
    function replaceHTML(node,value){
      if(markup.get(node)===value)return false;
      node.innerHTML=value;markup.set(node,value);return true;
    }
    function render(){
      if(destroyed)return;
      const active=container.querySelector(':focus'),focused=active?.getAttribute('data-life-action');
      if(!viewRoot){
        container.innerHTML='<div class="life-sim life-reader"><header class="life-toolbar"></header><div class="life-notices"></div><div class="life-main"></div><input id="life-import" type="file" accept="application/json,.json" hidden aria-label="'+esc(t.import)+'"></div>';
        viewRoot=container.firstElementChild;
      }
      viewRoot.dataset.mood=state?state.chapter.mood:'neutral';
      replaceHTML(viewRoot.querySelector('.life-toolbar'),'<strong>'+esc(t.brand)+'</strong>'+button('details:'+(state?'people':'settings'),t.aiDetails,'',busy&&operation?.kind==='start'));
      replaceHTML(viewRoot.querySelector('.life-notices'),notice?'<p class="life-notice" role="status">'+esc(notice)+(raw&&!state?' '+button('details:settings',t.aiRecover):'')+'</p>':'');
      if(replaceHTML(viewRoot.querySelector('.life-main'),story())){
        globe?.destroy();globe=null;
        const canvas=viewRoot.querySelector('.life-birth-canvas');if(canvas)globe=root.LifeSimGlobe.mount(canvas);
      }
      const nextButton=viewRoot.querySelector('.life-reading-actions button');if(nextButton)nextButton.setAttribute('aria-busy',String(busy));
      let dialog=viewRoot.querySelector('dialog');
      if(details){
        // Keep the connected modal and navigation; replacing them replays the opening animation.
        if(!dialog){
          dialog=document.createElement('dialog');dialog.className='life-sheet';dialog.setAttribute('aria-labelledby','life-sheet-title');
          dialog.innerHTML='<header></header><div class="life-sheet-body"><nav aria-label="'+esc(t.aiDetails)+'"></nav><div class="life-sheet-content"></div></div>';
          dialog.addEventListener('cancel',event=>{event.preventDefault();close();});viewRoot.appendChild(dialog);
        }
        const parts=sheet(),content=dialog.querySelector('.life-sheet-content'),scroll=content.scrollTop;
        replaceHTML(dialog.querySelector('header'),parts.header);replaceHTML(dialog.querySelector('nav'),parts.nav);
        dialog.querySelectorAll('nav [data-life-action]').forEach(el=>{if(el.dataset.lifeAction==='details:'+details)el.setAttribute('aria-current','page');else el.removeAttribute('aria-current');});
        if(replaceHTML(content,parts.content))content.scrollTop=scroll;
        if(!dialog.open)dialog.showModal();
      }else if(dialog?.open)dialog.close();
      if(focused&&!active.isConnected){
        const scope=dialog?.open?dialog:viewRoot,target=Array.from(scope.querySelectorAll('[data-life-action]')).find(el=>el.dataset.lifeAction===focused);
        (target||dialog?.querySelector('nav [aria-current]'))?.focus({preventScroll:true});
      }
      schedule();
    }
    function close(){details=null;confirmation=null;render();container.querySelector('.life-toolbar button')?.focus({preventScroll:true});}
    async function run(){
      if(busy||!operation||destroyed)return;
      busy=true;error='';render();controller=new AbortController();const control=controller,task=operation;
      const timeout=setTimeout(()=>control.abort(),40000);
      try{
        if(!config.services?.chapter)throw new Error('unavailable');
        if(!task.world){task.world=await config.services.birth(task.seed);if(!A.validWorld(task.world))throw new Error('birth');}
        if(control.signal.aborted)throw new Error('aborted');
        task.payload=task.payload||A.request(task.previous,task.kind,task.world,task.seed,lang);
        const value=await config.services.chapter(task.payload,control.signal);
        if(destroyed)return;
        if(control.signal.aborted)throw new Error('aborted');
        const next=A.commit(task.previous,value,task.kind,task.world,task.seed,lang);
        clearTimeout(timeout);
        if(task.kind==='start'&&globe){
          const destination=next.world.places[next.chapter.locationIndex],label=lang==='en'?destination.pathEn:destination.path;
          const scene=container.querySelector('.life-birth');scene?.setAttribute('data-arriving','true');
          const destinationEl=container.querySelector('.life-birth-destination');
          if(destinationEl){destinationEl.hidden=false;destinationEl.querySelector('strong').textContent=label;destinationEl.querySelector('small').textContent=Number.isFinite(destination.lon)&&Number.isFinite(destination.lat)?t.birthReference:t.coordinatesMissing;}
          const status=container.querySelector('.life-birth-status p');if(status)status.textContent=t.birthArriving;
          await globe.land(destination);
          if(destroyed)return;
        }
        save(next);operation=null;mapSelected=null;mapBox=null;if(task.kind==='start')intros.clear();
        if(details==='world'||!state.started)requestIntro();
        if(!state.chapter.alive)pause();
      }catch(_){if(!destroyed){error='failed';pause();}}
      finally{clearTimeout(timeout);if(!destroyed){busy=false;controller=null;render();if(!error)container.querySelector('#life-moment')?.focus({preventScroll:true});}}
    }
    function begin(){pause();details=null;confirmation=null;const seed=new Uint32Array(1);crypto.getRandomValues(seed);operation={kind:'start',seed:seed[0],world:null,previous:null};run();container.scrollIntoView({block:'start',behavior:'instant'});}
    function nextChapter(){if(!state?.started||!state.chapter.alive||busy||error)return;operation={kind:'next',seed:state.seed,world:state.world,previous:state};run();}
    function exportSave(){
      const blob=new Blob([state?JSON.stringify(state):raw],{type:'application/json'}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download='between-lives-save.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
    }
    function click(event){
      if(event.target===container.querySelector('dialog')){close();return;}
      const el=event.target.closest('[data-life-action]');if(!el||!container.contains(el)||el.disabled)return;
      const action=el.dataset.lifeAction,index=action.indexOf(':'),a=index<0?action:action.slice(0,index),id=index<0?'':action.slice(index+1);
      if(a==='enter'){if(!busy&&state?.introduction){save(A.enter(state));render();container.querySelector('#life-moment')?.focus({preventScroll:true});container.scrollIntoView({block:'start',behavior:'instant'});}return;}if(a==='begin'){begin();return;}if(a==='next'){nextChapter();return;}if(a==='retry'){run();return;}
      if(a==='return'){error='';operation=null;}
      else if(a==='details'){clearTimeout(timer);details=id;confirmation=null;const panel=container.querySelector('.life-sheet-content');if(panel)panel.scrollTop=0;if(id==='world')requestIntro();}
      else if(a==='memories'){details='memories';}
      else if(a==='close'){close();return;}
      else if(a==='intro-retry'){requestIntro();}
      else if(a==='map'){
        if(dragged&&el.classList.contains('life-map-pin')){dragged=false;return;}
        if(!M.allLocations(shell())[id])return;mapSelected=id;mapBox=M.locate(id,shell());if(!details)details='map';
      }else if(a==='map-world')mapBox=M.bounds(0,0,960);
      else if(a==='map-zoom')mapBox=M.zoom(mapBox,id==='in'?.65:1/.65);
      else if(a==='play'){playing=!playing;close();return;}
      else if(a==='export'){exportSave();return;}
      else if(a==='import'){pause();container.querySelector('#life-import').click();return;}
      else if(a==='new'){pause();confirmation='new';}
      else if(a==='cancel')confirmation=null;
      else if(a==='confirm'){
        if(confirmation==='new'){begin();return;}
        if(confirmation){save(confirmation);details=null;confirmation=null;error='';operation=null;mapSelected=null;mapBox=null;intros.clear();if(!state.started&&!state.introduction)requestIntro();}
      }
      render();
    }
    async function change(event){
      if(event.target.id!=='life-import')return;const file=event.target.files[0];event.target.value='';if(!file)return;
      try{if(file.size>2000000)throw new Error('size');const value=JSON.parse(await file.text());if(destroyed)return;if(!A.valid(value))throw new Error('format');if(state||raw){confirmation=value;details='settings';}else save(value);}
      catch(_){notice=t.importError;}render();if(state&&!state.started&&!state.introduction)requestIntro();
    }
    function updateMap(){(container.querySelector('dialog[open] .life-map-svg')||container.querySelector('.life-main .life-map-svg'))?.setAttribute('viewBox',[mapBox.x,mapBox.y,mapBox.width,mapBox.height].join(' '));}
    function pointerDown(e){const svg=e.target.closest('.life-map-svg');if(!svg||e.button!==0)return;dragged=false;drag={svg,id:e.pointerId,x:e.clientX,y:e.clientY,box:mapBox,width:svg.getBoundingClientRect().width};}
    function pointerMove(e){if(!drag||drag.id!==e.pointerId)return;const dx=e.clientX-drag.x,dy=e.clientY-drag.y;if(Math.hypot(dx,dy)<5)return;dragged=true;drag.svg.setPointerCapture(e.pointerId);mapBox=M.pan(drag.box,-dx*drag.box.width/drag.width,-dy*drag.box.width/drag.width);updateMap();}
    function pointerUp(){drag=null;}
    function keyDown(e){
      const pin=e.target.closest('.life-map-pin');if(pin&&['Enter',' '].includes(e.key)){e.preventDefault();dragged=false;click({target:pin});return;}
      if(!e.target.matches('.life-map-svg'))return;
      const shift={ArrowLeft:[-.15,0],ArrowRight:[.15,0],ArrowUp:[0,-.15],ArrowDown:[0,.15]}[e.key];
      if(shift){e.preventDefault();mapBox=M.pan(mapBox,mapBox.width*shift[0],mapBox.width*shift[1]);updateMap();}
    }
    function visibility(){if(document.hidden){pause();}else schedule();}
    const listeners={click,change,pointerdown:pointerDown,pointermove:pointerMove,pointerup:pointerUp,pointercancel:pointerUp,keydown:keyDown};
    Object.entries(listeners).forEach(([name,fn])=>container.addEventListener(name,fn));document.addEventListener('visibilitychange',visibility);render();if(state&&!state.started&&!state.introduction)requestIntro();
    return {destroy(){destroyed=true;pause();globe?.destroy();controller?.abort();introController?.abort();container.querySelector('dialog')?.close();Object.entries(listeners).forEach(([name,fn])=>container.removeEventListener(name,fn));document.removeEventListener('visibilitychange',visibility);}};
  }
  root.LifeSimView={mount};
})(typeof globalThis!=='undefined'?globalThis:this);
