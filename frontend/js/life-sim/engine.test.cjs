'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const E = require('./engine.js');
const D = require('./data.js');
const clone = x => JSON.parse(JSON.stringify(x));
const countries = new Set();
const phases = new Set();
for (let seed = 0; seed < 180; seed++) {
  let s = E.create(seed * 98761);
  countries.add(s.country);
  assert(E.validate(s));
  assert.equal(new Set([s.name, ...s.people.map(p => p.name)]).size, s.people.length + 1);
  let steps = 0;
  while (s.alive) {
    assert(++steps < 101);
    const choices = E.options(s);
    assert(choices.length > 0, `${seed}: ${s.age}: ${s.event}`);
    phases.add(s.event);
    const initial = clone(s);
    let chosen = choices[(seed + steps) % choices.length];
    const path = ['university','partner','child','house','retire','care'];
    if (seed % 2 === 0) chosen = path.find(x => choices.includes(x)) || chosen;
    const updated = E.choose(s, chosen);
    assert.deepEqual(s, initial);
    s = updated; // API result must not mutate the input.
    assert(E.validate(s), `invalid ${seed} at ${s.age}`);
    if (initial.age >= 18) {
      const change = (s.cash - s.debt) - (initial.cash - initial.debt);
      assert(Math.abs(change - (s.income - s.expenses)) <= 1, 'annual money must balance');
    }
    const saved = clone(s);
    if (s.alive) assert.deepEqual(E.choose(s, E.options(s)[0]), E.choose(saved, E.options(saved)[0]));
    if (s.alive && s.people.some(p => p.alive)) {
      const id = s.people.find(p => p.alive).id;
      const v = E.visit(s, id);
      assert(E.validate(v));
      assert.equal(E.visit(v, id), v);
      s = v;
    }
  }
  assert(s.age >= 1 && s.age <= 100);
  assert.equal(E.options(s).length, 0);
  assert.throws(() => E.choose(s, 'rest'));
}
assert.equal(countries.size, 3);
['birth','education','career','love','family','home','retire'].forEach(e => assert(phases.has(e), e));
let s = E.create(3);
while (s.age < 18) s = E.choose(s, E.options(s)[0]);
s.cash = 0; s.debt = 0;
const before = clone(s);
const uni = E.choose(s, 'university');
assert.deepEqual(s, before);
assert(uni.debt > 0);
assert.equal(uni.education, 'university');
assert.equal(uni.income, 0);
assert.throws(() => E.choose(s, 'house'));
const parent = s.people[0]; parent.alive = false; const deathAge = parent.age;
const next = E.choose(s, 'work');
assert.equal(next.people[0].age, deathAge);
for (const bad of [null, {}, [], { ...s, version: 2 }, { ...s, cash: -1 }, { ...s, seed: NaN }, { ...s, event: '__proto__' }, { ...s, people: [null] }, { ...s, log: [{age:18,key:'toString'}] }, { ...s, ledger: [{age:18,cash: Infinity}] }]) assert.equal(E.validate(bad), false);
for (const lang of ['zh-CN', 'en']) {
  const t = JSON.parse(fs.readFileSync(`${__dirname}/../../locales/${lang}.json`, 'utf8')).lifeSim;
  Object.keys(D.events).forEach(id => { assert(t.events[id].title); assert(t.events[id].body); });
  Object.keys(D.actions).forEach(id => { assert(t.actions[id].label); assert(t.actions[id].hint); });
  Object.keys(D.regions).forEach(id => assert(t.places[id].description));
}
console.log('180 complete lives, deterministic saves, money, relationships, malformed saves and both locales passed.');
// Observer mode: deterministic automatic decisions, early mortality, shocks and save compatibility.
let earlyDeath = false, lostWork = false, sawIllness = false, sawAccident = false, laterDeath = false;
for(let seed=1;seed<=100;seed++) {
 let s=E.create(seed*342271),steps=0;
 while(s.alive) {
  const original=clone(s), next=E.advance(s);
  assert.deepEqual(s,original);
  assert.deepEqual(next,E.advance(clone(s)));
  assert(E.validate(next),`auto invalid at ${next.age}`);
  lostWork ||= next.event==='unemployment';sawIllness ||= next.event==='seriousIllness';sawAccident ||= next.event==='accident';
  s=next;assert(++steps<=100);
 }
 earlyDeath ||= s.age<60;laterDeath ||= s.age>=60;
 assert.equal(E.tone(s),'death');assert.equal(E.advance(s),s);
}
assert(earlyDeath && laterDeath && lostWork && sawIllness && sawAccident);
let worker=E.create(1);worker.age=35;worker.year=2061;worker.event='jobhunt';worker.job='unemployed';worker.unemployedUntil=40;worker.education='work';
assert.equal(E.earnings(worker),0);assert(E.validate(worker));
const resting=E.choose(worker,'save');assert.equal(resting.income,0);assert(resting.expenses>0);
worker.unemployedUntil=0;assert(E.earnings(worker)>0);
const legacy=E.create(4);delete legacy.crisis;delete legacy.unemployedUntil;assert(E.validate(legacy));assert(E.validate(E.advance(legacy)));
assert.equal(E.tone({...legacy,event:'unemployment'}),'negative');assert.equal(E.tone({...legacy,event:'birth'}),'positive');
assert.equal(E.validate({...legacy,unemployedUntil:Infinity}),false);
console.log('100 automatic lives: deterministic progression, early deaths, illness, accidents, unemployment income and legacy saves passed.');
