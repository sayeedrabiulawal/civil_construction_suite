# Civil Construction Suite

A web app of **107 civil engineering calculators** covering construction materials,
concrete, steel, RCC, foundations, soil, surveying, hydraulics, transportation,
geometry, unit conversion and BOQ.

Every calculator runs entirely in the browser with no backend and no database. It
installs as a PWA and works fully offline after the first visit.

There is also an optional **AI assistant** that answers civil engineering questions
and links to the right calculator. It is off until you give it a free API key —
see [AI assistant](#ai-assistant) below. The calculator side of the app never
depends on it.

---

## Quick start

```bash
npm install
npm run dev        # http://localhost:5173
npm run test       # 231 unit tests
npm run build      # typecheck + production bundle in dist/
npm run preview    # serve the production build (needed to test the PWA)
```

To switch the assistant on locally, copy `.env.example` to `.env` and paste a free
API key into it. Everything else works without one.

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
  components/        # Field, CalculatorCard, Chart, ChatPanel, ChatWidget, Markdown
  screens/           # ListScreen, CalculatorScreen, HistoryScreen, BoqScreen, AssistantScreen
  store/             # pubsub, storage (favourites/history/theme), boqStore, chatStore
  hooks/             # useInstallPrompt
  pwa.ts             # service worker registration
server/
  chat.ts            # the assistant backend: provider call, stream relay, limits
api/
  chat.ts            # Vercel Edge Function entry point (POST /api/chat)
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

149 tests across the three engine test files (`units`, `boq`, `engine` in
`src/core/`) cover four things:

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

`server/chat.test.ts` and `src/core/{markdown,chat}.test.ts` add 82 more for the
assistant: config resolution, prompt building, request sanitising, the stream
relay, LaTeX folding and the markdown parser.

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

## AI assistant

A chat assistant that answers civil engineering questions, works through the
numbers, and **links straight to the calculator that does it for you**. It reaches
the user two ways, both driven by the same `components/ChatPanel.tsx`:

- a **floating widget**, available from every screen and remembered across reloads;
- a **full-page route** at `/assistant`, which is the comfortable shape on a phone
  and the only one that can be linked to.

It knows the current page, so "explain this" works while a calculator is open. It
does **not** read the numbers you have typed — ask it to and it will tell you it
cannot see your screen, which is the honest answer.

### Turning it on is free

The assistant is provider-agnostic: it speaks the OpenAI `/chat/completions` shape,
which Google AI Studio, Groq, OpenRouter, Cerebras and a local Ollama all expose.
Every option below has a free tier and needs no credit card.

| Provider             | `AI_BASE_URL`                                             | Notes                                                                                         |
| -------------------- | --------------------------------------------------------- | --------------------------------------------------------------------------------------------- |
| **Google AI Studio** | `https://generativelanguage.googleapis.com/v1beta/openai` | Quickest to set up; key from [aistudio.google.com/apikey](https://aistudio.google.com/apikey) |
| **Groq**             | `https://api.groq.com/openai/v1`                          | Very fast; key from [console.groq.com/keys](https://console.groq.com/keys)                    |
| **OpenRouter**       | `https://openrouter.ai/api/v1`                            | Use a model suffixed `:free`                                                                  |
| **Ollama (local)**   | `http://localhost:11434/v1`                               | Zero cost, no key, nothing leaves the machine                                                 |

Then set `AI_MODEL` to the model id the provider uses, e.g. `gemini-2.5-flash` or
`llama-3.3-70b-versatile`. Locally that is a `.env` file; on Vercel it is
**Settings → Environment Variables**. `.env.example` has all four recipes
commented out, ready to paste.

### Why there is a serverless function

A static site cannot hold an API key: anything shipped in the bundle is public.
So the browser talks to `POST /api/chat`, and the key stays in the environment.

```
browser ──POST /api/chat──► api/chat.ts ──Bearer key──► provider
        ◄── normalised SSE ── server/chat.ts ◄── provider SSE ──
```

- `server/chat.ts` holds **all** the logic and imports nothing from `src/`, so it
  runs unchanged in the Vercel Edge Function and in the Vite dev server.
- `api/chat.ts` is a two-line shim, so the host can be swapped without touching
  the logic.
- A Vite middleware serves the same handler during `npm run dev`, so there is only
  one implementation and `npm run dev` behaves like production, streaming included.

### What the server does

- **Owns the system prompt.** The persona claims and the model instructions live
  server-side, so a crafted request cannot replace them; a client-supplied system
  turn is dropped.
- **Normalises the stream.** Providers format SSE slightly differently, including
  content delivered as an array of parts. The relay re-emits a tiny two-frame
  protocol (`delta` / `error`) plus `[DONE]`, so the client never needs to know
  which provider answered.
- **Relays incrementally.** The response body is piped through unbuffered, so
  tokens arrive as they are produced rather than after the answer completes.
- **Limits everything.** 24 turns, 6,000 characters per turn, 24 KB of catalogue,
  1,500 output tokens, a 60-second upstream timeout, and an abort that follows the
  client's `AbortSignal` when the user navigates away or presses Stop.
- **Turns failures into sentences.** A rate limit, a bad key and a model that the
  account cannot use each produce different, actionable text, with the provider's
  own message appended when it sent one.

### What the client does

- **Builds the catalogue.** `core/chat.ts` flattens every calculator in _this_
  build into `id | name — summary [tags]` and sends it with each request, so the
  model can only link to calculators that actually exist. It is built on the client
  because the serverless bundle has no access to the registry.
- **Parses SSE itself** — a small reader over `ReadableStream`, with no SDK.
- **Stores threads in `localStorage`**, capped at 20 conversations and 80 messages
  each, re-validated on load so a corrupt record degrades to a blank chat.
- **Coalesces re-renders while streaming.** The store bumps a version on every
  emit and the whole app re-renders, so token updates are throttled to ~10 fps and
  only written to `localStorage` when a turn settles.

### Rendering model output safely

`components/Markdown.tsx` renders the answer, and there is **no `innerHTML` and no
sanitiser to get wrong**: `core/markdown.ts` parses a small markdown subset into
data, and React turns that data into elements. Model output is therefore text by
construction. Links beginning with `/` become router links, which is what turns the
catalogue into working navigation.

Two deliberate departures from CommonMark, both driven by this domain:

- **`_underscores_` is not emphasis.** `_` is a subscript here, and treating it as
  a delimiter turns every `f_ck` and `c_b` in an answer into mangled italic text.
  The prompt asks for `*asterisks*` instead.
- **LaTeX is folded to plain text.** The prompt tells the model not to emit it, but
  when it does anyway, `\frac{a}{b}`, `\sqrt{}`, `\sigma_c` and `$…$` are reduced to
  `(a)/(b)`, `√()`, `σ_c` and bare text rather than shown as raw markup. A lone `$`
  in a price is left alone.

### When it is not configured

The assistant reports itself as off rather than failing obscurely: both surfaces
show a short notice with links to get a free key, the environment variable names,
and the Ollama alternative. All 107 calculators keep working exactly as before.

---

## Features

- **Live results** — every keystroke recalculates
- **Unit dropdowns** on every physical input (81 units, metric and imperial)
- **107 calculators across 12 categories**, with ranked fuzzy search
- **Bill of Quantities editor** — multiple projects, CSV export, auto-saved
- **AI assistant** — a civil engineering chat that links to the right calculator
- **Favourites** (★) and **history** — the last 100 calculations, auto-saved
- **Light / dark theme**, remembered per device
- **Fully responsive** — sidebar becomes a horizontal strip on phones
- **Copy results** to the clipboard, formulas and code references on each page
- **Installable PWA** — works offline, with an in-app install button
- **No database** — favourites, history, bills and chats live in `localStorage`

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
- `/api/*` is deliberately never cached. A cached status probe would hide a
  working assistant, and server data is live by definition.
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

To enable the assistant, set `AI_BASE_URL`, `AI_API_KEY` and `AI_MODEL` as
environment variables on the host. With Vercel that is
**Settings → Environment Variables**; `api/chat.ts` reads them at the edge and
they are never exposed to the browser. On a static host with no serverless
functions, the assistant will simply report itself as unconfigured — everything
else keeps working.

## Roadmap

- [x] 100+ calculators
- [x] PWA manifest, service worker and offline install
- [x] Unit test suite for the engine
- [x] Persistent multi-line BOQ editor with CSV export
- [x] AI assistant that knows the calculator catalogue
- [ ] Charts (mix design curves, sieve gradation, stress–strain)
- [ ] Export a full calculation set as PDF
- [ ] Custom user-defined calculators
- [ ] Optional Bangla interface via an `l10n` layer
