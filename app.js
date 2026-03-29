import { auth, db } from "./firebase-config.js";
import { signInAnonymously, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/12.11.0/firebase-auth.js";
import { addDoc, collection, deleteDoc, doc, getDocs, limit, onSnapshot, orderBy, query, serverTimestamp, setDoc, where, writeBatch, updateDoc } from "https://www.gstatic.com/firebasejs/12.11.0/firebase-firestore.js";

// --- ESTADO & ELEMENTOS ---
const state = {
  authUser: null, sessionUser: null, loginMode: "administrador",
  users: [], sales: [], expenses: [], products: [], categories: [],
  customers: [], accountMovements: [], budgets: [], cashMovements: [],
  selectedCustomerId: "", selectedBudgetId: "", editingSaleId: "",
  editingExpenseId: "", editingProductId: "", editingBudgetId: "",
  editingCashId: "", editingPaymentId: "", editingUserId: ""
};

const els = {
  loginScreen: document.getElementById("loginScreen"), appScreen: document.getElementById("appScreen"),
  loginForm: document.getElementById("loginForm"), loginError: document.getElementById("loginError"),
  usernameInput: document.getElementById("usernameInput"), passwordInput: document.getElementById("passwordInput"),
  tabAdmin: document.getElementById("tabAdmin"), tabVendor: document.getElementById("tabVendor"),
  loginTitle: document.getElementById("loginTitle"), loginSubtitle: document.getElementById("loginSubtitle"),
  logoutBtn: document.getElementById("logoutBtn"), sessionUserText: document.getElementById("sessionUserText"),
  userRoleText: document.getElementById("userRoleText"), todayText: document.getElementById("todayText"),
  viewTitle: document.getElementById("viewTitle"), viewSubtitle: document.getElementById("viewSubtitle"),
  installBtn: document.getElementById("installBtn"), renderHost: document.getElementById("renderHost"),
  saleForm: document.getElementById("saleForm"), saleOperationType: document.getElementById("saleOperationType"),
  saleCashFields: document.getElementById("saleCashFields"), saleAccountFields: document.getElementById("saleAccountFields"),
  paymentMethod: document.getElementById("paymentMethod"), checkFields: document.getElementById("checkFields"),
  saleSubmitBtn: document.getElementById("saleSubmitBtn"), cancelSaleEditBtn: document.getElementById("cancelSaleEditBtn"),
  saleFormTitle: document.getElementById("saleFormTitle"), salesSearchInput: document.getElementById("salesSearchInput"),
  salesFilterDate: document.getElementById("salesFilterDate"), salesFilterMonth: document.getElementById("salesFilterMonth"),
  salesFilterYear: document.getElementById("salesFilterYear"), salesFilterFrom: document.getElementById("salesFilterFrom"),
  salesFilterTo: document.getElementById("salesFilterTo"), salesTableWrap: document.getElementById("salesTableWrap"),
  expenseSearchInput: document.getElementById("expenseSearchInput"), expenseFilterMonth: document.getElementById("expenseFilterMonth"),
  expenseFilterFrom: document.getElementById("expenseFilterFrom"), expenseFilterTo: document.getElementById("expenseFilterTo"),
  exportExpensesPdfBtn: document.getElementById("exportExpensesPdfBtn"), expenseForm: document.getElementById("expenseForm"),
  expenseCategory: document.getElementById("expenseCategory"), expenseFormTitle: document.getElementById("expenseFormTitle"),
  expenseSubmitBtn: document.getElementById("expenseSubmitBtn"), cancelExpenseEditBtn: document.getElementById("cancelExpenseEditBtn"),
  expensesTableWrap: document.getElementById("expensesTableWrap"), customerSearchInput: document.getElementById("customerSearchInput"),
  paymentCustomerId: document.getElementById("paymentCustomerId"), captureAccountBtn: document.getElementById("captureAccountBtn"),
  accountPdfBtn: document.getElementById("accountPdfBtn"), deleteAccountBtn: document.getElementById("deleteAccountBtn"),
  accountActionBar: document.getElementById("accountActionBar"), productForm: document.getElementById("productForm"),
  productFormTitle: document.getElementById("productFormTitle"), productCategorySelect: document.getElementById("productCategorySelect"),
  productSearchInput: document.getElementById("productSearchInput"), goCreateProductBtn: document.getElementById("goCreateProductBtn"),
  cancelProductBtn: document.getElementById("cancelProductBtn"), cancelProductEditBtn: document.getElementById("cancelProductEditBtn"),
  exportProductsPdfBtn: document.getElementById("exportProductsPdfBtn"), productsTableWrap: document.getElementById("productsTableWrap"),
  budgetForm: document.getElementById("budgetForm"), budgetFormTitle: document.getElementById("budgetFormTitle"),
  budgetSubmitBtn: document.getElementById("budgetSubmitBtn"), cancelBudgetEditBtn: document.getElementById("cancelBudgetEditBtn"),
  budgetItemsWrap: document.getElementById("budgetItemsWrap"), budgetSubtotal: document.getElementById("budgetSubtotal"),
  budgetTotal: document.getElementById("budgetTotal"), budgetPaymentTerms: document.getElementById("budgetPaymentTerms"),
  budgetCustomTermsWrap: document.getElementById("budgetCustomTermsWrap"), budgetsList: document.getElementById("budgetsList"),
  budgetSearchInput: document.getElementById("budgetSearchInput"), budgetSearchFrom: document.getElementById("budgetSearchFrom"),
  budgetSearchTo: document.getElementById("budgetSearchTo"), budgetPreviewCard: document.getElementById("budgetPreviewCard"),
  budgetDownloadPdfBtn: document.getElementById("budgetDownloadPdfBtn"), budgetDownloadPngBtn: document.getElementById("budgetDownloadPngBtn"),
  budgetShareBtn: document.getElementById("budgetShareBtn"), budgetToggleSentBtn: document.getElementById("budgetToggleSentBtn"),
  budgetToggleApprovedBtn: document.getElementById("budgetToggleApprovedBtn"), addBudgetItemBtn: document.getElementById("addBudgetItemBtn"),
  goCreateBudgetBtn: document.getElementById("goCreateBudgetBtn"), budgetClientMode: document.getElementById("budgetClientMode"),
  budgetCustomerSearch: document.getElementById("budgetCustomerSearch"), budgetCustomerId: document.getElementById("budgetCustomerId"),
  budgetCustomerOptions: document.getElementById("budgetCustomerOptions"), budgetCustomerSelectWrap: document.getElementById("budgetCustomerSelectWrap"),
  budgetCustomerSelectedCard: document.getElementById("budgetCustomerSelectedCard"), budgetPreviewActions: document.getElementById("budgetPreviewActions"),
  budgetPreviewModal: document.getElementById("budgetPreviewModal"), budgetPreviewCloseBtn: document.getElementById("budgetPreviewCloseBtn"),
  budgetModalEditBtn: document.getElementById("budgetModalEditBtn"), budgetModalTitle: document.getElementById("budgetModalTitle"),
  userFormTitle: document.getElementById("userFormTitle"), userSubmitBtn: document.getElementById("userSubmitBtn"),
  cancelUserEditBtn: document.getElementById("cancelUserEditBtn"), themeLightBtn: document.getElementById("themeLightBtn"),
  themeDarkBtn: document.getElementById("themeDarkBtn"), cashStatusCards: document.getElementById("cashStatusCards")
};

let unsubscribers = [];
let deferredPrompt = null;

// --- UTILIDADES ---
const currency = (value) => new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS", minimumFractionDigits: Number(value || 0) % 1 ? 2 : 0, maximumFractionDigits: 2 }).format(Number(value || 0));
const todayISO = () => { const now = new Date(); const tzOffset = now.getTimezoneOffset() * 60000; return new Date(now - tzOffset).toISOString().slice(0, 10); };
const todayLongText = () => new Date().toLocaleDateString("es-AR", { weekday: "long", day: "2-digit", month: "long", year: "numeric" });
const sanitizeId = (value) => String(value || "").trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "").replace(/^+|_+$/g, "");
const escapeHtml = (value) => String(value ?? " ").replace(/&/g, " & ").replace(/</g, " < ").replace(/>/g, " > ").replace(/"/g, " " ").replace(/'/g, "'");
const roleLabel = (role) => role === "administrador" ? "Administrador" : "Vendedor";
const isAdmin = () => state.sessionUser?.role === "administrador";

// 🚀 MEJORA: Sistema de Toasts
function showToast(message, type = 'success', duration = 3000) {
  const container = document.getElementById('toastContainer');
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.innerHTML = `<span>${type === 'success' ? '✓' : type === 'error' ? '✕' : '⚠'}</span><span>${message}</span>`;
  container.appendChild(toast);
  setTimeout(() => {
    toast.style.animation = 'slideIn 0.3s ease reverse';
    setTimeout(() => toast.remove(), 300);
  }, duration);
}

// 🚀 MEJORA: Loading States
function setLoading(button, isLoading, text = 'Guardando...') {
  if (!button) return;
  if (isLoading) {
    button.disabled = true;
    button.dataset.originalText = button.textContent;
    button.innerHTML = `<span class="spinner"></span> ${text}`;
  } else {
    button.disabled = false;
    button.textContent = button.dataset.originalText || 'Guardar';
  }
}

// 🚀 MEJORA: Debounce para rendimiento
function debounce(func, wait) {
  let timeout;
  return function executedFunction(...args) {
    const later = () => { clearTimeout(timeout); func(...args); };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
}

function parseMoneyValue(input) {
  const raw = String(input ?? " ").trim();
  if (!raw) return 0;
  let normalized = raw.replace(/\s+/g, " ");
  if (normalized.includes(",") && normalized.includes(".")) {
    if (normalized.lastIndexOf(",") > normalized.lastIndexOf(".")) {
      normalized = normalized.replace(/\./g, "").replace(",", ".");
    } else { normalized = normalized.replace(/,/g, ""); }
  } else if (normalized.includes(",")) {
    normalized = normalized.replace(/\./g, "").replace(",", ".");
  }
  normalized = normalized.replace(/[^0-9.-]/g, "");
  const value = Number(normalized);
  return Number.isFinite(value) ? value : 0;
}

function formatMoneyInputValue(value) {
  const number = Number(value || 0);
  return new Intl.NumberFormat("es-AR", { minimumFractionDigits: 0, maximumFractionDigits: 2 }).format(number);
}

function setMoneyFieldValue(input, value) {
  if (!input) return;
  input.value = formatMoneyInputValue(value || 0);
  updateMoneyText(input);
}

// Funciones de números a palabras (simplificadas para brevedad, mantener lógica original)
function numberToWordsEs(num) { /* ... (Mantener lógica original de app.js) ... */ return "pesos"; } 
function moneyToWords(value) { return moneyToWords(value); } // Placeholder para no extender demasiado, usar original
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
      if (input.value !== " ") input.value = formatMoneyInputValue(value);
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

function showApp() { els.loginScreen.classList.add("hidden"); els.appScreen.classList.remove("hidden"); }
function showLogin() { els.loginScreen.classList.remove("hidden"); els.appScreen.classList.add("hidden"); }
function setMode(mode) {
  state.loginMode = mode;
  els.tabAdmin.classList.toggle("active", mode === "administrador");
  els.tabVendor.classList.toggle("active", mode === "vendedor");
  els.loginTitle.textContent = mode === "administrador" ? "Ingreso administración" : "Ingreso vendedor";
  els.loginSubtitle.textContent = mode === "administrador" ? "Usá usuario y contraseña." : "El vendedor entra con usuario creado.";
}
function setDefaultDates() {
  ["saleForm", "expenseForm", "paymentForm", "budgetForm", "cashOpenForm", "cashEntryForm"].forEach((id) => {
    const form = document.getElementById(id);
    if (form?.date) form.date.value = todayISO();
  });
}
function clearRealtime() { unsubscribers.forEach((fn) => { try { fn(); } catch (_) {} }); unsubscribers = []; }
function getCustomerFullName(customer) { return [customer.firstName, customer.lastName].filter(Boolean).join(" ").trim() || "Cliente sin nombre"; }
function getCustomerCode(customer) { if (!customer) return ""; return String(customer.code || customer.id || "").padStart(4, "0"); }
function nextSequentialCustomerCode() {
  const numbers = state.customers.map((customer) => Number(String(customer.code || customer.id || "").replace(/\D/g, ""))).filter((value) => Number.isFinite(value) && value > 0);
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
  return state.accountMovements.filter((m) => m.customerId === customerId).sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));
}
function accountBalance(customerId) {
  return accountMovementsForCustomer(customerId).reduce((sum, item) => {
    const amount = Number(item.amount || 0);
    return item.type === "cobro" ? sum - amount : sum + amount;
  }, 0);
}
function normalizeMedium(value) {
  const raw = String(value || " ").toLowerCase().trim();
  if (raw === "cheque" || raw === "check") return "cheque";
  if (raw === "efectivo" || raw === "cash") return "efectivo";
  return "otro";
}
function startOfMonthISO(date = todayISO()) { return `${String(date).slice(0, 7)}-01`; }
function addToBreakdown(target, medium, amount) {
  const key = normalizeMedium(medium);
  target[key] = Number(target[key] || 0) + Number(amount || 0);
}
function sumBreakdown(target) { return Number(target.efectivo || 0) + Number(target.cheque || 0) + Number(target.otro || 0); }
function formatBreakdownText(breakdown) { return `Efectivo ${currency(breakdown.efectivo || 0)} · Cheques ${currency(breakdown.cheque || 0)} · Otros ${currency(breakdown.otro || 0)}`; }
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
  state.sales.forEach((sale) => { if (sale.operationType === "contado") addToBreakdown(breakdown, sale.paymentMethod, sale.amount || 0); });
  state.accountMovements.forEach((movement) => { if (movement.type === "cobro") addToBreakdown(breakdown, movement.paymentMethod, movement.amount || 0); });
  state.expenses.forEach((expense) => { breakdown.efectivo -= Number(expense.amount || 0); });
  return breakdown;
}
function buildSalesBreakdown(items) {
  return items.reduce((acc, sale) => { addToBreakdown(acc, sale.paymentMethod, sale.amount || 0); return acc; }, { efectivo: 0, cheque: 0, otro: 0 });
}
function renderMiniStats(targetId, cards = []) {
  const node = document.getElementById(targetId);
  if (!node) return;
  if (!cards.length) { node.innerHTML = '<p class="muted">Sin datos suficientes.</p>'; return; }
  node.innerHTML = cards.map((card) => `<div class="mini-stat"><span>${card.label}</span><strong>${card.value}</strong></div>`).join("");
}
function renderBarChart(targetId, rows = [], monthMode = false) {
  const node = document.getElementById(targetId);
  if (!node) return;
  if (!rows.length) { node.innerHTML = '<p class="muted">Sin ventas para graficar.</p>'; return; }
  const max = Math.max(...rows.map((row) => Number(row.amount || 0)), 1);
  node.innerHTML = rows.map((row) => {
    const width = Math.max(6, (Number(row.amount || 0) / max) * 100);
    return `<div class="chart-row ${monthMode ? "month" : ""}"><div class="chart-label">${row.label}</div><div class="chart-track"><div class="chart-fill" style="width:${width}%"></div></div><div class="chart-value">${currency(row.amount || 0)}</div></div>`;
  }).join("");
}
function fillCategoriesSelect() {
  const select = els.productCategorySelect;
  if (!select) return;
  const categories = state.categories.length ? state.categories.slice().sort((a, b) => (a.name || " ").localeCompare(b.name || " ")) : [{ name: "General" }];
  select.innerHTML = categories.map((cat) => `<option value="${escapeHtml(cat.name)}">${escapeHtml(cat.name)}</option>`).join("");
}
function fillCustomerSelects() {
  const customers = state.customers.slice().sort((a, b) => getCustomerFullName(a).localeCompare(getCustomerFullName(b)));
  const options = customers.map((customer) => `<option value="${escapeHtml(`${getCustomerCode(customer)} · ${getCustomerFullName(customer)} · ${customer.phone || " "}`)}" data-id="${customer.id}"></option>`).join("");
  if (els.budgetCustomerOptions) els.budgetCustomerOptions.innerHTML = options;
  renderBudgetSelectedCustomer();
}
function renderBudgetSelectedCustomer(customer = null) {
  if (!els.budgetCustomerSelectedCard) return;
  if (!customer) {
    const id = els.budgetCustomerId?.value || " ";
    customer = state.customers.find((item) => item.id === id) || null;
  }
  if (!customer || els.budgetClientMode?.value !== "existing") {
    els.budgetCustomerSelectedCard.classList.add("hidden");
    els.budgetCustomerSelectedCard.innerHTML = " ";
    return;
  }
  els.budgetCustomerSelectedCard.classList.remove("hidden");
  els.budgetCustomerSelectedCard.innerHTML = `<div class="selected-customer-card-head"><strong>#${escapeHtml(getCustomerCode(customer))} · ${escapeHtml(getCustomerFullName(customer))}</strong><span class="status-pill success">Cliente cargado</span></div><div class="selected-customer-card-body"><span>${escapeHtml(customer.phone || "Sin celular")}</span><span>${escapeHtml(customer.email || "Sin email")}</span><span>${escapeHtml(customer.address || "Sin dirección")}</span></div>`;
}
function resolveBudgetCustomerSearch() {
  const raw = String(els.budgetCustomerSearch?.value || " ").trim().toLowerCase();
  const customer = state.customers.find((item) => {
    const label = `${getCustomerCode(item)} · ${getCustomerFullName(item)} · ${item.phone || ""}`.toLowerCase();
    return label === raw;
  }) || state.customers.find((item) => {
    const label = `${getCustomerCode(item)} ${getCustomerFullName(item)} ${item.phone || ""} ${item.email || ""}`.toLowerCase();
    return raw && label.includes(raw);
  });
  if (!customer) {
    if (els.budgetCustomerId) els.budgetCustomerId.value = " ";
    renderBudgetSelectedCustomer(null);
    return null;
  }
  if (els.budgetCustomerId) els.budgetCustomerId.value = customer.id;
  if (els.budgetCustomerSearch) els.budgetCustomerSearch.value = `${getCustomerCode(customer)} · ${getCustomerFullName(customer)} · ${customer.phone || ""}`;
  const form = els.budgetForm;
  form.clientName.value = getCustomerFullName(customer);
  form.clientPhone.value = customer.phone || " ";
  form.clientEmail.value = customer.email || " ";
  form.clientAddress.value = customer.address || " ";
  renderBudgetSelectedCustomer(customer);
  return customer;
}
function syncBudgetClientMode() {
  const existing = els.budgetClientMode?.value === "existing";
  els.budgetCustomerSelectWrap?.classList.toggle("hidden", !existing);
  if (els.budgetCustomerSearch) { els.budgetCustomerSearch.disabled = !existing; els.budgetCustomerSearch.required = existing; }
  const fieldIds = ["budgetClientNameWrap", "budgetClientPhoneWrap", "budgetClientEmailWrap", "budgetClientAddressWrap"];
  fieldIds.forEach((id) => {
    const wrap = document.getElementById(id);
    if (!wrap) return;
    wrap.classList.toggle("hidden", existing);
    wrap.querySelectorAll("input, select, textarea").forEach((input) => {
      input.disabled = existing;
      if (input.name === "clientName") input.required = !existing;
    });
  });
  if (!existing && els.budgetCustomerId) els.budgetCustomerId.value = " ";
  if (!existing && els.budgetCustomerSearch) els.budgetCustomerSearch.value = " ";
  renderBudgetSelectedCustomer();
}
function applyRoleUI() {
  els.userRoleText.textContent = `Rol: ${roleLabel(state.sessionUser.role)}`;
  els.sessionUserText.textContent = state.sessionUser.name || state.sessionUser.username;
  document.querySelectorAll(".admin-only-nav").forEach((el) => el.classList.toggle("hidden", !isAdmin()));
  document.querySelectorAll(".admin-only-block").forEach((el) => el.classList.toggle("hidden", !isAdmin()));
  const hideByRole = { vendedor: ["inicio", "presupuestos", "usuarios"] };
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

// 🚀 MEJORA: Renderizado Optimizado con RequestAnimationFrame
const renderDebounced = debounce(() => {
  requestAnimationFrame(() => {
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
  });
}, 300);

function renderDashboard() {
  const today = todayISO();
  const monthStart = startOfMonthISO(today);
  const salesTodayItems = state.sales.filter((sale) => sale.date === today);
  const monthSalesItems = state.sales.filter((sale) => (sale.date || " ") >= monthStart && (sale.date || " ") <= today);
  const allSalesTotal = monthSalesItems.reduce((sum, sale) => sum + Number(sale.amount || 0), 0);
  const salesDay = salesTodayItems.reduce((sum, sale) => sum + Number(sale.amount || 0), 0);
  const expensesDay = state.expenses.filter((exp) => exp.date === today).reduce((sum, exp) => sum + Number(exp.amount || 0), 0);
  const cajaBreakdown = currentCajaBreakdown();
  const cash = sumBreakdown(cajaBreakdown);
  const salesDayBreakdown = buildSalesBreakdown(salesTodayItems);
  const overdueCustomers = state.customers.map((customer) => {
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
  }).filter((customer) => customer.overdue);
  
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
  
  const lowStock = state.products.slice().sort((a, b) => (Number(a.currentStock || 0) - Number(a.minStock || 0)) - (Number(b.currentStock || 0) - Number(b.minStock || 0))).filter((item) => Number(item.currentStock || 0) <= Number(item.minStock || 0));
  document.getElementById("stockRankingList").innerHTML = lowStock.length ? lowStock.slice(0, 8).map((item) => `<div class="simple-item"><strong>${escapeHtml(item.name || "-")}</strong><span>${escapeHtml(item.category || "General")} · ${escapeHtml(item.unit || "unidad")}</span><div class="muted">Actual: ${item.currentStock} · Mínimo: ${item.minStock}</div></div>`).join("") : '<p class="muted">No hay productos con stock bajo.</p>';
  document.getElementById("overdueList").innerHTML = overdueCustomers.length ? overdueCustomers.slice(0, 20).map((customer) => `<div class="simple-item"><strong>${escapeHtml(getCustomerFullName(customer))}</strong><span>${currency(customer.balance)}</span><div class="muted">${escapeHtml(customer.phone || "")}</div></div>`).join("") : '<p class="muted">No hay clientes morosos.</p>';
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
    const matchesMonth = !month || String(sale.date || " ").startsWith(month);
    const matchesYear = !year || String(sale.date || " ").startsWith(year);
    const matchesFrom = !from || (sale.date || " ") >= from;
    const matchesTo = !to || (sale.date || " ") <= to;
    return matchesText && matchesDay && matchesMonth && matchesYear && matchesFrom && matchesTo;
  });
}

function renderSales() {
  const rows = getSalesFiltered();
  if (!rows.length) { els.salesTableWrap.innerHTML = '<p class="muted">No hay ventas para mostrar con esos filtros.</p>'; return; }
  els.salesTableWrap.innerHTML = `<div class="record-list compact-record-list"> ${rows.map((sale) => `
    <article class="record-card">
      <div class="record-main">
        <div class="record-head"><strong>${escapeHtml(sale.documentType || "-")} · ${escapeHtml(sale.documentNumber || "-")}</strong><span class="record-amount">${currency(sale.amount)}</span></div>
        <div class="record-meta"><span>${escapeHtml(sale.date || "-")}</span>${sale.operationType === "cuenta_corriente" ? `<span class="status-pill warning">Cuenta corriente</span><span>#${escapeHtml(getCustomerCode(state.customers.find((item) => item.id === sale.customerId) || { id: sale.customerId || "" }))}</span><span>${escapeHtml(`${sale.customerFirstName || ""} ${sale.customerLastName || ""}`.trim() || "-")}</span>` : `<span class="status-pill success">Contado</span><span>${escapeHtml(sale.paymentMethod || "-")}</span>`}</div>
      </div>
      <div class="record-actions">
        <button class="btn btn-sm btn-secondary sale-edit-btn" data-id="${sale.id}">Editar</button>
        <button class="btn btn-sm btn-secondary sale-share-btn" data-id="${sale.id}">Ticket</button>
        <button class="btn btn-sm btn-danger sale-delete-btn" data-id="${sale.id}">Eliminar</button>
      </div>
    </article>`).join("")} </div>`;
  els.salesTableWrap.querySelectorAll(".sale-edit-btn").forEach((btn) => btn.addEventListener("click", () => loadSaleIntoForm(btn.dataset.id)));
  els.salesTableWrap.querySelectorAll(".sale-delete-btn").forEach((btn) => btn.addEventListener("click", async () => {
    if (!confirm("¿Eliminar esta venta?")) return;
    try { setLoading(btn, true); await deleteSale(btn.dataset.id); showToast("Venta eliminada"); } catch (error) { showToast(error.message, "error"); } finally { setLoading(btn, false); }
  }));
  els.salesTableWrap.querySelectorAll(".sale-share-btn").forEach((btn) => btn.addEventListener("click", async () => {
    try { await shareSaleTicket(btn.dataset.id); } catch (error) { showToast(error.message, "error"); }
  }));
}

// ... (Mantener el resto de las funciones de renderizado originales: renderExpenses, renderProducts, etc. con la misma lógica pero usando showToast en lugar de alert) ...
// Por brevedad, asumo que copias las funciones restantes de tu app.js original pero reemplazando:
// alert(...) -> showToast(..., 'error')
// showMessage(...) -> showToast(...)

// 🚀 MEJORA: Registro de Service Worker
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js').then(() => console.log('SW registrado'));
  });
}

// ... (Resto del código de inicialización igual al original) ...
// Asegúrate de envolver los submit de formularios con setLoading
// Ejemplo:
// els.saleForm.addEventListener("submit", async (event) => {
//   setLoading(els.saleSubmitBtn, true);
//   try { await saveSaleForm(event); showToast("Venta guardada"); } 
//   catch (error) { showToast(error.message, "error"); } 
//   finally { setLoading(els.saleSubmitBtn, false); }
// });

// Inicialización
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
