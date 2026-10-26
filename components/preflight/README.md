# Pre-Flight dashboard UI

Five screens for a supply chain / logistics dashboard, as plain React + TypeScript.
Converted from the design canvas so they drop into a real app.

Type-checked clean under `tsc --strict`. Not rendered in a browser — see
**What has not been checked** at the bottom.

## Files

| File | What it is |
|---|---|
| `tokens.ts` | Colours, fonts, the verdict→colour map. Start here to re-skin. |
| `ui.tsx` | Shared primitives: `Page`, `Card`, `StatTile`, `Button`, table bits. |
| `data.ts` | Sample data + the types the screens read. **Swap this for your selectors.** |
| `ControlTower.tsx` | Screen 1 — portfolio view. Client component (filter state). |
| `ExceptionQueue.tsx` | Screen 2 — ranked findings worklist. Client component (selection). |
| `RuleHealth.tsx` | Screen 3 — rule × booking matrix. Static, works as a server component. |
| `ShipmentDetail.tsx` | Screen 4 — reworked single-shipment screen. Static. |
| `WarehouseCheck.tsx` | Screen 5 — 390px phone task. Client component (stepper). |
| `Landing.tsx` | Landing page with the animated check and a Start CTA. |
| `landing-preview.html` | The same landing page, standalone. Open it in a browser to see it. |

### Landing page

```tsx
import Landing from '@/components/preflight/Landing';

<Landing startHref="/app" />        // Start is an <a>
<Landing onStart={() => ...} />     // or a <button>
```

Its CSS is scoped under `.pf-landing`, so nothing leaks into your global
styles. Keyframes cannot be inline, so it ships one `<style>` element —
that is the only place in this set that differs from the inline-style rule.

The animation is the product: ten rules sweep across BK-101 on a 7s loop,
eight pass, R-07 costs money, R-04 stops it. Change the `CELLS` array at the
top of the file to show a different booking. `prefers-reduced-motion` is
honoured — those viewers get the settled result with no motion.

## Dependencies

React 18 or 19. Nothing else — no Tailwind, no icon pack, no CSS import.
Styling is inline on purpose so these render correctly the moment you paste
them in, before any config is lined up.

`ControlTower`, `ExceptionQueue` and `WarehouseCheck` carry `'use client'`
for the Next.js App Router. Drop that line on Vite / CRA / Pages Router.

## Dropping them in

```
src/components/preflight/   ← put all eight files here
```

Then route to them:

```tsx
// app/control-tower/page.tsx
import ControlTower from '@/components/preflight/ControlTower';
export default function Page() {
  return <ControlTower />;
}
```

The screens assume a dark page behind them. `Page` paints its own
background, so no global CSS change is needed.

`ControlTower` links rows to `/shipments/${id}` — change that `href` to
whatever your detail route is.

## Wiring to real data

Every screen reads from `data.ts` and nothing else. The contract is small:

```ts
type Verdict = 'pass' | 'fail' | 'warn' | 'na';

interface Shipment {
  id: string;
  seller: string;
  lane: string;
  riskGbp: number | null;   // null = nothing at risk
  tally: string;            // "R-02, R-03, R-04 blocking"
  stage: string;            // held-at stage, or 'Clear'
  blocked: boolean;
  rules: Verdict[];         // R-01..R-10, in order — length 10
}
```

`rules` drives both the strips on the control tower and the matrix on the
rule-health screen, so as long as you return ten verdicts in rule order,
both screens light up correctly.

`Finding` (in `data.ts`) is the shape behind the exception queue and the
detail cards: `found` / `expected` / `consequence` / `diagnosis` / `fix`,
which mirrors how your existing finding cards already read.

Derived numbers — total exposure, hit counts, quiet rules, the stage
histogram — are computed in the components from those two arrays, so they
stay correct when the data changes. Only the four headline counts on the
exception queue (`11`, `4`, `7`) are still hardcoded strings; compute them
from your findings list when you wire it up.

## If you are on Tailwind

Convert `ui.tsx` first. The screens mostly compose those primitives, so
most of the inline style disappears once `Card`, `StatTile`, `Button`, `Th`
and `Td` are class-based. `tokens.ts` maps straight onto a theme extension.

## Accessibility, as written

Kept deliberately, worth not regressing:

- Real `<button>`, `<a href>`, `<input>` + `<label>` — nothing clickable on a div
- Touch targets ≥44px; the phone stepper is 56px
- `aria-pressed` on the filter tabs and queue rows, `aria-label` on the icon-only steppers
- Every status colour is backed by a text label, so pass/fail never depends on
  telling red from green
- Body text clears 4.5:1 on its surface
- `<th scope="col">` / `scope="row"` on both tables
- Tables scroll inside their card; every layout reflows at phone width

## About the data

The sample figures are real — read out of the live demo set at
preflight-three-mu.vercel.app on 26-10-2026: the five bookings, the ten
rules and their wording, the pass/fail matrix, the carrier tables.

The failure matrix reconciles against the app's own per-booking red/amber
counts for all five bookings.

One exception, flagged in a comment in `data.ts`: BK-104's R-06 finding
card was past the read limit, so its `consequence` and `diagnosis` are
written from the rulebook entry and the booking's own figures rather than
quoted. It deliberately offers no one-click fix, because a dangerous-goods
declaration is a decision, not a typo.

## What has not been checked

`Landing.tsx` **was** rendered and checked in a browser, via
`landing-preview.html`: the loop runs, the sweep travels, the cells settle on
the right colours, it fits 1280x900 with no scroll, and 375px wide with no
horizontal scroll. The React port is a direct transcription of that verified
markup and CSS, but the port itself has only been type-checked.

The five dashboard screens compile but have **not** been rendered — the
Pre-Flight app is not in the repo this was built from, so there was no app to
mount them in. Before you trust the layout, run each screen once and look at:

- the control tower table at ~900px, where the five columns get tight
- the rule matrix at phone width (it scrolls, but check the row headers)
- `ShipmentDetail`'s carrier sliders, which are uncontrolled (`defaultValue`)
  and do not yet re-rank anything
