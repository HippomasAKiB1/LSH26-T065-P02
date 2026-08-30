import {
  classifyItem,
  daysLabel,
  formatPaisa,
  itemValuePaisa,
  normalizeCase,
  parseMoneyToPaisa,
  sixMonthRisk,
  statusLabel,
  summarizeStock,
} from "./pharmacy.js";

const state = {
  dataset: null,
  cases: [],
  caseIndex: 0,
  currentCase: null,
  items: [],
  returnedIds: new Set(),
  search: "",
  company: "all",
  status: "all",
};

const $ = (selector) => document.querySelector(selector);
const refs = {
  appStatus: $("#app-status"),
  statusText: $("#app-status .status-text"),
  referenceDate: $("#reference-date"),
  caseSelect: $("#case-select"),
  fileInput: $("#file-input"),
  resetCase: $("#reset-case"),
  search: $("#search"),
  companyFilter: $("#company-filter"),
  statusFilter: $("#status-filter"),
  clearFilters: $("#clear-filters"),
  inventoryBody: $("#inventory-body"),
  emptyInventory: $("#empty-inventory"),
  returnedBody: $("#returned-body"),
  returnedEmpty: $("#returned-empty"),
  returnedCount: $("#returned-count"),
  caseInfo: $("#case-info"),
  priorityList: $("#priority-list"),
  riskChart: $("#risk-chart"),
  addDialog: $("#add-dialog"),
  addMedicine: $("#add-medicine"),
  closeAdd: $("#close-add"),
  cancelAdd: $("#cancel-add"),
  addForm: $("#add-form"),
  expiryInput: $("#add-expiry"),
  toast: $("#toast"),
};

function setStatus(kind, message) {
  refs.appStatus.dataset.kind = kind;
  refs.statusText.textContent = message;
  refs.appStatus.hidden = !message;
}

function toast(message) {
  refs.toast.textContent = message;
  refs.toast.classList.add("show");
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => refs.toast.classList.remove("show"), 2200);
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function formatDate(dateString) {
  const [y, m, d] = dateString.split("-").map(Number);
  return new Intl.DateTimeFormat("en-BD", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(Date.UTC(y, m - 1, d)));
}

function addDaysIso(iso, days) {
  const [y, m, d] = iso.split("-").map(Number);
  const date = new Date(Date.UTC(y, m - 1, d + days));
  return date.toISOString().slice(0, 10);
}

function updateDefaultExpiry() {
  if (state.currentCase) refs.expiryInput.value = addDaysIso(state.currentCase.today, 365);
}

function resetFilters(render = true) {
  state.search = "";
  state.company = "all";
  state.status = "all";
  refs.search.value = "";
  refs.companyFilter.value = "all";
  refs.statusFilter.value = "all";
  if (render) renderInventory();
}

function loadCase(index) {
  const source = state.cases[index];
  if (!source) return;
  try {
    const normalized = normalizeCase(source);
    state.caseIndex = index;
    state.currentCase = normalized;
    state.items = normalized.items.map((item) => ({ ...item }));
    state.returnedIds = new Set(normalized.mark_returned);
    resetFilters(false);
    refs.referenceDate.value = normalized.today;
    updateDefaultExpiry();
    renderAll();
    setStatus("success", `Loaded ${normalized.case_id}. All expiry groups and value totals were recalculated from ${normalized.today}.`);
  } catch (error) {
    setStatus("error", error.message);
  }
}

function ingestJson(data, sourceName = "file") {
  let cases;
  if (Array.isArray(data?.cases)) {
    cases = data.cases;
  } else if (Array.isArray(data?.items)) {
    cases = [data];
  } else {
    throw new Error("Unsupported JSON. Load a P02 fixture wrapper or a single P02 case object.");
  }
  if (!cases.length) throw new Error("The JSON contains no cases.");
  state.dataset = data;
  state.cases = cases;
  refs.caseSelect.innerHTML = cases
    .map((entry, index) => `<option value="${index}">${escapeHtml(entry.case_id ?? `Case ${index + 1}`)}</option>`)
    .join("");
  refs.caseSelect.disabled = cases.length === 1;
  loadCase(0);
  toast(`${sourceName} loaded successfully`);
}

async function loadPublicFixture() {
  setStatus("loading", "Loading organizer fixture and validating stock records...");
  try {
    const response = await fetch("./data/P02_pharmacy_expiry_public.json", { cache: "no-store" });
    if (!response.ok) throw new Error(`Could not load sample data (${response.status}).`);
    ingestJson(await response.json(), "Public fixture");
  } catch (error) {
    setStatus("error", `${error.message} You can still use Import JSON.`);
  }
}

function enrichedActiveItems() {
  if (!state.currentCase) return [];
  return state.items
    .filter((item) => !state.returnedIds.has(item.id))
    .map((item) => {
      const meta = classifyItem(item, state.currentCase.today);
      return { ...item, ...meta, valuePaisa: itemValuePaisa(item) };
    });
}

function activeRows() {
  const query = state.search.trim().toLowerCase();
  return enrichedActiveItems()
    .filter((item) => {
      if (query && !`${item.name} ${item.company} ${item.batch} ${item.id}`.toLowerCase().includes(query)) return false;
      if (state.company !== "all" && item.company !== state.company) return false;
      if (state.status !== "all" && item.status !== state.status) return false;
      return true;
    })
    .sort((a, b) => a.days - b.days || b.valuePaisa - a.valuePaisa || a.name.localeCompare(b.name));
}

function renderDashboard() {
  const summary = summarizeStock(state.items, state.returnedIds, state.currentCase.today);
  const within90Value = summary.groups.within90.reduce((sum, item) => sum + item.valuePaisa, 0);
  const safeValue = summary.groups.safe.reduce((sum, item) => sum + item.valuePaisa, 0);
  const riskNow = summary.expiredValuePaisa + summary.soonValuePaisa;
  const priorityCount = summary.counts.expired + summary.counts.soon;
  const values = {
    expired: summary.counts.expired,
    soon: summary.counts.soon,
    within90: summary.counts.within90,
    safe: summary.counts.safe,
    expiredValue: formatPaisa(summary.expiredValuePaisa),
    soonValue: formatPaisa(summary.soonValuePaisa),
    within90Value: formatPaisa(within90Value),
    safeValue: formatPaisa(safeValue),
    activeCount: summary.activeCount,
    activeValue: formatPaisa(summary.activeValuePaisa),
    riskNow: formatPaisa(riskNow),
    priorityCount,
  };
  for (const [key, value] of Object.entries(values)) {
    for (const node of document.querySelectorAll(`[data-stat="${key}"]`)) node.textContent = value;
  }
}

function renderCompanyFilter() {
  const companies = [...new Set(enrichedActiveItems().map((item) => item.company))].sort((a, b) => a.localeCompare(b));
  const current = state.company;
  refs.companyFilter.innerHTML = `<option value="all">All companies</option>${companies
    .map((company) => `<option value="${escapeHtml(company)}">${escapeHtml(company)}</option>`)
    .join("")}`;
  refs.companyFilter.value = companies.includes(current) ? current : "all";
  state.company = refs.companyFilter.value;
}

function renderInventory() {
  const rows = activeRows();
  refs.inventoryBody.innerHTML = rows
    .map(
      (item) => `
      <tr>
        <td data-label="Medicine"><strong>${escapeHtml(item.name)}</strong><span class="muted mono">${escapeHtml(item.id)}</span></td>
        <td data-label="Company">${escapeHtml(item.company)}</td>
        <td data-label="Batch" class="mono">${escapeHtml(item.batch)}</td>
        <td data-label="Qty" class="number">${item.quantity}</td>
        <td data-label="Expiry"><strong>${formatDate(item.expiry)}</strong><span class="muted">${daysLabel(item.days)}</span></td>
        <td data-label="Status"><span class="badge badge-${item.status}">${statusLabel(item.status)}</span></td>
        <td data-label="Unit price" class="number">${formatPaisa(parseMoneyToPaisa(item.unit_price_bdt))}</td>
        <td data-label="Stock value" class="number"><strong>${formatPaisa(item.valuePaisa)}</strong></td>
        <td data-label="Action"><button class="btn btn-small btn-return" data-return-id="${escapeHtml(item.id)}">Mark returned</button></td>
      </tr>`,
    )
    .join("");
  refs.emptyInventory.hidden = rows.length > 0;
}

function renderReturned() {
  const rows = state.items.filter((item) => state.returnedIds.has(item.id));
  refs.returnedCount.textContent = rows.length;
  refs.returnedBody.innerHTML = rows
    .map(
      (item) => `
      <tr>
        <td data-label="Medicine"><strong>${escapeHtml(item.name)}</strong><span class="muted mono">${escapeHtml(item.id)}</span></td>
        <td data-label="Company">${escapeHtml(item.company)}</td>
        <td data-label="Batch" class="mono">${escapeHtml(item.batch)}</td>
        <td data-label="Qty" class="number">${item.quantity}</td>
        <td data-label="Returned value" class="number"><strong>${formatPaisa(itemValuePaisa(item))}</strong></td>
        <td data-label="Action"><button class="btn btn-small btn-ghost" data-restore-id="${escapeHtml(item.id)}">Restore active</button></td>
      </tr>`,
    )
    .join("");
  refs.returnedEmpty.hidden = rows.length > 0;
}

function renderPriorityList() {
  const rows = enrichedActiveItems()
    .filter((item) => item.status === "expired" || item.status === "soon")
    .sort((a, b) => a.days - b.days || b.valuePaisa - a.valuePaisa)
    .slice(0, 6);

  if (!rows.length) {
    refs.priorityList.innerHTML = '<div class="priority-empty">No expired or 0-30 day stock in this case. The immediate action queue is clear.</div>';
    return;
  }

  refs.priorityList.innerHTML = rows
    .map(
      (item) => `<div class="priority-row" data-status="${item.status}">
        <span class="priority-accent" aria-hidden="true"></span>
        <div class="priority-item"><strong>${escapeHtml(item.name)}</strong><span>${escapeHtml(item.company)} / batch ${escapeHtml(item.batch)}</span></div>
        <div class="priority-metric"><span>Timing</span><strong>${escapeHtml(daysLabel(item.days))}</strong></div>
        <div class="priority-metric"><span>Value</span><strong>${formatPaisa(item.valuePaisa)}</strong></div>
        <button class="btn btn-small btn-return" data-return-id="${escapeHtml(item.id)}">Mark returned</button>
      </div>`,
    )
    .join("");
}

function renderRiskChart() {
  const buckets = sixMonthRisk(state.items, state.returnedIds, state.currentCase.today);
  const max = Math.max(1, ...buckets.map((bucket) => bucket.valuePaisa));
  refs.riskChart.innerHTML = buckets
    .map((bucket) => {
      const height = Math.max(bucket.valuePaisa ? 8 : 2, Math.round((bucket.valuePaisa / max) * 100));
      return `<div class="chart-column" title="${escapeHtml(bucket.label)}: ${formatPaisa(bucket.valuePaisa)}">
        <div class="chart-value">${bucket.count ? formatPaisa(bucket.valuePaisa) : "--"}</div>
        <div class="chart-track"><div class="chart-bar" style="height:${height}%"></div></div>
        <div class="chart-label">${escapeHtml(bucket.label)}</div>
        <div class="chart-count">${bucket.count} item${bucket.count === 1 ? "" : "s"}</div>
      </div>`;
    })
    .join("");
}

function renderCaseInfo() {
  const returnedFromFixture = state.currentCase.mark_returned.length;
  refs.caseInfo.innerHTML = `
    <strong>${escapeHtml(state.currentCase.case_id)}</strong>
    <span>${state.items.length} stock records</span>
    <span>${returnedFromFixture} supplied return action${returnedFromFixture === 1 ? "" : "s"}</span>
    <span>Reference ${formatDate(state.currentCase.today)}</span>
  `;
}

function renderAll() {
  if (!state.currentCase) return;
  renderCompanyFilter();
  renderDashboard();
  renderInventory();
  renderReturned();
  renderPriorityList();
  renderRiskChart();
  renderCaseInfo();
}

function markReturned(id) {
  if (!id || state.returnedIds.has(id)) return;
  state.returnedIds.add(id);
  renderAll();
  toast(`${id} moved to Returned and removed from active totals`);
}

refs.caseSelect.addEventListener("change", () => loadCase(Number(refs.caseSelect.value)));
refs.resetCase.addEventListener("click", () => loadCase(state.caseIndex));

refs.fileInput.addEventListener("change", async () => {
  const file = refs.fileInput.files?.[0];
  if (!file) return;
  setStatus("loading", `Reading and validating ${file.name}...`);
  try {
    const data = JSON.parse(await file.text());
    ingestJson(data, file.name);
  } catch (error) {
    setStatus("error", `Could not load JSON: ${error.message}`);
  } finally {
    refs.fileInput.value = "";
  }
});

refs.referenceDate.addEventListener("change", () => {
  if (!state.currentCase || !refs.referenceDate.value) return;
  try {
    state.currentCase.today = refs.referenceDate.value;
    updateDefaultExpiry();
    renderAll();
    setStatus("success", `Reference date changed to ${refs.referenceDate.value}. Every expiry group was recalculated.`);
  } catch (error) {
    setStatus("error", error.message);
  }
});

refs.search.addEventListener("input", () => {
  state.search = refs.search.value;
  renderInventory();
});
refs.companyFilter.addEventListener("change", () => {
  state.company = refs.companyFilter.value;
  renderInventory();
});
refs.statusFilter.addEventListener("change", () => {
  state.status = refs.statusFilter.value;
  renderInventory();
});
refs.clearFilters.addEventListener("click", () => {
  resetFilters();
  toast("Inventory filters cleared");
});

for (const card of document.querySelectorAll("[data-filter-status]")) {
  card.addEventListener("click", () => {
    state.status = card.dataset.filterStatus;
    refs.statusFilter.value = state.status;
    renderInventory();
    document.querySelector("#inventory")?.scrollIntoView({ behavior: "smooth", block: "start" });
  });
}

for (const container of [refs.inventoryBody, refs.priorityList]) {
  container.addEventListener("click", (event) => {
    const button = event.target.closest("[data-return-id]");
    if (button) markReturned(button.dataset.returnId);
  });
}

refs.returnedBody.addEventListener("click", (event) => {
  const button = event.target.closest("[data-restore-id]");
  if (!button) return;
  const id = button.dataset.restoreId;
  state.returnedIds.delete(id);
  renderAll();
  toast(`${id} restored to active inventory`);
});

refs.addMedicine.addEventListener("click", () => {
  updateDefaultExpiry();
  refs.addDialog.showModal();
});
refs.closeAdd.addEventListener("click", () => refs.addDialog.close());
refs.cancelAdd.addEventListener("click", () => refs.addDialog.close());
refs.addDialog.addEventListener("click", (event) => {
  if (event.target === refs.addDialog) refs.addDialog.close();
});

refs.addForm.addEventListener("submit", (event) => {
  event.preventDefault();
  const form = new FormData(refs.addForm);
  const item = {
    id: `USR-${Date.now().toString(36).toUpperCase()}`,
    name: form.get("name")?.trim(),
    company: form.get("company")?.trim() || "Unknown",
    batch: form.get("batch")?.trim(),
    quantity: Number(form.get("quantity")),
    unit_price_bdt: String(form.get("unit_price_bdt") ?? "0"),
    expiry: String(form.get("expiry") ?? ""),
  };
  try {
    const normalized = normalizeCase({ today: state.currentCase.today, items: [item] }).items[0];
    state.items.push(normalized);
    refs.addForm.reset();
    updateDefaultExpiry();
    refs.addDialog.close();
    renderAll();
    toast(`${normalized.name} added to active inventory`);
  } catch (error) {
    setStatus("error", error.message);
  }
});

loadPublicFixture();
