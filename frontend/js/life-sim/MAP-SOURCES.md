# Offline geography and local-life context

Retrieved / compiled 2026-11-05. No runtime requests go to the following providers. Moving this module to a new project requires copying `geography.js`, `map.js`, this notice and the existing locale objects alongside the engine/view.

## Land layer

Natural Earth `ne_110m_land` (1:110 million), public domain:

- Source: https://github.com/nvkelso/natural-earth-vector/blob/master/geojson/ne_110m_land.geojson
- Download: https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_110m_land.geojson
- Terms: https://www.naturalearthdata.com/about/terms-of-use/
- Original GeoJSON SHA-256: `9e0729ee253ca7d7a5c4ae9395fb1902264c5377c52e224d13dd85010e2835d9`

127 land polygons converted to SVG paths in `geography.js`. Projection is equirectangular: x = (longitude + 180) × 960/360, y = (90 − latitude) × 480/180. SVG coordinates rounded to two decimals. The low-resolution physical layer provides geographic orientation; it has no roads, administrative or political boundaries. It is not a street map or navigation product.

## City reference points

© GeoNames, licensed under Creative Commons Attribution 4.0:

- https://www.geonames.org/about.html
- https://creativecommons.org/licenses/by/4.0/
- Extract: https://download.geonames.org/export/dump/cities15000.zip

Selected by GeoNames ID, not names alone (several Chinese locations are named Changsha). Coordinates are WGS84 and identify city reference points, not a dwelling, exact administrative center, or player/device location. Coordinates are stored as supplied; display rounds to five decimals. Names are localized by the game.

| Game ID | GeoNames ID | Latitude | Longitude |
|---|---:|---:|---:|
| changsha | 1815577 | 28.19874 | 112.97087 |
| shaoyang | 1816920 | 27.23818 | 111.46214 |
| osaka | 1853909 | 34.69379 | 135.50107 |
| nagano | 1856215 | 36.65000 | 138.18333 |
| saopaulo | 3448439 | -23.54750 | -46.63611 |
| recife | 3390760 | -8.05389 | -34.88111 |

These six point records are retained for legacy engine/map compatibility. The current AI reader uses shared-catalog profiles instead, with country reference coordinates and full-name provider search links. Attribution is shown with the map. Provider access is optional through source links; gameplay, basemap, zoom, pan and location selection remain local. Domestic accessibility depends only on reaching the game's own origin, not access to overseas tile servers. Mainland network and production hosting availability have not been independently verified.

## Local-life descriptions

Legacy bilingual summaries remain at `lifeSim.environments` in both locale files; the current AI reader does not use them as a loading fallback. Local-life introductions now come from the canonical-place AI service and are labeled as potentially inaccurate. The following describes the retained legacy material. Geography, climate and cultural context are based on the linked municipal, provincial, government-approved education and official tourism sources. Descriptions of housing choices, commuting trade-offs, family support and everyday routines are general interpretive context, not measured household data. They neither predict a resident's life nor update into the simulation's future years. No real rents, wages, tuition, benefit eligibility or treatment advice are asserted. The separate character-context card is generated from fictional game state.

Additional Recife background: https://www2.recife.pe.gov.br/servico/cidade-1 and https://visit.recife.pe.gov.br/informacoes/clima/ . Nagano winter context: https://www.city.nagano.nagano.jp/documents/899/r07tirashi-english.pdf . These per-city primary-source links remain in the legacy locale material. Do not substitute prefecture/state-wide statistics for city-level conditions.

## Real map provider links (2026-11-05)

Current shared-catalog profiles search full names through `https://www.amap.com/search?query=...` in China and Google Maps search URLs (`api=1&query=...`) elsewhere. Reference coordinates are country-level and must not be used as city coordinates. Satellite/Street View point links below are retained legacy helpers; current global profiles do not claim precise imagery coverage.

China points use the official Amap marker URI: https://lbs.amap.com/api/uri-api/guide/mobile-web/point . We pass `position=longitude,latitude`, explicitly set `coordinate=wgs84` (GeoNames coordinates), and `callnative=0`. No approximate client-side GCJ-02 transform is needed for this URI.

Other points use Google Maps URLs: https://developers.google.com/maps/documentation/urls/get-started . All URLs set `api=1`; search uses `query=latitude,longitude`, satellite uses `map_action=map`, `center`, `basemap=satellite`, and Street View uses `map_action=pano` / `viewpoint`. Parameters are URL-encoded; Maps URLs do not require an API key.

These are explicit, separate-window links with `noopener noreferrer`, not embedded providers or unlicensed tile proxies. Opening a map passes only a place label or reference point, never a character's name, finances or save. AI life generation separately sends fictional character context to the game backend. External coverage, imagery dates and network availability vary; Amap does not promise Google-style street panoramas, and Google access in mainland China is not guaranteed. Existing offline map controls remain usable without providers. An in-page Google Maps Embed API integration would need separate project/API key configuration (https://developers.google.com/maps/documentation/embed/get-started) and a corresponding CSP/privacy integration.
