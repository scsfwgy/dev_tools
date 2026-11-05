(function (root, factory) {
  'use strict';
  if (typeof module === 'object' && module.exports) module.exports = factory(require('./data.js'));
  else root.LifeSimEngine = factory(root.LifeSimData);
})(typeof globalThis !== 'undefined' ? globalThis : this, function (D) {
  'use strict';
  const own = (object, key) => Object.prototype.hasOwnProperty.call(object, key);
  const clamp = n => Math.max(0, Math.min(100, n));
  function country(s) {
    if (!s.world) return D.countries.find(c => c.id === s.country);
    const original = D.countries.find(c => c.id === ({CHN:'cn',JPN:'jp',BRA:'br'}[s.world.country.code]));
    return {id:s.country,currency:'XXX',wage:1000,regions:s.world.places.map(p => p.id),names:original ? original.names : ['Ari','Sam','Mika','Noa','Robin','Alex','Luca','Rene','Sasha','Lee','Kim','Morgan']};
  }
  const region = s => s.world ? {cost:1,opportunity:1} : D.regions[s.region];
  const location = (s,id) => s && s.world ? s.world.places.find(p => p.id === id) : null;
  function validWorld(w) {
    if (!w || !w.country || typeof w.country.code !== 'string' || !/^[A-Z]{3}$/.test(w.country.code) || !['name','cname'].every(k => typeof w.country[k] === 'string' && w.country[k].length > 0 && w.country[k].length <= 150)) return false;
    if (!Array.isArray(w.places) || !w.places.length || w.places.length > 2 || new Set(w.places.map(p => p && p.id)).size !== w.places.length) return false;
    return w.places.every(p => p && typeof p.id === 'string' && p.id.length <= 100 && p.country === w.country.code && ['china','world'].includes(p.mode) && Array.isArray(p.codes) && p.codes.length >= 1 && p.codes.length <= 3 && p.codes.every(c => typeof c === 'string' && c.length > 0 && c.length <= 20) && p.id === p.mode + ':' + p.codes.join(':') && ['path','pathEn'].every(k => typeof p[k] === 'string' && p[k].length > 0 && p[k].length <= 500) && ['district','locality','country'].includes(p.level) && p.precision === 'country' && (p.lat === null || Number.isFinite(p.lat) && Math.abs(p.lat) <= 90) && (p.lon === null || Number.isFinite(p.lon) && Math.abs(p.lon) <= 180)) && w.places.some(p => p.id === w.origin);
  }
  function random(s) { s.seed = (Math.imul(s.seed, 1664525) + 1013904223) >>> 0; return s.seed / 4294967296; }
  const pick = (s, a) => a[Math.floor(random(s) * a.length)];
  function person(s, role, age) {
    const used = [s.name].concat(s.people.map(p => p.name));
    const names = country(s).names.filter(n => !used.includes(n));
    const name = pick(s, names.length ? names : country(s).names) + (names.length ? '' : ' · ' + (s.people.length + 1));
    return { id: role, role, name, age, bond: 60 + Math.floor(random(s) * 25), alive: true, memories: [] };
  }
  function create(seed,world) {
    if (world && !validWorld(world)) throw new Error('Invalid birthplace');
    const s = { version: D.version, seed: seed >>> 0, age: 0, year: 2026, alive: true, health: 90, happiness: 70, skill: 10, cash: 0, debt: 0, property: 0, income: 0, expenses: 0, retired: false, education: 'none', job: 'none', people: [], log: [], ledger: [], used: [], interactions: [], event: 'birth', end: null, unemployedUntil: 0, crisis: null };
    // shortcut: equal-country exploration among curated places; use birth-weighted sampling when coverage expands.
    if (world) { s.world = JSON.parse(JSON.stringify(world)); s.country = world.country.code.toLowerCase(); }
    const c = world ? country(s) : pick(s, D.countries); s.country = c.id; s.region = world ? world.origin : pick(s, c.regions); s.origin = s.region; s.name = pick(s, c.names);
    s.wealth = pick(s, ['poor', 'ordinary', 'ordinary', 'comfortable', 'wealthy']);
    const multiple = { poor: 2, ordinary: 8, comfortable: 24, wealthy: 90 }[s.wealth];
    s.familyCash = c.wage * multiple;
    [['mother', 25 + Math.floor(random(s) * 12)], ['father', 27 + Math.floor(random(s) * 12)], ['sibling', 3], ['grandparent', 59], ['aunt', 32], ['cousin', 2]].forEach(([role, age]) => s.people.push(person(s, role, age)));
    record(s, 'birth', { region: s.region }); return s;
  }
  function record(s, key, extra) { s.log.push(Object.assign({ age: s.age, key }, extra || {})); }
  function living(s, role) { return s.people.find(p => p.role === role && p.alive); }
  function available(s, action) {
    if (!s.alive || !own(D.actions, action)) return false;
    if (action === 'partner') return s.age >= 18 && !s.people.some(p => p.role === 'partner');
    if (action === 'child') return s.age >= 22 && s.age <= 50 && !!living(s, 'partner') && !s.people.some(p => p.role === 'child');
    if (action === 'house') return s.age >= 18 && !s.property && s.cash >= country(s).wage * 30;
    if (action === 'retire') return s.age >= 60 && !s.retired;
    if (action === 'university' || action === 'vocational') return s.age === 18;
    if (action === 'move') return s.age >= 18 && country(s).regions.length > 1;
    return true;
  }
  function options(s) { return (D.events[s.event] || []).filter(a => available(s, a)); }
  function charge(s, amount) {
    if (s.age < 18) { s.familyCash = Math.max(0, s.familyCash - amount); return; }
    const paid = Math.min(s.cash, amount); s.cash -= paid; s.debt += amount - paid;
  }
  function earnings(s) {
    if (!s.alive || s.age < 18) return 0;
    const c = country(s), r = region(s);
    if (s.retired) return Math.round(c.wage * 12 * .42);
    if (s.education === 'university' && s.age < 22) return 0;
    if ((s.unemployedUntil || 0) >= s.age) return 0;
    return Math.round(c.wage * 12 * r.opportunity * (.55 + s.skill / 100) * (s.education === 'university' ? 1.25 : 1));
  }
  function advanceYear(s, decisionCost) {
    s.age++; s.year++; s.interactions = [];
    if (s.age === 18) { s.cash += s.familyCash * .12; record(s, 'support'); }
    s.people.forEach(p => {
      if (!p.alive) return;
      p.age++;
      if (p.alive && random(s) < .0005 + (p.age > 65 ? Math.min(.55, .008 * Math.exp((p.age - 65) / 12)) : 0)) { p.alive = false; record(s, 'loss', { person: p.name }); s.happiness = clamp(s.happiness - 8); }
    });
    if (s.age === 6) s.people.push(person(s, 'friend', 6));
    if (s.age === 22) s.people.push(person(s, 'colleague', 23));
    const wasUnemployed = s.job === 'unemployed';
    const income = earnings(s);
    const children = s.people.filter(p => p.role === 'child' && p.alive && p.age < 18).length;
    const expenses = s.age < 18 ? 0 : Math.round(country(s).wage * 12 * region(s).cost * (s.property ? .38 : .55) * (1 + children * .22));
    const interest = Math.round(s.debt * .03);
    s.income = income; s.expenses = expenses + interest + (decisionCost || 0);
    charge(s, expenses + interest);
    s.cash += income;
    const repayment = Math.min(s.debt, s.cash * .6); s.debt -= repayment; s.cash -= repayment;
    s.cash = Math.round(s.cash); s.debt = Math.round(s.debt);
    if (s.age >= 18 && !s.retired && !(s.education === 'university' && s.age < 22)) s.job = (s.unemployedUntil || 0) >= s.age ? 'unemployed' : s.skill >= 60 ? 'professional' : s.skill >= 30 ? 'skilled' : 'entry';
    if (s.retired) s.job = 'retired';
    if (wasUnemployed && s.job !== 'unemployed' && !s.retired) record(s,'reemployment');
    s.ledger.push({ age: s.age, income, expenses: s.expenses, cash: s.cash, debt: s.debt });
    s.health = clamp(s.health - (s.age > 65 ? 2 : s.age > 40 ? .8 : .15));
    // Fictional risks for varied stories, not calibrated mortality or medical probabilities.
    const crisisRisk = s.crisis === 'illness' ? .04 : s.crisis === 'accident' ? .025 : 0;
    const risk = .0007 + crisisRisk + (s.age > 60 ? .003 * Math.exp((s.age - 60) / 12) * (1.5 - s.health / 100) : 0);
    if (s.age >= 100 || s.health <= 0 || random(s) < risk) {
      endLife(s, s.health <= 0 ? 'health' : s.age >= 100 ? 'age' : s.crisis || (s.age > 60 ? 'age' : 'accident'));
    }
  }
  function endLife(s, cause) { s.alive = false; s.end = cause; record(s, 'death'); }

  function nextEvent(s) {
    s.crisis = null;
    const m = D.milestones[s.age];
    if (m) return m;
    if (s.log.some(e => e.age === s.age && e.key === 'loss')) return 'bereavement';
    if (s.log.some(e => e.age === s.age && e.key === 'reemployment')) return 'reemployment';
    if (s.age >= 6 && random(s) < .035) {
      s.crisis = 'accident'; s.health = clamp(s.health - 12 - Math.floor(random(s) * 20));
      if (s.health <= 0) endLife(s, 'accident');
      return 'accident';
    }
    if (s.age >= 6 && random(s) < (s.age > 60 ? .12 : .045)) {
      s.crisis = 'illness'; s.health = clamp(s.health - 18 - Math.floor(random(s) * 20));
      if (s.health <= 0) endLife(s, 'illness');
      return 'seriousIllness';
    }
    if (s.age >= 22 && !s.retired && s.job !== 'unemployed' && random(s) < .065) {
      s.unemployedUntil = s.age + 1 + Math.floor(random(s) * 3);
      s.job = 'unemployed'; s.happiness = clamp(s.happiness - 12);
      return 'unemployment';
    }
    if (s.job === 'unemployed') return 'jobhunt';
    if (s.age >= 60 && !s.retired && s.age % 3 === 0) return 'retire';
    let pool = s.age < 18 ? ['discovery', 'friendship', 'outing', 'schoolstress', 'hobby'] : s.age < 60 ? ['job', 'pressure', 'invitation', 'familycall', 'opportunity', 'setback', 'illness', 'move', 'affection', 'repair'] : ['quiet', 'reunion', 'illness', 'memory'];
    if (s.age >= 26 && s.age < 60 && !s.property) pool.push('home');
    if (s.age >= 26 && s.age <= 50 && living(s, 'partner') && !s.people.some(p => p.role === 'child')) pool.push('family');
    if (living(s, 'child')) pool.push('parenting');
    pool = pool.filter(e => !s.used.slice(-3).includes(e) && (e !== 'affection' || !s.people.some(p => p.role === 'partner')));
    return pick(s, pool);
  }
  function choose(state, action) {
    if (!options(state).includes(action)) throw new Error('Invalid choice');
    const s = JSON.parse(JSON.stringify(state)), effect = D.actions[action];
    ['health', 'happiness', 'skill'].forEach(k => { s[k] = clamp(s[k] + (effect[k] || 0)); });
    const cost = Math.round((effect.cost || 0) * country(s).wage);
    charge(s, cost);
    if (effect.bond) s.people.filter(p => p.alive && (action !== 'family' || !['colleague', 'friend'].includes(p.role))).forEach(p => p.bond = clamp(p.bond + effect.bond));
    if (action === 'university' || action === 'vocational') s.education = action;
    if (action === 'work' && s.age === 18) s.education = 'work';
    if (action === 'partner') s.people.push(person(s, 'partner', s.age));
    if (action === 'child') s.people.push(person(s, 'child', 0));
    if (action === 'house') s.property = country(s).wage * 30;
    if (action === 'retire') { s.retired = true; s.unemployedUntil = 0; }
    if (s.job === 'unemployed' && ['work','training'].includes(action) && random(s) < .35) s.unemployedUntil = s.age;
    if (action === 'move') s.region = country(s).regions.find(r => r !== s.region);
    if (s.event === 'illness' && action !== 'care') s.health = clamp(s.health - 6);
    s.people.filter(p => p.alive && effect.bond).forEach(p => p.memories.push({ age: s.age, action }));
    record(s, s.event, { action }); s.used.push(s.event);
    const step = s.age < 6 ? 3 : 1;
    for (let i = 0; i < step && s.alive; i++) advanceYear(s, i === 0 && state.age >= 18 ? cost : 0);
    if (s.alive) s.event = nextEvent(s);
    return s;
  }
  function advance(state) {
    if (!state.alive) return state;
    const s = JSON.parse(JSON.stringify(state));
    const choices = options(s);
    const weights = {family:4,curiosity:3,play:3,learn:4,study:4,social:3,rest:3,university:s.wealth === 'poor' ? 1 : 4,vocational:3,work:3,training:3,partner:4,child:2,house:4,save:2,retire:8,care:7,move:1,stay:4,repair:4};
    let roll = random(s) * choices.reduce((total,id) => total + weights[id],0);
    const action = choices.find(id => (roll -= weights[id]) < 0) || choices[choices.length-1];
    let next = choose(s,action);
    const people = next.people.filter(p => p.alive);
    if (next.alive && people.length && random(next) < .5) next = visit(next,pick(next,people).id);
    return next;
  }
  function visit(state, id) {
    const p = state.people.find(p => p.id === id);
    if (!state.alive || !p || !p.alive || state.interactions.includes(id) || state.interactions.length >= 2) return state;
    const s = JSON.parse(JSON.stringify(state)), target = s.people.find(p => p.id === id);
    target.bond = clamp(target.bond + 8); s.happiness = clamp(s.happiness + 3); target.memories.push({ age: s.age, action: 'visit' });
    s.interactions.push(id); record(s, 'visit', { person: p.name }); return s;
  }
  function tone(s) {
    if (!s.alive) return 'death';
    if (s.log.some(e => e.age === s.age && e.key === 'loss')) return 'negative';
    if (['bereavement','unemployment','jobhunt','seriousIllness','accident','illness','pressure','setback','schoolstress','exam'].includes(s.event)) return 'negative';
    if (['reemployment','birth','childhood','school','discovery','friendship','outing','hobby','love','affection','family','parenting','home','reunion','invitation','legacy'].includes(s.event)) return 'positive';
    return 'neutral';
  }
  function validate(s) {
    if (!s || !['age','health','illness','accident',null].includes(s.end) || s.version !== 1) return false;
    if (s.world ? (!validWorld(s.world) || s.country !== s.world.country.code.toLowerCase() || !s.world.places.some(p => p.id === s.region) || !s.world.places.some(p => p.id === s.origin)) : !D.countries.some(c => c.id === s.country && c.regions.includes(s.region) && c.regions.includes(s.origin))) return false;
    for (const key of ['narratives','introductions']) {
      if (s[key] !== undefined && (!s[key] || typeof s[key] !== 'object' || Array.isArray(s[key]) || Object.keys(s[key]).length > (key === 'narratives' ? 210 : 4) || !Object.entries(s[key]).every(([k,v]) => k.length <= 130 && v && typeof v.title === 'string' && v.title.length <= 100 && typeof v.body === 'string' && v.body.length <= (key === 'narratives' ? 1200 : 5000)))) return false;
    }
    if (typeof s.name !== 'string' || s.name.length > 80 || typeof s.alive !== 'boolean' || typeof s.retired !== 'boolean' || !own(D.events, s.event)) return false;
    if (!['poor','ordinary','comfortable','wealthy'].includes(s.wealth) || !['none','university','vocational','work'].includes(s.education) || !['none','entry','skilled','professional','retired','unemployed'].includes(s.job)) return false;
    if (!['seed','age','year','health','happiness','skill','cash','debt','property','familyCash','income','expenses'].every(k => Number.isFinite(s[k]) && s[k] >= 0 && s[k] <= 1e15)) return false;
    if (s.unemployedUntil !== undefined && (!Number.isInteger(s.unemployedUntil) || s.unemployedUntil < 0 || s.unemployedUntil > 104)) return false;
    if (s.crisis !== undefined && ![null,'illness','accident'].includes(s.crisis)) return false;
    if (!Number.isInteger(s.seed) || s.seed > 4294967295 || !Number.isInteger(s.age) || s.age > 100 || s.year !== 2026 + s.age || ['health','happiness','skill'].some(k => s[k] > 100)) return false;
    if (!Array.isArray(s.people) || s.people.length > 16 || new Set(s.people.map(p => p && p.id)).size !== s.people.length) return false;
    if (!s.people.every(p => p && ['mother','father','sibling','grandparent','aunt','cousin','friend','colleague','partner','child'].includes(p.role) && p.id === p.role && typeof p.name === 'string' && p.name.length <= 80 && typeof p.alive === 'boolean' && Number.isFinite(p.age) && p.age >= 0 && p.age < 200 && Number.isFinite(p.bond) && p.bond >= 0 && p.bond <= 100 && Array.isArray(p.memories) && p.memories.length <= 500 && p.memories.every(m => Number.isInteger(m.age) && m.age >= 0 && m.age <= 100 && (m.action === 'visit' || own(D.actions, m.action))))) return false;
    if (!Array.isArray(s.log) || s.log.length > 1000 || !s.log.every(e => e && Number.isInteger(e.age) && e.age >= 0 && e.age <= 100 && (own(D.events, e.key) || ['loss','support','visit','death'].includes(e.key)) && (!e.action || own(D.actions, e.action)) && (!e.person || typeof e.person === 'string' && e.person.length <= 80))) return false;
    if (!Array.isArray(s.ledger) || s.ledger.length > 100 || !s.ledger.every(e => e && ['age','income','expenses','cash','debt'].every(k => Number.isFinite(e[k]) && e[k] >= 0 && e[k] <= 1e15))) return false;
    return Array.isArray(s.used) && s.used.length <= 100 && s.used.every(e => own(D.events, e)) && Array.isArray(s.interactions) && s.interactions.length <= 2 && s.interactions.every(id => s.people.some(p => p.id === id));
  }
  return { create, choose, advance, tone, visit, validate, options, available, country, region, location, validWorld, earnings };
});
