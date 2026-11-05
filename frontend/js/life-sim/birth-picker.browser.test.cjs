/* Uses real local geography endpoints and mocked AI only. Run after start.sh. */
'use strict';
const {chromium}=require(process.env.PLAYWRIGHT_CORE_PATH||'playwright-core');
const assert=require('node:assert/strict');
const A=require('./ai-engine.js');
const origin=(process.env.LIFE_SIM_TEST_URL||'http://127.0.0.1:8731').replace(/\/$/,'');
const chapter={name:'Ari',age:0,alive:true,mood:'positive',health:85,happiness:70,occupation:'Child',education:'Not at school',locationIndex:0,finances:{owner:'household',cash:1000,debt:0,property:0,income:2000,expenses:1800},people:[{id:'mother',name:'Robin',relation:'Mother',age:28,alive:true,closeness:90,note:'A family memory.'}],title:'A new life',body:'A fictional birth scene.',summary:'Born into a family.'};
const guide={title:'Local life',body:'A local-life test fixture.',country:{economy:'Economic context.',ranking:'No ranking in this test fixture.',environment:'Environmental context.',tourism:'Cultural context.'}};
(async()=>{
 const browser=await chromium.launch({headless:true}),results=[];
 try{
  for(const lang of ['zh','en'])for(const theme of ['light','dark'])for(const width of [1440,390]){
   const context=await browser.newContext({viewport:{width,height:900},reducedMotion:'reduce'}),page=await context.newPage(),errors=[],external=[],births=[],chapters=[];
   let badChapter=false,failBirth=false;
   page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error'&&!m.text().includes('503 (Service Unavailable)'))errors.push(m.text());});
   await context.route('**/*',r=>r.request().url().startsWith(origin+'/')?r.continue():(external.push(r.request().url()),r.abort()));
   await context.route('**/api/visits*',r=>r.fulfill({json:{count:0,skipped:true}}));
   await context.route('**/api/life-sim/birth?*',r=>{births.push(new URL(r.request().url()));if(failBirth){failBirth=false;return r.fulfill({status:503,json:{ok:false,error:'unavailable'}});}return r.continue();});
   await context.route('**/api/life-sim/chapter',r=>{chapters.push(r.request().postDataJSON());const data={...chapter,locationIndex:badChapter?1:0};badChapter=false;return r.fulfill({json:{ok:true,data}});});
   await context.route('**/api/life-sim/ai',r=>r.fulfill({json:{ok:true,data:guide}}));
   await page.addInitScript(({lang,theme})=>{localStorage.setItem('devtools_lang',lang==='zh'?'zh-CN':'en');localStorage.setItem('devtools_theme',theme);},{lang,theme});
   await page.goto(origin+'/'+lang+'/tool/life-sim');const country=page.locator('#life-country-welcome');await country.waitFor();await page.waitForFunction(()=>!document.querySelector('#life-country-welcome').disabled);assert.equal(await country.inputValue(),'');assert(await page.locator('#life-place-welcome').isDisabled());
   await page.locator('[data-life-action="begin"]').click();await page.locator('[data-life-action="enter"]:not(:disabled)').waitFor();assert.equal(births[0].searchParams.has('country'),false);assert.equal(births[0].searchParams.has('place'),false);
   async function enter(){await page.locator('[data-life-action="enter"]:not(:disabled)').click();await page.locator('[data-life-action="next"]').waitFor();}
   async function newPicker(){await page.locator('.life-toolbar button').click();await page.locator('dialog [data-life-action="details:settings"]').click();await page.locator('[data-life-action="new"]').click();await page.locator('#life-country-sheet').waitFor();}
   await enter();await newPicker();await page.locator('#life-country-sheet').selectOption('JPN');assert.equal(await page.locator('#life-place-sheet').inputValue(),'');await page.locator('[data-life-action="confirm"]').click();await page.locator('[data-life-action="enter"]:not(:disabled)').waitFor();let saved=await page.evaluate(()=>JSON.parse(localStorage.getItem('between-lives.v2')));assert(A.valid(saved));assert.equal(saved.world.country.code,'JPN');assert.equal(births[1].searchParams.get('country'),'JPN');assert.equal(births[1].searchParams.has('place'),false);
   await enter();await newPicker();const selectedCountry=width===390?'CHN':'USA';await page.locator('#life-country-sheet').selectOption(selectedCountry);await page.waitForFunction(()=>!document.querySelector('#life-place-sheet').disabled);
   const placeId=selectedCountry==='CHN'?'china:43:4301':await page.locator('#life-place-sheet option:not([value=""])').first().getAttribute('value');await page.locator('#life-place-sheet').focus();await page.locator('#life-place-sheet').selectOption(placeId);
   assert.equal(await page.evaluate(()=>document.activeElement.getAttribute('data-life-picker')),'place');
   const before=await page.evaluate(()=>localStorage.getItem('between-lives.v2'));const expectedRequests=chapters.length;
   if(lang==='zh'&&theme==='light'&&width===390)failBirth=true;
   if(lang==='en'&&theme==='light'&&width===1440)badChapter=true;
   const shouldFail=failBirth||badChapter;
   await page.locator('[data-life-action="confirm"]').click();
   if(shouldFail){await page.locator('[data-life-action="retry"]').waitFor();assert.equal(await page.evaluate(()=>localStorage.getItem('between-lives.v2')),before);await page.locator('[data-life-action="retry"]').click();}
   await page.locator('[data-life-action="enter"]:not(:disabled)').waitFor();saved=await page.evaluate(()=>JSON.parse(localStorage.getItem('between-lives.v2')));assert(A.valid(saved));assert.equal(saved.world.country.code,selectedCountry);assert.equal(saved.world.origin,placeId);assert.equal(saved.world.places[0].id,placeId);assert.equal(saved.chapter.locationIndex,0);assert.deepEqual(chapters.at(-1).places[0].codes,saved.world.places[0].codes);assert(chapters.length>expectedRequests);
   assert.equal(births.at(-1).searchParams.get('place'),placeId);assert.equal(births.at(-1).searchParams.get('country'),selectedCountry);
   await enter();await newPicker();await page.locator('#life-country-sheet').selectOption('');assert.equal(await page.locator('#life-place-sheet').inputValue(),'');assert(await page.locator('#life-place-sheet').isDisabled());
   assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);assert.deepEqual(errors,[]);assert.deepEqual(external,[]);results.push({lang,theme,width,globalRandom:true,countryOnly:true,exactPlace:true,clearSelection:true,failedSelectionPreserves:true});await context.close();
  }
  // Late country responses must not replace the currently selected country's cities.
  const context=await browser.newContext({viewport:{width:390,height:844},reducedMotion:'reduce'}),page=await context.newPage();
  await context.route('**/api/visits*',r=>r.fulfill({json:{count:0}}));
  await context.route('**/api/life-sim/locations?country=JPN',async r=>{const response=await r.fetch();await new Promise(resolve=>setTimeout(resolve,400));try{await r.fulfill({response});}catch(_){/* The stale request is intentionally aborted. */}});
  await page.goto(origin+'/zh/tool/life-sim');await page.waitForFunction(()=>!document.querySelector('#life-country-welcome')?.disabled);
  await page.locator('#life-country-welcome').selectOption('JPN');await page.locator('#life-country-welcome').selectOption('USA');await page.waitForFunction(()=>!document.querySelector('#life-place-welcome').disabled);await page.waitForTimeout(500);assert.equal(await page.locator('#life-country-welcome').inputValue(),'USA');assert((await page.locator('#life-place-welcome option:not([value=""])').evaluateAll(es=>es.map(e=>e.value))).every(v=>v.startsWith('world:USA:')));
  // Source-data gaps keep country-only birth available, and list failures keep random birth available.
  const list=await page.evaluate(async()=>{const r=await fetch('/api/life-sim/locations');return (await r.json()).data;});let empty;
  for(const c of list){const places=await page.evaluate(async code=>(await(await fetch('/api/life-sim/locations?country='+code)).json()).data,c.code);if(!places.length){empty=c.code;break;}}
  await page.locator('#life-country-welcome').selectOption(empty);await page.waitForFunction(()=>document.querySelector('.life-picker-note')?.textContent.includes('暂无下级'));assert(await page.locator('#life-place-welcome').isDisabled());assert(await page.locator('[data-life-action="begin"]').isEnabled());
  await context.close();
  const fallback=await browser.newContext({viewport:{width:360,height:800},reducedMotion:'reduce'}),f=await fallback.newPage();let listCalls=0;const fallbackBirths=[];
  await fallback.route('**/api/visits*',r=>r.fulfill({json:{count:0}}));
  await fallback.route(origin+'/api/life-sim/locations',r=>++listCalls===1?r.fulfill({status:503,json:{ok:false,error:'unavailable'}}):r.continue());
  await fallback.route('**/api/life-sim/locations?country=CHN',r=>r.fulfill({status:503,json:{ok:false,error:'unavailable'}}));
  await fallback.route('**/api/life-sim/birth?*',r=>{fallbackBirths.push(new URL(r.request().url()));return r.continue();});
  await fallback.route('**/api/life-sim/chapter',r=>r.fulfill({json:{ok:true,data:chapter}}));await fallback.route('**/api/life-sim/ai',r=>r.fulfill({json:{ok:true,data:guide}}));
  await f.goto(origin+'/zh/tool/life-sim');await f.locator('[data-life-action="picker-retry"]').waitFor();assert(await f.locator('[data-life-action="begin"]').isEnabled());await f.locator('[data-life-action="begin"]').click();await f.locator('[data-life-action="enter"]:not(:disabled)').waitFor();assert.equal(fallbackBirths[0].searchParams.has('country'),false);
  await f.locator('[data-life-action="enter"]').click();await f.locator('.life-toolbar button').click();await f.locator('dialog [data-life-action="details:settings"]').click();await f.locator('[data-life-action="new"]').click();await f.waitForFunction(()=>!document.querySelector('#life-country-sheet').disabled);await f.locator('#life-country-sheet').selectOption('CHN');await f.locator('[data-life-action="picker-retry"]').waitFor();await f.locator('[data-life-action="confirm"]').click();await f.locator('[data-life-action="enter"]:not(:disabled)').waitFor();assert.equal(await f.evaluate(()=>JSON.parse(localStorage.getItem('between-lives.v2')).world.country.code),'CHN');assert.equal(fallbackBirths.at(-1).searchParams.get('country'),'CHN');await fallback.close();
  console.log(JSON.stringify({matrix:results,staleResponsesIgnored:true,noCityData:true,listFailuresKeepRandomAvailable:true}));
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exit(1)});
