/* Only this adapter knows about the DevTools host. */
var LifeSimTool = (function () {
  'use strict';
  var base = new URL('./life-sim/', document.currentScript.src);
  var version = new URL(document.currentScript.src).searchParams.get('v') || '1';
  var ready, view, generation = 0;
  function script(name) {
    return new Promise(function (resolve, reject) {
      var el = document.createElement('script'); el.src = new URL(name + '?v=' + encodeURIComponent(version), base).href;
      el.onload = resolve; el.onerror = function () { el.remove(); reject(new Error('load')); }; document.head.appendChild(el);
    });
  }
  function load() {
    if (!ready) ready = (async function () {
      var css = document.createElement('link'); css.rel = 'stylesheet'; css.href = new URL('style.css?v=' + encodeURIComponent(version), base).href;
      await new Promise(function(resolve,reject) { css.onload = resolve; css.onerror = function() { css.remove(); reject(new Error('style')); }; document.head.appendChild(css); });
      await script('ai-engine.js'); await script('geography.js'); await script('map.js'); await script('globe.js'); await script('view.js');
    })().catch(function (error) { ready = null; throw error; });
    return ready;
  }
  async function json(url,options) {
    var response = await fetch(url,options); var payload = await response.json();
    if (!response.ok || !payload.ok) throw new Error(payload.error || 'unavailable');
    return payload.data;
  }
  var services = {
    birth: async function(seed,selection) {
      var controller = new AbortController(); var timeout = setTimeout(function(){controller.abort();},12000);
      try { var params = new URLSearchParams({seed:seed}); if(selection && selection.country) params.set('country',selection.country); if(selection && selection.place) params.set('place',selection.place); return await json('/api/life-sim/birth?' + params.toString(),{signal:controller.signal}); }
      finally { clearTimeout(timeout); }
    },
    locations: function(country,signal) { return json('/api/life-sim/locations' + (country ? '?country=' + encodeURIComponent(country) : ''),{signal:signal}); },
    chapter: function(payload,signal) { return json('/api/life-sim/chapter',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload),signal:signal}); },
    ai: function(payload,signal) { return json('/api/life-sim/ai',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload),signal:signal}); }
  };
  function deactivate() { generation++; if (view) view.destroy(); view = null; }
  async function init(el) {
    deactivate(); var current = generation;
    try { await load(); if (current !== generation || !el.isConnected) return;
      var storage; try { storage = localStorage; } catch (_) { storage = { getItem: function () { return null; }, setItem: function () { throw new Error('unavailable'); } }; }
      view = LifeSimView.mount(el, { text: window.__locale.lifeSim, lang: document.documentElement.lang, storage: storage, services: services });
    } catch (_) { if (current === generation) el.textContent = window.__t('lifeSim.loadError'); }
  }
  return { init: init, deactivate: deactivate };
})();
