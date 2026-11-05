/* Run against start.sh with PLAYWRIGHT_CORE_PATH pointing to an installed playwright-core. */
'use strict';
const {chromium}=require(process.env.PLAYWRIGHT_CORE_PATH||'playwright-core');
const assert=require('node:assert/strict');
const A=require('./ai-engine.js');
const origin=process.env.LIFE_SIM_TEST_URL||'http://127.0.0.1:8731';
const world={country:{code:'CHN',name:'China',cname:'中国'},origin:'china:43:4301',places:[
 {id:'china:43:4301',mode:'china',codes:['43','4301'],country:'CHN',path:'中国 / 湖南 / 长沙',pathEn:'China / Hunan / Changsha',level:'locality',precision:'country',lat:35,lon:104},
 {id:'china:43:4305',mode:'china',codes:['43','4305'],country:'CHN',path:'中国 / 湖南 / 邵阳',pathEn:'China / Hunan / Shaoyang',level:'locality',precision:'country',lat:35,lon:104}
]};
const guide={title:'Local life',body:'A fictional test guide.\n\n'.repeat(60),country:{economy:'Test context.',ranking:'No ranking in this test fixture.',environment:'Test context.',tourism:'Test context.'}};
const chapter={name:'Ari',age:0,alive:true,mood:'positive',health:80,happiness:70,occupation:'Child',education:'Not yet at school',locationIndex:0,
 finances:{owner:'household',cash:1000,debt:0,property:0,income:2000,expenses:1800},
 people:Array.from({length:4},(_,i)=>({id:'family_'+i,name:'Relative '+i,relation:'Family',age:25+i,alive:true,closeness:80,note:'A shared memory.'})),title:'A beginning',body:'A fictional chapter.',summary:'Living with family.'};
let initial=A.commit(null,chapter,'start',world,7,'en');initial.introduction={...guide,regionId:world.origin};initial=A.enter(initial);
const moved=structuredClone(chapter);moved.age=3;moved.locationIndex=1;moved.people.forEach(p=>p.age+=3);initial=A.commit(initial,moved,'next');
(async()=>{
 const browser=await chromium.launch({headless:true}),results=[];
 try{
  for(const lang of ['zh','en'])for(const theme of ['light','dark'])for(const width of [1440,390]){
   const context=await browser.newContext({viewport:{width,height:900}}),page=await context.newPage(),errors=[],external=[];
   let releaseIntro,releaseChapter;
   const introGate=new Promise(resolve=>releaseIntro=resolve),chapterGate=new Promise(resolve=>releaseChapter=resolve);
   page.on('pageerror',error=>errors.push(error.message));page.on('console',msg=>{if(msg.type()==='error')errors.push(msg.text());});
   await context.route('**/*',route=>route.request().url().startsWith(origin+'/')?route.continue():(external.push(route.request().url()),route.abort()));
   await context.route('**/api/visits*',route=>route.fulfill({json:{count:0,skipped:true}}));
   await context.route('**/api/life-sim/ai',async route=>{await introGate;await route.fulfill({json:{ok:true,data:guide}});});
   await context.route('**/api/life-sim/chapter',async route=>{
    const current=route.request().postDataJSON().context,next={...current,age:current.age+2,people:current.people.map(p=>({...p,age:p.age+2})),title:'A later chapter',body:'The next scene.',summary:'Another memory.'};
    await chapterGate;await route.fulfill({json:{ok:true,data:next}});
   });
   await page.addInitScript(({initial,lang,theme})=>{
    localStorage.setItem('between-lives.v2',JSON.stringify(initial));localStorage.setItem('devtools_theme',theme);localStorage.setItem('devtools_lang',lang==='zh'?'zh-CN':'en');
    window.modalAudit={shows:0,animations:0};const show=HTMLDialogElement.prototype.showModal;
    HTMLDialogElement.prototype.showModal=function(){if(this.matches('.life-sheet'))window.modalAudit.shows++;return show.call(this);};
    document.addEventListener('animationstart',event=>{if(event.target.matches('.life-sheet'))window.modalAudit.animations++;});
   },{initial,lang,theme});
   await page.goto(origin+'/'+lang+'/tool/life-sim');await page.locator('[data-life-action="next"]').waitFor();await page.locator('.life-toolbar button').click();await page.locator('dialog[open]').waitFor();await page.waitForTimeout(280);
   await page.evaluate(()=>{window.modalAudit.dialog=document.querySelector('dialog');window.modalAudit.nav=document.querySelector('dialog nav');window.modalAudit.buttons=Array.from(document.querySelectorAll('dialog nav button'));});
   async function stable(shows=1){
    const audit=await page.evaluate(()=>({same:document.querySelector('dialog')===window.modalAudit.dialog,connected:window.modalAudit.dialog.isConnected,open:window.modalAudit.dialog.open,nav:document.querySelector('dialog nav')===window.modalAudit.nav,buttons:window.modalAudit.buttons.every(button=>button.isConnected),shows:window.modalAudit.shows,animations:window.modalAudit.animations}));
    assert.deepEqual(audit,{same:true,connected:true,open:true,nav:true,buttons:true,shows,animations:shows});
   }
   for(const section of ['wealth','memories','settings','people','map']){await page.locator('dialog [data-life-action="details:'+section+'"]').click();await stable();assert.equal(await page.locator('dialog nav [aria-current]').getAttribute('data-life-action'),'details:'+section);}
   for(const action of ['map-world','map-zoom:in','map-zoom:out','map:'+world.origin]){await page.locator('dialog [data-life-action="'+action+'"]').first().click();await stable();}
   await page.locator('dialog [data-life-action="details:world"]').click();await page.locator('dialog .life-loading').waitFor();await page.waitForTimeout(80);
   await page.locator('.life-sheet-content').evaluate(el=>el.scrollTop=70);const scroll=await page.locator('.life-sheet-content').evaluate(el=>el.scrollTop);releaseIntro();await page.locator('dialog .life-story-text').waitFor();await stable();assert.equal(await page.locator('.life-sheet-content').evaluate(el=>el.scrollTop),scroll);
   assert.equal(await page.evaluate(()=>document.activeElement?.getAttribute('data-life-action')),'details:world');
   await page.locator('dialog [data-life-action="details:settings"]').click();await page.locator('.life-policy summary').click();assert(await page.locator('.life-policy').getAttribute('open')!==null);await stable();
   await page.locator('[data-life-action="new"]').click();await stable();await page.locator('[data-life-action="cancel"]').click();await stable();
   // The persistent input must allow the same file to be chosen again after cancellation.
   for(let i=0;i<2;i++){await page.locator('#life-import').setInputFiles({name:'same-save.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(initial))});await page.locator('[data-life-action="confirm"]').waitFor();await stable();await page.locator('[data-life-action="cancel"]').click();}
   await page.keyboard.press('Escape');assert.equal(await page.locator('dialog').getAttribute('open'),null);assert.equal(await page.evaluate(()=>document.activeElement===document.querySelector('.life-toolbar button')),true);
   await page.locator('.life-toolbar button').click();await page.waitForTimeout(280);await stable(2);await page.locator('[data-life-action="close"]').click();
   await page.locator('[data-life-action="next"]').click();await page.locator('.life-toolbar button').click();await page.waitForTimeout(280);await stable(3);releaseChapter();await page.waitForFunction(()=>JSON.parse(localStorage.getItem('between-lives.v2')).chapter.age===5);await stable(3);
   assert.equal(await page.locator('dialog .life-dossier-identity h2 small').textContent(),'5 '+(lang==='zh'?'岁':'years old'));
   assert(A.valid(await page.evaluate(()=>JSON.parse(localStorage.getItem('between-lives.v2')))));
   assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);assert.deepEqual(errors,[]);assert.deepEqual(external,[]);
   results.push({lang,theme,width,persistentModal:true,stableNav:true,animationOnlyOnOpen:true,asyncUpdate:true,focusAndScroll:true,reimport:true});await context.close();
  }
  console.log(JSON.stringify(results));
 }finally{await browser.close();}
})().catch(error=>{console.error(error);process.exit(1);});
