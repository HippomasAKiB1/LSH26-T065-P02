const DAY_MS = 86_400_000;

// Validates YYYY-MM-DD format and parses UTC timestamp to prevent browser timezone shifts
function requireIsoDate(value, fieldName = "date") {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw new Error(`${fieldName} must be YYYY-MM-DD.`);
  }
  const [year, month, day] = value.split("-").map(Number);
  const timestamp = Date.UTC(year, month - 1, day);
  const parsed = new Date(timestamp);
  if (
    parsed.getUTCFullYear() !== year ||
    parsed.getUTCMonth() !== month - 1 ||
    parsed.getUTCDate() !== day
  ) {
    throw new Error(`${fieldName} is not a valid calendar date.`);
  }
  return timestamp;
}

export function todayIso() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

// Computes day difference using UTC calendar midnights so daylight saving / client timezone cannot alter the count
export function daysUntilExpiry(today, expiry) {
  return Math.round((requireIsoDate(expiry, "expiry") - requireIsoDate(today, "today")) / DAY_MS);
}

// Expiry classification boundaries:
// - days < 0: Expired
// - 0 <= days <= 30: 0-30 days (inclusive)
// - 31 <= days <= 90: 31-90 days (inclusive)
// - days > 90: Safe
export function classifyDays(days) {
  if (days < 0) return "expired";
  if (days <= 30) return "soon";
  if (days <= 90) return "within90";
  return "safe";
}

export function classifyItem(item, today) {
  const days = daysUntilExpiry(today, item.expiry);
  return { days, status: classifyDays(days) };
}

// Monetary amounts are parsed into integer paisa (1 BDT = 100 paisa) to avoid IEEE 754 floating-point errors
export function parseMoneyToPaisa(value) {
  const text = String(value).trim();
  if (!/^\d+(?:\.\d{1,2})?$/.test(text)) {
    throw new Error(`Invalid taka amount: ${value}`);
  }
  const [whole, fraction = ""] = text.split(".");
  return Number(whole) * 100 + Number(fraction.padEnd(2, "0"));
}

export function formatPaisa(paisa) {
  const amount = Number(paisa) / 100;
  return new Intl.NumberFormat("en-BD", {
    style: "currency",
    currency: "BDT",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

export function itemValuePaisa(item) {
  const quantity = Number(item.quantity);
  if (!Number.isInteger(quantity) || quantity < 0) {
    throw new Error(`Invalid quantity for ${item.id || item.name || "item"}.`);
  }
  return quantity * parseMoneyToPaisa(item.unit_price_bdt);
}

export function normalizeItem(item, index = 0) {
  if (!item || typeof item !== "object") throw new Error(`Item ${index + 1} is invalid.`);
  const required = ["id", "name", "batch", "quantity", "expiry"];
  for (const field of required) {
    if (item[field] === undefined || item[field] === null || item[field] === "") {
      throw new Error(`Item ${index + 1} is missing ${field}.`);
    }
  }
  requireIsoDate(String(item.expiry), `expiry for ${item.id}`);
  const quantity = Number(item.quantity);
  if (!Number.isInteger(quantity) || quantity < 0) {
    throw new Error(`Quantity for ${item.id} must be a non-negative integer.`);
  }
  parseMoneyToPaisa(item.unit_price_bdt ?? "0");
  return {
    id: String(item.id),
    name: String(item.name),
    company: String(item.company ?? "Unknown"),
    batch: String(item.batch),
    quantity,
    unit_price_bdt: String(item.unit_price_bdt ?? "0"),
    expiry: String(item.expiry),
  };
}

export function normalizeCase(input) {
  if (!input || typeof input !== "object") throw new Error("Case must be a JSON object.");
  if (!Array.isArray(input.items)) throw new Error("Case is missing an items array.");
  const today = input.today || todayIso();
  requireIsoDate(today, "today");
  const items = input.items.map(normalizeItem);
  const ids = new Set();
  for (const item of items) {
    if (ids.has(item.id)) throw new Error(`Duplicate item id: ${item.id}`);
    ids.add(item.id);
  }
  const markReturned = Array.isArray(input.mark_returned)
    ? input.mark_returned.map(String).filter((id) => ids.has(id))
    : [];
  return {
    case_id: String(input.case_id ?? "IMPORTED"),
    today,
    items,
    mark_returned: markReturned,
  };
}

// Returned items are excluded before calculating active counts and value-at-risk totals
export function summarizeStock(items, returnedIds, today) {
  const groups = {
    expired: [],
    soon: [],
    within90: [],
    safe: [],
  };
  let expiredValuePaisa = 0;
  let soonValuePaisa = 0;
  let activeValuePaisa = 0;

  for (const item of items) {
    if (returnedIds.has(item.id)) continue;
    const { days, status } = classifyItem(item, today);
    const enriched = { ...item, days, status, valuePaisa: itemValuePaisa(item) };
    groups[status].push(enriched);
    activeValuePaisa += enriched.valuePaisa;
    if (status === "expired") expiredValuePaisa += enriched.valuePaisa;
    if (status === "soon") soonValuePaisa += enriched.valuePaisa;
  }

  return {
    groups,
    counts: Object.fromEntries(Object.entries(groups).map(([key, value]) => [key, value.length])),
    expiredValuePaisa,
    soonValuePaisa,
    activeValuePaisa,
    activeCount: Object.values(groups).reduce((sum, group) => sum + group.length, 0),
  };
}

function addMonths(year, monthZeroBased, offset) {
  const date = new Date(Date.UTC(year, monthZeroBased + offset, 1));
  return { year: date.getUTCFullYear(), month: date.getUTCMonth() };
}

export function sixMonthRisk(items, returnedIds, today) {
  const todayTs = requireIsoDate(today, "today");
  const ref = new Date(todayTs);
  const buckets = Array.from({ length: 6 }, (_, index) => {
    const { year, month } = addMonths(ref.getUTCFullYear(), ref.getUTCMonth(), index);
    return {
      key: `${year}-${String(month + 1).padStart(2, "0")}`,
      label: new Intl.DateTimeFormat("en", { month: "short", year: "2-digit", timeZone: "UTC" }).format(
        new Date(Date.UTC(year, month, 1)),
      ),
      valuePaisa: 0,
      count: 0,
    };
  });
  const lookup = new Map(buckets.map((bucket) => [bucket.key, bucket]));

  for (const item of items) {
    if (returnedIds.has(item.id)) continue;
    const expiryTs = requireIsoDate(item.expiry, "expiry");
    if (expiryTs < todayTs) continue;
    const date = new Date(expiryTs);
    const key = `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
    const bucket = lookup.get(key);
    if (!bucket) continue;
    bucket.valuePaisa += itemValuePaisa(item);
    bucket.count += 1;
  }

  return buckets;
}

export function statusLabel(status) {
  return {
    expired: "Expired",
    soon: "0–30 days",
    within90: "31–90 days",
    safe: "Safe",
  }[status] ?? status;
}

export function daysLabel(days) {
  if (days < 0) return `${Math.abs(days)}d overdue`;
  if (days === 0) return "Expires today";
  return `${days}d left`;
}
