import { auth, db } from "./firebase-config.js";
import {
  signInAnonymously,
  onAuthStateChanged,
  signOut
} from "https://www.gstatic.com/firebasejs/12.11.0/firebase-auth.js";
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDocs,
  limit,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  where,
  writeBatch,
  updateDoc
} from "https://www.gstatic.com/firebasejs/12.11.0/firebase-firestore.js";

const state = {
  authUser: null,
  sessionUser: null,
  loginMode: "administrador",
  users: [],
  sales: [],
  expenses: [],
  products: [],
  categories: [],
  customers: [],
  accountMovements: [],
  budgets: [],
  cashMovements: [],
  selectedCustomerId: "",
  selectedBudgetId: "",
  editingSaleId: "",
  editingExpenseId: "",
  editingProductId: "",
  editingBudgetId: "",
  editingCashId: "",
  editingPaymentId: "",
  editingUserId: ""
};

const els = {
  loginScreen: document.getElementById("loginScreen"),
  appScreen: document.getElementById("appScreen"),
  loginForm: document.getElementById("loginForm"),
  loginError: document.getElementById("loginError"),
  usernameInput: document.getElementById("usernameInput"),
  passwordInput: document.getElementById("passwordInput"),
  tabAdmin: document.getElementById("tabAdmin"),
  tabVendor: document.getElementById("tabVendor"),
  loginTitle: document.getElementById("loginTitle"),
  loginSubtitle: document.getElementById("loginSubtitle"),
  logoutBtn: document.getElementById("logoutBtn"),
  sessionUserText: document.getElementById("sessionUserText"),
  userRoleText: document.getElementById("userRoleText"),
  todayText: document.getElementById("todayText"),
  viewTitle: document.getElementById("viewTitle"),
  viewSubtitle: document.getElementById("viewSubtitle"),
  installBtn: document.getElementById("installBtn"),
  renderHost: document.getElementById("renderHost"),
  saleForm: document.getElementById("saleForm"),
  saleOperationType: document.getElementById("saleOperationType"),
  saleCashFields: document.getElementById("saleCashFields"),
  saleAccountFields: document.getElementById("saleAccountFields"),
  paymentMethod: document.getElementById("paymentMethod"),
  checkFields: document.getElementById("checkFields"),
  saleSubmitBtn: document.getElementById("saleSubmitBtn"),
  cancelSaleEditBtn: document.getElementById("cancelSaleEditBtn"),
  saleFormTitle: document.getElementById("saleFormTitle"),
  salesSearchInput: document.getElementById("salesSearchInput"),
  salesFilterDate: document.getElementById("salesFilterDate"),
  salesFilterMonth: document.getElementById("salesFilterMonth"),
  salesFilterYear: document.getElementById("salesFilterYear"),
  salesFilterFrom: document.getElementById("salesFilterFrom"),
  salesFilterTo: document.getElementById("salesFilterTo"),
  salesTableWrap: document.getElementById("salesTableWrap"),
  expenseSearchInput: document.getElementById("expenseSearchInput"),
  expenseFilterMonth: document.getElementById("expenseFilterMonth"),
  expenseFilterFrom: document.getElementById("expenseFilterFrom"),
  expenseFilterTo: document.getElementById("expenseFilterTo"),
  exportExpensesPdfBtn: document.getElementById("exportExpensesPdfBtn"),
  expenseForm: document.getElementById("expenseForm"),
  expenseCategory: document.getElementById("expenseCategory"),
  expenseFormTitle: document.getElementById("expenseFormTitle"),
  expenseSubmitBtn: document.getElementById("expenseSubmitBtn"),
  cancelExpenseEditBtn: document.getElementById("cancelExpenseEditBtn"),
  expensesTableWrap: document.getElementById("expensesTableWrap"),
  customerSearchInput: document.getElementById("customerSearchInput"),
  paymentCustomerId: document.getElementById("paymentCustomerId"),
  captureAccountBtn: document.getElementById("captureAccountBtn"),
  accountPdfBtn: document.getElementById("accountPdfBtn"),
  deleteAccountBtn: document.getElementById("deleteAccountBtn"),
  accountActionBar: document.getElementById("accountActionBar"),
  productForm: document.getElementById("productForm"),
  productFormTitle: document.getElementById("productFormTitle"),
  productCategorySelect: document.getElementById("productCategorySelect"),
  productSearchInput: document.getElementById("productSearchInput"),
  goCreateProductBtn: document.getElementById("goCreateProductBtn"),
  cancelProductBtn: document.getElementById("cancelProductBtn"),
  cancelProductEditBtn: document.getElementById("cancelProductEditBtn"),
  exportProductsPdfBtn: document.getElementById("exportProductsPdfBtn"),
  productsTableWrap: document.getElementById("productsTableWrap"),
  budgetForm: document.getElementById("budgetForm"),
  budgetFormTitle: document.getElementById("budgetFormTitle"),
  budgetSubmitBtn: document.getElementById("budgetSubmitBtn"),
  cancelBudgetEditBtn: document.getElementById("cancelBudgetEditBtn"),
  budgetItemsWrap: document.getElementById("budgetItemsWrap"),
  budgetSubtotal: document.getElementById("budgetSubtotal"),
  budgetTotal: document.getElementById("budgetTotal"),
  budgetPaymentTerms: document.getElementById("budgetPaymentTerms"),
  budgetCustomTermsWrap: document.getElementById("budgetCustomTermsWrap"),
  budgetsList: document.getElementById("budgetsList"),
  budgetSearchInput: document.getElementById("budgetSearchInput"),
  budgetSearchFrom: document.getElementById("budgetSearchFrom"),
  budgetSearchTo: document.getElementById("budgetSearchTo"),
  budgetPreviewCard: document.getElementById("budgetPreviewCard"),
  budgetDownloadPdfBtn: document.getElementById("budgetDownloadPdfBtn"),
  budgetDownloadPngBtn: document.getElementById("budgetDownloadPngBtn"),
  budgetShareBtn: document.getElementById("budgetShareBtn"),
  budgetToggleSentBtn: document.getElementById("budgetToggleSentBtn"),
  budgetToggleApprovedBtn: document.getElementById("budgetToggleApprovedBtn"),
  addBudgetItemBtn: document.getElementById("addBudgetItemBtn"),
  goCreateBudgetBtn: document.getElementById("goCreateBudgetBtn"),
  budgetClientMode: document.getElementById("budgetClientMode"),
  budgetCustomerSearch: document.getElementById("budgetCustomerSearch"),
  budgetCustomerId: document.getElementById("budgetCustomerId"),
  budgetCustomerOptions: document.getElementById("budgetCustomerOptions"),
  budgetCustomerSelectWrap: document.getElementById("budgetCustomerSelectWrap"),
  budgetCustomerSelectedCard: document.getElementById("budgetCustomerSelectedCard"),
  budgetPreviewActions: document.getElementById("budgetPreviewActions"),
  budgetPreviewModal: document.getElementById("budgetPreviewModal"),
  budgetPreviewCloseBtn: document.getElementById("budgetPreviewCloseBtn"),
  budgetModalEditBtn: document.getElementById("budgetModalEditBtn"),
  budgetModalTitle: document.getElementById("budgetModalTitle"),
  userFormTitle: document.getElementById("userFormTitle"),
  userSubmitBtn: document.getElementById("userSubmitBtn"),
  cancelUserEditBtn: document.getElementById("cancelUserEditBtn"),
  themeLightBtn: document.getElementById("themeLightBtn"),
  themeDarkBtn: document.getElementById("themeDarkBtn"),
  cashStatusCards: document.getElementById("cashStatusCards")
};

let unsubscribers = [];
let deferredPrompt = null;

const currency = (value) =>
  new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency: "ARS",
    minimumFractionDigits: Number(value || 0) % 1 ? 2 : 0,
    maximumFractionDigits: 2
  }).format(Number(value || 0));

const todayISO = () => {
  const now = new Date();
  const tzOffset = now.getTimezoneOffset() * 60000;
  return new Date(now - tzOffset).toISOString().slice(0, 10);
};

const todayLongText = () =>
  new Date().toLocaleDateString("es-AR", {
    weekday: "long",
    day: "2-digit",
    month: "long",
    year: "numeric"
  });

function sanitizeId(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "")
    .replace(/^+|_+$/g, "");
}

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function roleLabel(role) {
  return role === "administrador" ? "Administrador" : "Vendedor";
}

function isAdmin() {
  return state.sessionUser?.role === "administrador";
}

function showMessage(id, text, isError = false) {
  const el = document.getElementById(id);
  if (!el) return;
  el.textContent = text || "";
  el.style.color = isError ? "var(--danger)" : "var(--success)";
}

function clearMessage(id) {
  const el = document.getElementById(id);
  if (el) el.textContent = "";
}

function parseMoneyValue(input) {
  const raw = String(input ?? "").trim();
  if (!raw) return 0;
  let normalized = raw.replace(/\s+/g, " ");
  if (normalized.includes(",") && normalized.includes(".")) {
    if (normalized.lastIndexOf(",") > normalized.lastIndexOf(".")) {
      normalized = normalized.replace(/\./g, "").replace(",", ".");
    } else {
      normalized = normalized.replace(/,/g, "");
    }
  } else if (normalized.includes(",")) {
    normalized = normalized.replace(/\./g, "").replace(",", ".");
  }
  normalized = normalized.replace(/[^0-9.-]/g, "");
  const value = Number(normalized);
  return Number.isFinite(value) ? value : 0;
}

function formatMoneyInputValue(value) {
  const number = Number(value || 0);
  return new Intl.NumberFormat("es-AR", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2
  }).format(number);
}

function setMoneyFieldValue(input, value) {
  if (!input) return;
  input.value = formatMoneyInputValue(value || 0);
  updateMoneyText(input);
}

function numberToWordsUnder100(num) {
  const u = ["cero", "uno", "dos", "tres", "cuatro", "cinco", "seis", "siete", "ocho", "nueve"];
  const teens = {
    10: "diez", 11: "once", 12: "doce", 13: "trece", 14: "catorce", 15: "quince",
    16: "dieciséis", 17: "diecisiete", 18: "dieciocho", 19: "diecinueve"
  };
  const tens = {
    20: "veinte", 30: "treinta", 40: "cuarenta", 50: "cincuenta",
    60: "sesenta", 70: "setenta", 80: "ochenta", 90: "noventa"
  };
  if (num < 10) return u[num];
  if (teens[num]) return teens[num];
  if (num < 30) return num === 20 ? "veinte" : `veinti${u[num - 20]}`;
  const ten = Math.floor(num / 10) * 10;
  const unit = num % 10;
  return unit ? `${tens[ten]} y ${u[unit]}` : tens[ten];
}

function numberToWordsUnder1000(num) {
  const hundreds = {
    100: "cien", 200: "doscientos", 300: "trescientos", 400: "cuatrocientos",
    500: "quinientos", 600: "seiscientos", 700: "setecientos", 800: "ochocientos", 900: "novecientos"
  };
  if (num < 100) return numberToWordsUnder100(num);
  if (hundreds[num]) return hundreds[num];
  const hundred = Math.floor(num / 100) * 100;
  const rest = num % 100;
  const prefix = num < 200 ? "ciento" : hundreds[hundred];
  return `${prefix} ${numberToWordsUnder100(rest)}`;
}

function numberToWordsEs(num) {
  num = Math.floor(Number(num || 0));
  if (num === 0) return "cero";
  if (num < 1000) return numberToWordsUnder1000(num);
  if (num < 1000000) {
    const thousands = Math.floor(num / 1000);
    const rest = num % 1000;
    const thousandText = thousands === 1 ? "mil" : `${numberToWordsUnder1000(thousands)} mil`;
    return `${thousandText}${rest ? ` ${numberToWordsUnder1000(rest)}` : ""}`;
  }
  if (num < 1000000000) {
    const millions = Math.floor(num / 1000000);
    const rest = num % 1000000;
    const millionText = millions === 1 ? "un millón" : `${numberToWordsEs(millions)} millones`;
    return `${millionText}${rest ? ` ${numberToWordsEs(rest)}` : ""}`;
  }
  const billions = Math.floor(num / 1000000000);
  const rest = num % 1000000000;
  const billionText = billions === 1 ? "mil millones" : `${numberToWordsEs(billions)} mil millones`;
  return `${billionText}${rest ? ` ${numberToWordsEs(rest)}` : ""}`;
}

function moneyToWords(value) {
  const amount = Number(value || 0);
  const abs = Math.abs(amount);
  const integer = Math.floor(abs);
  const cents = Math.round((abs - integer) * 100);
  const sign = amount < 0 ? "menos " : "";
  const words = `${sign}${numberToWordsEs(integer)} peso${integer === 1 ? "" : "s"}`;
  if (!cents) return words.charAt(0).toUpperCase() + words.slice(1);
  const centsText = `${numberToWordsEs(cents)} centavo${cents === 1 ? "" : "s"}`;
  return `${words} con ${centsText}`.charAt(0).toUpperCase() + `${words} con ${centsText}`.slice(1);
}

function updateMoneyText(input) {
  const root = input.closest("label") || input.parentElement?.parentElement || document;
  const fieldName = input.name;
  const target = root.querySelector(`[data-money-text-for="${fieldName}"]`) || document.querySelector(`[data-money-text-for="${fieldName}"]`);
  if (target) target.textContent = moneyToWords(parseMoneyValue(input.value));
}

function enhanceMoneyInputs(root = document) {
  root.querySelectorAll('[data-money="true"]').forEach((input) => {
    if (input.dataset.moneyBound === "1") return;
    input.dataset.moneyBound = "1";
    input.addEventListener("input", () => updateMoneyText(input));
    input.addEventListener("blur", () => {
      const value = parseMoneyValue(input.value);
      if (input.value !== "") input.value = formatMoneyInputValue(value);
      updateMoneyText(input);
    });
    updateMoneyText(input);
  });
}

async function sha256(text) {
  const data = new TextEncoder().encode(String(text || ""));
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  return [...new Uint8Array(hashBuffer)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

function showApp() {
  els.loginScreen.classList.add("hidden");
  els.appScreen.classList.remove("hidden");
}

function showLogin() {
  els.loginScreen.classList.remove("hidden");
  els.appScreen.classList.add("hidden");
}

function setMode(mode) {
  state.loginMode = mode;
  els.tabAdmin.classList.toggle("active", mode === "administrador");
  els.tabVendor.classList.toggle("active", mode === "vendedor");
  if (mode === "administrador") {
    els.loginTitle.textContent = "Ingreso administración";
    els.loginSubtitle.textContent = "Usá usuario y contraseña. Si todavía no existe un administrador, el primer ingreso lo crea.";
  } else {
    els.loginTitle.textContent = "Ingreso vendedor";
    els.loginSubtitle.textContent = "El vendedor entra con el usuario creado por administración.";
  }
}

function setDefaultDates() {
  ["saleForm", "expenseForm", "paymentForm", "budgetForm", "cashOpenForm", "cashEntryForm"].forEach((id) => {
    const form = document.getElementById(id);
    if (form?.date) form.date.value = todayISO();
  });
}

function clearRealtime() {
  unsubscribers.forEach((fn) => { try { fn(); } catch (_) {} });
  unsubscribers = [];
}

function getCustomerFullName(customer) {
  return [customer.firstName, customer.lastName].filter(Boolean).join(" ").trim() || "Cliente sin nombre";
}

function getCustomerCode(customer) {
  if (!customer) return "";
  return String(customer.code || customer.id || "").padStart(4, "0");
}

function nextSequentialCustomerCode() {
  const numbers = state.customers
    .map((customer) => Number(String(customer.code || customer.id || "").replace(/\D/g, "")))
    .filter((value) => Number.isFinite(value) && value > 0);
  const next = (numbers.length ? Math.max(...numbers) : 0) + 1;
  return String(next).padStart(4, "0");
}

function applyTheme(theme = "light") {
  const resolved = theme === "dark" ? "dark" : "light";
  document.documentElement.setAttribute("data-theme", resolved);
  try { localStorage.setItem("seniorflow_theme", resolved); } catch (_) {}
  els.themeLightBtn?.classList.toggle("btn-success", resolved === "light");
  els.themeDarkBtn?.classList.toggle("btn-success", resolved === "dark");
}

function initTheme() {
  let saved = "light";
  try { saved = localStorage.getItem("seniorflow_theme") || "light"; } catch (_) {}
  applyTheme(saved);
}

function accountMovementsForCustomer(customerId) {
  return state.accountMovements
    .filter((m) => m.customerId === customerId)
    .sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));
}

function accountBalance(customerId) {
  return accountMovementsForCustomer(customerId).reduce((sum, item) => {
    const amount = Number(item.amount || 0);
    return item.type === "cobro" ? sum - amount : sum + amount;
  }, 0);
}

function normalizeMedium(value) {
  const raw = String(value || "").toLowerCase().trim();
  if (raw === "cheque" || raw === "check") return "cheque";
  if (raw === "efectivo" || raw === "cash") return "efectivo";
  return "otro";
}

function startOfMonthISO(date = todayISO()) {
  return `${String(date).slice(0, 7)}-01`;
}

function addToBreakdown(target, medium, amount) {
  const key = normalizeMedium(medium);
  target[key] = Number(target[key] || 0) + Number(amount || 0);
}

function sumBreakdown(target) {
  return Number(target.efectivo || 0) + Number(target.cheque || 0) + Number(target.otro || 0);
}

function formatBreakdownText(breakdown) {
  return `Efectivo ${currency(breakdown.efectivo || 0)} · Cheques ${currency(breakdown.cheque || 0)} · Otros ${currency(breakdown.otro || 0)}`;
}

function currentCajaBreakdown() {
  const breakdown = { efectivo: 0, cheque: 0, otro: 0 };
  state.cashMovements.forEach((item) => {
    if (item.kind === "apertura") {
      breakdown.efectivo += Number(item.cashAmount || 0);
      breakdown.cheque += Number(item.checkAmount || 0);
      breakdown.otro += Number(item.otherAmount || 0);
    } else if (item.kind === "ingreso_manual") {
      addToBreakdown(breakdown, item.medium, item.amount || 0);
    }
  });
  state.sales.forEach((sale) => {
    if (sale.operationType === "contado") addToBreakdown(breakdown, sale.paymentMethod, sale.amount || 0);
  });
  state.accountMovements.forEach((movement) => {
    if (movement.type === "cobro") addToBreakdown(breakdown, movement.paymentMethod, movement.amount || 0);
  });
  state.expenses.forEach((expense) => {
    breakdown.efectivo -= Number(expense.amount || 0);
  });
  return breakdown;
}

function buildSalesBreakdown(items) {
  return items.reduce((acc, sale) => {
    addToBreakdown(acc, sale.paymentMethod, sale.amount || 0);
    return acc;
  }, { efectivo: 0, cheque: 0, otro: 0 });
}

function renderMiniStats(targetId, cards = []) {
  const node = document.getElementById(targetId);
  if (!node) return;
  if (!cards.length) {
    node.innerHTML = '<p class="muted">Todavía no hay datos suficientes.</p>';
    return;
  }
  node.innerHTML = cards.map((card) => 
    `<div class="mini-stat"><span>${card.label}</span><strong>${card.value}</strong></div>`
  ).join("");
}

function renderBarChart(targetId, rows = [], monthMode = false) {
  const node = document.getElementById(targetId);
  if (!node) return;
  if (!rows.length) {
    node.innerHTML = '<p class="muted">Todavía no hay ventas para graficar.</p>';
    return;
  }
  const max = Math.max(...rows.map((row) => Number(row.amount || 0)), 1);
  node.innerHTML = rows.map((row) => {
    const width = Math.max(6, (Number(row.amount || 0) / max) * 100);
    return `<div class="chart-row ${monthMode ? "month" : ""}">
      <div class="chart-label">${row.label}</div>
      <div class="chart-track"><div class="chart-fill" style="width:${width}%"></div></div>
      <div class="chart-value">${currency(row.amount || 0)}</div>
    </div>`;
  }).join("");
}

function fillCategoriesSelect() {
  const select = els.productCategorySelect;
  if (!select) return;
  const categories = state.categories.length
    ? state.categories.slice().sort((a, b) => (a.name || "").localeCompare(b.name || ""))
    : [{ name: "General" }];
  select.innerHTML = categories.map((cat) => 
    `<option value="${escapeHtml(cat.name)}">${escapeHtml(cat.name)}</option>`
  ).join("");
}

function fillCustomerSelects() {
  const customers = state.customers.slice().sort((a, b) => getCustomerFullName(a).localeCompare(getCustomerFullName(b)));
  const options = customers.map((customer) =>
    `<option value="${escapeHtml(`${getCustomerCode(customer)} · ${getCustomerFullName(customer)} · ${customer.phone || ""}`)}" data-id="${customer.id}"></option>`
  ).join("");
  if (els.budgetCustomerOptions) els.budgetCustomerOptions.innerHTML = options;
  renderBudgetSelectedCustomer();
}

function renderBudgetSelectedCustomer(customer = null) {
  if (!els.budgetCustomerSelectedCard) return;
  if (!customer) {
    const id = els.budgetCustomerId?.value || "";
    customer = state.customers.find((item) => item.id === id) || null;
  }
  if (!customer || els.budgetClientMode?.value !== "existing") {
    els.budgetCustomerSelectedCard.classList.add("hidden");
    els.budgetCustomerSelectedCard.innerHTML = "";
    return;
  }
  els.budgetCustomerSelectedCard.classList.remove("hidden");
  els.budgetCustomerSelectedCard.innerHTML = `
    <div class="selected-customer-card-head">
      <strong>#${escapeHtml(getCustomerCode(customer))} · ${escapeHtml(getCustomerFullName(customer))}</strong>
      <span class="status-pill success">Cliente cargado</span>
    </div>
    <div class="selected-customer-card-body">
      <span>${escapeHtml(customer.phone || "Sin celular")}</span>
      <span>${escapeHtml(customer.email || "Sin email")}</span>
      <span>${escapeHtml(customer.address || "Sin dirección")}</span>
    </div>
  `;
}

function resolveBudgetCustomerSearch() {
  const raw = String(els.budgetCustomerSearch?.value || "").trim().toLowerCase();
  const customer = state.customers.find((item) => {
    const label = `${getCustomerCode(item)} · ${getCustomerFullName(item)} · ${item.phone || ""}`.toLowerCase();
    return label === raw;
  }) || state.customers.find((item) => {
    const label = `${getCustomerCode(item)} ${getCustomerFullName(item)} ${item.phone || ""} ${item.email || ""}`.toLowerCase();
    return raw && label.includes(raw);
  });
  if (!customer) {
    if (els.budgetCustomerId) els.budgetCustomerId.value = "";
    renderBudgetSelectedCustomer(null);
    return null;
  }
  if (els.budgetCustomerId) els.budgetCustomerId.value = customer.id;
  if (els.budgetCustomerSearch) {
    els.budgetCustomerSearch.value = `${getCustomerCode(customer)} · ${getCustomerFullName(customer)} · ${customer.phone || ""}`;
  }
  const form = els.budgetForm;
  form.clientName.value = getCustomerFullName(customer);
  form.clientPhone.value = customer.phone || "";
  form.clientEmail.value = customer.email || "";
  form.clientAddress.value = customer.address || "";
  renderBudgetSelectedCustomer(customer);
  return customer;
}

function syncBudgetClientMode() {
  const existing = els.budgetClientMode?.value === "existing";
  els.budgetCustomerSelectWrap?.classList.toggle("hidden", !existing);
  if (els.budgetCustomerSearch) {
    els.budgetCustomerSearch.disabled = !existing;
    els.budgetCustomerSearch.required = existing;
  }
  const fieldIds = ["budgetClientNameWrap", "budgetClientPhoneWrap", "budgetClientEmailWrap", "budgetClientAddressWrap"];
  fieldIds.forEach((id) => {
    const wrap = document.getElementById(id);
    if (!wrap) return;
    wrap.classList.toggle("hidden", existing);
    wrap.querySelectorAll("input, select, textarea").forEach((input) => {
      input.disabled = existing;
      if (input.name === "clientName") {
        input.required = !existing;
      }
    });
  });
  if (!existing && els.budgetCustomerId) els.budgetCustomerId.value = "";
  if (!existing && els.budgetCustomerSearch) els.budgetCustomerSearch.value = "";
  renderBudgetSelectedCustomer();
}

function applyRoleUI() {
  els.userRoleText.textContent = `Rol: ${roleLabel(state.sessionUser.role)}`;
  els.sessionUserText.textContent = state.sessionUser.name || state.sessionUser.username;
  document.querySelectorAll(".admin-only-nav").forEach((el) => {
    el.classList.toggle("hidden", !isAdmin());
  });
  document.querySelectorAll(".admin-only-block").forEach((el) => {
    el.classList.toggle("hidden", !isAdmin());
  });
  const hideByRole = {
    vendedor: ["inicio", "presupuestos", "usuarios"]
  };
  document.querySelectorAll(".nav-btn").forEach((btn) => {
    const hide = (hideByRole[state.sessionUser.role] || []).includes(btn.dataset.view);
    btn.classList.toggle("hidden", hide);
  });
  const activeBtn = document.querySelector(".nav-btn.active");
  if (!activeBtn || activeBtn.classList.contains("hidden")) {
    const firstVisible = [...document.querySelectorAll(".nav-btn")].find((btn) => !btn.classList.contains("hidden"));
    firstVisible?.click();
  }
}
// === FUNCIONES DE RENDERIZADO - CONTINUACIÓN ===

function getSalesFiltered() {
  const text = (els.salesSearchInput?.value || "").trim().toLowerCase();
  const day = els.salesFilterDate?.value || "";
  const month = els.salesFilterMonth?.value || "";
  const year = String(els.salesFilterYear?.value || "").trim();
  const from = els.salesFilterFrom?.value || "";
  const to = els.salesFilterTo?.value || "";
  
  return state.sales.filter((sale) => {
    const haystack = `${sale.documentType || ""} ${sale.documentNumber || ""} ${sale.customerFirstName || ""} ${sale.customerLastName || ""} ${sale.createdByName || ""}`.toLowerCase();
    const matchesText = !text || haystack.includes(text);
    const matchesDay = !day || sale.date === day;
    const matchesMonth = !month || String(sale.date || "").startsWith(month);
    const matchesYear = !year || String(sale.date || "").startsWith(year);
    const matchesFrom = !from || (sale.date || "") >= from;
    const matchesTo = !to || (sale.date || "") <= to;
    return matchesText && matchesDay && matchesMonth && matchesYear && matchesFrom && matchesTo;
  });
}

function renderSales() {
  const rows = getSalesFiltered();
  if (!rows.length) {
    els.salesTableWrap.innerHTML = '<p class="muted">No hay ventas para mostrar con esos filtros.</p>';
    return;
  }
  
  els.salesTableWrap.innerHTML = `<div class="record-list compact-record-list"> ${rows.map((sale) => `
    <article class="record-card">
      <div class="record-main">
        <div class="record-head">
          <strong>${escapeHtml(sale.documentType || "-")} · ${escapeHtml(sale.documentNumber || "-")}</strong>
          <span class="record-amount">${currency(sale.amount)}</span>
        </div>
        <div class="record-meta">
          <span>${escapeHtml(sale.date || "-")}</span>
          ${sale.operationType === "cuenta_corriente" 
            ? `<span class="status-pill warning">Cuenta corriente</span><span>#${escapeHtml(getCustomerCode(state.customers.find((item) => item.id === sale.customerId) || { id: sale.customerId || "" }))}</span><span>${escapeHtml(`${sale.customerFirstName || ""} ${sale.customerLastName || ""}`.trim() || "-")}</span>`
            : `<span class="status-pill success">Contado</span><span>${escapeHtml(sale.paymentMethod || "-")}</span>`
          }
        </div>
      </div>
      <div class="record-actions">
        <button class="btn btn-sm btn-secondary sale-edit-btn" data-id="${sale.id}">Editar</button>
        <button class="btn btn-sm btn-secondary sale-share-btn" data-id="${sale.id}">Ticket</button>
        <button class="btn btn-sm btn-danger sale-delete-btn" data-id="${sale.id}">Eliminar</button>
      </div>
    </article>
  `).join("")} </div>`;
  
  els.salesTableWrap.querySelectorAll(".sale-edit-btn").forEach((btn) => 
    btn.addEventListener("click", () => loadSaleIntoForm(btn.dataset.id))
  );
  
  els.salesTableWrap.querySelectorAll(".sale-delete-btn").forEach((btn) => 
    btn.addEventListener("click", async () => {
      if (!confirm("¿Eliminar esta venta?")) return;
      try { 
        await deleteSale(btn.dataset.id); 
      } catch (error) { 
        alert(error.message || "No se pudo eliminar la venta."); 
      }
    })
  );
  
  els.salesTableWrap.querySelectorAll(".sale-share-btn").forEach((btn) => 
    btn.addEventListener("click", async () => {
      try { 
        await shareSaleTicket(btn.dataset.id); 
      } catch (error) { 
        alert(error.message || "No se pudo generar el ticket."); 
      }
    })
  );
}

function getExpensesFiltered() {
  const text = (els.expenseSearchInput?.value || "").trim().toLowerCase();
  const month = els.expenseFilterMonth?.value || "";
  const from = els.expenseFilterFrom?.value || "";
  const to = els.expenseFilterTo?.value || "";
  
  return state.expenses.filter((exp) => {
    const haystack = `${exp.category || ""} ${exp.details || ""} ${exp.createdByName || ""}`.toLowerCase();
    const matchesText = !text || haystack.includes(text);
    const matchesMonth = !month || String(exp.date || "").startsWith(month);
    const matchesFrom = !from || (exp.date || "") >= from;
    const matchesTo = !to || (exp.date || "") <= to;
    return matchesText && matchesMonth && matchesFrom && matchesTo;
  });
}

function renderExpenses() {
  const items = getExpensesFiltered();
  if (!items.length) {
    els.expensesTableWrap.innerHTML = '<p class="muted">No hay gastos para mostrar con esos filtros.</p>';
    return;
  }
  
  els.expensesTableWrap.innerHTML = `<div class="record-list"> ${items.map((exp) => `
    <article class="record-card">
      <div class="record-main">
        <div class="record-head">
          <strong>${escapeHtml(exp.category || "-")}</strong>
          <span class="record-amount">${currency(exp.amount)}</span>
        </div>
        <div class="record-meta">
          <span>${escapeHtml(exp.date || "-")}</span>
          <span>${escapeHtml(exp.details || "Sin detalle")}</span>
        </div>
      </div>
      <div class="record-actions">
        <button class="btn btn-sm btn-secondary expense-edit-btn" data-id="${exp.id}">Editar</button>
        <button class="btn btn-sm btn-danger expense-delete-btn" data-id="${exp.id}">Eliminar</button>
      </div>
    </article>
  `).join("")} </div>`;
  
  els.expensesTableWrap.querySelectorAll(".expense-edit-btn").forEach((btn) => 
    btn.addEventListener("click", () => loadExpenseIntoForm(btn.dataset.id))
  );
  
  els.expensesTableWrap.querySelectorAll(".expense-delete-btn").forEach((btn) => 
    btn.addEventListener("click", async () => {
      if (!confirm("¿Eliminar este gasto?")) return;
      try { 
        await deleteDoc(doc(db, "expenses", btn.dataset.id)); 
      } catch (error) { 
        alert(error.message || "No se pudo eliminar el gasto."); 
      }
    })
  );
}

function renderProducts() {
  const productFilter = (els.productSearchInput?.value || "").trim().toLowerCase();
  const filteredProducts = state.products.filter((item) => {
    const text = `${item.code || ""} ${item.name || ""} ${item.description || ""} ${item.category || ""} ${item.unit || ""}`.toLowerCase();
    return !productFilter || text.includes(productFilter);
  });
  
  const lowStock = state.products
    .slice()
    .sort((a, b) => (Number(a.currentStock || 0) - Number(a.minStock || 0)) - (Number(b.currentStock || 0) - Number(b.minStock || 0)))
    .filter((item) => Number(item.currentStock || 0) <= Number(item.minStock || 0));
  
  const lowStockNode = document.getElementById("stockRankingListSide");
  if (lowStockNode) {
    lowStockNode.innerHTML = lowStock.length 
      ? lowStock.slice(0, 5).map((item) => `
          <div class="simple-item">
            <strong>${escapeHtml(item.name || "-")}</strong>
            <span>${escapeHtml(item.category || "General")}</span>
            <div class="muted">Actual: ${item.currentStock} ${escapeHtml(item.unit || "unidad")} · Mínimo: ${item.minStock}</div>
          </div>
        `).join("")
      : '<p class="muted">No hay alertas de stock bajo.</p>';
  }
  
  if (!filteredProducts.length) {
    els.productsTableWrap.innerHTML = '<p class="muted">No hay productos cargados.</p>';
    return;
  }
  
  els.productsTableWrap.innerHTML = `<table class="data-table">
    <thead>
      <tr>
        <th>Código</th>
        <th>Producto</th>
        <th>Categoría</th>
        <th>Unidad</th>
        <th>Actual</th>
        <th>Mínimo</th>
        <th>Costo</th>
        <th>Final</th>
        <th>Acciones</th>
      </tr>
    </thead>
    <tbody>
      ${filteredProducts.map((item) => `
        <tr>
          <td>${escapeHtml(item.code || "-")}</td>
          <td>${escapeHtml(item.name || "-")} ${escapeHtml(item.description || "")}</td>
          <td>${escapeHtml(item.category || "General")}</td>
          <td>${escapeHtml(item.unit || "unidad")}</td>
          <td>${item.currentStock ?? 0}</td>
          <td>${item.minStock ?? 0}</td>
          <td>${currency(item.cost)}</td>
          <td>${currency(item.salePrice)}</td>
          <td>
            <button class="btn btn-sm btn-secondary product-edit-btn" data-id="${item.id}">Editar</button>
            <button class="btn btn-sm btn-danger product-delete-btn" data-id="${item.id}">Eliminar</button>
          </td>
        </tr>
      `).join("")}
    </tbody>
  </table>`;
  
  els.productsTableWrap.querySelectorAll(".product-edit-btn").forEach((btn) => 
    btn.addEventListener("click", () => loadProductIntoForm(btn.dataset.id))
  );
  
  els.productsTableWrap.querySelectorAll(".product-delete-btn").forEach((btn) => 
    btn.addEventListener("click", async () => {
      if (!confirm("¿Eliminar este producto?")) return;
      try {
        await deleteDoc(doc(db, "products", btn.dataset.id));
      } catch (error) {
        alert(error.message || "No se pudo eliminar el producto.");
      }
    })
  );
}

// ... [El archivo continúa con más funciones]

// === INICIALIZACIÓN ===
setMode("administrador");
setDefaultDates();
setupNavigation();
setupUiEvents();
setupForms();
resetSaleForm();
resetExpenseForm();
resetProductForm();
resetBudgetForm();
resetUserForm();
initTheme();
setupInstallPrompt();
initLoginFlow();

// Exportar para módulos si es necesario
export { state, els, currency, todayISO };
