# Pre-Flight

Cross-border shipment booking and pre-flight error checker, UK to EU.

Sellers fill in long forms, and small mistakes mean goods held at customs or units
reported missing at the receiving warehouse, discovered days later when the stock
is already stuck. This catches those mistakes before the shipment leaves, names
the field that is wrong, and recommends a carrier the shipment can actually
travel on.

No login, no key, no quota, no database. Everything runs in the visitor's
browser, which is why nothing in it can go down.

## Running it

```
npm install
npm test          # 165 unit tests over the engine
npm run dev       # http://localhost:3000
npm run build     # static export into out/
```

## Deploying

The app is a static export (`next.config.js` sets `output: 'export'`). It needs
no environment variables and no server.

```
npx vercel --prod
```

Vercel detects Next.js and serves `out/` as static files. Any static host works
equally well: the whole app is the contents of `out/`.

## Commodity codes

`lib/generated/` holds the UK Trade Tariff baked in at build time: 6,766 valid
six-digit subheadings and 8,272 official plain-English descriptions. Refresh it
with:

```
npm run tariff
```

That script is the only thing in this repo that touches the network, and it runs
on a developer's machine, never in a browser. The generated files are committed,
so a build needs no network and the shipped app makes no API call at all. R-01
can therefore tell a code that does not exist from one that is merely too short,
and the rulebook stays a pure function of its arguments.

The subheading list ships in the first load because it is small. The 204 KB
description vocabulary is loaded lazily after paint: it only widens the
suggestions, and verdicts are identical with or without it.

Contains public sector information licensed under the Open Government Licence
v3.0, from the [UK Trade Tariff](https://www.trade-tariff.service.gov.uk).

## How it is put together

The rule engine is pure. Everything in `lib/` is a function of its arguments:
no I/O, no network, no React, no model. The UI is a thin renderer over it.

```
lib/
  types.ts        Booking, Item, Issue, CarrierRow, Priority
  carriers.ts     the rate card (fixed data)
  rules.ts        validate(booking) -> Issue[]          <- the heart
  diagnose.ts     culprit-field logic used by rules.ts
  carrier.ts      recommend(booking) -> Recommendation
  readiness.ts    five stages, and the check-run node list
  parse-chat.ts   extract(text) -> Partial<Booking>
  parse-xlsx.ts   header mapping + sheet join
  sample-xlsx.ts  writes the sample and corrected workbooks
  fixtures.ts     the five demo bookings
  generated/      the UK Trade Tariff, baked in by scripts/fetch-tariff.mjs
  format.ts       gbp(), qty(), fmtDate(), parseDMY()
app/page.tsx      the three-region shell
components/       Chat, Upload, Queue, Verdict, CheckRun, Readiness,
                  BookingCard, ItemsTable, Issues, Carrier, Confirmation
```

Three rules the code holds to:

1. **One booking object.** The typed conversation and the uploaded spreadsheet
   populate the same `Booking` and run the same engine. There is no second path.
2. **No model does arithmetic.** The conversation parser is deterministic regex
   over a fixed vocabulary. A model that is right 95% of the time is wrong on
   exactly the rows that carry the planted errors.
3. **Nothing is uploaded.** Spreadsheets are parsed client-side with SheetJS.

## The ten rules

| ID | Rule | Severity |
|---|---|---|
| R-01 | Every item needs an HS code of at least 6 digits | Red |
| R-02 | Declared value equals the sum of quantity x unit price, within 1% | Red |
| R-03 | Per item, units per carton x cartons equals quantity | Red |
| R-04 | Booking cartons equal the sum of item cartons | Red |
| R-05 | Gross weight divided by pallets is within a carrier ceiling | Red |
| R-06 | No lithium batteries, aerosols or flammable liquids | Red |
| R-07 | Gross weight covers the net weight of the goods | Amber |
| R-08 | Warehouse deliveries need a booked appointment | Amber |
| R-09 | Every item needs a country of origin | Amber |
| R-10 | Ready-to-ship date must not be in the past | Amber |

Detecting a mismatch is trivial. Naming the culprit field is the product, so
each rule carries a diagnosis written as an instruction to a seller, a
confidence, a consequence in days and pounds, and where it is safe, a one-click
fix. Where there is no safe fix the card says so rather than guessing.

Costs are planning estimates from typical customs and freight charges, except
where the shipment's own numbers give a real figure (a carton shortfall, a value
gap), and the UI labels them as estimates.

## Design

One constraint drives the whole palette: red, amber and green carry the
rulebook's meaning, so the brand orange owns the header, the conversation rail
and primary buttons and never appears on a surface that reports a rule result.
Colours come from CSS custom properties on `:root`, redefined for dark mode, so
both themes are token-driven.
