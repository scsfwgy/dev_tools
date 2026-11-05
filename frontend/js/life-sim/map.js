/* Portable offline map; no tiles, geolocation permission, network client or host globals. */
(function (root, factory) {
  'use strict';
  if (typeof module === 'object' && module.exports) module.exports = factory(require('./geography.js'));
  else root.LifeSimMap = factory(root.LifeSimGeography);
})(typeof globalThis !== 'undefined' ? globalThis : this, function (G) {
  'use strict';
  const locations = s => s && s.world ? Object.fromEntries(s.world.places.map(p => [p.id,p])) : G.locations;
  const project = (lon, lat) => ({ x: (lon + 180) * 960 / 360, y: (90 - lat) * 480 / 180 });
  const clamp = (n, min, max) => Math.min(max, Math.max(min, n));
  function bounds(x, y, width) {
    const w = clamp(width, 80, 960), h = w / 2;
    return { x: clamp(x, 0, 960 - w), y: clamp(y, 0, 480 - h), width: w, height: h };
  }
  function locate(id,state) {
    const p = locations(state)[id]; if (!p) throw new Error('Unknown location');
    if (!Number.isFinite(p.lon) || !Number.isFinite(p.lat)) return bounds(0,0,960);
    const point = project(p.lon, p.lat); return bounds(point.x - 60, point.y - 30, 120);
  }
  function zoom(box, factor) {
    const w = clamp(box.width * factor, 80, 960);
    return bounds(box.x + (box.width - w) / 2, box.y + (box.height - w / 2) / 2, w);
  }
  function pan(box, dx, dy) { return bounds(box.x + dx, box.y + dy, box.width); }
  function realMaps(id, label, state) {
    const p = locations(state)[id]; if (!p) throw new Error('Unknown location');
    const china = ['cn','CHN'].includes(p.country);
    if (p.precision === 'country') {
      const url = new URL(china ? 'https://www.amap.com/search' : 'https://www.google.com/maps/search/');
      url.search = new URLSearchParams(china ? {query:p.path} : {api:'1',query:p.pathEn}).toString();
      return {provider:china ? 'amap' : 'google',map:url.href};
    }
    if (china) {
      const url = new URL('https://uri.amap.com/marker');
      url.search = new URLSearchParams({position:p.lon + ',' + p.lat,name:label,coordinate:'wgs84',callnative:'0',src:'between-lives'}).toString();
      return {provider:'amap',map:url.href};
    }
    const point = p.lat + ',' + p.lon;
    const link = (path,params) => { const url = new URL(path,'https://www.google.com'); url.search = new URLSearchParams(Object.assign({api:'1'},params)).toString(); return url.href; };
    return {provider:'google',map:link('/maps/search/',{query:point}),satellite:link('/maps/@',{map_action:'map',center:point,zoom:'17',basemap:'satellite'}),streetView:link('/maps/@',{map_action:'pano',viewpoint:point})};
  }
  function svg(box, selected, state, t, esc, labelFor) {
    const r = box.width * .011, font = box.width * .025;
    const grid = [];
    for (let lon = -180; lon <= 180; lon += 30) { const x = project(lon, 0).x; grid.push('<path d="M' + x + ',0V480"/>'); }
    for (let lat = -60; lat <= 60; lat += 30) { const y = project(0, lat).y; grid.push('<path d="M0,' + y + 'H960"/>'); }
    return '<svg class="life-map-svg" style="--life-map-mobile-font:' + box.width * .04 + 'px" viewBox="' + [box.x,box.y,box.width,box.height].join(' ') + '" tabindex="0" role="group" aria-label="' + esc(t.mapHelp) + '"><title>' + esc(t.mapTitle) + '</title><rect width="960" height="480" class="life-map-ocean"/><g class="life-map-grid">' + grid.join('') + '</g><g class="life-map-land">' + G.land.map(d => '<path d="' + d + '"/>').join('') + '</g>' + Object.entries(locations(state)).filter(([id,p]) => Number.isFinite(p.lon) && Number.isFinite(p.lat) && (!state.world || id === selected)).map(([id,p]) => {
      const pos = project(p.lon,p.lat), active = id === selected;
      const label = labelFor ? labelFor(id) : t.places[id].name;
      return '<g class="life-map-pin' + (id === state.region ? ' is-home' : '') + (active ? ' is-selected' : '') + '" data-life-action="map:' + id + '" tabindex="0" role="button" aria-label="' + esc(t.locate + ' ' + label) + '" aria-pressed="' + active + '"><title>' + esc(label) + '</title><circle cx="' + pos.x + '" cy="' + pos.y + '" r="' + (r * 2.6) + '" class="life-map-hit"/><circle cx="' + pos.x + '" cy="' + pos.y + '" r="' + r + '"/>' + (active ? '<circle class="life-map-ring" cx="' + pos.x + '" cy="' + pos.y + '" r="' + r * 1.9 + '"/><text x="' + (pos.x + r * 2.6) + '" y="' + (pos.y - r * 2.6) + '" font-size="' + font + '">' + esc(label) + '</text>' : '') + '</g>';
    }).join('') + '</svg>';
  }
  return { locations:G.locations, allLocations:locations, project, bounds, locate, zoom, pan, realMaps, svg };
});
