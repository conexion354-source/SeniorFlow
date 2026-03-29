import { auth, db } from "./firebase-config.js";
import { signInAnonymously, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/12.11.0/firebase-auth.js";
import { addDoc, collection, deleteDoc, doc, getDocs, limit, onSnapshot, orderBy, query, serverTimestamp, setDoc, where, writeBatch, updateDoc } from "https://www.gstatic.com/firebasejs/12.11.0/firebase-firestore.js";

// ESTADO GLOBAL
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
  editingUserId: ""
};

// REFERENCIAS DOM
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
  todayText: document.getElementById("todayText"),
  viewTitle: document.getElementById("viewTitle"),
  viewSubtitle: document.getElementById("viewSubtitle"),
  installBtn: document.getElementById("installBtn"),
  saleForm: document.getElementById("saleForm"),
  saleOperationType: document.getElementById("saleOperationType"),
  saleCashFields: document.getElementById("saleCashFields"),
  saleAccountFields: document.getElementById("saleAccountFields"),
  paymentMethod: document.getElementById("paymentMethod"),
  checkFields: document.getElementById("checkFields"),
  saleSubmitBtn: document.getElementById("saleSubmitBtn"),
  cancelSaleEditBtn: document.getElementById("cancelSaleEditBtn"),
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
  expenseForm: document.getElementById("expenseForm"),
  expenseCategory: document.getElementById("expenseCategory"),
  expenseSubmitBtn: document.getElementById("expenseSubmitBtn"),
  cancelExpenseEditBtn: document.getElementById("cancelExpenseEditBtn"),
  expensesTableWrap: document.getElementById("expensesTableWrap"),
  customerSearchInput: document.getElementById("customerSearchInput"),
  paymentCustomerId: document.getElementById("paymentCustomerId"),
  accountDetailCard: document.getElementById("accountDetailCard"),
  accountActionBar: document.getElementById("accountActionBar"),
  productForm: document.getElementById("productForm"),
  productCategorySelect: document.getElementById("productCategorySelect"),
  productSearchInput: document.getElementById("productSearchInput"),
  goCreateProductBtn: document.getElementById("goCreateProductBtn"),
  cancelProductEditBtn: document.getElementById("cancelProductEditBtn"),
  productsTableWrap: document.getElementById("productsTableWrap"),
  budgetForm: document.getElementById("budgetForm"),
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
  userForm: document.getElementById("userForm"),
  userSubmitBtn: document.getElementById("userSubmitBtn"),
  cancelUserEditBtn: document.getElementById("cancelUserEditBtn"),
  usersTableWrap: document.getElementById("usersTableWrap"),
  themeLightBtn: document.getElementById("themeLightBtn"),
  themeDarkBtn: document.getElementById("themeDarkBtn"),
  cashStatusCards: document.getElementById("cashStatusCards"),
  cashOpenForm: document.getElementById("cashOpenForm"),
  cashEntryForm: document.getElementById("cashEntryForm"),
  cashMovementsList: document.getElementById("cashMovementsList"),
  customersList: document.getElementById("customersList"),
  paymentForm: document.getElementById("paymentForm")
};

let unsubscribers = [];
let deferredPrompt = null;

// UTILIDADES
const currency = (value) => new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS", minimumFractionDigits: Number(value || 0) % 1 ? 2 : 0, maximumFractionDigits: 2 }).format(Number(value || 0));
const todayISO = () => { const now = new Date(); const tzOffset = now.getTimezoneOffset() * 60000; return new Date(now - tzOffset).toISOString().slice(0, 10); };
const todayLongText = () => new Date().toLocaleDateString("es-AR", { weekday: "long", day: "2-digit", month: "long", year: "numeric" });

function escapeHtml(value) {
  return String(value ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#039;");
}

function roleLabel(role) { return role === "administrador" ? "Administrador" : "Vendedor"; }
function isAdmin() { return state.sessionUser?.role === "administrador"; }

function showToast(message, type = "success", duration = 3000) {
  const container = document.getElementById("toastContainer");
  if (!container) return;
  const toast = document.createElement("div");
  toast.className = `toast ${type}`;
  toast.innerHTML = `<span>${type === "success" ? "✓" : type === "error" ? "✕" : "⚠"}</span><span>${message}</span>`;
  container.appendChild(toast);
  setTimeout(() => { toast.style.opacity = "0"; toast.style.transform = "translateX(100%)"; setTimeout(() => toast.remove(), 300); }, duration);
}

function setLoading(button, isLoading, text = "Guardando...") {
  if (!button) return;
  if (isLoading) {
    button.disabled = true;
    button.dataset.originalText = button.textContent;
    button.innerHTML = `<span class="spinner"></span>${text}`;
  } else {
    button.disabled = false;
    button.textContent = button.dataset.originalText || "Guardar";
  }
}

function debounce(func, wait) {
  let timeout;
  return function executedFunction(...args) {
    const later = () => { clearTimeout(timeout); func(...args); };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
}

function parseMoneyValue(input) {
  const raw = String(input ?? "").trim();
  if (!raw) return 0;
  let normalized = raw.replace(/\s+/g, " ");
  if (normalized.includes(",") && normalized.includes(".")) {
    if (normalized.lastIndexOf(",") > normalized.lastIndexOf(".")) { normalized = normalized.replace(/\./g, "").replace(",", "."); }
    else { normalized = normalized.replace(/,/g, ""); }
  } else if (normalized.includes(",")) { normalized = normalized.replace(/\./g, "").replace(",", "."); }
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
  if (mode === "administrador") {
    els.loginTitle.textContent = "Ingreso administración";
    els.loginSubtitle.textContent = "Usá usuario y contraseña. Si no existe admin, el primer ingreso lo crea.";
  } else {
    els.loginTitle.textContent = "Ingreso vendedor";
    els.loginSubtitle.textContent = "El vendedor entra con usuario creado por administración.";
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
  const numbers = state.customers.map((customer) => Number(String(customer.code || customer.id || "").replace(/\D/g, ""))).filter((value) => Number.isFinite(value) && value > 0);
  const next = (numbers.length ? Math.max(...numbers) : 0) + 1;
  return String(next).padStart(4, "0");
}

function applyTheme(theme = "light") {
  const resolved = theme === "dark" ? "dark" : "light";
  document.documentElement.setAttribute("data-theme", resolved);
  try { localStorage.setItem("mundoled_theme", resolved); } catch (_) {}
  els.themeLightBtn?.classList.toggle("btn-success", resolved === "light");
  els.themeDarkBtn?.classList.toggle("btn-success", resolved === "dark");
}

function initTheme() {
  let saved = "light";
  try { saved = localStorage.getItem("mundoled_theme") || "light"; } catch (_) {}
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
  const raw = String(value || "").toLowerCase().trim();
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
  if (!cards.length) { node.innerHTML = '<p style="color:var(--muted)">Sin datos suficientes.</p>'; return; }
  node.innerHTML = cards.map((card) => `<div><span style="color:var(--muted);font-size:14px">${card.label}</span><div style="font-size:24px;font-weight:700">${card.value}</div></div>`).join("");
}

function renderBarChart(targetId, rows = [], monthMode = false) {
  const node = document.getElementById(targetId);
  if (!node) return;
  if (!rows.length) { node.innerHTML = '<p style="color:var(--muted)">Sin ventas para graficar.</p>'; return; }
  const max = Math.max(...rows.map((row) => Number(row.amount || 0)), 1);
  node.innerHTML = rows.map((row) => {
    const width = Math.max(6, (Number(row.amount || 0) / max) * 100);
    return `<div style="display:flex;align-items:center;gap:10px;margin:10px 0"><div style="width:80px;font-size:14px">${row.label}</div><div style="flex:1;height:24px;background:var(--bg);border-radius:4px;overflow:hidden"><div style="height:100%;background:var(--primary);border-radius:4px;width:${width}%"></div></div><div style="width:100px;text-align:right;font-size:14px">${currency(row.amount || 0)}</div></div>`;
  }).join("");
}

function fillCategoriesSelect() {
  const select = els.productCategorySelect;
  if (!select) return;
  const categories = state.categories.length ? state.categories.slice().sort((a, b) => (a.name || "").localeCompare(b.name || "")) : [{ name: "General" }];
  select.innerHTML = categories.map((cat) => `<option value="${escapeHtml(cat.name)}">${escapeHtml(cat.name)}</option>`).join("");
}

function fillCustomerSelects() {
  const customers = state.customers.slice().sort((a, b) => getCustomerFullName(a).localeCompare(getCustomerFullName(b)));
  const options = customers.map((customer) => `<option value="${escapeHtml(`${getCustomerCode(customer)} · ${getCustomerFullName(customer)} · ${customer.phone || ""}`)}" data-id="${customer.id}"></option>`).join("");
  if (els.budgetCustomerOptions) els.budgetCustomerOptions.innerHTML = options;
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
  els.budgetCustomerSelectedCard.innerHTML = `<div><strong>#${escapeHtml(getCustomerCode(customer))} · ${escapeHtml(getCustomerFullName(customer))}</strong><span style="color:var(--success)">Cliente cargado</span></div><div style="color:var(--muted);font-size:14px">${escapeHtml(customer.phone || "Sin celular")} · ${escapeHtml(customer.email || "Sin email")}</div>`;
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
  if (els.budgetCustomerSearch) els.budgetCustomerSearch.value = `${getCustomerCode(customer)} · ${getCustomerFullName(customer)} · ${customer.phone || ""}`;
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
  const fieldIds = ["budgetClientNameWrap"];
  fieldIds.forEach((id) => {
    const wrap = document.getElementById(id);
    if (!wrap) return;
    wrap.classList.toggle("hidden", existing);
    wrap.querySelectorAll("input, select, textarea").forEach((input) => {
      input.disabled = existing;
      if (input.name === "clientName") input.required = !existing;
    });
  });
  if (!existing && els.budgetCustomerId) els.budgetCustomerId.value = "";
  if (!existing && els.budgetCustomerSearch) els.budgetCustomerSearch.value = "";
  renderBudgetSelectedCustomer();
}

function applyRoleUI() {
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

  document.getElementById("statCash").textContent = currency(cash);
  document.getElementById("statCashBreakdown").textContent = formatBreakdownText(cajaBreakdown);
  document.getElementById("statSalesDay").textContent = currency(salesDay);
  document.getElementById("statSalesDayBreakdown").textContent = formatBreakdownText(salesDayBreakdown);
  document.getElementById("statSalesTotal").textContent = currency(allSalesTotal);
  document.getElementById("statSalesMonthBreakdown").textContent = `Semana actual ${currency(weekTotal)} · Ticket medio ${currency(monthTicket)}`;
  document.getElementById("statOverdueCount").textContent = overdueCustomers.length;
  els.todayText.textContent = todayLongText();

  renderBarChart("weekSalesChart", weekDays, false);
  renderBarChart("monthSalesChart", monthRows, true);

  const lowStock = state.products.slice().sort((a, b) => (Number(a.currentStock || 0) - Number(a.minStock || 0)) - (Number(b.currentStock || 0) - Number(b.minStock || 0))).filter((item) => Number(item.currentStock || 0) <= Number(item.minStock || 0));
  document.getElementById("stockRankingList").innerHTML = lowStock.length ? lowStock.slice(0, 8).map((item) => `<div class="simple-item"><strong>${escapeHtml(item.name || "-")}</strong><span>${escapeHtml(item.category || "General")} · Actual: ${item.currentStock} · Mínimo: ${item.minStock}</span></div>`).join("") : '<p style="color:var(--muted)">No hay productos con stock bajo.</p>';

  document.getElementById("overdueList").innerHTML = overdueCustomers.length ? overdueCustomers.slice(0, 20).map((customer) => `<div class="simple-item"><strong>${escapeHtml(getCustomerFullName(customer))}</strong><span>${currency(customer.balance)} · ${escapeHtml(customer.phone || "")}</span></div>`).join("") : '<p style="color:var(--muted)">No hay clientes morosos.</p>';
}

function getSalesFiltered() {
  const text = (els.salesSearchInput?.value || "").trim().toLowerCase();
  const day = els.salesFilterDate?.value || "";
  const month = els.salesFilterMonth?.value || "";
  const year = String(els.salesFilterYear?.value || "").trim();
  const from = els.salesFilterFrom?.value || "";
  const to = els.salesFilterTo?.value || "";
  return state.sales.filter((sale) => {
    const haystack = `${sale.documentType || ""} ${sale.documentNumber || ""} ${sale.customerFirstName || ""} ${sale.customerLastName || ""}`.toLowerCase();
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
  if (!rows.length) { els.salesTableWrap.innerHTML = '<p style="color:var(--muted)">No hay ventas para mostrar.</p>'; return; }
  els.salesTableWrap.innerHTML = rows.map((sale) => `<div class="record-card"><div class="record-main"><div class="record-head"><strong>${escapeHtml(sale.documentType || "-")} · ${escapeHtml(sale.documentNumber || "-")}</strong><span class="record-amount">${currency(sale.amount)}</span></div><div class="record-meta"><span>${escapeHtml(sale.date || "-")}</span>${sale.operationType === "cuenta_corriente" ? `<span class="status-pill warning">Cta. Cte.</span>` : `<span class="status-pill success">Contado</span>`}</div></div><div class="record-actions"><button class="btn btn-sm btn-secondary sale-edit-btn" data-id="${sale.id}">Editar</button><button class="btn btn-sm btn-danger sale-delete-btn" data-id="${sale.id}">Eliminar</button></div></div>`).join("");
  els.salesTableWrap.querySelectorAll(".sale-edit-btn").forEach((btn) => btn.addEventListener("click", () => loadSaleIntoForm(btn.dataset.id)));
  els.salesTableWrap.querySelectorAll(".sale-delete-btn").forEach((btn) => btn.addEventListener("click", async () => {
    if (!confirm("¿Eliminar esta venta?")) return;
    try { await deleteSale(btn.dataset.id); showToast("Venta eliminada"); } catch (error) { showToast(error.message, "error"); }
  }));
}

function getExpensesFiltered() {
  const text = (els.expenseSearchInput?.value || "").trim().toLowerCase();
  const month = els.expenseFilterMonth?.value || "";
  const from = els.expenseFilterFrom?.value || "";
  const to = els.expenseFilterTo?.value || "";
  return state.expenses.filter((exp) => {
    const haystack = `${exp.category || ""} ${exp.details || ""}`.toLowerCase();
    const matchesText = !text || haystack.includes(text);
    const matchesMonth = !month || String(exp.date || "").startsWith(month);
    const matchesFrom = !from || (exp.date || "") >= from;
    const matchesTo = !to || (exp.date || "") <= to;
    return matchesText && matchesMonth && matchesFrom && matchesTo;
  });
}

function renderExpenses() {
  const items = getExpensesFiltered();
  if (!items.length) { els.expensesTableWrap.innerHTML = '<p style="color:var(--muted)">No hay gastos para mostrar.</p>'; return; }
  els.expensesTableWrap.innerHTML = items.map((exp) => `<div class="record-card"><div class="record-main"><div class="record-head"><strong>${escapeHtml(exp.category || "-")}</strong><span class="record-amount">${currency(exp.amount)}</span></div><div class="record-meta"><span>${escapeHtml(exp.date || "-")}</span><span>${escapeHtml(exp.details || "Sin detalle")}</span></div></div><div class="record-actions"><button class="btn btn-sm btn-secondary expense-edit-btn" data-id="${exp.id}">Editar</button><button class="btn btn-sm btn-danger expense-delete-btn" data-id="${exp.id}">Eliminar</button></div></div>`).join("");
  els.expensesTableWrap.querySelectorAll(".expense-edit-btn").forEach((btn) => btn.addEventListener("click", () => loadExpenseIntoForm(btn.dataset.id)));
  els.expensesTableWrap.querySelectorAll(".expense-delete-btn").forEach((btn) => btn.addEventListener("click", async () => {
    if (!confirm("¿Eliminar este gasto?")) return;
    try { await deleteDoc(doc(db, "expenses", btn.dataset.id)); showToast("Gasto eliminado"); } catch (error) { showToast(error.message, "error"); }
  }));
}

function renderProducts() {
  const productFilter = (els.productSearchInput?.value || "").trim().toLowerCase();
  const filteredProducts = state.products.filter((item) => {
    const text = `${item.code || ""} ${item.name || ""} ${item.description || ""} ${item.category || ""}`.toLowerCase();
    return !productFilter || text.includes(productFilter);
  });
  if (!filteredProducts.length) { els.productsTableWrap.innerHTML = '<p style="color:var(--muted)">No hay productos cargados.</p>'; return; }
  els.productsTableWrap.innerHTML = `<table class="data-table"><thead><tr><th>Código</th><th>Producto</th><th>Categoría</th><th>Stock</th><th>Precio</th><th>Acciones</th></tr></thead><tbody>${filteredProducts.map((item) => `<tr><td>${escapeHtml(item.code || "-")}</td><td>${escapeHtml(item.name || "-")}</td><td>${escapeHtml(item.category || "General")}</td><td>${item.currentStock ?? 0}</td><td>${currency(item.salePrice)}</td><td><button class="btn btn-sm btn-secondary product-edit-btn" data-id="${item.id}">Editar</button><button class="btn btn-sm btn-danger product-delete-btn" data-id="${item.id}">Eliminar</button></td></tr>`).join("")}</tbody></table>`;
  els.productsTableWrap.querySelectorAll(".product-edit-btn").forEach((btn) => btn.addEventListener("click", () => loadProductIntoForm(btn.dataset.id)));
  els.productsTableWrap.querySelectorAll(".product-delete-btn").forEach((btn) => btn.addEventListener("click", async () => {
    if (!confirm("¿Eliminar este producto?")) return;
    try { await deleteDoc(doc(db, "products", btn.dataset.id)); showToast("Producto eliminado"); } catch (error) { showToast(error.message, "error"); }
  }));
}

function renderCustomers() {
  const filter = (els.customerSearchInput.value || "").trim().toLowerCase();
  const filteredCustomers = state.customers.filter((customer) => {
    const text = `${getCustomerFullName(customer)} ${customer.phone || ""} ${customer.email || ""}`.toLowerCase();
    return !filter || text.includes(filter);
  });
  const target = document.getElementById("customersList");
  target.innerHTML = filteredCustomers.length ? filteredCustomers.map((customer) => `<button class="simple-item customer-btn ${state.selectedCustomerId === customer.id ? "active" : ""}" data-id="${customer.id}" type="button" style="width:100%;text-align:left;background:transparent;border:none;cursor:pointer"><strong>#${escapeHtml(getCustomerCode(customer))} · ${escapeHtml(getCustomerFullName(customer))}</strong><span>${currency(accountBalance(customer.id))}</span><div style="color:var(--muted);font-size:14px">${escapeHtml(customer.phone || "")}</div></button>`).join("") : '<p style="color:var(--muted)">No hay clientes.</p>';
  document.querySelectorAll(".customer-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      state.selectedCustomerId = btn.dataset.id;
      renderCustomers();
      renderAccountDetail(btn.dataset.id);
    });
  });
  renderAccountDetail(state.selectedCustomerId);
}

function renderAccountDetail(customerId) {
  const card = document.getElementById("accountDetailCard");
  const customer = state.customers.find((item) => item.id === customerId);
  els.accountActionBar?.classList.toggle("hidden", !customer);
  if (!customer) {
    card.innerHTML = '<p style="color:var(--muted)">Buscá y seleccioná un cliente para ver sus movimientos.</p>';
    els.paymentCustomerId.value = "";
    return;
  }
  const movements = accountMovementsForCustomer(customerId);
  const balance = accountBalance(customerId);
  els.paymentCustomerId.value = customerId;
  card.innerHTML = `<div><strong>#${escapeHtml(getCustomerCode(customer))} · ${escapeHtml(getCustomerFullName(customer))}</strong><div style="color:var(--muted);font-size:14px">Celular: ${escapeHtml(customer.phone || "-")} · Email: ${escapeHtml(customer.email || "-")}</div><div style="font-size:24px;font-weight:700;margin:10px 0">${currency(balance)}</div></div><div>${movements.length ? movements.map((item) => `<div class="simple-item"><strong>${escapeHtml(item.type === "cobro" ? "Cobro" : "Cargo")}</strong><span>${currency(item.amount)} · ${escapeHtml(item.date || "-")} · ${escapeHtml(item.paymentMethod || "-")}</span></div>`).join("") : '<p style="color:var(--muted)">Sin movimientos.</p>'}</div>`;
}

function renderCash() {
  const cajaBreakdown = currentCajaBreakdown();
  renderMiniStats("cashStatusCards", [
    { label: "Caja total", value: currency(sumBreakdown(cajaBreakdown)) },
    { label: "Efectivo", value: currency(cajaBreakdown.efectivo || 0) },
    { label: "Cheques", value: currency(cajaBreakdown.cheque || 0) }
  ]);
  const node = document.getElementById("cashMovementsList");
  node.innerHTML = state.cashMovements.length ? state.cashMovements.slice(0, 40).map((item) => `<div class="record-card"><div class="record-main"><div class="record-head"><strong>${item.kind === "apertura" ? "Apertura de caja" : "Ingreso manual"}</strong><span class="record-amount">${item.kind === "apertura" ? currency((item.cashAmount || 0) + (item.checkAmount || 0) + (item.otherAmount || 0)) : currency(item.amount || 0)}</span></div><div class="record-meta"><span>${escapeHtml(item.date || "-")}</span><span>${item.kind === "apertura" ? `Efectivo ${currency(item.cashAmount || 0)}` : `${escapeHtml(String(item.medium || "otro"))}`}</span></div></div></div>`).join("") : '<p style="color:var(--muted)">Sin movimientos de caja.</p>';
}

function renderBudgets() {
  const budgetFilterText = (els.budgetSearchInput?.value || "").trim().toLowerCase();
  const budgetFrom = els.budgetSearchFrom?.value || "";
  const budgetTo = els.budgetSearchTo?.value || "";
  const filteredBudgets = state.budgets.filter((budget) => {
    const text = `${budget.number || ""} ${budget.clientName || ""}`.toLowerCase();
    const matchesText = !budgetFilterText || text.includes(budgetFilterText);
    const matchesFrom = !budgetFrom || (budget.date || "") >= budgetFrom;
    const matchesTo = !budgetTo || (budget.date || "") <= budgetTo;
    return matchesText && matchesFrom && matchesTo;
  });
  els.budgetsList.innerHTML = filteredBudgets.length ? filteredBudgets.map((budget) => `<div class="simple-item budget-item ${state.selectedBudgetId === budget.id ? "active" : ""}" data-id="${budget.id}" style="cursor:pointer"><strong>${escapeHtml(budget.number || budget.id)} · ${escapeHtml(budget.clientName || "Cliente")}</strong><span>${escapeHtml(budget.date || "-")} · ${currency(budget.total)}</span><div style="color:var(--muted);font-size:14px">${budget.sent ? '✓ Enviado' : ''} ${budget.approved ? '✓ Aprobado' : ''}</div></div>`).join("") : '<p style="color:var(--muted)">No hay presupuestos.</p>';
  document.querySelectorAll(".budget-item").forEach((btn) => {
    btn.addEventListener("click", () => {
      state.selectedBudgetId = btn.dataset.id;
      renderBudgets();
      renderBudgetPreview(btn.dataset.id);
    });
  });
  if (state.selectedBudgetId) renderBudgetPreview(state.selectedBudgetId);
}

function renderBudgetPreview(budgetId) {
  const budget = state.budgets.find((item) => item.id === budgetId);
  if (!budget) {
    els.budgetPreviewCard.innerHTML = '<p style="color:var(--muted)">Seleccioná un presupuesto.</p>';
    els.budgetPreviewActions?.classList.add("hidden");
    return;
  }
  els.budgetPreviewActions?.classList.remove("hidden");
  els.budgetToggleSentBtn.classList.toggle("btn-success", !!budget.sent);
  els.budgetToggleApprovedBtn.classList.toggle("btn-success", !!budget.approved);
  if (els.budgetModalTitle) els.budgetModalTitle.textContent = `Presupuesto ${budget.number || budget.id} · ${budget.clientName || "Cliente"}`;
  const rows = (budget.items || []).map((item, index) => `<tr><td>${index + 1}</td><td>${escapeHtml(item.description || "-")}</td><td>${item.quantity || 0}</td><td>${currency(item.unitPrice)}</td><td>${currency(item.total)}</td></tr>`).join("");
  els.budgetPreviewCard.innerHTML = `<div><h3>${escapeHtml(budget.clientName || "Cliente")}</h3><p>Fecha: ${escapeHtml(budget.date || "-")} · Validez: ${escapeHtml(budget.validUntil || "-")}</p><table class="data-table"><thead><tr><th>#</th><th>Detalle</th><th>Cant.</th><th>Unitario</th><th>Total</th></tr></thead><tbody>${rows}</tbody></table><div style="text-align:right;font-size:24px;font-weight:700;margin-top:20px">Total: ${currency(budget.total)}</div></div>`;
}

function renderUsers() {
  const wrap = document.getElementById("usersTableWrap");
  if (!wrap) return;
  wrap.innerHTML = state.users.length ? state.users.map((user) => `<div class="record-card"><div class="record-main"><div class="record-head"><strong>${escapeHtml(user.name || "-")}</strong><span>${escapeHtml(roleLabel(user.role))}</span></div><div class="record-meta"><span>${escapeHtml(user.username || "-")}</span></div></div><div class="record-actions">${isAdmin() && user.id !== state.sessionUser.id ? `<button class="btn btn-sm btn-danger user-delete-btn" data-id="${user.id}">Eliminar</button>` : ""}</div></div>`).join("") : '<p style="color:var(--muted)">No hay usuarios.</p>';
  wrap.querySelectorAll(".user-delete-btn").forEach((btn) => btn.addEventListener("click", async () => {
    if (!confirm("¿Eliminar este usuario?")) return;
    try { await deleteDoc(doc(db, "users", btn.dataset.id)); showToast("Usuario eliminado"); } catch (error) { showToast(error.message, "error"); }
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
}

// LOGIN Y AUTENTICACIÓN
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
  const snap = await getDocs(query(collection(db, "users"), where("username", "==", username.trim().toLowerCase()), where("passwordHash", "==", passwordHash), where("role", "==", role)));
  if (snap.empty) return null;
  const docSnap = snap.docs[0];
  return { id: docSnap.id, ...docSnap.data() };
}

async function createFirstAdmin(username, password) {
  const cleanUsername = username.trim().toLowerCase();
  const userId = cleanUsername.replace(/[^a-z0-9]+/g, "");
  const passwordHash = await sha256(password);
  const payload = { name: "Administrador", username: cleanUsername, passwordHash, role: "administrador", createdAt: serverTimestamp(), updatedAt: serverTimestamp() };
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
    if (!user) throw new Error("Usuario o contraseña incorrectos.");
    return user;
  }
  const vendor = await findUserByCredentials(cleanUsername, password, "vendedor");
  if (!vendor) throw new Error("Usuario o contraseña incorrectos.");
  return vendor;
}

// FORMULARIOS
function syncSaleFormVisibility() {
  const accountMode = els.saleOperationType.value === "cuenta_corriente";
  els.saleCashFields.classList.toggle("hidden", accountMode);
  els.saleAccountFields.classList.toggle("hidden", !accountMode);
  els.saleSubmitBtn.textContent = state.editingSaleId ? "Guardar cambios" : accountMode ? "Guardar venta y cliente" : "Guardar venta";
}

function syncCheckFields() {
  const isCheck = els.paymentMethod.value === "cheque";
  els.checkFields.classList.toggle("hidden", !isCheck);
}

function resetSaleForm() {
  state.editingSaleId = "";
  els.saleForm.reset();
  els.saleForm.date.value = todayISO();
  els.saleSubmitBtn.textContent = "Guardar venta";
  els.cancelSaleEditBtn.classList.add("hidden");
  els.saleOperationType.value = "contado";
  els.paymentMethod.value = "efectivo";
  syncSaleFormVisibility();
  syncCheckFields();
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
  form.customerFirstName.value = sale.customerFirstName || "";
  form.customerLastName.value = sale.customerLastName || "";
  form.customerPhone.value = sale.customerPhone || "";
  form.customerEmail.value = sale.customerEmail || "";
  form.customerAddress.value = sale.customerAddress || "";
  els.saleSubmitBtn.textContent = "Guardar cambios";
  els.cancelSaleEditBtn.classList.remove("hidden");
  syncSaleFormVisibility();
  syncCheckFields();
  document.querySelector('[data-view="ventas"]')?.click();
}

async function deleteSale(id) {
  const sale = state.sales.find((item) => item.id === id);
  if (!sale) return;
  if (sale.accountMovementId) { try { await deleteDoc(doc(db, "account_movements", sale.accountMovementId)); } catch (_) {} }
  await deleteDoc(doc(db, "sales", id));
}

function resetExpenseForm() {
  state.editingExpenseId = "";
  els.expenseForm.reset();
  els.expenseForm.date.value = todayISO();
  els.expenseSubmitBtn.textContent = "Guardar gasto";
  els.cancelExpenseEditBtn.classList.add("hidden");
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
  els.expenseSubmitBtn.textContent = "Guardar cambios";
  els.cancelExpenseEditBtn.classList.remove("hidden");
  document.querySelector('[data-view="gastos"]')?.click();
}

function resetProductForm() {
  state.editingProductId = "";
  els.productForm.reset();
  document.getElementById("productSubmitBtn").textContent = "Guardar producto";
  els.cancelProductEditBtn.classList.add("hidden");
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
  document.getElementById("productSubmitBtn").textContent = "Guardar cambios";
  els.cancelProductEditBtn.classList.remove("hidden");
  document.querySelector('[data-view="stock"]')?.click();
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
  renderBudgetSelectedCustomer(null);
  syncBudgetClientMode();
  if (els.budgetItemsWrap) els.budgetItemsWrap.innerHTML = "";
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
    if (customer && els.budgetCustomerSearch) els.budgetCustomerSearch.value = `${getCustomerCode(customer)} · ${getCustomerFullName(customer)} · ${customer.phone || ""}`;
    if (els.budgetCustomerId) els.budgetCustomerId.value = budget.customerId;
  } else {
    els.budgetClientMode.value = "manual";
    form.clientName.value = budget.clientName || "";
    form.clientPhone.value = budget.clientPhone || "";
    form.clientEmail.value = budget.clientEmail || "";
    form.clientAddress.value = budget.clientAddress || "";
  }
  syncBudgetClientMode();
  renderBudgetSelectedCustomer(budget.customerId ? state.customers.find((item) => item.id === budget.customerId) : null);
  els.budgetCustomTermsWrap.classList.toggle("hidden", els.budgetPaymentTerms.value !== "Personalizado");
  els.budgetFormTitle.textContent = "Editar presupuesto";
  els.budgetSubmitBtn.textContent = "Guardar cambios";
  els.cancelBudgetEditBtn.classList.remove("hidden");
  document.querySelector('[data-view="presupuestos"]')?.click();
}

function resetUserForm() {
  state.editingUserId = "";
  const form = document.getElementById("userForm");
  if (!form) return;
  form.reset();
  els.userSubmitBtn.textContent = "Guardar usuario";
  els.cancelUserEditBtn?.classList.add("hidden");
  form.username.readOnly = false;
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
  els.userSubmitBtn.textContent = "Guardar cambios";
  els.cancelUserEditBtn?.classList.remove("hidden");
  document.querySelector('[data-view="usuarios"]')?.click();
}

// GUARDAR DATOS
async function saveSaleForm(event) {
  event.preventDefault();
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
  payload.createdAt = originalSale?.createdAt || serverTimestamp();
  await setDoc(doc(db, "sales", saleId), payload, { merge: true });
  renderEverything();
  const wasEditing = !!state.editingSaleId;
  resetSaleForm();
  showToast(wasEditing ? "Venta actualizada." : "Venta guardada.");
}

async function saveExpenseForm(event) {
  event.preventDefault();
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
  showToast(wasEditing ? "Gasto actualizado." : "Gasto guardado.");
}

async function saveProductForm(event) {
  event.preventDefault();
  const form = els.productForm;
  const id = state.editingProductId || form.code.value.trim().replace(/[^a-z0-9]+/g, "").toLowerCase();
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
  showToast(wasEditing ? "Producto actualizado." : "Producto guardado.");
}

async function saveBudgetForm(event) {
  event.preventDefault();
  const form = els.budgetForm;
  const items = [];
  if (els.budgetItemsWrap) {
    els.budgetItemsWrap.querySelectorAll(".budget-item-row").forEach((row) => {
      const description = row.querySelector('[name="description"]')?.value || "";
      const quantity = Number(row.querySelector('[name="quantity"]')?.value || 0);
      const unitPrice = parseMoneyValue(row.querySelector('[name="unitPrice"]')?.value || 0);
      if (description && quantity > 0) items.push({ description, quantity, unitPrice, unit: row.querySelector('[name="unit"]')?.value || "unidad", total: quantity * unitPrice });
    });
  }
  if (!items.length) throw new Error("Agregá al menos un ítem.");
  const total = items.reduce((sum, item) => sum + item.total, 0);
  let customerId = "";
  let clientName = form.clientName.value;
  let clientPhone = form.clientPhone.value || "";
  let clientEmail = form.clientEmail.value || "";
  let clientAddress = form.clientAddress.value || "";
  if (els.budgetClientMode.value === "existing") {
    customerId = els.budgetCustomerId.value || resolveBudgetCustomerSearch()?.id || "";
    const customer = state.customers.find((item) => item.id === customerId);
    if (!customer) throw new Error("Seleccioná un cliente.");
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
  renderBudgetPreview(id);
  const wasEditing = !!state.editingBudgetId;
  resetBudgetForm();
  showToast(wasEditing ? "Presupuesto actualizado." : "Presupuesto guardado.");
}

async function savePaymentForm(event) {
  event.preventDefault();
  const form = event.currentTarget;
  const amount = parseMoneyValue(form.amount.value || 0);
  if (!form.customerId.value) throw new Error("Seleccioná un cliente.");
  if (amount <= 0) throw new Error("El monto debe ser mayor a cero.");
  const balance = accountBalance(form.customerId.value);
  const finalAmount = form.paymentKind.value === "total" ? balance : amount;
  if (finalAmount <= 0) throw new Error("No hay saldo pendiente.");
  if (finalAmount > balance) throw new Error("El cobro supera el saldo.");
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
  showToast("Cobro registrado.");
}

async function saveCashOpenForm(event) {
  event.preventDefault();
  if (!isAdmin()) throw new Error("Solo administración puede abrir caja.");
  const form = event.currentTarget;
  const cashAmount = parseMoneyValue(form.cashAmount.value || 0);
  const checkAmount = parseMoneyValue(form.checkAmount.value || 0);
  const otherAmount = parseMoneyValue(form.otherAmount.value || 0);
  if ((cashAmount + checkAmount + otherAmount) <= 0) throw new Error("Cargá algún importe.");
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
  showToast("Apertura guardada.");
}

async function saveCashEntryForm(event) {
  event.preventDefault();
  if (!isAdmin()) throw new Error("Solo administración puede agregar ingresos.");
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
  showToast("Ingreso guardado.");
}

async function saveUserForm(event) {
  event.preventDefault();
  if (!isAdmin()) throw new Error("Solo administración puede cargar usuarios.");
  const form = event.currentTarget;
  const username = form.username.value.trim().toLowerCase();
  if (!username) throw new Error("Completá el usuario.");
  const editingUser = state.editingUserId ? state.users.find((user) => user.id === state.editingUserId) : null;
  const userId = state.editingUserId || username.replace(/[^a-z0-9]+/g, "");
  const payload = { name: form.name.value, username, role: form.role.value, updatedAt: serverTimestamp(), createdAt: editingUser?.createdAt || serverTimestamp() };
  if (form.password.value) { payload.passwordHash = await sha256(form.password.value); }
  else if (!editingUser) { throw new Error("Completá la contraseña."); }
  await setDoc(doc(db, "users", userId), payload, { merge: true });
  const wasEditing = !!state.editingUserId;
  resetUserForm();
  showToast(wasEditing ? "Usuario actualizado." : "Usuario guardado.");
}

// EVENTOS Y NAVEGACIÓN
function setupNavigation() {
  document.querySelectorAll(".nav-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      const view = btn.dataset.view;
      document.querySelectorAll(".nav-btn").forEach((item) => item.classList.remove("active"));
      btn.classList.add("active");
      document.querySelectorAll(".view-section").forEach((viewNode) => viewNode.classList.remove("active"));
      document.getElementById(`${view}View`)?.classList.add("active");
      const titles = { inicio: ["Inicio", "Resumen general"], ventas: ["Ventas", "Carga y historial"], gastos: ["Gastos", "Registro de egresos"], caja: ["Caja", "Control de caja"], stock: ["Stock", "Productos"], cuentas: ["Cuentas", "Clientes"], presupuestos: ["Presupuestos", "Lista y edición"], usuarios: ["Usuarios", "Accesos"], ajustes: ["Ajustes", "Configuración"] };
      els.viewTitle.textContent = titles[view]?.[0] || "Panel";
      els.viewSubtitle.textContent = titles[view]?.[1] || "";
    });
  });
}

function setupInstallPrompt() {
  const isStandalone = window.matchMedia("(display-mode: standalone)").matches || window.navigator.standalone;
  if (isStandalone) { els.installBtn?.classList.add("hidden"); return; }
  els.installBtn?.classList.remove("hidden");
  window.addEventListener("beforeinstallprompt", (event) => {
    event.preventDefault();
    deferredPrompt = event;
    els.installBtn.textContent = "Instalar app";
  });
  els.installBtn?.addEventListener("click", async () => {
    if (deferredPrompt) { deferredPrompt.prompt(); deferredPrompt = null; return; }
    alert("En el menú del navegador elegí 'Instalar aplicación' o 'Agregar a pantalla de inicio'.");
  });
}

function bindFilters() {
  [els.salesSearchInput, els.salesFilterDate, els.salesFilterMonth, els.salesFilterYear, els.salesFilterFrom, els.salesFilterTo, els.expenseSearchInput, els.expenseFilterMonth, els.expenseFilterFrom, els.expenseFilterTo, els.customerSearchInput, els.productSearchInput, els.budgetSearchInput, els.budgetSearchFrom, els.budgetSearchTo].forEach((input) => input?.addEventListener("input", renderEverything));
}

function setupUiEvents() {
  els.tabAdmin.addEventListener("click", () => setMode("administrador"));
  els.tabVendor.addEventListener("click", () => setMode("vendedor"));
  els.saleOperationType.addEventListener("change", syncSaleFormVisibility);
  els.paymentMethod.addEventListener("change", syncCheckFields);
  els.cancelSaleEditBtn.addEventListener("click", resetSaleForm);
  els.cancelExpenseEditBtn.addEventListener("click", resetExpenseForm);
  els.cancelProductEditBtn?.addEventListener("click", resetProductForm);
  els.cancelBudgetEditBtn.addEventListener("click", resetBudgetForm);
  els.cancelUserEditBtn?.addEventListener("click", resetUserForm);
  els.goCreateProductBtn?.addEventListener("click", () => { resetProductForm(); document.getElementById("productForm")?.scrollIntoView({ behavior: "smooth", block: "start" }); });
  els.goCreateBudgetBtn?.addEventListener("click", () => { resetBudgetForm(); document.getElementById("budgetForm")?.scrollIntoView({ behavior: "smooth", block: "start" }); });
  els.budgetPaymentTerms?.addEventListener("change", () => { els.budgetCustomTermsWrap.classList.toggle("hidden", els.budgetPaymentTerms.value !== "Personalizado"); });
  els.budgetClientMode?.addEventListener("change", syncBudgetClientMode);
  els.budgetCustomerSearch?.addEventListener("change", resolveBudgetCustomerSearch);
  els.budgetCustomerSearch?.addEventListener("input", resolveBudgetCustomerSearch);
  els.addBudgetItemBtn?.addEventListener("click", () => {
    if (!els.budgetItemsWrap) return;
    const row = document.createElement("div");
    row.className = "budget-item-row";
    row.innerHTML = `<div class="budget-item-fields"><label><span>Detalle</span><input name="description" type="text" placeholder="Producto o servicio" required></label><label><span>Cantidad</span><input name="quantity" type="number" min="0" step="0.01" value="1"></label><label><span>Unidad</span><select name="unit"><option value="unidad">Unidad</option><option value="kilos">Kilos</option><option value="metros">Metros</option></select></label><label><span>Precio unitario</span><input name="unitPrice" type="text" data-money="true" value="0"></label></div><button type="button" class="btn btn-sm btn-danger remove-budget-item" style="margin-top:10px">Quitar</button>`;
    els.budgetItemsWrap.appendChild(row);
    row.querySelectorAll("input").forEach((input) => input.addEventListener("input", () => {
      const items = [];
      els.budgetItemsWrap.querySelectorAll(".budget-item-row").forEach((r) => {
        const desc = r.querySelector('[name="description"]')?.value || "";
        const qty = Number(r.querySelector('[name="quantity"]')?.value || 0);
        const price = parseMoneyValue(r.querySelector('[name="unitPrice"]')?.value || 0);
        if (desc && qty > 0) items.push({ total: qty * price });
      });
      const total = items.reduce((sum, item) => sum + item.total, 0);
      if (els.budgetSubtotal) els.budgetSubtotal.textContent = currency(total);
      if (els.budgetTotal) els.budgetTotal.textContent = currency(total);
    }));
    row.querySelector(".remove-budget-item").addEventListener("click", () => { row.remove(); });
  });
  els.budgetPreviewCloseBtn?.addEventListener("click", () => { els.budgetPreviewModal.classList.add("hidden"); });
  els.budgetModalEditBtn?.addEventListener("click", () => { if (state.selectedBudgetId) loadBudgetIntoForm(state.selectedBudgetId); });
  els.budgetToggleSentBtn?.addEventListener("click", async () => {
    if (!state.selectedBudgetId) return;
    const budget = state.budgets.find((item) => item.id === state.selectedBudgetId);
    if (!budget) return;
    await updateDoc(doc(db, "budgets", state.selectedBudgetId), { sent: !budget.sent, updatedAt: serverTimestamp() });
    showToast(budget.sent ? "Marcado como no enviado." : "Marcado como enviado.");
  });
  els.budgetToggleApprovedBtn?.addEventListener("click", async () => {
    if (!state.selectedBudgetId) return;
    const budget = state.budgets.find((item) => item.id === state.selectedBudgetId);
    if (!budget) return;
    await updateDoc(doc(db, "budgets", state.selectedBudgetId), { approved: !budget.approved, updatedAt: serverTimestamp() });
    showToast(budget.approved ? "Marcado como no aprobado." : "Marcado como aprobado.");
  });
  els.logoutBtn.addEventListener("click", async () => {
    state.sessionUser = null;
    state.selectedCustomerId = "";
    state.selectedBudgetId = "";
    clearRealtime();
    await signOut(auth);
  });
  els.themeLightBtn?.addEventListener("click", () => applyTheme("light"));
  els.themeDarkBtn?.addEventListener("click", () => applyTheme("dark"));
  bindFilters();
  syncSaleFormVisibility();
  syncCheckFields();
  syncBudgetClientMode();
}

function setupForms() {
  els.saleForm.addEventListener("submit", async (event) => { try { await saveSaleForm(event); } catch (error) { showToast(error.message, "error"); } });
  els.expenseForm.addEventListener("submit", async (event) => { try { await saveExpenseForm(event); } catch (error) { showToast(error.message, "error"); } });
  els.productForm.addEventListener("submit", async (event) => { try { await saveProductForm(event); } catch (error) { showToast(error.message, "error"); } });
  els.budgetForm.addEventListener("submit", async (event) => { try { await saveBudgetForm(event); } catch (error) { showToast(error.message, "error"); } });
  els.paymentForm?.addEventListener("submit", async (event) => { try { await savePaymentForm(event); } catch (error) { showToast(error.message, "error"); } });
  els.cashOpenForm?.addEventListener("submit", async (event) => { try { await saveCashOpenForm(event); } catch (error) { showToast(error.message, "error"); } });
  els.cashEntryForm?.addEventListener("submit", async (event) => { try { await saveCashEntryForm(event); } catch (error) { showToast(error.message, "error"); } });
  els.userForm?.addEventListener("submit", async (event) => { try { await saveUserForm(event); } catch (error) { showToast(error.message, "error"); } });
}

function attachRealtime() {
  clearRealtime();
  unsubscribers.push(onSnapshot(query(collection(db, "users"), orderBy("updatedAt", "desc")), (snap) => { state.users = snap.docs.map((item) => ({ id: item.id, ...item.data() })); renderEverything(); }));
  unsubscribers.push(onSnapshot(query(collection(db, "sales"), orderBy("createdAt", "desc")), (snap) => { state.sales = snap.docs.map((item) => ({ id: item.id, ...item.data() })); renderEverything(); }));
  unsubscribers.push(onSnapshot(query(collection(db, "expenses"), orderBy("createdAt", "desc")), (snap) => { state.expenses = snap.docs.map((item) => ({ id: item.id, ...item.data() })); renderEverything(); }));
  unsubscribers.push(onSnapshot(query(collection(db, "products"), orderBy("updatedAt", "desc")), (snap) => { state.products = snap.docs.map((item) => ({ id: item.id, ...item.data() })); renderEverything(); }));
  unsubscribers.push(onSnapshot(query(collection(db, "customers"), orderBy("updatedAt", "desc")), (snap) => { state.customers = snap.docs.map((item) => ({ id: item.id, ...item.data() })); renderEverything(); }));
  unsubscribers.push(onSnapshot(query(collection(db, "account_movements"), orderBy("createdAt", "desc")), (snap) => { state.accountMovements = snap.docs.map((item) => ({ id: item.id, ...item.data() })); renderEverything(); }));
  unsubscribers.push(onSnapshot(query(collection(db, "cash_movements"), orderBy("createdAt", "desc")), (snap) => { state.cashMovements = snap.docs.map((item) => ({ id: item.id, ...item.data() })); renderEverything(); }));
  unsubscribers.push(onSnapshot(query(collection(db, "budgets"), orderBy("createdAt", "desc")), (snap) => { state.budgets = snap.docs.map((item) => ({ id: item.id, ...item.data() })); if (!state.selectedBudgetId && state.budgets[0]) state.selectedBudgetId = state.budgets[0].id; renderEverything(); }));
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

// INICIALIZACIÓN
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
