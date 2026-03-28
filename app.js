
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
  budgetPreviewActions: document.getElementById("budgetPreviewActions"),
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
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
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
  let normalized = raw.replace(/\s+/g, "");
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
    node.innerHTML = '<div class="empty">Todavía no hay datos suficientes.</div>';
    return;
  }
  node.innerHTML = cards.map((card) => `<div class="mini-stat"><span>${card.label}</span><strong>${card.value}</strong></div>`).join("");
}

function renderBarChart(targetId, rows = [], monthMode = false) {
  const node = document.getElementById(targetId);
  if (!node) return;
  if (!rows.length) {
    node.innerHTML = '<div class="empty">Todavía no hay ventas para graficar.</div>';
    return;
  }
  const max = Math.max(...rows.map((row) => Number(row.amount || 0)), 1);
  node.innerHTML = rows.map((row) => {
    const width = Math.max(6, (Number(row.amount || 0) / max) * 100);
    return `<div class="chart-row ${monthMode ? "month" : ""}"><div class="chart-label">${row.label}</div><div class="chart-track"><div class="chart-fill" style="width:${width}%"></div></div><div class="chart-value">${currency(row.amount || 0)}</div></div>`;
  }).join("");
}

function fillCategoriesSelect() {
  const select = els.productCategorySelect;
  if (!select) return;
  const categories = state.categories.length
    ? state.categories.slice().sort((a, b) => (a.name || "").localeCompare(b.name || ""))
    : [{ name: "General" }];
  select.innerHTML = categories.map((cat) => `<option value="${escapeHtml(cat.name)}">${escapeHtml(cat.name)}</option>`).join("");
}

function fillCustomerSelects() {
  const customers = state.customers.slice().sort((a, b) => getCustomerFullName(a).localeCompare(getCustomerFullName(b)));
  const options = customers.map((customer) =>
    `<option value="${escapeHtml(`${getCustomerCode(customer)} · ${getCustomerFullName(customer)} · ${customer.phone || ""}`)}" data-id="${customer.id}"></option>`
  ).join("");
  if (els.budgetCustomerOptions) els.budgetCustomerOptions.innerHTML = options;
}

function resolveBudgetCustomerSearch() {
  const raw = String(els.budgetCustomerSearch?.value || "").trim();
  const customer = state.customers.find((item) => raw === `${getCustomerCode(item)} · ${getCustomerFullName(item)} · ${item.phone || ""}`);
  if (!customer) {
    if (els.budgetCustomerId) els.budgetCustomerId.value = "";
    return null;
  }
  if (els.budgetCustomerId) els.budgetCustomerId.value = customer.id;
  const form = els.budgetForm;
  form.clientName.value = getCustomerFullName(customer);
  form.clientPhone.value = customer.phone || "";
  form.clientEmail.value = customer.email || "";
  form.clientAddress.value = customer.address || "";
  return customer;
}

function syncBudgetClientMode() {
  const existing = els.budgetClientMode?.value === "existing";
  els.budgetCustomerSelectWrap?.classList.toggle("hidden", !existing);
  ["budgetClientNameWrap", "budgetClientPhoneWrap", "budgetClientEmailWrap", "budgetClientAddressWrap"].forEach((id) => {
    document.getElementById(id)?.classList.toggle("hidden", existing);
  });
  if (!existing && els.budgetCustomerId) els.budgetCustomerId.value = "";
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

function renderDashboard() {
  const today = todayISO();
  const monthStart = startOfMonthISO(today);
  const salesTodayItems = state.sales.filter((sale) => sale.date === today);
  const monthSalesItems = state.sales.filter((sale) => (sale.date || "") >= monthStart && (sale.date || "") <= today);
  const allSalesTotal = monthSalesItems.reduce((sum, sale) => sum + Number(sale.amount || 0), 0);
  const salesDay = salesTodayItems.reduce((sum, sale) => sum + Number(sale.amount || 0), 0);
  const expensesDay = state.expenses.filter((exp) => exp.date === today).reduce((sum, exp) => sum + Number(exp.amount || 0), 0);
  const cajaBreakdown = currentCajaBreakdown();
  const cash = sumBreakdown(cajaBreakdown);
  const salesDayBreakdown = buildSalesBreakdown(salesTodayItems);

  const overdueCustomers = state.customers
    .map((customer) => {
      const movements = accountMovementsForCustomer(customer.id);
      const balance = accountBalance(customer.id);
      const lastCharge = movements.find((item) => item.type === "cargo");
      let overdue = false;
      if (lastCharge?.date) {
        const start = new Date(`${lastCharge.date}T00:00:00`);
        const now = new Date(`${today}T00:00:00`);
        const days = Math.floor((now - start) / (1000 * 60 * 60 * 24));
        overdue = balance > 0 && days > 30;
      }
      return { ...customer, balance, overdue };
    })
    .filter((customer) => customer.overdue);

  const weekDays = [...Array(7)].map((_, index) => {
    const date = new Date();
    date.setDate(date.getDate() - (6 - index));
    const iso = new Date(date.getTime() - (date.getTimezoneOffset() * 60000)).toISOString().slice(0, 10);
    const label = date.toLocaleDateString("es-AR", { weekday: "short" });
    const amount = state.sales.filter((sale) => sale.date === iso).reduce((sum, sale) => sum + Number(sale.amount || 0), 0);
    return { label: label.charAt(0).toUpperCase() + label.slice(1), amount };
  });

  const monthlyBuckets = {};
  monthSalesItems.forEach((sale) => {
    const day = Number(String(sale.date || "").slice(8, 10) || 0);
    const weekNumber = Math.min(5, Math.max(1, Math.ceil(day / 7)));
    monthlyBuckets[weekNumber] = Number(monthlyBuckets[weekNumber] || 0) + Number(sale.amount || 0);
  });
  const monthRows = [1, 2, 3, 4, 5].map((week) => ({ label: `Semana ${week}`, amount: Number(monthlyBuckets[week] || 0) }));
  const weekTotal = weekDays.reduce((sum, row) => sum + Number(row.amount || 0), 0);
  const monthTicket = monthSalesItems.length ? allSalesTotal / monthSalesItems.length : 0;
  const bestWeekDay = weekDays.slice().sort((a, b) => b.amount - a.amount)[0] || { label: "-", amount: 0 };
  const bestMonthWeek = monthRows.slice().sort((a, b) => b.amount - a.amount)[0] || { label: "-", amount: 0 };

  document.getElementById("statCash").textContent = currency(cash);
  document.getElementById("statCashBreakdown").textContent = formatBreakdownText(cajaBreakdown);
  document.getElementById("statSalesDay").textContent = currency(salesDay);
  document.getElementById("statSalesDayBreakdown").textContent = formatBreakdownText(salesDayBreakdown);
  document.getElementById("statExpensesDay").textContent = currency(expensesDay);
  document.getElementById("statSalesTotal").textContent = currency(allSalesTotal);
  document.getElementById("statSalesMonthBreakdown").textContent = `Semana actual ${currency(weekTotal)} · Ticket medio ${currency(monthTicket)}`;
  document.getElementById("statOverdueCount").textContent = overdueCustomers.length;
  els.todayText.textContent = todayLongText();

  renderMiniStats("weekSummaryCards", [
    { label: "Total semana", value: currency(weekTotal) },
    { label: "Mejor día", value: `${bestWeekDay.label} · ${currency(bestWeekDay.amount)}` },
    { label: "Días con ventas", value: String(weekDays.filter((row) => row.amount > 0).length) }
  ]);
  renderMiniStats("monthSummaryCards", [
    { label: "Total del mes", value: currency(allSalesTotal) },
    { label: "Mejor semana", value: `${bestMonthWeek.label} · ${currency(bestMonthWeek.amount)}` },
    { label: "Ticket promedio", value: currency(monthTicket) }
  ]);
  renderBarChart("weekSalesChart", weekDays, false);
  renderBarChart("monthSalesChart", monthRows, true);

  const lowStock = state.products
    .slice()
    .sort((a, b) => (Number(a.currentStock || 0) - Number(a.minStock || 0)) - (Number(b.currentStock || 0) - Number(b.minStock || 0)))
    .filter((item) => Number(item.currentStock || 0) <= Number(item.minStock || 0));

  document.getElementById("stockRankingList").innerHTML = lowStock.length ? lowStock.slice(0, 8).map((item) => `
    <div class="simple-item">
      <strong>${escapeHtml(item.name || "-")}</strong>
      <span>${escapeHtml(item.category || "General")} · ${escapeHtml(item.unit || "unidad")}</span>
      <div class="muted">Actual: ${item.currentStock} · Mínimo: ${item.minStock}</div>
    </div>
  `).join("") : '<div class="empty">No hay productos con stock bajo.</div>';

  document.getElementById("overdueList").innerHTML = overdueCustomers.length ? overdueCustomers.slice(0, 20).map((customer) => `
    <div class="simple-item">
      <strong>${escapeHtml(getCustomerFullName(customer))}</strong>
      <span>${currency(customer.balance)}</span>
      <div class="muted">${escapeHtml(customer.phone || "")}</div>
    </div>
  `).join("") : '<div class="empty">No hay clientes morosos.</div>';
}

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
    els.salesTableWrap.innerHTML = '<div class="empty">No hay ventas para mostrar con esos filtros.</div>';
    return;
  }

  els.salesTableWrap.innerHTML = `
    <div class="record-list compact-record-list">
      ${rows.map((sale) => `
        <article class="record-card compact-card">
          <div class="record-main">
            <div class="record-head">
              <strong>${escapeHtml(sale.documentType || "-")} · ${escapeHtml(sale.documentNumber || "-")}</strong>
              <span class="record-amount">${currency(sale.amount)}</span>
            </div>
            <div class="record-meta">
              <span>${escapeHtml(sale.date || "-")}</span>
              ${sale.operationType === "cuenta_corriente"
                ? `<span class="status-pill warning">Cuenta corriente</span><span>#${escapeHtml(getCustomerCode(state.customers.find((item) => item.id === sale.customerId) || { id: sale.customerId || "" }))}</span><span>${escapeHtml(`${sale.customerFirstName || ""} ${sale.customerLastName || ""}`.trim() || "-")}</span>`
                : `<span class="status-pill success">Contado</span><span>${escapeHtml(sale.paymentMethod || "-")}</span>`}
            </div>
          </div>
          <div class="record-actions compact-actions">
            <button class="btn btn-secondary sale-edit-btn" data-id="${sale.id}" type="button">Editar</button>
            <button class="btn btn-secondary sale-share-btn" data-id="${sale.id}" type="button">Ticket</button>
            <button class="btn btn-danger sale-delete-btn" data-id="${sale.id}" type="button">Eliminar</button>
          </div>
        </article>
      `).join("")}
    </div>
  `;

  els.salesTableWrap.querySelectorAll(".sale-edit-btn").forEach((btn) => btn.addEventListener("click", () => loadSaleIntoForm(btn.dataset.id)));
  els.salesTableWrap.querySelectorAll(".sale-delete-btn").forEach((btn) => btn.addEventListener("click", async () => {
    if (!confirm("¿Eliminar esta venta?")) return;
    try { await deleteSale(btn.dataset.id); } catch (error) { alert(error.message || "No se pudo eliminar la venta."); }
  }));
  els.salesTableWrap.querySelectorAll(".sale-share-btn").forEach((btn) => btn.addEventListener("click", async () => {
    try { await shareSaleTicket(btn.dataset.id); } catch (error) { alert(error.message || "No se pudo generar el ticket."); }
  }));
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
    els.expensesTableWrap.innerHTML = '<div class="empty">No hay gastos para mostrar con esos filtros.</div>';
    return;
  }
  els.expensesTableWrap.innerHTML = `
    <div class="record-list">
      ${items.map((exp) => `
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
            <button class="btn btn-secondary expense-edit-btn" data-id="${exp.id}" type="button">Editar</button>
            <button class="btn btn-danger expense-delete-btn" data-id="${exp.id}" type="button">Eliminar</button>
          </div>
        </article>
      `).join("")}
    </div>
  `;
  els.expensesTableWrap.querySelectorAll(".expense-edit-btn").forEach((btn) => btn.addEventListener("click", () => loadExpenseIntoForm(btn.dataset.id)));
  els.expensesTableWrap.querySelectorAll(".expense-delete-btn").forEach((btn) => btn.addEventListener("click", async () => {
    if (!confirm("¿Eliminar este gasto?")) return;
    try { await deleteDoc(doc(db, "expenses", btn.dataset.id)); } catch (error) { alert(error.message || "No se pudo eliminar el gasto."); }
  }));
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
    lowStockNode.innerHTML = lowStock.length ? lowStock.slice(0, 5).map((item) => `
      <div class="simple-item">
        <strong>${escapeHtml(item.name || "-")}</strong>
        <span>${escapeHtml(item.category || "General")}</span>
        <div class="muted">Actual: ${item.currentStock} ${escapeHtml(item.unit || "unidad")} · Mínimo: ${item.minStock}</div>
      </div>
    `).join("") : '<div class="empty">No hay alertas de stock bajo.</div>';
  }

  if (!filteredProducts.length) {
    els.productsTableWrap.innerHTML = '<div class="empty">No hay productos cargados.</div>';
    return;
  }

  els.productsTableWrap.innerHTML = `
    <table class="data-table">
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
            <td><strong>${escapeHtml(item.name || "-")}</strong><div class="sheet-muted">${escapeHtml(item.description || "")}</div></td>
            <td>${escapeHtml(item.category || "General")}</td>
            <td>${escapeHtml(item.unit || "unidad")}</td>
            <td>${item.currentStock ?? 0}</td>
            <td>${item.minStock ?? 0}</td>
            <td>${currency(item.cost)}</td>
            <td>${currency(item.salePrice)}</td>
            <td>
              <div class="action-buttons">
                <button class="btn btn-secondary product-edit-btn" data-id="${item.id}" type="button">Editar</button>
                <button class="btn btn-danger product-delete-btn" data-id="${item.id}" type="button">Eliminar</button>
              </div>
            </td>
          </tr>
        `).join("")}
      </tbody>
    </table>
  `;

  els.productsTableWrap.querySelectorAll(".product-edit-btn").forEach((btn) => btn.addEventListener("click", () => loadProductIntoForm(btn.dataset.id)));
  els.productsTableWrap.querySelectorAll(".product-delete-btn").forEach((btn) => btn.addEventListener("click", async () => {
    if (!confirm("¿Eliminar este producto?")) return;
    try {
      await deleteDoc(doc(db, "products", btn.dataset.id));
    } catch (error) {
      alert(error.message || "No se pudo eliminar el producto.");
    }
  }));
}

function renderAccountDetail(customerId) {
  const card = document.getElementById("accountDetailCard");
  const customer = state.customers.find((item) => item.id === customerId);
  els.accountActionBar?.classList.toggle("hidden", !customer);
  if (!customer) {
    card.innerHTML = '<div class="empty">Buscá y seleccioná un cliente para ver sus movimientos.</div>';
    els.paymentCustomerId.value = "";
    return;
  }
  const movements = accountMovementsForCustomer(customerId);
  const balance = accountBalance(customerId);
  els.paymentCustomerId.value = customerId;

  card.innerHTML = `
    <div class="account-header">
      <div>
        <strong>#${escapeHtml(getCustomerCode(customer))} · ${escapeHtml(getCustomerFullName(customer))}</strong>
        <div class="muted">Celular: ${escapeHtml(customer.phone || "-")}</div>
        <div class="muted">Email: ${escapeHtml(customer.email || "-")}</div>
        <div class="muted">Dirección: ${escapeHtml(customer.address || "-")}</div>
      </div>
      <div class="account-balance">${currency(balance)}</div>
    </div>

    <div class="record-list">
      ${movements.length ? movements.map((item) => `
        <article class="record-card">
          <div class="record-main">
            <div class="record-head">
              <strong>${escapeHtml(item.type === "cobro" ? "Cobro" : "Cargo")}</strong>
              <span class="record-amount">${currency(item.amount)}</span>
            </div>
            <div class="record-meta">
              <span>${escapeHtml(item.date || "-")}</span>
              <span>${escapeHtml(item.details || "-")}</span>
              <span>${escapeHtml(item.paymentMethod || "-")}</span>
            </div>
          </div>
          <div class="record-actions">
            ${item.type === "cobro"
              ? `<button class="btn btn-secondary account-movement-edit-btn" data-id="${item.id}" type="button">Editar</button>
                 <button class="btn btn-danger account-movement-delete-btn" data-id="${item.id}" type="button">Eliminar</button>`
              : `<button class="btn btn-secondary account-sale-edit-btn" data-sale-id="${item.saleId || ""}" data-id="${item.id}" type="button">Editar</button>
                 <button class="btn btn-danger account-sale-delete-btn" data-sale-id="${item.saleId || ""}" data-id="${item.id}" type="button">Eliminar</button>`}
          </div>
        </article>
      `).join("") : '<div class="empty">No hay movimientos para este cliente.</div>'}
    </div>
  `;

  card.querySelectorAll(".account-movement-edit-btn").forEach((btn) => btn.addEventListener("click", async () => {
    try { await editAccountMovement(btn.dataset.id); } catch (error) { alert(error.message || "No se pudo editar el movimiento."); }
  }));
  card.querySelectorAll(".account-movement-delete-btn").forEach((btn) => btn.addEventListener("click", async () => {
    if (!confirm("¿Eliminar este cobro?")) return;
    try { await deleteAccountMovement(btn.dataset.id); } catch (error) { alert(error.message || "No se pudo eliminar el movimiento."); }
  }));
  card.querySelectorAll(".account-sale-edit-btn").forEach((btn) => btn.addEventListener("click", async () => {
    try { await editAccountLinkedSale(btn.dataset.saleId, btn.dataset.id); } catch (error) { alert(error.message || "No se pudo abrir la venta."); }
  }));
  card.querySelectorAll(".account-sale-delete-btn").forEach((btn) => btn.addEventListener("click", async () => {
    if (!confirm("¿Eliminar este cargo de la cuenta?")) return;
    try { await deleteAccountLinkedSale(btn.dataset.saleId, btn.dataset.id); } catch (error) { alert(error.message || "No se pudo eliminar el cargo."); }
  }));
}

function renderCustomers() {
  const filter = (els.customerSearchInput.value || "").trim().toLowerCase();
  const filteredCustomers = state.customers.filter((customer) => {
    const text = `${getCustomerFullName(customer)} ${customer.phone || ""} ${customer.email || ""}`.toLowerCase();
    return !filter || text.includes(filter);
  });

  const target = document.getElementById("customersList");
  target.innerHTML = filteredCustomers.length ? filteredCustomers.map((customer) => `
    <button class="simple-item customer-btn ${state.selectedCustomerId === customer.id ? "active" : ""}" data-id="${customer.id}" type="button">
      <strong>#${escapeHtml(getCustomerCode(customer))} · ${escapeHtml(getCustomerFullName(customer))}</strong>
      <span>${currency(accountBalance(customer.id))}</span>
      <div class="muted">${escapeHtml(customer.phone || "")}</div>
    </button>
  `).join("") : '<div class="empty">No hay clientes con cuenta corriente.</div>';

  document.querySelectorAll(".customer-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      state.selectedCustomerId = btn.dataset.id;
      renderCustomers();
      renderAccountDetail(btn.dataset.id);
    });
  });

  renderAccountDetail(state.selectedCustomerId);
}

function renderCash() {
  const cajaBreakdown = currentCajaBreakdown();
  renderMiniStats("cashStatusCards", [
    { label: "Caja total", value: currency(sumBreakdown(cajaBreakdown)) },
    { label: "Efectivo", value: currency(cajaBreakdown.efectivo || 0) },
    { label: "Cheques", value: currency(cajaBreakdown.cheque || 0) }
  ]);

  const node = document.getElementById("cashMovementsList");
  node.innerHTML = state.cashMovements.length ? `
    <div class="record-list">
      ${state.cashMovements.slice(0, 40).map((item) => `
        <article class="record-card">
          <div class="record-main">
            <div class="record-head">
              <strong>${item.kind === "apertura" ? "Apertura de caja" : "Ingreso manual"}</strong>
              <span class="record-amount">${item.kind === "apertura" ? currency((item.cashAmount || 0) + (item.checkAmount || 0) + (item.otherAmount || 0)) : currency(item.amount || 0)}</span>
            </div>
            <div class="record-meta">
              <span>${escapeHtml(item.date || "-")}</span>
              <span>${item.kind === "apertura"
                ? `Efectivo ${currency(item.cashAmount || 0)} · Cheques ${currency(item.checkAmount || 0)} · Otros ${currency(item.otherAmount || 0)}`
                : `${escapeHtml(String(item.medium || "otro"))} · ${escapeHtml(item.details || "")}`}</span>
            </div>
          </div>
          <div class="record-actions">
            <button class="btn btn-secondary cash-edit-btn" data-id="${item.id}" type="button">Editar</button>
            <button class="btn btn-danger cash-delete-btn" data-id="${item.id}" type="button">Eliminar</button>
          </div>
        </article>
      `).join("")}
    </div>
  ` : '<div class="empty">Todavía no registraste apertura o ingresos manuales.</div>';

  node.querySelectorAll(".cash-edit-btn").forEach((btn) => btn.addEventListener("click", async () => {
    try { await editCashMovement(btn.dataset.id); } catch (error) { alert(error.message || "No se pudo editar el movimiento."); }
  }));
  node.querySelectorAll(".cash-delete-btn").forEach((btn) => btn.addEventListener("click", async () => {
    if (!confirm("¿Eliminar este movimiento de caja?")) return;
    try { await deleteDoc(doc(db, "cash_movements", btn.dataset.id)); } catch (error) { alert(error.message || "No se pudo eliminar el movimiento."); }
  }));
}

function budgetPaymentLabel(budget) {
  return budget.paymentTerms === "Personalizado" ? (budget.paymentTermsCustom || "Personalizado") : budget.paymentTerms;
}

function renderBudgetPreview(budgetId = state.selectedBudgetId) {
  const budget = state.budgets.find((item) => item.id === budgetId);
  if (!budget) {
    els.budgetPreviewCard.innerHTML = '<div class="empty">Seleccioná un presupuesto para verlo, editarlo o compartirlo.</div>';
    els.budgetToggleSentBtn.classList.remove("btn-success");
    els.budgetToggleApprovedBtn.classList.remove("btn-success");
    els.budgetPreviewActions?.classList.add("hidden");
    return;
  }
  state.selectedBudgetId = budget.id;
  els.budgetPreviewActions?.classList.remove("hidden");
  els.budgetToggleSentBtn.classList.toggle("btn-success", !!budget.sent);
  els.budgetToggleApprovedBtn.classList.toggle("btn-success", !!budget.approved);

  const rows = (budget.items || []).map((item, index) => `
    <tr>
      <td>${index + 1}</td>
      <td>${escapeHtml(item.description || "-")}</td>
      <td>${item.quantity || 0}</td>
      <td>${escapeHtml(item.unit || "")}</td>
      <td>${currency(item.unitPrice)}</td>
      <td>${currency(item.total)}</td>
    </tr>
  `).join("");

  els.budgetPreviewCard.innerHTML = `
    <div class="budget-sheet">
      <div class="budget-sheet-head">
        <div class="budget-sheet-brand">
          <img src="./img/company-logo-wide.png" alt="Mundo Led que brillen tus ideas" class="budget-company-logo" />
          <div class="budget-company-data">
            <p>Av. San Martín 646 · Cel: 3735 506858</p>
            <p>info@mundoledchaco.com · www.mundoledchaco.com</p>
          </div>
        </div>
        <div class="budget-sheet-side">
          <strong>Presupuesto ${escapeHtml(budget.number || budget.id)}</strong>
          <span>Fecha: ${escapeHtml(budget.date || "-")}</span>
          <span>Validez: ${escapeHtml(budget.validUntil || "-")}</span>
          <div class="top-badges">
            ${budget.sent ? '<span class="status-pill success">Enviado</span>' : ''}
            ${budget.approved ? '<span class="status-pill success">Aprobado</span>' : ''}
          </div>
        </div>
      </div>

      <div class="budget-client-box">
        <strong>Cliente: ${escapeHtml(budget.clientName || "-")}</strong>
        <span>Celular: ${escapeHtml(budget.clientPhone || "-")}</span>
        <span>Email: ${escapeHtml(budget.clientEmail || "-")}</span>
        <span>Dirección: ${escapeHtml(budget.clientAddress || "-")}</span>
      </div>

      <table class="data-table">
        <thead>
          <tr><th>#</th><th>Detalle</th><th>Cant.</th><th>Unidad</th><th>Unitario</th><th>Total</th></tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>

      <div class="budget-sheet-footer">
        <div>
          <strong>Condición de pago</strong>
          <p>${escapeHtml(budgetPaymentLabel(budget))}</p>
          <strong>Observaciones</strong>
          <p>${escapeHtml(budget.notes || "-")}</p>
        </div>
        <div class="budget-grand-total">
          <span>Total</span>
          <strong>${currency(budget.total)}</strong>
        </div>
      </div>
    </div>
  `;
}

function getBudgetsFiltered() {
  const budgetFilterText = (els.budgetSearchInput?.value || "").trim().toLowerCase();
  const budgetFrom = els.budgetSearchFrom?.value || "";
  const budgetTo = els.budgetSearchTo?.value || "";
  return state.budgets.filter((budget) => {
    const text = `${budget.number || ""} ${budget.clientName || ""}`.toLowerCase();
    const matchesText = !budgetFilterText || text.includes(budgetFilterText);
    const matchesFrom = !budgetFrom || (budget.date || "") >= budgetFrom;
    const matchesTo = !budgetTo || (budget.date || "") <= budgetTo;
    return matchesText && matchesFrom && matchesTo;
  });
}

function renderBudgets() {
  const filteredBudgets = getBudgetsFiltered();
  els.budgetsList.innerHTML = filteredBudgets.length ? filteredBudgets.map((budget) => `
    <div class="simple-item budget-row ${state.selectedBudgetId === budget.id ? "active" : ""}">
      <button class="budget-btn-main" data-id="${budget.id}" type="button">
        <strong>${escapeHtml(budget.number || budget.id)} · ${escapeHtml(budget.clientName || "Cliente")}</strong>
        <span>${currency(budget.total)}</span>
        <div class="top-badges">
          ${budget.sent ? '<span class="status-pill success">Enviado</span>' : ''}
          ${budget.approved ? '<span class="status-pill success">Aprobado</span>' : ''}
        </div>
        <div class="muted">${escapeHtml(budgetPaymentLabel(budget))}</div>
        <div class="muted">Fecha: ${escapeHtml(budget.date || "-")}</div>
      </button>
      <div class="budget-row-actions">
        <button class="btn btn-secondary budget-view-btn" data-id="${budget.id}" type="button">Ver</button>
        <button class="btn btn-secondary budget-edit-btn" data-id="${budget.id}" type="button">Editar</button>
        <button class="btn btn-secondary budget-sent-btn ${budget.sent ? "btn-success" : ""}" data-id="${budget.id}" type="button">Enviado</button>
        <button class="btn btn-secondary budget-approved-btn ${budget.approved ? "btn-success" : ""}" data-id="${budget.id}" type="button">Aprobado</button>
        <button class="btn btn-danger budget-delete-btn" data-id="${budget.id}" type="button">Eliminar</button>
      </div>
    </div>
  `).join("") : '<div class="empty">No hay presupuestos guardados.</div>';

  document.querySelectorAll(".budget-btn-main").forEach((btn) => btn.addEventListener("click", () => renderBudgetPreview(btn.dataset.id)));
  document.querySelectorAll(".budget-view-btn").forEach((btn) => btn.addEventListener("click", () => renderBudgetPreview(btn.dataset.id)));
  document.querySelectorAll(".budget-edit-btn").forEach((btn) => btn.addEventListener("click", () => loadBudgetIntoForm(btn.dataset.id)));
  document.querySelectorAll(".budget-delete-btn").forEach((btn) => btn.addEventListener("click", async () => {
    if (!confirm("¿Eliminar este presupuesto?")) return;
    try {
      await deleteDoc(doc(db, "budgets", btn.dataset.id));
      if (state.selectedBudgetId === btn.dataset.id) {
        state.selectedBudgetId = "";
        renderBudgetPreview("");
      }
    } catch (error) {
      alert(error.message || "No se pudo eliminar el presupuesto.");
    }
  }));
  document.querySelectorAll(".budget-sent-btn").forEach((btn) => btn.addEventListener("click", async () => {
    try { await toggleBudgetFlag(btn.dataset.id, "sent"); } catch (error) { alert(error.message || "No se pudo actualizar el estado."); }
  }));
  document.querySelectorAll(".budget-approved-btn").forEach((btn) => btn.addEventListener("click", async () => {
    try { await toggleBudgetFlag(btn.dataset.id, "approved"); } catch (error) { alert(error.message || "No se pudo actualizar el estado."); }
  }));

  renderBudgetPreview(state.selectedBudgetId);
}

function renderUsers() {
  const wrap = document.getElementById("usersTableWrap");
  if (!wrap) return;
  wrap.innerHTML = state.users.length ? `
    <div class="record-list">
      ${state.users.map((user) => `
        <article class="record-card">
          <div class="record-main">
            <div class="record-head">
              <strong>${escapeHtml(user.name || "-")}</strong>
              <span>${escapeHtml(roleLabel(user.role))}</span>
            </div>
            <div class="record-meta">
              <span>${escapeHtml(user.username || "-")}</span>
            </div>
          </div>
          <div class="record-actions">
            ${isAdmin() ? `<button class="btn btn-secondary user-edit-btn" data-id="${user.id}" type="button">Editar</button>` : ""}
            ${isAdmin() && user.id !== state.sessionUser.id ? `<button class="btn btn-danger user-delete-btn" data-id="${user.id}" type="button">Eliminar</button>` : ""}
          </div>
        </article>
      `).join("")}
    </div>
  ` : '<div class="empty">No hay usuarios cargados.</div>';
  wrap.querySelectorAll(".user-edit-btn").forEach((btn) => btn.addEventListener("click", () => loadUserIntoForm(btn.dataset.id)));
  wrap.querySelectorAll(".user-delete-btn").forEach((btn) => btn.addEventListener("click", async () => {
    if (!confirm("¿Eliminar este usuario?")) return;
    try { await deleteDoc(doc(db, "users", btn.dataset.id)); } catch (error) { alert(error.message || "No se pudo eliminar el usuario."); }
  }));
}

function renderEverything() {
  fillCategoriesSelect();
  fillCustomerSelects();
  renderDashboard();
  renderSales();
  renderExpenses();
  renderProducts();
  renderCustomers();
  renderCash();
  renderBudgets();
  renderUsers();
  syncBudgetClientMode();
  enhanceMoneyInputs(document);
}

async function ensureAnonymousSession() {
  if (state.authUser) return;
  await signInAnonymously(auth);
}

async function countAdminUsers() {
  const snap = await getDocs(query(collection(db, "users"), where("role", "==", "administrador"), limit(1)));
  return snap.size;
}

async function findUserByCredentials(username, password, role) {
  const passwordHash = await sha256(password);
  const snap = await getDocs(query(
    collection(db, "users"),
    where("username", "==", username.trim().toLowerCase()),
    where("passwordHash", "==", passwordHash),
    where("role", "==", role)
  ));
  if (snap.empty) return null;
  const docSnap = snap.docs[0];
  return { id: docSnap.id, ...docSnap.data() };
}

async function createFirstAdmin(username, password) {
  const cleanUsername = username.trim().toLowerCase();
  const userId = sanitizeId(cleanUsername);
  const passwordHash = await sha256(password);
  const payload = {
    name: "Administrador",
    username: cleanUsername,
    passwordHash,
    role: "administrador",
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp()
  };
  await setDoc(doc(db, "users", userId), payload, { merge: true });
  return { id: userId, ...payload };
}

async function handleLogin(username, password) {
  await ensureAnonymousSession();
  const cleanUsername = username.trim().toLowerCase();
  if (!cleanUsername || !password) throw new Error("Completá usuario y contraseña.");

  if (state.loginMode === "administrador") {
    const adminCount = await countAdminUsers();
    if (adminCount === 0) return await createFirstAdmin(cleanUsername, password);
    const user = await findUserByCredentials(cleanUsername, password, "administrador");
    if (!user) throw new Error("Usuario o contraseña de administración incorrectos.");
    return user;
  }

  const vendor = await findUserByCredentials(cleanUsername, password, "vendedor");
  if (!vendor) throw new Error("Usuario o contraseña de vendedor incorrectos.");
  return vendor;
}

async function saveCustomerForAccount(data) {
  const firstName = String(data.customerFirstName || "").trim();
  const lastName = String(data.customerLastName || "").trim();
  const phone = String(data.customerPhone || "").trim();
  const email = String(data.customerEmail || "").trim().toLowerCase();
  const address = String(data.customerAddress || "").trim();

  const existing = state.customers.find((customer) =>
    String(customer.firstName || "").trim().toLowerCase() === firstName.toLowerCase() &&
    String(customer.lastName || "").trim().toLowerCase() === lastName.toLowerCase() &&
    (phone ? String(customer.phone || "").trim() === phone : true)
  );

  const customerId = existing?.id || nextSequentialCustomerCode();
  const payload = {
    code: existing?.code || customerId,
    firstName,
    lastName,
    phone,
    email,
    address,
    updatedAt: serverTimestamp()
  };
  if (!existing) payload.createdAt = serverTimestamp();
  await setDoc(doc(db, "customers", customerId), payload, { merge: true });
  return customerId;
}

async function syncSaleAccountMovement(saleRefId, payload, originalSale = null) {
  const isAccount = payload.operationType === "cuenta_corriente";
  if (!isAccount) {
    if (originalSale?.accountMovementId) {
      await deleteDoc(doc(db, "account_movements", originalSale.accountMovementId));
    }
    payload.customerId = "";
    payload.accountMovementId = "";
    return payload;
  }

  const customerId = await saveCustomerForAccount(payload);
  payload.customerId = customerId;
  const movementPayload = {
    customerId,
    type: "cargo",
    amount: payload.amount,
    date: payload.date,
    details: `${payload.documentType} ${payload.documentNumber}`.trim(),
    paymentMethod: "",
    saleId: saleRefId,
    createdAt: originalSale?.accountMovementId ? originalSale.createdAt || serverTimestamp() : serverTimestamp(),
    updatedAt: serverTimestamp()
  };
  const movementId = originalSale?.accountMovementId || doc(collection(db, "account_movements")).id;
  await setDoc(doc(db, "account_movements", movementId), movementPayload, { merge: true });
  payload.accountMovementId = movementId;

  if (originalSale?.accountMovementId && originalSale.accountMovementId !== movementId) {
    try { await deleteDoc(doc(db, "account_movements", originalSale.accountMovementId)); } catch (_) {}
  }
  return payload;
}

function syncSaleFormVisibility() {
  const accountMode = els.saleOperationType.value === "cuenta_corriente";
  els.saleCashFields.classList.toggle("hidden", accountMode);
  els.saleAccountFields.classList.toggle("hidden", !accountMode);
  if (accountMode) {
    els.saleSubmitBtn.textContent = state.editingSaleId ? "Guardar cambios de venta y cliente" : "Guardar venta y cliente";
  } else {
    els.saleSubmitBtn.textContent = state.editingSaleId ? "Guardar cambios de venta" : "Guardar venta";
  }
}

function syncCheckFields() {
  const isCheck = els.paymentMethod.value === "cheque";
  els.checkFields.classList.toggle("hidden", !isCheck);
}

function resetSaleForm() {
  state.editingSaleId = "";
  els.saleForm.reset();
  els.saleForm.date.value = todayISO();
  els.saleFormTitle.textContent = "Cargar venta";
  els.cancelSaleEditBtn.classList.add("hidden");
  els.saleSubmitBtn.textContent = "Guardar venta";
  els.saleOperationType.value = "contado";
  els.paymentMethod.value = "efectivo";
  syncSaleFormVisibility();
  syncCheckFields();
  enhanceMoneyInputs(els.saleForm);
  clearMessage("saleMsg");
}

function loadSaleIntoForm(id) {
  const sale = state.sales.find((item) => item.id === id);
  if (!sale) return;
  state.editingSaleId = id;
  const form = els.saleForm;
  form.date.value = sale.date || todayISO();
  setMoneyFieldValue(form.amount, sale.amount || 0);
  form.documentType.value = sale.documentType || "Remito X";
  form.documentNumber.value = sale.documentNumber || "";
  form.operationType.value = sale.operationType || "contado";
  form.paymentMethod.value = sale.paymentMethod || "efectivo";
  form.details.value = sale.details || "";
  form.checkBank.value = sale.checkBank || "";
  form.checkNumber.value = sale.checkNumber || "";
  form.checkHolder.value = sale.checkHolder || "";
  form.checkDueDate.value = sale.checkDueDate || "";
  form.customerFirstName.value = sale.customerFirstName || "";
  form.customerLastName.value = sale.customerLastName || "";
  form.customerPhone.value = sale.customerPhone || "";
  form.customerEmail.value = sale.customerEmail || "";
  form.customerAddress.value = sale.customerAddress || "";
  els.saleFormTitle.textContent = "Editar venta";
  els.cancelSaleEditBtn.classList.remove("hidden");
  syncSaleFormVisibility();
  syncCheckFields();
  document.querySelector('[data-view="ventas"]')?.click();
  form.scrollIntoView({ behavior: "smooth", block: "start" });
}

async function deleteSale(id) {
  const sale = state.sales.find((item) => item.id === id);
  if (!sale) return;
  if (sale.accountMovementId) {
    try { await deleteDoc(doc(db, "account_movements", sale.accountMovementId)); } catch (_) {}
  }
  await deleteDoc(doc(db, "sales", id));
}


async function editAccountMovement(id) {
  const item = state.accountMovements.find((movement) => movement.id === id);
  if (!item) throw new Error("Movimiento no encontrado.");
  if (item.type !== "cobro") {
    if (item.saleId) return loadSaleIntoForm(item.saleId);
    throw new Error("Este cargo se corrige desde la venta.");
  }
  const date = prompt("Fecha del cobro", item.date || todayISO());
  if (date === null) return;
  const amountInput = prompt("Monto del cobro", String(item.amount || 0));
  if (amountInput === null) return;
  const paymentMethod = prompt("Medio de cobro", item.paymentMethod || "efectivo");
  if (paymentMethod === null) return;
  const details = prompt("Detalle", item.details || "Cobro de cuenta corriente");
  if (details === null) return;

  await updateDoc(doc(db, "account_movements", id), {
    date,
    amount: parseMoneyValue(amountInput),
    paymentMethod,
    details,
    updatedAt: serverTimestamp()
  });
}

async function deleteAccountMovement(id) {
  const item = state.accountMovements.find((movement) => movement.id === id);
  if (!item) return;
  if (item.saleId) return deleteSale(item.saleId);
  await deleteDoc(doc(db, "account_movements", id));
}

async function editAccountLinkedSale(saleId, movementId) {
  if (saleId) return loadSaleIntoForm(saleId);
  return editAccountMovement(movementId);
}

async function deleteAccountLinkedSale(saleId, movementId) {
  if (saleId) return deleteSale(saleId);
  return deleteAccountMovement(movementId);
}

async function editCashMovement(id) {
  const item = state.cashMovements.find((movement) => movement.id === id);
  if (!item) throw new Error("Movimiento no encontrado.");
  const date = prompt("Fecha", item.date || todayISO());
  if (date === null) return;

  if (item.kind === "apertura") {
    const cashAmount = prompt("Efectivo inicial", String(item.cashAmount || 0));
    if (cashAmount === null) return;
    const checkAmount = prompt("Cheques iniciales", String(item.checkAmount || 0));
    if (checkAmount === null) return;
    const otherAmount = prompt("Otros medios iniciales", String(item.otherAmount || 0));
    if (otherAmount === null) return;
    const details = prompt("Detalle", item.details || "");
    if (details === null) return;
    await updateDoc(doc(db, "cash_movements", id), {
      date,
      cashAmount: parseMoneyValue(cashAmount),
      checkAmount: parseMoneyValue(checkAmount),
      otherAmount: parseMoneyValue(otherAmount),
      details,
      updatedAt: serverTimestamp()
    });
    return;
  }

  const amount = prompt("Monto", String(item.amount || 0));
  if (amount === null) return;
  const medium = prompt("Medio", item.medium || "efectivo");
  if (medium === null) return;
  const details = prompt("Detalle", item.details || "");
  if (details === null) return;
  await updateDoc(doc(db, "cash_movements", id), {
    date,
    amount: parseMoneyValue(amount),
    medium,
    details,
    updatedAt: serverTimestamp()
  });
}

function resetExpenseForm() {
  state.editingExpenseId = "";
  els.expenseForm.reset();
  els.expenseForm.date.value = todayISO();
  els.expenseFormTitle.textContent = "Cargar gasto";
  els.cancelExpenseEditBtn.classList.add("hidden");
  els.expenseSubmitBtn.textContent = "Guardar gasto";
  enhanceMoneyInputs(els.expenseForm);
  clearMessage("expenseMsg");
}

function loadExpenseIntoForm(id) {
  const item = state.expenses.find((exp) => exp.id === id);
  if (!item) return;
  state.editingExpenseId = id;
  const form = els.expenseForm;
  form.date.value = item.date || todayISO();
  setMoneyFieldValue(form.amount, item.amount || 0);
  form.category.value = item.category || "Gastos Insumos Negocio";
  form.details.value = item.details || "";
  els.expenseFormTitle.textContent = "Editar gasto";
  els.cancelExpenseEditBtn.classList.remove("hidden");
  els.expenseSubmitBtn.textContent = "Guardar cambios";
  document.querySelector('[data-view="gastos"]')?.click();
  form.scrollIntoView({ behavior: "smooth", block: "start" });
}

function resetProductForm() {
  state.editingProductId = "";
  els.productForm.reset();
  els.productFormTitle.textContent = "Crear producto";
  document.getElementById("productSubmitBtn").textContent = "Guardar producto";
  els.cancelProductEditBtn.classList.add("hidden");
  enhanceMoneyInputs(els.productForm);
  clearMessage("productMsg");
  if (state.categories[0]) els.productForm.category.value = state.categories[0].name;
}

function loadProductIntoForm(id) {
  const item = state.products.find((prod) => prod.id === id);
  if (!item) return;
  state.editingProductId = id;
  const form = els.productForm;
  form.code.value = item.code || "";
  form.name.value = item.name || "";
  form.description.value = item.description || "";
  form.category.value = item.category || "";
  form.unit.value = item.unit || "unidad";
  form.currentStock.value = item.currentStock ?? 0;
  form.minStock.value = item.minStock ?? 0;
  setMoneyFieldValue(form.cost, item.cost || 0);
  setMoneyFieldValue(form.salePrice, item.salePrice || 0);
  els.productFormTitle.textContent = "Editar producto";
  document.getElementById("productSubmitBtn").textContent = "Guardar cambios";
  els.cancelProductEditBtn.classList.remove("hidden");
  document.querySelector('[data-view="stock"]')?.click();
  form.scrollIntoView({ behavior: "smooth", block: "start" });
}

function budgetItemsDraftFromDom() {
  if (!els.budgetItemsWrap) return [];
  return [...els.budgetItemsWrap.querySelectorAll(".budget-item-row")].map((row) => {
    const source = row.querySelector('[name="source"]')?.value || "manual";
    const stockId = row.querySelector('[name="stockId"]')?.value || "";
    const description = row.querySelector('[name="description"]')?.value || "";
    const quantity = Number(row.querySelector('[name="quantity"]')?.value || 0);
    const unitPrice = parseMoneyValue(row.querySelector('[name="unitPrice"]')?.value || 0);
    const unit = row.querySelector('[name="unit"]')?.value || "unidad";
    return { source, stockId, description, quantity, unitPrice, unit, total: quantity * unitPrice };
  }).filter((item) => item.description || item.quantity || item.unitPrice);
}

function updateBudgetTotals() {
  const items = budgetItemsDraftFromDom();
  const total = items.reduce((sum, item) => sum + Number(item.total || 0), 0);
  if (els.budgetSubtotal) els.budgetSubtotal.textContent = currency(total);
  if (els.budgetTotal) els.budgetTotal.textContent = currency(total);
}

function createBudgetItemRow(item = {}) {
  if (!els.budgetItemsWrap) return;
  const row = document.createElement("div");
  row.className = "budget-item-row";
  const source = item.source || "manual";
  const options = ['<option value="">Seleccionar producto</option>'].concat(
    state.products.map((prod) => `<option value="${prod.id}">${escapeHtml(prod.code || "-")} · ${escapeHtml(prod.name)}</option>`)
  ).join("");

  row.innerHTML = `
    <label>
      <span>Modo</span>
      <select name="source">
        <option value="manual" ${source === "manual" ? "selected" : ""}>Manual</option>
        <option value="stock" ${source === "stock" ? "selected" : ""}>Desde stock</option>
      </select>
    </label>
    <label class="${source === "stock" ? "" : "hidden"} budget-stock-wrap">
      <span>Buscar producto</span>
      <select name="stockId">${options}</select>
    </label>
    <label class="budget-description-wrap full">
      <span>Detalle</span>
      <input name="description" type="text" value="${escapeHtml(item.description || "")}" placeholder="Detalle completo del producto o servicio" required />
    </label>
    <label>
      <span>Cantidad</span>
      <input name="quantity" type="number" min="0" step="0.01" value="${item.quantity || 1}" />
    </label>
    <label>
      <span>Unidad</span>
      <select name="unit">
        <option value="unidad" ${item.unit === "unidad" ? "selected" : ""}>Unidad</option>
        <option value="kilos" ${item.unit === "kilos" ? "selected" : ""}>Kilos</option>
        <option value="metros" ${item.unit === "metros" ? "selected" : ""}>Metros</option>
        <option value="litros" ${item.unit === "litros" ? "selected" : ""}>Litros</option>
      </select>
    </label>
    <label>
      <span>Precio unitario</span>
      <input name="unitPrice" type="text" inputmode="decimal" data-money="true" value="${formatMoneyInputValue(item.unitPrice || 0)}" />
      <small class="money-text" data-money-text-for="unitPrice">${moneyToWords(item.unitPrice || 0)}</small>
    </label>
    <button class="btn btn-secondary remove-budget-item-btn" type="button">Quitar</button>
  `;

  const sourceSelect = row.querySelector('[name="source"]');
  const stockWrap = row.querySelector(".budget-stock-wrap");
  const stockSelect = row.querySelector('[name="stockId"]');
  const descriptionInput = row.querySelector('[name="description"]');
  const unitInput = row.querySelector('[name="unit"]');
  stockSelect.value = item.stockId || "";

  const applyProduct = () => {
    const product = state.products.find((prod) => prod.id === stockSelect.value);
    if (!product) return;
    descriptionInput.value = product.description || product.name || product.code || "";
    row.querySelector('[name="unitPrice"]').value = formatMoneyInputValue(product.salePrice || product.cost || 0);
    unitInput.value = product.unit || "unidad";
    updateBudgetTotals();
    enhanceMoneyInputs(row);
  };

  sourceSelect?.addEventListener("change", () => {
    stockWrap.classList.toggle("hidden", sourceSelect.value !== "stock");
    if (sourceSelect.value === "stock") applyProduct();
  });
  stockSelect?.addEventListener("change", applyProduct);

  if (source === "stock" && item.stockId) applyProduct();

  row.querySelectorAll("input, select").forEach((input) => input.addEventListener("input", updateBudgetTotals));
  row.querySelector(".remove-budget-item-btn").addEventListener("click", () => {
    row.remove();
    if (!els.budgetItemsWrap.children.length) createBudgetItemRow({ source: "manual", quantity: 1, unitPrice: 0, unit: "unidad" });
    updateBudgetTotals();
  });

  els.budgetItemsWrap.appendChild(row);
  enhanceMoneyInputs(row);
  updateBudgetTotals();
}

function resetBudgetBuilder() {
  if (!els.budgetItemsWrap) return;
  els.budgetItemsWrap.innerHTML = "";
  createBudgetItemRow({ source: "manual", quantity: 1, unitPrice: 0, unit: "unidad" });
}

function resetBudgetForm() {
  state.editingBudgetId = "";
  els.budgetForm.reset();
  els.budgetForm.date.value = todayISO();
  els.budgetFormTitle.textContent = "Presupuesto nuevo";
  els.budgetSubmitBtn.textContent = "Guardar presupuesto";
  els.cancelBudgetEditBtn.classList.add("hidden");
  els.budgetClientMode.value = "manual";
  if (els.budgetCustomerSearch) els.budgetCustomerSearch.value = "";
  if (els.budgetCustomerId) els.budgetCustomerId.value = "";
  syncBudgetClientMode();
  resetBudgetBuilder();
  updateBudgetTotals();
  clearMessage("budgetMsg");
}

function loadBudgetIntoForm(id) {
  const budget = state.budgets.find((item) => item.id === id);
  if (!budget) return;
  state.editingBudgetId = id;
  const form = els.budgetForm;
  form.date.value = budget.date || todayISO();
  form.validUntil.value = budget.validUntil || "";
  form.paymentTerms.value = budget.paymentTerms || "Efectivo";
  form.paymentTermsCustom.value = budget.paymentTermsCustom || "";
  form.notes.value = budget.notes || "";
  if (budget.customerId) {
    els.budgetClientMode.value = "existing";
    const customer = state.customers.find((item) => item.id === budget.customerId);
    if (customer && els.budgetCustomerSearch) {
      els.budgetCustomerSearch.value = `${getCustomerCode(customer)} · ${getCustomerFullName(customer)} · ${customer.phone || ""}`;
    }
    if (els.budgetCustomerId) els.budgetCustomerId.value = budget.customerId;
  } else {
    els.budgetClientMode.value = "manual";
    form.clientName.value = budget.clientName || "";
    form.clientPhone.value = budget.clientPhone || "";
    form.clientEmail.value = budget.clientEmail || "";
    form.clientAddress.value = budget.clientAddress || "";
  }
  syncBudgetClientMode();
  els.budgetCustomTermsWrap.classList.toggle("hidden", els.budgetPaymentTerms.value !== "Personalizado");
  els.budgetItemsWrap.innerHTML = "";
  (budget.items || []).forEach((item) => createBudgetItemRow(item));
  updateBudgetTotals();
  els.budgetFormTitle.textContent = "Editar presupuesto";
  els.budgetSubmitBtn.textContent = "Guardar cambios";
  els.cancelBudgetEditBtn.classList.remove("hidden");
  document.querySelector('[data-view="presupuestos"]')?.click();
  form.scrollIntoView({ behavior: "smooth", block: "start" });
}

async function toggleBudgetFlag(id, flag) {
  const budget = state.budgets.find((item) => item.id === id);
  if (!budget) return;
  await updateDoc(doc(db, "budgets", id), {
    [flag]: !budget[flag],
    updatedAt: serverTimestamp()
  });
}

async function captureElementToPng(element, filename) {
  const canvas = await window.html2canvas(element, { backgroundColor: "#ffffff", scale: 2 });
  return new Promise((resolve) => {
    canvas.toBlob((blob) => {
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.download = filename;
      link.href = url;
      link.click();
      setTimeout(() => URL.revokeObjectURL(url), 2000);
      resolve(blob);
    }, "image/png");
  });
}

async function captureElementToPdf(element, filename) {
  const canvas = await window.html2canvas(element, { backgroundColor: "#ffffff", scale: 2 });
  const { jsPDF } = window.jspdf;
  const pdf = new jsPDF("p", "mm", "a4");
  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();
  const margin = 8;
  const usableWidth = pageWidth - margin * 2;
  const imgHeight = canvas.height * usableWidth / canvas.width;
  const imgData = canvas.toDataURL("image/png");
  let position = margin;
  let remaining = imgHeight;
  pdf.addImage(imgData, "PNG", margin, position, usableWidth, imgHeight);
  remaining -= (pageHeight - margin * 2);
  while (remaining > 0) {
    pdf.addPage();
    position = margin - (imgHeight - remaining);
    pdf.addImage(imgData, "PNG", margin, position, usableWidth, imgHeight);
    remaining -= (pageHeight - margin * 2);
  }
  pdf.save(filename);
}

function mountSheet(html) {
  els.renderHost.innerHTML = `<div class="sheet-card">${html}</div>`;
  return els.renderHost.firstElementChild;
}

function buildSaleTicketHtml(sale) {
  const customerName = sale.operationType === "cuenta_corriente"
    ? `${sale.customerFirstName || ""} ${sale.customerLastName || ""}`.trim()
    : "Consumidor final";
  return `
    <div class="ticket-sheet">
      <div class="ticket-sheet-head">
        <div class="ticket-sheet-brand">
          <img src="./img/company-logo-wide.png" alt="Mundo Led" class="budget-company-logo" />
          <div class="ticket-company-data">
            <strong>Ticket / comprobante</strong>
            <span class="sheet-muted">Generado desde SeniorFlow</span>
          </div>
        </div>
        <div class="budget-sheet-side">
          <strong>${escapeHtml(sale.documentType || "Ticket")}</strong>
          <span>Número: ${escapeHtml(sale.documentNumber || "-")}</span>
          <span>Fecha: ${escapeHtml(sale.date || "-")}</span>
        </div>
      </div>

      <div class="ticket-client-box">
        <strong>Cliente: ${escapeHtml(customerName || "Consumidor final")}</strong>
        <span>Operación: ${sale.operationType === "cuenta_corriente" ? "Cuenta corriente" : "Contado"}</span>
        <span>Medio: ${escapeHtml(sale.paymentMethod || "-")}</span>
        <span>Detalle: ${escapeHtml(sale.details || "-")}</span>
      </div>

      <table class="sheet-table">
        <thead><tr><th>Concepto</th><th class="text-right">Importe</th></tr></thead>
        <tbody>
          <tr><td>${escapeHtml(sale.documentType || "Venta")} ${escapeHtml(sale.documentNumber || "")}</td><td class="text-right">${currency(sale.amount)}</td></tr>
        </tbody>
      </table>

      <div class="budget-grand-total">
        <span>Total</span>
        <strong>${currency(sale.amount)}</strong>
      </div>
    </div>
  `;
}

async function shareSaleTicket(id) {
  const sale = state.sales.find((item) => item.id === id);
  if (!sale) throw new Error("Venta no encontrada.");
  const node = mountSheet(buildSaleTicketHtml(sale));
  const canvas = await window.html2canvas(node, { backgroundColor: "#ffffff", scale: 2 });
  const blob = await new Promise((resolve) => canvas.toBlob(resolve, "image/png"));
  const file = new File([blob], `ticket-${sale.documentNumber || sale.id}.png`, { type: "image/png" });
  if (navigator.share && navigator.canShare?.({ files: [file] })) {
    await navigator.share({
      title: `Ticket ${sale.documentNumber || sale.id}`,
      text: `Ticket ${sale.documentType || "Venta"} por ${currency(sale.amount)}`,
      files: [file]
    });
    return;
  }
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.download = file.name;
  link.href = url;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

function buildAccountSheetHtml(customer) {
  const balance = accountBalance(customer.id);
  const movements = accountMovementsForCustomer(customer.id);
  return `
    <div class="account-sheet">
      <div class="ticket-sheet-head">
        <div>
          <img src="./img/company-logo-wide.png" alt="Mundo Led" class="budget-company-logo" />
          <div class="ticket-company-data">
            <strong>Estado de cuenta corriente</strong>
            <span class="sheet-muted">${escapeHtml(getCustomerFullName(customer))}</span>
          </div>
        </div>
        <div class="budget-sheet-side">
          <strong>Saldo</strong>
          <span>${currency(balance)}</span>
        </div>
      </div>
      <div class="ticket-client-box">
        <span>Cliente: ${escapeHtml(getCustomerFullName(customer))}</span>
        <span>Celular: ${escapeHtml(customer.phone || "-")}</span>
        <span>Email: ${escapeHtml(customer.email || "-")}</span>
        <span>Dirección: ${escapeHtml(customer.address || "-")}</span>
      </div>
      <table class="sheet-table">
        <thead>
          <tr><th>Fecha</th><th>Tipo</th><th>Detalle</th><th>Medio</th><th class="text-right">Monto</th></tr>
        </thead>
        <tbody>
          ${movements.length ? movements.map((item) => `
            <tr>
              <td>${escapeHtml(item.date || "-")}</td>
              <td>${escapeHtml(item.type || "-")}</td>
              <td>${escapeHtml(item.details || "-")}</td>
              <td>${escapeHtml(item.paymentMethod || "-")}</td>
              <td class="text-right">${currency(item.amount)}</td>
            </tr>
          `).join("") : '<tr><td colspan="5">Sin movimientos.</td></tr>'}
        </tbody>
      </table>
      <div class="budget-grand-total">
        <span>Saldo actual</span>
        <strong>${currency(balance)}</strong>
      </div>
    </div>
  `;
}

async function downloadAccountImage() {
  const customer = state.customers.find((item) => item.id === state.selectedCustomerId);
  if (!customer) throw new Error("Seleccioná una cuenta primero.");
  const node = mountSheet(buildAccountSheetHtml(customer));
  await captureElementToPng(node, `cuenta-${sanitizeId(getCustomerFullName(customer))}.png`);
}

async function downloadAccountPdf() {
  const customer = state.customers.find((item) => item.id === state.selectedCustomerId);
  if (!customer) throw new Error("Seleccioná una cuenta primero.");
  const node = mountSheet(buildAccountSheetHtml(customer));
  await captureElementToPdf(node, `cuenta-${sanitizeId(getCustomerFullName(customer))}.pdf`);
}

async function deleteSelectedAccount() {
  if (!isAdmin()) throw new Error("Solo administración puede eliminar cuentas.");
  if (!state.selectedCustomerId) throw new Error("Seleccioná una cuenta.");
  const batch = writeBatch(db);
  batch.delete(doc(db, "customers", state.selectedCustomerId));
  state.accountMovements.filter((item) => item.customerId === state.selectedCustomerId).forEach((item) => {
    batch.delete(doc(db, "account_movements", item.id));
  });
  state.sales.filter((sale) => sale.customerId === state.selectedCustomerId).forEach((sale) => {
    batch.update(doc(db, "sales", sale.id), {
      customerId: "",
      customerFirstName: sale.customerFirstName || "",
      customerLastName: sale.customerLastName || "",
      customerPhone: sale.customerPhone || "",
      customerEmail: sale.customerEmail || "",
      customerAddress: sale.customerAddress || "",
      accountMovementId: "",
      updatedAt: serverTimestamp()
    });
  });
  await batch.commit();
  state.selectedCustomerId = "";
}

function getSelectedBudget() {
  return state.budgets.find((item) => item.id === state.selectedBudgetId) || null;
}

async function downloadBudgetPng(budget = getSelectedBudget()) {
  if (!budget) throw new Error("Seleccioná un presupuesto.");
  await captureElementToPng(els.budgetPreviewCard, `presupuesto-${budget.number || budget.id}.png`);
}

async function downloadBudgetPdf(budget = getSelectedBudget()) {
  if (!budget) throw new Error("Seleccioná un presupuesto.");
  await captureElementToPdf(els.budgetPreviewCard, `presupuesto-${budget.number || budget.id}.pdf`);
}

async function shareBudget(budget = getSelectedBudget()) {
  if (!budget) throw new Error("Seleccioná un presupuesto.");
  const canvas = await window.html2canvas(els.budgetPreviewCard, { backgroundColor: "#ffffff", scale: 2 });
  const blob = await new Promise((resolve) => canvas.toBlob(resolve, "image/png"));
  const file = new File([blob], `presupuesto-${budget.number || budget.id}.png`, { type: "image/png" });
  const text = `Presupuesto ${budget.number || budget.id} · ${budget.clientName} · Total ${currency(budget.total)}`;
  if (navigator.share && navigator.canShare?.({ files: [file] })) {
    await navigator.share({ title: `Presupuesto ${budget.number || budget.id}`, text, files: [file] });
    return;
  }
  const link = document.createElement("a");
  link.download = file.name;
  link.href = URL.createObjectURL(blob);
  link.click();
}

function buildProductListHtml() {
  const grouped = {};
  state.products.slice().sort((a, b) => {
    const catDiff = String(a.category || "").localeCompare(String(b.category || ""));
    if (catDiff !== 0) return catDiff;
    return String(a.name || "").localeCompare(String(b.name || ""));
  }).forEach((item) => {
    const category = item.category || "General";
    grouped[category] ||= [];
    grouped[category].push(item);
  });

  const sections = Object.entries(grouped).map(([category, products]) => `
    <div>
      <h3>${escapeHtml(category)}</h3>
      <table class="sheet-table">
        <thead>
          <tr><th>Código</th><th>Producto / descripción</th><th>Unidad</th><th class="text-right">Costo</th><th class="text-right">Precio final</th></tr>
        </thead>
        <tbody>
          ${products.map((item) => `
            <tr>
              <td>${escapeHtml(item.code || "-")}</td>
              <td><strong>${escapeHtml(item.name || "-")}</strong><div class="sheet-muted">${escapeHtml(item.description || "")}</div></td>
              <td>${escapeHtml(item.unit || "unidad")}</td>
              <td class="text-right">${currency(item.cost)}</td>
              <td class="text-right">${currency(item.salePrice)}</td>
            </tr>
          `).join("")}
        </tbody>
      </table>
    </div>
  `).join("");

  return `
    <div class="product-list-sheet">
      <div class="ticket-sheet-head">
        <div>
          <img src="./img/company-logo-wide.png" alt="Mundo Led" class="budget-company-logo" />
          <div class="ticket-company-data">
            <strong>Lista de productos por categorías</strong>
            <span class="sheet-muted">Incluye costo, precio final y descripción</span>
          </div>
        </div>
        <div class="budget-sheet-side">
          <strong>Fecha</strong>
          <span>${escapeHtml(todayISO())}</span>
        </div>
      </div>
      ${sections || '<p>Sin productos cargados.</p>'}
    </div>
  `;
}

async function exportProductsPdf() {
  if (!state.products.length) throw new Error("No hay productos para exportar.");
  const node = mountSheet(buildProductListHtml());
  await captureElementToPdf(node, `lista-productos-${todayISO()}.pdf`);
}


function buildExpensesSheetHtml(items = getExpensesFiltered()) {
  const grouped = {};
  items.slice().sort((a, b) => String(a.date || "").localeCompare(String(b.date || ""))).forEach((item) => {
    const month = String(item.date || todayISO()).slice(0, 7) || todayISO().slice(0, 7);
    grouped[month] ||= [];
    grouped[month].push(item);
  });

  const sections = Object.entries(grouped).map(([month, monthItems]) => `
    <div>
      <h3>Mes ${escapeHtml(month)}</h3>
      <table class="sheet-table">
        <thead><tr><th>Fecha</th><th>Categoría</th><th>Detalle</th><th class="text-right">Monto</th></tr></thead>
        <tbody>
          ${monthItems.map((item) => `
            <tr>
              <td>${escapeHtml(item.date || "-")}</td>
              <td>${escapeHtml(item.category || "-")}</td>
              <td>${escapeHtml(item.details || "-")}</td>
              <td class="text-right">${currency(item.amount)}</td>
            </tr>
          `).join("")}
          <tr>
            <td colspan="3"><strong>Total ${escapeHtml(month)}</strong></td>
            <td class="text-right"><strong>${currency(monthItems.reduce((sum, item) => sum + Number(item.amount || 0), 0))}</strong></td>
          </tr>
        </tbody>
      </table>
    </div>
  `).join("");

  const total = items.reduce((sum, item) => sum + Number(item.amount || 0), 0);
  return `
    <div class="product-list-sheet">
      <div class="ticket-sheet-head">
        <div>
          <img src="./img/company-logo-wide.png" alt="Mundo Led" class="budget-company-logo" />
          <div class="ticket-company-data">
            <strong>Resumen de gastos</strong>
            <span class="sheet-muted">Detalle mes a mes</span>
          </div>
        </div>
        <div class="budget-sheet-side">
          <strong>Total</strong>
          <span>${currency(total)}</span>
        </div>
      </div>
      ${sections || "<p>Sin gastos en el período.</p>"}
    </div>
  `;
}

async function exportExpensesPdf() {
  const items = getExpensesFiltered();
  if (!items.length) throw new Error("No hay gastos para exportar.");
  const node = mountSheet(buildExpensesSheetHtml(items));
  await captureElementToPdf(node, `gastos-${todayISO()}.pdf`);
}

function attachRealtime() {
  clearRealtime();
  unsubscribers.push(
    onSnapshot(query(collection(db, "users"), orderBy("updatedAt", "desc")), (snap) => {
      state.users = snap.docs.map((item) => ({ id: item.id, ...item.data() }));
      renderEverything();
    })
  );
  unsubscribers.push(
    onSnapshot(query(collection(db, "sales"), orderBy("createdAt", "desc")), (snap) => {
      state.sales = snap.docs.map((item) => ({ id: item.id, ...item.data() }));
      renderEverything();
    })
  );
  unsubscribers.push(
    onSnapshot(query(collection(db, "expenses"), orderBy("createdAt", "desc")), (snap) => {
      state.expenses = snap.docs.map((item) => ({ id: item.id, ...item.data() }));
      renderEverything();
    })
  );
  unsubscribers.push(
    onSnapshot(query(collection(db, "categories"), orderBy("name", "asc")), (snap) => {
      state.categories = snap.docs.map((item) => ({ id: item.id, ...item.data() }));
      renderEverything();
    })
  );
  unsubscribers.push(
    onSnapshot(query(collection(db, "products"), orderBy("updatedAt", "desc")), (snap) => {
      state.products = snap.docs.map((item) => ({ id: item.id, ...item.data() }));
      renderEverything();
    })
  );
  unsubscribers.push(
    onSnapshot(query(collection(db, "customers"), orderBy("updatedAt", "desc")), (snap) => {
      state.customers = snap.docs.map((item) => ({ id: item.id, ...item.data() }));
      renderEverything();
    })
  );
  unsubscribers.push(
    onSnapshot(query(collection(db, "account_movements"), orderBy("createdAt", "desc")), (snap) => {
      state.accountMovements = snap.docs.map((item) => ({ id: item.id, ...item.data() }));
      renderEverything();
    })
  );
  unsubscribers.push(
    onSnapshot(query(collection(db, "cash_movements"), orderBy("createdAt", "desc")), (snap) => {
      state.cashMovements = snap.docs.map((item) => ({ id: item.id, ...item.data() }));
      renderEverything();
    })
  );
  unsubscribers.push(
    onSnapshot(query(collection(db, "budgets"), orderBy("createdAt", "desc")), (snap) => {
      state.budgets = snap.docs.map((item) => ({ id: item.id, ...item.data() }));
      if (!state.selectedBudgetId && state.budgets[0]) state.selectedBudgetId = state.budgets[0].id;
      renderEverything();
    })
  );
}

function setupNavigation() {
  document.querySelectorAll(".nav-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      const view = btn.dataset.view;
      document.querySelectorAll(".nav-btn").forEach((item) => item.classList.remove("active"));
      btn.classList.add("active");
      document.querySelectorAll(".view").forEach((viewNode) => viewNode.classList.remove("active"));
      document.getElementById(`${view}View`)?.classList.add("active");
      const titles = {
        inicio: ["Inicio", "Resumen general del negocio"],
        ventas: ["Ventas", "Carga y historial de ventas"],
        gastos: ["Gastos", "Registro de egresos del negocio"],
        caja: ["Caja", "Apertura, ingresos manuales y control actual"],
        stock: ["Stock", "Productos, categorías, unidades y lista PDF"],
        cuentas: ["Cuentas corrientes", "Buscador de cuentas, saldos y movimientos"],
        presupuestos: ["Presupuestos", "Lista, edición, estados y envío"],
        usuarios: ["Usuarios", "Acceso de administración y vendedores"],
        ajustes: ["Ajustes", "Tema día/noche y adaptación móvil"]
      };
      els.viewTitle.textContent = titles[view]?.[0] || "Panel";
      els.viewSubtitle.textContent = titles[view]?.[1] || "";
    });
  });
}

function setupInstallPrompt() {
  const isStandalone = window.matchMedia("(display-mode: standalone)").matches || window.navigator.standalone;
  const isIOS = /iphone|ipad|ipod/i.test(navigator.userAgent);

  const showManualSteps = () => {
    if (isIOS) {
      alert("En iPhone o iPad: abrí Compartir y elegí 'Agregar a pantalla de inicio'.");
      return;
    }
    alert("En Android o PC: abrí el menú del navegador y elegí 'Instalar aplicación' o 'Agregar a pantalla de inicio'. Si no aparece, recargá una vez la página.");
  };

  if (isStandalone) {
    els.installBtn?.classList.add("hidden");
    return;
  }

  els.installBtn?.classList.remove("hidden");
  els.installBtn.textContent = "Instalar app";

  window.addEventListener("beforeinstallprompt", (event) => {
    event.preventDefault();
    deferredPrompt = event;
    els.installBtn.textContent = "Instalar app";
  });

  window.addEventListener("appinstalled", () => {
    els.installBtn.textContent = "App instalada";
    els.installBtn.classList.add("hidden");
    deferredPrompt = null;
  });

  els.installBtn?.addEventListener("click", async () => {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      try { await deferredPrompt.userChoice; } catch (_) {}
      deferredPrompt = null;
      return;
    }
    showManualSteps();
  });
}

function bindFilters() {
  [
    els.salesSearchInput,
    els.salesFilterDate,
    els.salesFilterMonth,
    els.salesFilterYear,
    els.salesFilterFrom,
    els.salesFilterTo,
    els.expenseSearchInput,
    els.expenseFilterMonth,
    els.expenseFilterFrom,
    els.expenseFilterTo,
    els.customerSearchInput,
    els.productSearchInput,
    els.budgetSearchInput,
    els.budgetSearchFrom,
    els.budgetSearchTo
  ].forEach((input) => input?.addEventListener("input", renderEverything));
  [els.salesFilterFrom, els.salesFilterTo, els.expenseFilterFrom, els.expenseFilterTo, els.budgetSearchFrom, els.budgetSearchTo].forEach((input) => input?.addEventListener("change", renderEverything));
}

function setupUiEvents() {
  els.tabAdmin.addEventListener("click", () => setMode("administrador"));
  els.tabVendor.addEventListener("click", () => setMode("vendedor"));

  els.saleOperationType.addEventListener("change", syncSaleFormVisibility);
  els.paymentMethod.addEventListener("change", syncCheckFields);
  els.cancelSaleEditBtn.addEventListener("click", resetSaleForm);
  els.cancelExpenseEditBtn.addEventListener("click", resetExpenseForm);
  els.cancelProductBtn.addEventListener("click", resetProductForm);
  els.cancelProductEditBtn.addEventListener("click", resetProductForm);
  els.cancelBudgetEditBtn.addEventListener("click", resetBudgetForm);
  els.cancelUserEditBtn?.addEventListener("click", resetUserForm);
  els.goCreateProductBtn?.addEventListener("click", () => {
    resetProductForm();
    document.getElementById("productForm")?.scrollIntoView({ behavior: "smooth", block: "start" });
    document.querySelector('#productForm [name="code"]')?.focus();
  });
  els.goCreateBudgetBtn?.addEventListener("click", () => {
    resetBudgetForm();
    document.getElementById("budgetForm")?.scrollIntoView({ behavior: "smooth", block: "start" });
  });

  els.budgetPaymentTerms?.addEventListener("change", () => {
    els.budgetCustomTermsWrap.classList.toggle("hidden", els.budgetPaymentTerms.value !== "Personalizado");
  });

  els.budgetClientMode?.addEventListener("change", syncBudgetClientMode);
  els.budgetCustomerSearch?.addEventListener("change", resolveBudgetCustomerSearch);
  els.budgetCustomerSearch?.addEventListener("input", resolveBudgetCustomerSearch);

  els.addBudgetItemBtn?.addEventListener("click", () => createBudgetItemRow({ source: "manual", quantity: 1, unitPrice: 0 }));

  els.captureAccountBtn?.addEventListener("click", async () => {
    try { await downloadAccountImage(); } catch (error) { alert(error.message || "No se pudo generar la imagen."); }
  });
  els.accountPdfBtn?.addEventListener("click", async () => {
    try { await downloadAccountPdf(); } catch (error) { alert(error.message || "No se pudo generar el PDF."); }
  });
  els.deleteAccountBtn?.addEventListener("click", async () => {
    try {
      if (!confirm("¿Eliminar esta cuenta corriente y todos sus movimientos?")) return;
      await deleteSelectedAccount();
    } catch (error) {
      alert(error.message || "No se pudo eliminar la cuenta.");
    }
  });

  els.exportProductsPdfBtn?.addEventListener("click", async () => {
    try { await exportProductsPdf(); } catch (error) { alert(error.message || "No se pudo generar el PDF."); }
  });
  els.exportExpensesPdfBtn?.addEventListener("click", async () => {
    try { await exportExpensesPdf(); } catch (error) { alert(error.message || "No se pudo generar el PDF."); }
  });
  els.themeLightBtn?.addEventListener("click", () => applyTheme("light"));
  els.themeDarkBtn?.addEventListener("click", () => applyTheme("dark"));

  els.budgetDownloadPdfBtn?.addEventListener("click", async () => {
    try { await downloadBudgetPdf(); } catch (error) { alert(error.message || "No se pudo generar el PDF."); }
  });
  els.budgetDownloadPngBtn?.addEventListener("click", async () => {
    try { await downloadBudgetPng(); } catch (error) { alert(error.message || "No se pudo generar la imagen."); }
  });
  els.budgetShareBtn?.addEventListener("click", async () => {
    try { await shareBudget(); } catch (error) { alert(error.message || "No se pudo compartir."); }
  });
  els.budgetToggleSentBtn?.addEventListener("click", async () => {
    try { if (state.selectedBudgetId) await toggleBudgetFlag(state.selectedBudgetId, "sent"); } catch (error) { alert(error.message || "No se pudo actualizar el estado."); }
  });
  els.budgetToggleApprovedBtn?.addEventListener("click", async () => {
    try { if (state.selectedBudgetId) await toggleBudgetFlag(state.selectedBudgetId, "approved"); } catch (error) { alert(error.message || "No se pudo actualizar el estado."); }
  });

  els.logoutBtn.addEventListener("click", async () => {
    state.sessionUser = null;
    state.selectedCustomerId = "";
    state.selectedBudgetId = "";
    clearRealtime();
    await signOut(auth);
  });

  bindFilters();
  syncSaleFormVisibility();
  syncCheckFields();
  syncBudgetClientMode();
  enhanceMoneyInputs(document);
}

async function saveSaleForm(event) {
  event.preventDefault();
  clearMessage("saleMsg");
  const form = els.saleForm;
  const amount = parseMoneyValue(form.amount.value || 0);
  if (amount <= 0) throw new Error("El monto debe ser mayor a cero.");

  let payload = {
    date: form.date.value,
    amount,
    documentType: form.documentType.value,
    documentNumber: form.documentNumber.value,
    operationType: form.operationType.value,
    paymentMethod: form.operationType.value === "contado" ? form.paymentMethod.value || "efectivo" : "",
    details: form.operationType.value === "contado" ? (form.details.value || "") : "",
    checkBank: form.paymentMethod.value === "cheque" ? (form.checkBank.value || "") : "",
    checkNumber: form.paymentMethod.value === "cheque" ? (form.checkNumber.value || "") : "",
    checkHolder: form.paymentMethod.value === "cheque" ? (form.checkHolder.value || "") : "",
    checkDueDate: form.paymentMethod.value === "cheque" ? (form.checkDueDate.value || "") : "",
    customerFirstName: form.customerFirstName.value || "",
    customerLastName: form.customerLastName.value || "",
    customerPhone: form.customerPhone.value || "",
    customerEmail: form.customerEmail.value || "",
    customerAddress: form.customerAddress.value || "",
    createdByName: state.sessionUser.name,
    createdByUsername: state.sessionUser.username,
    updatedAt: serverTimestamp()
  };

  if (payload.operationType === "cuenta_corriente" && (!payload.customerFirstName || !payload.customerLastName)) {
    throw new Error("En cuenta corriente completá nombre y apellido.");
  }

  const originalSale = state.editingSaleId ? state.sales.find((item) => item.id === state.editingSaleId) : null;
  const saleId = state.editingSaleId || doc(collection(db, "sales")).id;
  payload = await syncSaleAccountMovement(saleId, payload, originalSale);

  payload.createdAt = originalSale?.createdAt || serverTimestamp();

  await setDoc(doc(db, "sales", saleId), payload, { merge: true });
  renderEverything();
  const wasEditing = !!state.editingSaleId;
  resetSaleForm();
  showMessage("saleMsg", wasEditing ? "Venta actualizada correctamente." : "Venta guardada correctamente.");
}

async function saveExpenseForm(event) {
  event.preventDefault();
  clearMessage("expenseMsg");
  const form = els.expenseForm;
  const amount = parseMoneyValue(form.amount.value || 0);
  if (amount <= 0) throw new Error("El monto debe ser mayor a cero.");

  const payload = {
    date: form.date.value,
    amount,
    category: form.category.value,
    details: form.details.value || "",
    createdByName: state.sessionUser.name,
    createdByUsername: state.sessionUser.username,
    updatedAt: serverTimestamp()
  };
  if (!state.editingExpenseId) payload.createdAt = serverTimestamp();
  const id = state.editingExpenseId || doc(collection(db, "expenses")).id;
  await setDoc(doc(db, "expenses", id), payload, { merge: true });
  const wasEditing = !!state.editingExpenseId;
  resetExpenseForm();
  showMessage("expenseMsg", wasEditing ? "Gasto actualizado correctamente." : "Gasto guardado correctamente.");
}

async function saveProductForm(event) {
  event.preventDefault();
  clearMessage("productMsg");
  const form = els.productForm;
  const id = state.editingProductId || sanitizeId(form.code.value);
  if (!id) throw new Error("Completá el código del producto.");

  await setDoc(doc(db, "products", id), {
    code: form.code.value,
    name: form.name.value,
    description: form.description.value || "",
    category: form.category.value || "General",
    unit: form.unit.value || "unidad",
    currentStock: Number(form.currentStock.value || 0),
    minStock: Number(form.minStock.value || 0),
    cost: parseMoneyValue(form.cost.value || 0),
    salePrice: parseMoneyValue(form.salePrice.value || 0),
    updatedAt: serverTimestamp()
  }, { merge: true });

  const wasEditing = !!state.editingProductId;
  resetProductForm();
  showMessage("productMsg", wasEditing ? "Producto actualizado correctamente." : "Producto guardado correctamente.");
}

async function saveCategoryForm(event) {
  event.preventDefault();
  clearMessage("categoryMsg");
  if (!isAdmin()) throw new Error("Solo administración puede agregar categorías.");
  const form = event.currentTarget;
  const data = new FormData(form);
  const name = String(data.get("name") || "").trim();
  if (!name) throw new Error("Completá el nombre de la categoría.");
  const id = sanitizeId(name);
  await setDoc(doc(db, "categories", id), {
    name,
    updatedAt: serverTimestamp()
  }, { merge: true });
  form.reset();
  showMessage("categoryMsg", "Categoría agregada correctamente.");
}

async function saveBudgetForm(event) {
  event.preventDefault();
  clearMessage("budgetMsg");
  const form = els.budgetForm;

  const items = budgetItemsDraftFromDom().map((item) => ({
    ...item,
    quantity: Number(item.quantity || 0),
    unitPrice: parseMoneyValue(item.unitPrice || 0),
    total: Number(item.total || 0)
  })).filter((item) => item.description && item.quantity > 0);
  if (!items.length) throw new Error("Agregá al menos un ítem al presupuesto.");

  const total = items.reduce((sum, item) => sum + item.total, 0);
  let customerId = "";
  let clientName = form.clientName.value;
  let clientPhone = form.clientPhone.value || "";
  let clientEmail = form.clientEmail.value || "";
  let clientAddress = form.clientAddress.value || "";

  if (els.budgetClientMode.value === "existing") {
    customerId = els.budgetCustomerId.value || resolveBudgetCustomerSearch()?.id || "";
    const customer = state.customers.find((item) => item.id === customerId);
    if (!customer) throw new Error("Seleccioná un cliente existente.");
    clientName = getCustomerFullName(customer);
    clientPhone = customer.phone || "";
    clientEmail = customer.email || "";
    clientAddress = customer.address || "";
  } else if (!clientName.trim()) {
    throw new Error("Completá el nombre del cliente.");
  }

  const payload = {
    number: state.editingBudgetId ? (state.budgets.find((b) => b.id === state.editingBudgetId)?.number || `P-${new Date().getFullYear()}-${String(Date.now()).slice(-6)}`) : `P-${new Date().getFullYear()}-${String(Date.now()).slice(-6)}`,
    date: form.date.value,
    validUntil: form.validUntil.value || "",
    customerId,
    clientName,
    clientPhone,
    clientEmail,
    clientAddress,
    paymentTerms: form.paymentTerms.value,
    paymentTermsCustom: form.paymentTermsCustom.value || "",
    notes: form.notes.value || "",
    items,
    total,
    sent: state.editingBudgetId ? !!(state.budgets.find((b) => b.id === state.editingBudgetId)?.sent) : false,
    approved: state.editingBudgetId ? !!(state.budgets.find((b) => b.id === state.editingBudgetId)?.approved) : false,
    createdByName: state.sessionUser.name,
    createdByUsername: state.sessionUser.username,
    updatedAt: serverTimestamp()
  };
  if (!state.editingBudgetId) payload.createdAt = serverTimestamp();

  const id = state.editingBudgetId || doc(collection(db, "budgets")).id;
  await setDoc(doc(db, "budgets", id), payload, { merge: true });
  state.selectedBudgetId = id;
  const wasEditing = !!state.editingBudgetId;
  resetBudgetForm();
  showMessage("budgetMsg", wasEditing ? "Presupuesto actualizado correctamente." : "Presupuesto guardado correctamente.");
}

async function savePaymentForm(event) {
  event.preventDefault();
  clearMessage("paymentMsg");
  const form = event.currentTarget;
  const amount = parseMoneyValue(form.amount.value || 0);
  if (!form.customerId.value) throw new Error("Seleccioná un cliente.");
  if (amount <= 0) throw new Error("El monto debe ser mayor a cero.");

  const balance = accountBalance(form.customerId.value);
  const finalAmount = form.paymentKind.value === "total" ? balance : amount;
  if (finalAmount <= 0) throw new Error("No hay saldo pendiente.");
  if (finalAmount > balance) throw new Error("El cobro supera el saldo actual.");

  await addDoc(collection(db, "account_movements"), {
    customerId: form.customerId.value,
    type: "cobro",
    amount: finalAmount,
    date: form.date.value,
    details: form.details.value || "Cobro de cuenta corriente",
    paymentMethod: form.paymentMethod.value || "efectivo",
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp()
  });
  form.reset();
  form.date.value = todayISO();
  form.customerId.value = state.selectedCustomerId || "";
  enhanceMoneyInputs(form);
  showMessage("paymentMsg", "Cobro registrado correctamente.");
}

async function saveCashOpenForm(event) {
  event.preventDefault();
  clearMessage("cashMsg");
  if (!isAdmin()) throw new Error("Solo administración puede abrir caja.");
  const form = event.currentTarget;
  const cashAmount = parseMoneyValue(form.cashAmount.value || 0);
  const checkAmount = parseMoneyValue(form.checkAmount.value || 0);
  const otherAmount = parseMoneyValue(form.otherAmount.value || 0);
  if ((cashAmount + checkAmount + otherAmount) <= 0) throw new Error("Cargá algún importe para la apertura.");
  await addDoc(collection(db, "cash_movements"), {
    kind: "apertura",
    date: form.date.value,
    cashAmount,
    checkAmount,
    otherAmount,
    details: form.details.value || "",
    authorName: state.sessionUser.name,
    authorUsername: state.sessionUser.username,
    createdAt: serverTimestamp()
  });
  form.reset();
  form.date.value = todayISO();
  enhanceMoneyInputs(form);
  showMessage("cashMsg", "Apertura guardada correctamente.");
}

async function saveCashEntryForm(event) {
  event.preventDefault();
  clearMessage("cashMsg");
  if (!isAdmin()) throw new Error("Solo administración puede agregar ingresos de caja.");
  const form = event.currentTarget;
  const amount = parseMoneyValue(form.amount.value || 0);
  if (amount <= 0) throw new Error("El monto debe ser mayor a cero.");
  await addDoc(collection(db, "cash_movements"), {
    kind: "ingreso_manual",
    date: form.date.value,
    amount,
    medium: form.medium.value || "efectivo",
    details: form.details.value || "",
    authorName: state.sessionUser.name,
    authorUsername: state.sessionUser.username,
    createdAt: serverTimestamp()
  });
  form.reset();
  form.date.value = todayISO();
  enhanceMoneyInputs(form);
  showMessage("cashMsg", "Ingreso manual guardado correctamente.");
}

async function saveUserForm(event) {
  event.preventDefault();
  clearMessage("userMsg");
  if (!isAdmin()) throw new Error("Solo administración puede cargar usuarios.");
  const form = event.currentTarget;
  const username = form.username.value.trim().toLowerCase();
  if (!username) throw new Error("Completá el usuario.");

  const editingUser = state.editingUserId ? state.users.find((user) => user.id === state.editingUserId) : null;
  const userId = state.editingUserId || sanitizeId(username);
  const payload = {
    name: form.name.value,
    username,
    role: form.role.value,
    updatedAt: serverTimestamp(),
    createdAt: editingUser?.createdAt || serverTimestamp()
  };
  if (form.password.value) {
    payload.passwordHash = await sha256(form.password.value);
  } else if (!editingUser) {
    throw new Error("Completá la contraseña.");
  }

  await setDoc(doc(db, "users", userId), payload, { merge: true });
  const wasEditing = !!state.editingUserId;
  resetUserForm();
  showMessage("userMsg", wasEditing ? "Usuario actualizado correctamente." : "Usuario guardado correctamente.");
}

function resetUserForm() {
  state.editingUserId = "";
  const form = document.getElementById("userForm");
  if (!form) return;
  form.reset();
  els.userFormTitle.textContent = "Usuarios";
  els.userSubmitBtn.textContent = "Guardar usuario";
  els.cancelUserEditBtn?.classList.add("hidden");
  form.username.readOnly = false;
  clearMessage("userMsg");
}

function loadUserIntoForm(id) {
  const user = state.users.find((item) => item.id === id);
  if (!user) return;
  state.editingUserId = id;
  const form = document.getElementById("userForm");
  form.name.value = user.name || "";
  form.username.value = user.username || "";
  form.password.value = "";
  form.role.value = user.role || "vendedor";
  form.username.readOnly = true;
  els.userFormTitle.textContent = "Editar usuario";
  els.userSubmitBtn.textContent = "Guardar cambios";
  els.cancelUserEditBtn?.classList.remove("hidden");
  document.querySelector('[data-view="usuarios"]')?.click();
  form.scrollIntoView({ behavior: "smooth", block: "start" });
}

function setupForms() {
  els.saleForm.addEventListener("submit", async (event) => {
    try { await saveSaleForm(event); } catch (error) { console.error(error); showMessage("saleMsg", error.message || "No se pudo guardar.", true); }
  });
  els.expenseForm.addEventListener("submit", async (event) => {
    try { await saveExpenseForm(event); } catch (error) { console.error(error); showMessage("expenseMsg", error.message || "No se pudo guardar.", true); }
  });
  els.productForm.addEventListener("submit", async (event) => {
    try { await saveProductForm(event); } catch (error) { console.error(error); showMessage("productMsg", error.message || "No se pudo guardar.", true); }
  });
  document.getElementById("categoryForm")?.addEventListener("submit", async (event) => {
    try { await saveCategoryForm(event); } catch (error) { console.error(error); showMessage("categoryMsg", error.message || "No se pudo guardar.", true); }
  });
  els.budgetForm.addEventListener("submit", async (event) => {
    try { await saveBudgetForm(event); } catch (error) { console.error(error); showMessage("budgetMsg", error.message || "No se pudo guardar.", true); }
  });
  document.getElementById("paymentForm")?.addEventListener("submit", async (event) => {
    try { await savePaymentForm(event); } catch (error) { console.error(error); showMessage("paymentMsg", error.message || "No se pudo guardar.", true); }
  });
  document.getElementById("cashOpenForm")?.addEventListener("submit", async (event) => {
    try { await saveCashOpenForm(event); } catch (error) { console.error(error); showMessage("cashMsg", error.message || "No se pudo guardar.", true); }
  });
  document.getElementById("cashEntryForm")?.addEventListener("submit", async (event) => {
    try { await saveCashEntryForm(event); } catch (error) { console.error(error); showMessage("cashMsg", error.message || "No se pudo guardar.", true); }
  });
  document.getElementById("userForm")?.addEventListener("submit", async (event) => {
    try { await saveUserForm(event); } catch (error) { console.error(error); showMessage("userMsg", error.message || "No se pudo guardar.", true); }
  });
}

function initLoginFlow() {
  els.loginForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    els.loginError.textContent = "";
    try {
      const user = await handleLogin(els.usernameInput.value, els.passwordInput.value);
      state.sessionUser = user;
      applyRoleUI();
      showApp();
      attachRealtime();
    } catch (error) {
      els.loginError.textContent = error.message || "No se pudo iniciar sesión.";
    }
  });

  onAuthStateChanged(auth, (user) => {
    state.authUser = user;
    if (!user) showLogin();
  });
}

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
