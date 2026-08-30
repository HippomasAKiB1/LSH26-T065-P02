import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  classifyDays,
  daysUntilExpiry,
  formatPaisa,
  itemValuePaisa,
  normalizeCase,
  parseMoneyToPaisa,
  summarizeStock,
  sixMonthRisk,
} from "../src/pharmacy.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const fixture = JSON.parse(fs.readFileSync(path.join(__dirname, "../data/P02_pharmacy_expiry_public.json"), "utf8"));

test("expiry boundaries exactly follow clarification", () => {
  assert.equal(classifyDays(-1), "expired");
  assert.equal(classifyDays(0), "soon");
  assert.equal(classifyDays(30), "soon");
  assert.equal(classifyDays(31), "within90");
  assert.equal(classifyDays(90), "within90");
  assert.equal(classifyDays(91), "safe");
});

test("date difference is timezone independent", () => {
  assert.equal(daysUntilExpiry("2026-08-16", "2026-08-16"), 0);
  assert.equal(daysUntilExpiry("2026-08-16", "2026-09-15"), 30);
  assert.equal(daysUntilExpiry("2026-08-16", "2026-08-15"), -1);
});

test("money uses exact paisa arithmetic", () => {
  assert.equal(parseMoneyToPaisa("18.75"), 1875);
  assert.equal(itemValuePaisa({ quantity: 3, unit_price_bdt: "18.75" }), 5625);
  assert.match(formatPaisa(5625), /56\.25/);
});

test("returned items leave active counts and value totals", () => {
  const sample = normalizeCase({
    today: "2026-08-16",
    items: [
      { id: "A", name: "A", company: "X", batch: "B1", quantity: 10, unit_price_bdt: "2.00", expiry: "2026-08-16" },
      { id: "B", name: "B", company: "X", batch: "B2", quantity: 5, unit_price_bdt: "3.00", expiry: "2026-08-20" },
    ],
  });
  const all = summarizeStock(sample.items, new Set(), sample.today);
  const after = summarizeStock(sample.items, new Set(["A"]), sample.today);
  assert.equal(all.counts.soon, 2);
  assert.equal(all.soonValuePaisa, 3500);
  assert.equal(after.counts.soon, 1);
  assert.equal(after.soonValuePaisa, 1500);
});

test("all 25 public cases normalize and contain at least 40 medicines", () => {
  assert.equal(fixture.cases.length, 25);
  for (const source of fixture.cases) {
    const c = normalizeCase(source);
    assert.ok(c.items.length >= 40, `${c.case_id} has fewer than 40 medicines`);
    const summary = summarizeStock(c.items, new Set(c.mark_returned), c.today);
    assert.equal(summary.activeCount, c.items.length - new Set(c.mark_returned).size);
    assert.equal(
      summary.counts.expired + summary.counts.soon + summary.counts.within90 + summary.counts.safe,
      summary.activeCount,
    );
  }
});


test("six-month chart excludes returned and already expired stock", () => {
  const sample = normalizeCase({
    today: "2026-08-16",
    items: [
      { id: "OLD", name: "Expired", company: "X", batch: "E1", quantity: 2, unit_price_bdt: "10.00", expiry: "2026-08-15" },
      { id: "AUG", name: "August", company: "X", batch: "A1", quantity: 3, unit_price_bdt: "10.00", expiry: "2026-08-30" },
      { id: "SEP", name: "September", company: "X", batch: "S1", quantity: 4, unit_price_bdt: "10.00", expiry: "2026-09-10" },
      { id: "RET", name: "Returned", company: "X", batch: "R1", quantity: 9, unit_price_bdt: "10.00", expiry: "2026-09-20" },
    ],
  });
  const buckets = sixMonthRisk(sample.items, new Set(["RET"]), sample.today);
  assert.equal(buckets[0].valuePaisa, 3000);
  assert.equal(buckets[1].valuePaisa, 4000);
  assert.equal(buckets.reduce((sum, bucket) => sum + bucket.valuePaisa, 0), 7000);
});
