# P02 Test Matrix

This matrix documents the high-risk rules verified by the automated suite and the fixture-loading workflow.

| Area | Cases verified | Why it matters |
|---|---|---|
| Expiry boundary | -1, 0, 30, 31, 90, 91 days | Proves the four groups are mutually exclusive at every published boundary. |
| Calendar arithmetic | ISO dates across browser timezone differences | Prevents day 30 from becoming day 29/31 because of local timezone conversion. |
| Money | decimal BDT converted to integer paisa | Prevents binary floating-point errors in value-at-risk totals. |
| Distributor return | returned batch removed from count and value totals | Directly covers clarification R-24. |
| Public input | all 25 organizer cases normalize; each has 40+ stock records | Confirms judge-shaped input compatibility before UI rendering. |
| Six-month chart | future stock only, returned/expired stock excluded | Keeps the bonus chart separate from required expired-loss totals. |

## Manual UI smoke test

1. Load the public fixture and switch between several cases.
2. Click each expiry KPI and confirm the inventory table filters to that exact group.
3. Mark a priority batch returned; confirm the active count/value and risk amount immediately decrease.
4. Restore the same batch; confirm every active calculation returns.
5. Change the reference date; confirm statuses and values recalculate without reloading sample data.
6. Import the organizer JSON file through **Import JSON** and confirm it produces the same case selector.
