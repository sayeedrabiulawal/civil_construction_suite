# Civil Construction Suite

A web app of **104 civil engineering calculators** covering construction materials,
concrete, steel, RCC, foundations, soil, surveying, hydraulics, transportation,
geometry, unit conversion and BOQ.

Everything runs in the browser. There is no backend and no database. It installs
as a PWA and works fully offline after the first visit.

---

## Quick start

```bash
npm install
npm run dev        # http://localhost:5173
npm run test       # 149 unit tests
npm run build      # typecheck + production bundle in dist/
npm run preview    # serve the production build (needed to test the PWA)
```

---

## The one idea that matters

**A calculator is data, not a screen.**

There is exactly _one_ calculator page, one input component and one result
renderer. Adding calculator #83 means writing one object in
`src/calculators/*.ts` — no new route, screen, component or CSS.

```
src/
  core/
    types.ts        # Calculator, InputField, OutputField, CalcResult
    units.ts        # every unit + how to convert it to the SI base unit
    engine.ts       # converts inputs to SI, runs compute, formats results
    format.ts       # number formatting, unit labels
    categories.ts   # the 12 categories
    registry.ts     # lookup, category filtering, ranked search
  calculators/      # DATA ONLY — one module per category
    shared.ts       # mix tables, densities, bond stress, bar formula
    geometry.ts  materials.ts  concrete.ts  steel.ts  rcc.ts
    foundation.ts  soil.ts  surveying.ts  hydraulics.ts
    transportation.ts  boq.ts  convert.ts
    index.ts        # the single list of all calculators
  components/        # Field, CalculatorCard
  screens/           # ListScreen, CalculatorScreen, HistoryScreen, BoqScreen
  store/             # pubsub, storage (favourites/history/theme), boqStore
  hooks/             # useInstallPrompt
  pwa.ts             # service worker registration
scripts/
  generate-icons.mjs # writes the PNG icon set, no image library needed
  sw.template.js     # service worker template, injected at build time
```

### Units: how the engine works

1. Every input that declares a `quantity` gets a unit dropdown.
2. `runCalculator` converts each input into the **SI base unit** of that quantity:

    | quantity | base |     | quantity    | base |
    | -------- | ---- | --- | ----------- | ---- |
    | length   | m    |     | force       | N    |
    | area     | m²   |     | pressure    | Pa   |
    | volume   | m³   |     | unitWeight  | N/m³ |
    | mass     | kg   |     | flow        | m³/s |
    | angle    | rad  |     | temperature | °C   |

3. `compute` therefore does all its arithmetic in SI, with no unit handling.
4. **Outputs are not converted.** Each output declares a `unit` label and
   `compute` must return the number already expressed in that unit. This keeps
   every formula explicit and readable.

> ⚠️ The one trap: a `dia` input with `defaultUnit: 'mm'` arrives in **metres**.
> Convert at the top of `compute` (`const diaMm = v.dia * 1000;`) and stay in one
> unit system from there. See `steel.ts` for the pattern.

### Adding a calculator

```ts
{
  id: 'curing-duration',
  name: 'Concrete Curing Duration',
  category: 'concrete',
  tags: ['curing', 'duration', 'strength gain'],
  summary: 'Curing period needed to reach a target strength ratio.',
  formula: 'Maturity = Σ (T + 10) × Δt',
  reference: 'IS 456:2000 Cl. 13.5',
  inputs: [
    { key: 'temp', label: 'Ambient temperature', quantity: 'temperature', defaultUnit: 'C', default: 25 },
  ],
  outputs: [
    { key: 'days', label: 'Curing period', unit: 'days', decimals: 0, hero: true },
  ],
  compute: (v) => ({ days: v.temp > 0 ? 100 / v.temp : 0 }),
}
```

Then add it to the array in the same file. It appears in search, its category, and
favourites automatically.

---

## Tests

```bash
npm run test
```

149 tests across `src/core/*.test.ts` cover four things:

1. **Unit conversions** — every unit round-trips, and the definitions match the
   exact values (1 ft = 0.3048 m, 1 acre = 4046.8564224 m², °F and K are affine).
2. **Known engineering values** — hand-checked results such as a development
   length of 47φ, 0.8889 kg/m for a 12 mm bar, and 64 MSA of design traffic.
3. **Every calculator must survive bad input.** These are the valuable ones:
    - every output is finite at its defaults;
    - nothing breaks with all inputs at zero;
    - nothing breaks when **any single** input is zeroed on its own;
    - no output ever comes back `NaN`.
4. **BOQ arithmetic and export** — contingency and tax apply in the right order,
   `lineAmount` copes with junk input, and the CSV has exactly one header row.

That third group found six genuine divide-by-zero bugs, each of which returned
`Infinity`. If you add a calculator, run the tests — they will catch a missing
guard for you.

Outputs that are _legitimately_ blank are listed in `INTENTIONAL_BLANK` in
`src/core/engine.test.ts`, each with the reason. Anything not on that list must be
a finite number.

---

## Bill of Quantities editor

The **Bill of Quantities** screen (`/boq`) is a persistent, multi-line priced bill.

- Add, edit, reorder and delete measured items, each with a description, unit,
  quantity, rate and optional remarks.
- Keep **several named bills** — one per project or tender — and duplicate one to
  start the next.
- Contingency, overhead and tax apply in the correct order: the percentages apply
  to the subtotal, and tax applies last of all.
- **Everything saves immediately** to `localStorage`. There is deliberately no
  "unsaved changes" warning, because there is never unsaved work.
- Export to **CSV** for Excel or Google Sheets, to a **wrapped text summary** for
  an email, to the clipboard, or to the printer.
- Quantities are totalled **per unit**, so 32.5 m³ and 310 m² are reported side
  by side rather than as a meaningless mixed sum.

The logic lives in `src/core/boq.ts` as pure functions (`computeTotals`,
`lineAmount`, `exportCsv`, `exportText`), and persistence in
`src/store/boqStore.ts`. Stored data is re-validated on load, so a corrupt or
older record degrades to a blank bill instead of crashing the screen.

> The UI uses inline inputs and two-step confirmation buttons rather than
> `window.prompt` / `window.confirm`, which are blocked in embedded frames and
> cannot be styled.

---

## Features

- **Live results** — every keystroke recalculates
- **Unit dropdowns** on every physical input (81 units, metric and imperial)
- **104 calculators across 12 categories**, with ranked fuzzy search
- **Bill of Quantities editor** — multiple projects, CSV export, auto-saved
- **Favourites** (★) and **history** — the last 100 calculations, auto-saved
- **Light / dark theme**, remembered per device
- **Fully responsive** — sidebar becomes a horizontal strip on phones
- **Copy results** to the clipboard, formulas and code references on each page
- **Installable PWA** — works offline, with an in-app install button
- **No backend** — favourites, history and bills live in `localStorage`

## The PWA and offline behaviour

`scripts/sw.template.js` holds the service worker logic. A small Vite plugin in
`vite.config.ts` injects the precache manifest and a version hash at build time,
so there is no `vite-plugin-pwa` or Workbox dependency.

The strategy:

- **Precache** the app shell, every hashed asset and the web fonts at install time.
- **Navigations** go network-first with a cached shell fallback.
- **Hashed assets** under `/assets/` are cache-first, which is always safe because
  a new build changes the filenames.
- Everything else is stale-while-revalidate.

The version hash changes whenever the asset list changes, which retires the old
caches on activate.

Two caveats:

- The service worker registers in **production builds only**, so `npm run dev`
  always shows your latest edits. Test offline behaviour with `npm run preview`.
- Run `npm run icons` only if you change the logo. The icons are committed, and
  the script needs no image library — it writes real PNGs from raw pixels.

## Engineering notes

Numbers follow IS 456:2000, IS 875, IS 383, IS 2720, IS 650, IS 2911, IS 1904,
IRC 37/38/66/73 and CPHEEO guidance, with the clause cited on each page. Every
calculator is a **preliminary estimating and checking tool** — it does not replace
a design by a qualified engineer or the governing code for your project.

A few calculators deliberately clamp their input to the range the source code
covers (the MSA design life, for instance) so that an impossible entry cannot
produce a meaningless figure. Those limits are stated in the calculator's notes.

## Deployment

The app is a static bundle in `dist/`, so any static host works. Because it uses
clean URLs, the host must rewrite unknown paths to `index.html`:

- **Netlify** — `public/_redirects` is included
- **Vercel** — `vercel.json` is included
- **GitHub Pages / other** — configure an equivalent SPA fallback, or switch
  `BrowserRouter` to `HashRouter` in `src/main.tsx`

A service worker requires HTTPS, which every host above provides by default.

## Roadmap

- [x] 100+ calculators
- [x] PWA manifest, service worker and offline install
- [x] Unit test suite for the engine
- [x] Persistent multi-line BOQ editor with CSV export
- [ ] Charts (mix design curves, sieve gradation, stress–strain)
- [ ] Export a full calculation set as PDF
- [ ] Custom user-defined calculators
- [ ] Optional Bangla interface via an `l10n` layer
