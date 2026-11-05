/* Portable AI snapshot validation and atomic save transitions. No event rolls. */
(function(root){
  'use strict';
  const clone = value => JSON.parse(JSON.stringify(value));
  const integer = (v,max) => Number.isSafeInteger(v) && v>=0 && v<=max;
  const string = (v,max,empty=false) => typeof v==='string' && (empty || !!v.trim()) && Array.from(v).length<=max;
  function validWorld(w) {
    if (!w || !w.country || typeof w.country.code !== 'string' || !/^[A-Z]{3}$/.test(w.country.code) || !['name','cname'].every(k => typeof w.country[k] === 'string' && w.country[k].length > 0 && w.country[k].length <= 150)) return false;
    if (!Array.isArray(w.places) || !w.places.length || w.places.length > 2 || new Set(w.places.map(p => p && p.id)).size !== w.places.length) return false;
    return w.places.every(p => p && typeof p.id === 'string' && p.id.length <= 100 && p.country === w.country.code && ['china','world'].includes(p.mode) && Array.isArray(p.codes) && p.codes.length >= 1 && p.codes.length <= 3 && p.codes.every(c => typeof c === 'string' && c.length > 0 && c.length <= 20) && p.id === p.mode + ':' + p.codes.join(':') && ['path','pathEn'].every(k => typeof p[k] === 'string' && p[k].length > 0 && p[k].length <= 500) && ['district','locality','country'].includes(p.level) && p.precision === 'country' && (p.lat === null || Number.isFinite(p.lat) && Math.abs(p.lat) <= 90) && (p.lon === null || Number.isFinite(p.lon) && Math.abs(p.lon) <= 180)) && w.places.some(p => p.id === w.origin);
  }
  const fields=['name','age','alive','mood','health','happiness','occupation','education','locationIndex','finances','people'];
  function finances(v){return v && ['household','personal'].includes(v.owner) && ['cash','debt','property','income','expenses'].every(k=>integer(v[k],1e12));}
  function snapshot(v){
    if(!v || !string(v.name,60) || !integer(v.age,110) || typeof v.alive!=='boolean' || v.age===110&&v.alive) return false;
    if(!['positive','negative','neutral','death'].includes(v.mood) || (v.mood==='death')!==!v.alive) return false;
    if(!['health','happiness'].every(k=>integer(v[k],100)) || !['occupation','education'].every(k=>string(v[k],100)) || !integer(v.locationIndex,1) || !finances(v.finances)) return false;
    if(!Array.isArray(v.people) || v.people.length>20) return false;
    const ids=new Set();
    return v.people.every(p=>{
      if(!p || !/^[A-Za-z0-9_-]{1,40}$/.test(p.id) || typeof p.id!=='string' || ids.has(p.id)) return false;
      ids.add(p.id);
      return ['name','relation'].every(k=>string(p[k],60)) && integer(p.age,150) && typeof p.alive==='boolean' && integer(p.closeness,100) && string(p.note,180,true);
    });
  }
  const prose=v=>v && string(v.title,100) && string(v.body,2400) && string(v.summary,300);
  const context=v=>Object.fromEntries(fields.map(k=>[k,clone(v[k])]));
  function transition(old,v,kind){
    if(!snapshot(v)||!prose(v)) return false;
    if(kind==='start') return v.age===0 && v.alive;
    if(!old || v.name!==old.name) return false;
    if(kind==='resume') return JSON.stringify(context(old))===JSON.stringify(context(v));
    const delta=v.age-old.age;
    if(!old.alive || delta<1 || delta>5) return false;
    return old.people.every(p=>{
      const n=v.people.find(n=>n.id===p.id);
      return n && n.name===p.name && (p.alive ? n.age>=p.age&&n.age<=p.age+delta : !n.alive&&n.age===p.age);
    });
  }
  const record=v=>clone(Object.fromEntries(['age','title','body','summary','mood','finances','locationIndex'].map(k=>[k,v[k]])));
  function intro(v,world){return v&&world.places.some(p=>p.id===v.regionId)&&string(v.title,100)&&string(v.body,5000)&&v.country&&['economy','ranking','environment','tourism'].every(k=>string(v.country[k],1200));}
  function enter(s){if(!valid(s)||!s.introduction)throw new Error('not_ready');const next=clone(s);next.started=true;return next;}
  function valid(s){
    if(!s || s.version!==2 || !integer(s.seed,4294967295) || !validWorld(s.world) || !['zh','en'].includes(s.language)) return false;
    if(typeof s.started!=='boolean'||!('introduction' in s)||s.introduction!==null&&!intro(s.introduction,s.world))return false;
    const c=s.chapter;
    if(!snapshot(c)||!prose(c)||c.locationIndex>=s.world.places.length) return false;
    if(!Array.isArray(s.history)||!s.history.length||s.history.length>111) return false;
    let last=-1;
    for(const h of s.history){
      if(!prose(h)||!integer(h.age,110)||h.age<=last||!['positive','negative','neutral','death'].includes(h.mood)||!finances(h.finances)||!integer(h.locationIndex,s.world.places.length-1))return false;
      last=h.age;
    }
    return JSON.stringify(record(c))===JSON.stringify(s.history[s.history.length-1]);
  }
  function commit(s,v,kind,world,seed,language){
    if(kind==='next'&&!s?.started)throw new Error('not_started');
    if(!transition(s&&s.chapter,v,kind)) throw new Error('invalid_transition');
    const result=s?clone(s):{version:2,world:clone(world),seed,language,started:false,introduction:null,history:[]};
    if(language)result.language=language;
    result.chapter={...context(v),title:v.title,body:v.body,summary:v.summary};
    if(kind==='resume')result.history[result.history.length-1]=record(result.chapter);else result.history.push(record(result.chapter));
    if(!valid(result))throw new Error('invalid_save');
    return result;
  }
  function request(s,kind,world,seed,language){
    return {kind,lang:language,seed:s?s.seed:seed,places:(s?s.world:world).places.map(p=>({mode:p.mode,codes:p.codes})),
      ...(s?{context:context(s.chapter),memories:s.history.slice(-3).map(h=>h.summary)}:{})};
  }
  const api={valid,validWorld,intro,enter,snapshot,transition,commit,request,context};
  if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.LifeSimAI=api;
})(typeof globalThis!=='undefined'?globalThis:this);
