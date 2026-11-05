# Between Lives / 人生之间

A build-free AI-authored life reader. The shared Area Search catalog supplies canonical birthplaces; a local rotating globe introduces the birthplace, then a welcome dossier presents country/local context and family before the reader begins. AI creates the fictional newborn, relationships, money, every subsequent event and all consequences. No local event/probability fallback is used by the reader.

## Module boundaries and migration

- `ai-engine.js`: portable geographic/snapshot validation, welcome/started lifecycle, immutable commits, save validation and minimal AI context. No DOM, network, event rolls or economic calculations.
- `view.js`: portable reader, details dialog, loading/retry, local saves/import/export and optional autoplay. Inject `{text, lang, storage, storageKey?, services}` into `LifeSimView.mount(element,config)` and call the returned `destroy()` on unmount.
- `map.js`, `geography.js`: local SVG orientation map and provider URL helpers.
- `globe.js`: a local Canvas 2D orthographic globe using the existing Natural Earth geometry. Rotates while birth generation is pending, eases toward the country reference point on arrival, and stops on unmount. Reduced motion uses a static globe.
- `style.css`: scoped classes and theme tokens. Dark default; `[data-theme="light"]` for light.
- `../life-sim-tool.js`: the only DevTools host adapter; lazy-loads versioned assets and injects services/locale.
- `engine.js`, `data.js`: old rule prototypes retained only for existing regression tests. Neither is loaded by the reader; there is no historical-save compatibility path.
- `../../locales/{zh-CN,en}.json`: translations under `lifeSim`.
- `backend/service/{life_catalog,life_chapters,life_ai}.py`: canonical geography, structured chapter generation and region prose. Reuse these or implement the same service interface in another project.

The injected service interface is:

```
birth(seed) -> Promise<world>
chapter({kind,lang,seed,places,context?,memories?},signal) -> Promise<chapter>
ai({kind:'intro',lang,location},signal) -> Promise<{title,body,country:{economy,ranking,environment,tourism}}>
```

The adapter calls same-origin `/api/life-sim/birth`, `/api/life-sim/chapter` and `/api/life-sim/ai`; no credentials enter frontend code. `standalone.html` uses these same APIs and translations independently of the host UI. Serve it through this Flask app at `/js/life-sim/standalone.html` (`?lang=en`). A static-only migration must provide a backend/service adapter; there is no offline story fallback. Copy this folder, translations and the chosen server adapter to migrate.

## AI and atomic progress

AI returns a complete snapshot: player name, age, life status, emotional tone, health/happiness, occupation/education, allowed location index, household/personal finances, stable people, chapter title/body and continuity summary. The server builds location names from canonical codes. Unknown request fields never enter prompts.

Both server and client validate bounds, stable identity, retained relationships, no resurrection, valid locations and age progression. AI chooses the entire financial snapshot; the app does not apply wages, interest, event probabilities or consequences itself. There are no fixed marriage, school or retirement milestones. Each next chapter advances 1–5 years; snapshots are bounded at 110 years, and death can happen at any next chapter. This is a storytelling constraint, not a mortality model. Validation cannot guarantee narrative truth or plausibility.

When continuing, only the primary button becomes a disabled gray `时光加载中...`; the committed chapter stays visible and details remain readable. New life generation uses the rotating globe; on arrival it opens a welcome dossier, not the first chapter. Only then are the chapter and history committed together. Timeout/invalid JSON/network failures preserve the previous age, balances and save, offer retry using the same request, and pause autoplay. No AI-off switch or local narration fallback remains. Cached AI chapters are readable on reload without a model call. Autoplay waits 6.5 seconds after a chapter is ready, stops while details are open, and pauses when the page is hidden. Reload never starts autoplay.

Calls send fictional character names, exact fictional balances, health, relationships and only the latest three chapter summaries. Full history is not uploaded. Do not import real private information. Country/local guides are AI-generated separately. Four country fields cover economy/living standards, global rankings, nature/environment and travel/culture; local prose describes everyday life. Numerical rankings must name a metric, year and known source; the prompt forbids fabricated ranks and asks for explicit uncertainty when unavailable. These are unverified AI references, not live statistical data. Pending guides use the same loading phrase and failures offer retry. The welcome page also shows family relationships, AI household/personal finances and a map. Its Begin button is enabled after a valid guide is saved. AI prose is always escaped plain text. Server logs exclude prompts, prose and character details.

The chapter endpoint uses the existing DeepSeek key (`DEV_TOOLS_DEEPSEEK_API_KEY`), bounded validation, shared rate limiting and a bounded one-hour process-local response cache. A cache miss after a server restart can produce a different response for an uncommitted request. No frontend key is needed. Tests mock model responses; live-provider quality/latency is not established by those tests.

## Saves and compatibility

Current snapshots use `version:2` under the `between-lives.v2` storage key; there is no legacy import/migration flow. The portable module includes a bounded geographic validator and has no dependency on the old rule engine. A life is saved with `started:false` after birth, plus a validated country/local introduction. Entering the life changes only `started` to true; it does not request another AI chapter or advance age. Refreshing an unstarted life reopens its welcome dossier. A cached introduction does not regenerate on refresh; an interrupted guide is requested again. The reader prevents next chapters/autoplay until the user enters.

One current life is stored per browser. History retains chapter prose and AI financial snapshots; importing is capped at 2 MB. Reset/import asks for confirmation. Failed parsing leaves stored bytes untouched. Storage failures keep the in-memory chapter and allow export. Moving domains requires export/import of the current format.

## Geography, map and fiction

The shared source has 194 raw features; 175 distinct named three-letter country/region records are usable after filtering blanks and duplicates. Some entries are administrative regions; 38 have no child region. Names may be outdated. China uses province/city/district data. Countries are equally sampled rather than weighted by births. Profiles contain up to two allowed locations; AI can only move among those. Country reference coordinates are labeled as such and never presented as street addresses.

The default page is a single-column story. People, local life, map, wealth, history and settings are in a neutral-color dossier dialog. Desktop uses a sidebar and relationship cards; mobile uses a nearly full-screen sheet with a fixed two-row section grid and independently scrollable content. Privacy detail is collapsed under More. Positive scenes use green, negative red, and death black, with a textual mood label. The map works locally without tiles, geolocation permissions or provider requests. Real map links use Amap in China and Google Maps elsewhere, opened on click with full-name searches; they are external links, not embedded street imagery. See [MAP-SOURCES.md](MAP-SOURCES.md) for attribution. Global financial amounts are fictional life points, not real local wages, prices or wealth statistics.

## Checks

The pytest/start gate runs legacy engine/map checks, global catalog checks, mocked structured-AI validation and portable immutable-save checks. Browser checks cover desktop/mobile, languages/themes, globe rotation/arrival, welcome data and explicit entry, button-only pending states, failures, retries, dossier scrolling, export/import and death. No real Redis or model APIs are used in automated tests.

The reader keeps the same connected dialog and navigation nodes across section switches, map actions and AI callbacks. `showModal()` runs only on a real opening; changing a section updates its content without replaying the modal entrance. Closing/reopening still plays the entrance normally. The persistent import input is cleared after reading a file, allowing the same save to be selected again.

With `./start.sh` running and an existing Playwright Core installation, run the focused browser regression with `PLAYWRIGHT_CORE_PATH=/path/to/playwright-core node frontend/js/life-sim/view.browser.test.cjs`. It mocks AI/statistics and checks dialog identity, animation counts, keyboard focus, scrolling and repeated imports across desktop/mobile, languages and themes. `LIFE_SIM_TEST_URL` overrides the default localhost origin.
