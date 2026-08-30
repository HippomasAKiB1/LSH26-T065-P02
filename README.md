# ShelfGuard — Pharmacy Expiry Intelligence

**Team ID:** `LSH26-T065`  
**Problem ID:** `P02`  
**Repository:** `lsh26-t065-p02`  
**Live URL:** https://lsh-26-t065-p02.vercel.app/

ShelfGuard turns a pharmacy stock list into an operational expiry console: it calculates the four required expiry groups from the active reference date, exposes the exact taka value at immediate risk, and moves distributor returns out of every active count and value in one action.

## Run and verify

There is **no build step and no third-party runtime dependency**. Node.js is only used for the local server and automated tests.

```bash
npm run serve
# open http://127.0.0.1:4173
```

Run the business-rule suite:

```bash
npm test
```

The app automatically loads `data/P02_pharmacy_expiry_public.json`. **Import JSON** also accepts the organizer fixture wrapper or one P02 case object in the published shape.

## 60-second judge verification path

1. Open the live URL. The organizer fixture loads automatically and the case selector becomes available.
2. Confirm **Active inventory** contains 40+ stock records and displays medicine, company, batch, quantity, expiry, status, unit purchase price and stock value. **R1**
3. Click the four KPI cards. They filter the stock to **Expired**, **0-30 days**, **31-90 days** and **Safe** using the case's `today` value. **R2**
4. From **Highest-priority batches**, click **Mark returned**. The batch moves to **Returned stock** and immediately disappears from active counts and active value totals. **R3**
5. Check **Current exposure** plus the Expired and 0-30 KPI values. They use `quantity x unit_price_bdt`; expired and 0-30 are kept separate exactly as clarified. **R4**

## Required-item proof

| Requirement | Implementation evidence |
|---|---|
| **R1 — Stock list** | Judge-shaped JSON loads directly. Active stock shows all required fields and all 25 public cases contain at least 40 medicines. |
| **R2 — Four groups** | `src/pharmacy.js` derives mutually exclusive groups from the selected reference date: `<0`, `0..30`, `31..90`, `>90`. Boundary tests cover `-1, 0, 30, 31, 90, 91`. |
| **R3 — Distributor return** | Return state is separate from the source inventory. A returned ID is excluded before group counts and active value totals are calculated, then rendered in a dedicated returned register. Restore is included for verification. |
| **R4 — Taka value at risk** | Purchase value is `quantity x unit price`. Money is parsed to integer paisa before arithmetic. Expired value and 0-30-day value are calculated separately. |

## Bonus and UX work

- Search by medicine, company, batch or ID.
- Filter by company and derived expiry status.
- Clickable KPI cards jump directly to the matching inventory group.
- Priority action queue surfaces expired/near-expiry batches by urgency and value.
- Six-month calendar exposure chart.
- Quick-add modal with a one-year default shelf life from the active reference date.
- Explicit loading, success, error and empty states.
- Responsive desktop/mobile layout and keyboard-visible focus states.

## Architecture

```text
index.html                 semantic application shell
styles.css                 responsive design system and UI states
src/pharmacy.js            pure validation, date, money and expiry logic
src/app.js                 state, rendering and user workflows
data/                       organizer public fixture
scripts/serve.mjs           dependency-free local static server
tests/pharmacy.test.js      automated business-rule tests
docs/TEST-MATRIX.md         edge-case and manual QA matrix
```

Core arithmetic does not live in DOM rendering code. The same pure functions used by the dashboard are exercised directly by the test suite.

## Major decisions

1. **Fixture date, not machine date, drives judging.** Hidden cases remain deterministic because the published `today` value is the calculation reference.
2. **UTC calendar arithmetic.** Date differences are computed from UTC midnight so browser timezone cannot move a medicine across the 30/31 or 90/91-day boundaries.
3. **Integer-paisa money.** Value-at-risk arithmetic avoids binary floating-point errors.
4. **Return state is applied before all active calculations.** This directly implements clarification R-24 rather than cosmetically hiding a returned row.
5. **Dependency-free runtime.** A static deployment has fewer failure points and the judge can open the live URL without setup.
6. **Required flows before bonus UI.** Search, chart, priority queue and quick-add are layered over the already-tested R1-R4 calculation engine.

See [`docs/TEST-MATRIX.md`](docs/TEST-MATRIX.md) for the explicit boundary and smoke-test matrix.

## Mocked / production boundaries

No required calculation or workflow is mocked. The application processes the organizer's real judge-shaped JSON in the browser.

Production systems would additionally add authenticated users, persistent inventory storage, audit history, distributor integration and server-side authorization. Those are intentionally outside this four-hour sprint; current add/return actions are session-only and reset when the case is reloaded.

## Approach and member contributions

**Approach:** lock down the specification and clarification boundaries first; implement pure date/money/return calculations; test the public fixture shape; then build the operational UI and bonus workflows over the verified engine.

| Registered member | Major contribution |
|---|---|
| Akib Hasan Pyil (`@HippomasAKiB1`) | Led repository integration and implementation of the expiry classification, inventory-risk calculations, returned-stock handling, testing, and final Git/deployment workflow. |
| Nazat E Rose (`@Rhythm-099`) | Contributed to interface refinement, inventory and return workflow review, responsive behaviour checks, and manual verification of the user flows before deployment. |

## AI assistance disclosure

AI assistance was used during the event for decomposition, implementation drafting/review, edge-case analysis, test design, UI iteration, documentation drafting and debugging support. Team members reviewed the output, ran the tests and remain responsible for the submitted implementation.

## Final submission preflight

After this build is copied into the real repository (which already contains the organizer `EVENT.md`) and after repository URLs, live URLs, exact 40-character SHAs, and member contributions are final, run:

```bash
npm run preflight
```

The preflight checks the required repository files, event identifiers, manifest structure, final URLs/SHAs, requirement statuses, and leftover submission placeholders. It is intentionally expected to report placeholders until the final submission metadata is filled.
