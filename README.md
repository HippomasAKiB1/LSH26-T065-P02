# ShelfGuard — Pharmacy Expiry Operations

**Team ID:** `LSH26-T065`  
**Problem ID:** `P02`  
**Repository:** `lsh26-t065-p02`  
**Live URL:** https://lsh-26-t065-p02.vercel.app/

ShelfGuard turns a pharmacy stock list into an operational expiry-management console. It calculates the required expiry groups from the case reference date, shows the exact taka value currently exposed, and moves distributor returns out of every active count and value calculation.

## Run locally

There is **no build step and no third-party runtime dependency**. Node.js is used only for the local static server and automated tests.

```bash
npm run serve
```

Open:

```text
http://127.0.0.1:4173
```

Run the business-rule test suite:

```bash
npm test
```

The application automatically loads:

```text
data/P02_pharmacy_expiry_public.json
```

The **Import JSON** control also accepts the organizer fixture wrapper or a single compatible P02 case object in the published shape.

## Judge verification path

1. Open the live URL and select an organizer case.
2. Confirm **Active inventory** shows the required medicine records and fields. **R1**
3. Click the expiry KPI cards to inspect **Expired**, **0-30 days**, **31-90 days**, and **Safe** groups using the case `today` value. **R2**
4. From the priority or inventory workflow, choose **Mark returned**. Confirm the batch moves to **Returned stock** and is removed from active counts and active value totals. **R3**
5. Check **Current exposure**, **Expired value**, and **0-30 day value**. The application calculates stock value as `quantity × unit_price_bdt`. **R4**

## Requirement evidence

| Requirement | Implementation evidence |
|---|---|
| **R1 — Stock list** | Judge-shaped JSON loads directly. The Active Inventory section displays medicine, company, batch, quantity, expiry, derived status, unit purchase price, and stock value. |
| **R2 — Four expiry groups** | `src/pharmacy.js` derives mutually exclusive groups from the selected reference date: `<0`, `0..30`, `31..90`, and `>90`. Boundary tests cover `-1`, `0`, `30`, `31`, `90`, and `91`. |
| **R3 — Distributor return** | Return state is applied before active counts and active monetary totals are calculated. Returned batches appear in a separate register and can be restored for verification. |
| **R4 — Taka value at risk** | Purchase value is calculated as `quantity × unit price`. Monetary values are converted to integer paisa before arithmetic. Expired value and 0-30-day value are calculated separately. |

## Additional UX and operational features

- Search by medicine, company, batch, or ID.
- Filter by company and derived expiry status.
- Clickable KPI cards that jump to the relevant inventory group.
- Priority queue for expired and near-expiry batches.
- Six-month calendar exposure view.
- Quick-add medicine workflow.
- Explicit loading, success, error, and empty states.
- Responsive desktop/mobile layout.
- Keyboard-visible focus states.

## Architecture

```text
index.html                 semantic application shell
styles.css                 responsive design system and UI states
src/pharmacy.js            validation, date, money, and expiry logic
src/app.js                 state, rendering, and user workflows
data/                       organizer public fixture
scripts/serve.mjs          dependency-free local static server
tests/pharmacy.test.js     automated business-rule tests
docs/TEST-MATRIX.md        edge-case and manual QA matrix
```

Core arithmetic is kept outside DOM rendering code. The same pure functions used by the interface are exercised directly by the automated tests.

## Major design decisions

1. **Use the case reference date rather than the machine date.** This keeps judge and hidden cases deterministic.
2. **Use UTC calendar arithmetic.** Browser timezone differences cannot move a medicine across the 30/31 or 90/91-day boundaries.
3. **Use integer-paisa money calculations.** This avoids binary floating-point rounding errors in value-at-risk totals.
4. **Apply returned state before active calculations.** Returned batches are truly removed from active counts and value totals rather than only hidden visually.
5. **Keep the runtime dependency-free.** The deployed application has no backend or third-party API dependency that could fail during judging.
6. **Keep required flows separate from optional UX.** Search, charts, priority views, and quick-add are layered over the tested R1-R4 calculation engine.

See [`docs/TEST-MATRIX.md`](docs/TEST-MATRIX.md) for the explicit boundary and smoke-test matrix.

## Mocked / production boundaries

No required calculation or workflow is mocked. The application processes organizer judge-shaped JSON directly in the browser.

A production implementation would additionally include authenticated users, persistent inventory storage, server-side authorization, audit history, and distributor integrations. Those are intentionally outside the scope of this four-hour build. Current add/return actions are session-only and reset when the case is restored or the application is reloaded.

## Approach and member contributions

**Approach:** translate the published requirements and clarification boundaries into pure date, money, expiry, and return-state functions; verify them against the public fixture shape and boundary tests; then build the operational UI over the tested calculation engine.

| Registered member | Major contribution |
|---|---|
| Akib Hasan Pyil (`HippomasAKiB1`) | Led repository integration and implementation of expiry classification, inventory-risk calculations, returned-stock handling, automated testing, Git workflow, deployment, and final submission preparation. |
| Nazat E Rose (`Rhythm-099`) | Contributed to interface and workflow review, inventory and return-flow validation, responsive behaviour checks, and manual verification before deployment. |

## AI assistance disclosure

AI assistance was used during the event for decomposition, implementation drafting and review, edge-case analysis, test design, UI iteration, documentation drafting, and debugging support.

The team reviewed the assisted output against the published P02 specification and clarifications, ran the automated test suite, tested the organizer fixture cases, and manually verified the deployed workflows.

## Known limitations

- The application is client-side only and does not persist inventory changes to a remote database.
- Returned-state changes and manually added medicines are session data.
- Imported JSON must follow the expected P02 case structure; incompatible input is rejected rather than automatically transformed.

## Final submission preflight

Before submitting the repository, run:

```bash
npm test
npm run preflight
```

The preflight checks required repository files, event identifiers, manifest structure, submission metadata, requirement statuses, and leftover placeholders.

After the final commit is pushed, verify the deployed URL in a private/incognito window and record the exact 40-character commit SHA for the submission form.
