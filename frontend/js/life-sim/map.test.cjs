'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const M = require('./map.js');
const G = require('./geography.js');
const D = require('./data.js');
assert.equal(Object.keys(G.locations).length, 6);
assert(G.land.length > 100);
assert.deepEqual(M.project(-180,90),{x:0,y:0});
assert.deepEqual(M.project(180,-90),{x:960,y:480});
for (const id of Object.keys(D.regions)) {
 const p = M.locations[id], box = M.locate(id), pos = M.project(p.lon,p.lat);
 assert(p.lat >= -90 && p.lat <= 90 && p.lon >= -180 && p.lon <= 180);
 assert(pos.x > box.x && pos.x < box.x+box.width && pos.y > box.y && pos.y < box.y+box.height);
 assert(D.countries.find(c=>c.id === p.country).regions.includes(id));
 assert.deepEqual(M.locate(id),M.locate(id));
 let b = box;
 for(let i=0;i<100;i++) b=M.zoom(b,.65);
 assert.equal(b.width,80);
 for(let i=0;i<100;i++) b=M.zoom(b,1/.65);
 assert.deepEqual(b,{x:0,y:0,width:960,height:480});
 const pan = M.pan(box,-1e6,1e6);
 assert.equal(pan.x,0);assert.equal(pan.y,480-pan.height);
}
// Distinguish Hunan's Changsha from other places with the same name.
assert.equal(G.locations.changsha.geonameId,1815577);
assert(G.locations.changsha.lat>28 && G.locations.changsha.lat<29);
for(const lang of ['zh-CN','en']) {
 const t=JSON.parse(fs.readFileSync(`${__dirname}/../../locales/${lang}.json`,'utf8')).lifeSim;
 assert.equal(Object.keys(t.environmentLabels).length,8);
 for(const id of Object.keys(D.regions)) {
  for(const k of Object.keys(t.environmentLabels)) assert(t.environments[id][k].length>35,`${lang} ${id} ${k}`);
  assert(t.environments[id].sources.length>=2);
  assert(t.environments[id].sources.every(s=>s.url.startsWith('https://')));
 }
 const html=M.svg(M.locate('changsha'),'changsha',{region:'changsha'},t,s=>String(s).replace(/</g,'&lt;'));
 assert(html.includes('life-map-svg'));assert(html.includes('map:changsha'));assert(!/https?:|<image|<iframe|<script/.test(html));
}
console.log('Offline geometry, city identities, map bounds, zoom, pan and bilingual environment coverage passed.');
for(const [id,p] of Object.entries(G.locations)) {
 const links=M.realMaps(id,'A name with spaces & < > 中文');
 const map=new URL(links.map);
 if(p.country==='cn') {
  assert.equal(links.provider,'amap');assert.equal(map.hostname,'uri.amap.com');
  assert.equal(map.searchParams.get('position'),`${p.lon},${p.lat}`);
  assert.equal(map.searchParams.get('coordinate'),'wgs84');assert.equal(map.searchParams.get('name'),'A name with spaces & < > 中文');
  assert(!links.streetView);
 } else {
  assert.equal(links.provider,'google');assert.equal(map.hostname,'www.google.com');
  assert.equal(map.searchParams.get('query'),`${p.lat},${p.lon}`);assert.equal(map.searchParams.get('api'),'1');
  assert.equal(new URL(links.satellite).searchParams.get('basemap'),'satellite');
  assert.equal(new URL(links.streetView).searchParams.get('viewpoint'),`${p.lat},${p.lon}`);
 }
}
assert.throws(()=>M.realMaps('unknown',''));
console.log('Country provider selection, WGS84 coordinate order and encoded provider URLs passed.');
