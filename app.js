
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
  writeBatch
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
  messages: [],
  budgets: [],
  cashMovements: [],
  selectedCustomerId: "",
  selectedBudgetId: ""
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
  saleOperationType: document.getElementById("saleOperationType"),
  saleCashFields: document.getElementById("saleCashFields"),
  saleAccountFields: document.getElementById("saleAccountFields"),
  paymentMethod: document.getElementById("paymentMethod"),
  checkFields: document.getElementById("checkFields"),
  expenseCategory: document.getElementById("expenseCategory"),
  freightLabel: document.getElementById("freightLabel"),
  customerSearchInput: document.getElementById("customerSearchInput"),
  paymentCustomerId: document.getElementById("paymentCustomerId"),
  captureAccountBtn: document.getElementById("captureAccountBtn"),
  productCategorySelect: document.getElementById("productCategorySelect"),
  productSearchInput: document.getElementById("productSearchInput"),
  goCreateProductBtn: document.getElementById("goCreateProductBtn"),
  installBtn: document.getElementById("installBtn"),
  deleteAccountBtn: document.getElementById("deleteAccountBtn"),
  budgetItemsWrap: document.getElementById("budgetItemsWrap"),
  budgetSubtotal: document.getElementById("budgetSubtotal"),
  budgetTotal: document.getElementById("budgetTotal"),
  budgetPaymentTerms: document.getElementById("budgetPaymentTerms"),
  budgetCustomTermsWrap: document.getElementById("budgetCustomTermsWrap"),
  budgetsList: document.getElementById("budgetsList"),
  budgetSearchInput: document.getElementById("budgetSearchInput"),
  budgetSearchFrom: document.getElementById("budgetSearchFrom"),
  budgetSearchTo: document.getElementById("budgetSearchTo"),
  goCreateBudgetBtn: document.getElementById("goCreateBudgetBtn"),
  budgetPreviewCard: document.getElementById("budgetPreviewCard"),
  budgetDownloadPdfBtn: document.getElementById("budgetDownloadPdfBtn"),
  budgetDownloadPngBtn: document.getElementById("budgetDownloadPngBtn"),
  budgetShareBtn: document.getElementById("budgetShareBtn"),
  budgetConvertBtn: document.getElementById("budgetConvertBtn"),
  addBudgetStockItemBtn: document.getElementById("addBudgetStockItemBtn"),
  addBudgetManualItemBtn: document.getElementById("addBudgetManualItemBtn"),
  floatingNoticeBtn: document.getElementById("floatingNoticeBtn"),
  floatingNoticeCount: document.getElementById("floatingNoticeCount"),
  floatingNoticePanel: document.getElementById("floatingNoticePanel"),
  floatingNoticeList: document.getElementById("floatingNoticeList"),
  closeFloatingNoticeBtn: document.getElementById("closeFloatingNoticeBtn")
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


async function sha256(text) {
  const data = new TextEncoder().encode(String(text || ""));
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  return [...new Uint8Array(hashBuffer)].map((b) => b.toString(16).padStart(2, "0")).join("");
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
  unsubscribers.forEach((fn) => {
    try { fn(); } catch (_) {}
  });
  unsubscribers = [];
}

function showApp() {
  els.loginScreen.classList.add("hidden");
  els.appScreen.classList.remove("hidden");
}

function showLogin() {
  els.loginScreen.classList.remove("hidden");
  els.appScreen.classList.add("hidden");
  els.floatingNoticePanel?.classList.add("hidden");
}

function roleLabel(role) {
  return role === "administrador" ? "Administrador" : "Vendedor";
}

function isAdmin() {
  return state.sessionUser?.role === "administrador";
}

function getCustomerFullName(customer) {
  return [customer.firstName, customer.lastName].filter(Boolean).join(" ").trim() || "Cliente sin nombre";
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

function getSelectedBudget() {
  return state.budgets.find((item) => item.id === state.selectedBudgetId) || null;
}

function budgetItemsDraftFromDom() {
  if (!els.budgetItemsWrap) return [];
  return [...els.budgetItemsWrap.querySelectorAll(".budget-item-row")].map((row) => {
    const source = row.querySelector('[name="source"]')?.value || "manual";
    const stockId = row.querySelector('[name="stockId"]')?.value || "";
    const description = row.querySelector('[name="description"]')?.value || "";
    const quantity = Number(row.querySelector('[name="quantity"]')?.value || 0);
    const unitPrice = parseMoneyValue(row.querySelector('[name="unitPrice"]')?.value || 0);
    return { source, stockId, description, quantity, unitPrice, total: quantity * unitPrice };
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
    state.products.map((prod) => `<option value="${prod.id}">${prod.code || "-"} · ${prod.name}</option>`)
  ).join("");

  row.innerHTML = `
    <input type="hidden" name="source" value="${source}" />
    <label>
      <span>Producto de stock</span>
      <select name="stockId" class="budget-stock-select ${source === "stock" ? "" : "hidden"}">${options}</select>
    </label>
    <label class="budget-description-wrap">
      <span>Descripción</span>
      <input name="description" type="text" value="${item.description || ""}" placeholder="Detalle del producto o servicio" required />
    </label>
    <label>
      <span>Cantidad</span>
      <input name="quantity" type="number" min="0" step="1" value="${item.quantity || 1}" />
    </label>
    <label>
      <span>Precio unitario</span>
      <input name="unitPrice" type="text" inputmode="decimal" data-money="true" value="${formatMoneyInputValue(item.unitPrice || 0)}" />
      <small class="money-text" data-money-text-for="unitPrice">${moneyToWords(item.unitPrice || 0)}</small>
    </label>
    <button class="btn btn-secondary remove-budget-item-btn" type="button">Quitar</button>
  `;

  const stockSelect = row.querySelector('[name="stockId"]');
  const descriptionInput = row.querySelector('[name="description"]');
  stockSelect.value = item.stockId || "";

  if (source === "stock" && item.stockId) {
    const product = state.products.find((prod) => prod.id === item.stockId);
    if (product && !item.description) descriptionInput.value = product.name;
    if (product && !item.unitPrice) row.querySelector('[name="unitPrice"]').value = formatMoneyInputValue(product.cost || 0);
  }

  stockSelect?.addEventListener("change", () => {
    const product = state.products.find((prod) => prod.id === stockSelect.value);
    if (!product) return;
    descriptionInput.value = product.name || product.code || "";
    row.querySelector('[name="unitPrice"]').value = formatMoneyInputValue(product.cost || 0);
    updateBudgetTotals();
  });

  row.querySelectorAll('input, select').forEach((input) => input.addEventListener("input", updateBudgetTotals));
  row.querySelector(".remove-budget-item-btn").addEventListener("click", () => {
    row.remove();
    updateBudgetTotals();
  });

  els.budgetItemsWrap.appendChild(row);
  enhanceMoneyInputs(row);
  updateBudgetTotals();
}

function resetBudgetBuilder() {
  if (!els.budgetItemsWrap) return;
  els.budgetItemsWrap.innerHTML = "";
  createBudgetItemRow({ source: "manual", quantity: 1, unitPrice: 0 });
}

function budgetPaymentLabel(budget) {
  return budget.paymentTerms === "Personalizado" ? (budget.paymentTermsCustom || "Personalizado") : budget.paymentTerms;
}

async function downloadBudgetPng(budget = getSelectedBudget()) {
  if (!budget) throw new Error("Seleccioná un presupuesto.");
  const canvas = await window.html2canvas(els.budgetPreviewCard, { backgroundColor: "#ffffff", scale: 2 });
  return new Promise((resolve) => {
    canvas.toBlob((blob) => {
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.download = `presupuesto-${budget.number || budget.id}.png`;
      link.href = url;
      link.click();
      setTimeout(() => URL.revokeObjectURL(url), 1500);
      resolve(blob);
    }, "image/png");
  });
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

  const waText = encodeURIComponent(`${text}
Revisar imagen descargada y cargar venta en Mundo Led.`);
  window.open(`https://wa.me/?text=${waText}`, "_blank");
  const link = document.createElement("a");
  link.download = file.name;
  link.href = URL.createObjectURL(blob);
  link.click();
}

function downloadBudgetPdf(budget = getSelectedBudget()) {
  if (!budget) throw new Error("Seleccioná un presupuesto.");
  return window.html2canvas(els.budgetPreviewCard, { backgroundColor: "#ffffff", scale: 2 }).then((canvas) => {
    const { jsPDF } = window.jspdf;
    const pdf = new jsPDF("p", "mm", "a4");
    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();
    const margin = 10;
    const usableWidth = pageWidth - margin * 2;
    const imgHeight = canvas.height * usableWidth / canvas.width;
    const imgData = canvas.toDataURL("image/png");
    pdf.addImage(imgData, "PNG", margin, margin, usableWidth, Math.min(imgHeight, pageHeight - margin * 2));
    pdf.save(`presupuesto-${budget.number || budget.id}.pdf`);
  });
}

async function convertBudgetToSale(budget = getSelectedBudget()) {
  if (!budget) throw new Error("Seleccioná un presupuesto.");
  const amount = Number(budget.total || 0);
  if (amount <= 0) throw new Error("El presupuesto no tiene importe.");

  const salePayload = {
    date: todayISO(),
    amount,
    documentType: "Presupuesto convertido",
    documentNumber: budget.number || budget.id,
    operationType: budget.paymentTerms === "Cuenta corriente" ? "cuenta_corriente" : "contado",
    paymentMethod: budget.paymentTerms === "Transferencia" ? "transferencia" : budget.paymentTerms === "Efectivo" ? "efectivo" : budget.paymentTerms.toLowerCase().includes("cheque") ? "cheque" : "otro",
    details: `Generado desde presupuesto ${budget.number || budget.id}`,
    createdByName: state.sessionUser.name,
    createdByUsername: state.sessionUser.username,
    createdAt: serverTimestamp(),
    budgetId: budget.id,
    budgetNumber: budget.number || budget.id
  };

  if (salePayload.operationType === "cuenta_corriente") {
    const customerId = await saveCustomerForAccount({
      customerFirstName: budget.clientName,
      customerLastName: "",
      customerPhone: budget.clientPhone || ""
    });
    salePayload.customerId = customerId;
    salePayload.customerFirstName = budget.clientName;
    salePayload.customerLastName = "";
    salePayload.customerPhone = budget.clientPhone || "";

    await addDoc(collection(db, "account_movements"), {
      customerId,
      type: "cargo",
      amount,
      date: todayISO(),
      details: `Presupuesto ${budget.number || budget.id}`,
      createdAt: serverTimestamp()
    });
  }

  await addDoc(collection(db, "sales"), salePayload);
  await setDoc(doc(db, "budgets", budget.id), {
    convertedToSale: true,
    convertedAt: serverTimestamp(),
    convertedByName: state.sessionUser.name,
    convertedByUsername: state.sessionUser.username
  }, { merge: true });
}

async function deleteSelectedAccount() {
  if (!isAdmin()) throw new Error("Solo administración puede eliminar cuentas.");
  if (!state.selectedCustomerId) throw new Error("Seleccioná una cuenta.");
  const batch = writeBatch(db);
  batch.delete(doc(db, "customers", state.selectedCustomerId));
  state.accountMovements.filter((item) => item.customerId === state.selectedCustomerId).forEach((item) => {
    batch.delete(doc(db, "account_movements", item.id));
  });
  await batch.commit();
  state.selectedCustomerId = "";
}

function renderFloatingNotices() {
  const items = state.messages.slice(0, 12);
  if (!els.floatingNoticeBtn || !els.floatingNoticeList) return;
  els.floatingNoticeBtn.classList.toggle("hidden", !state.sessionUser);
  els.floatingNoticeCount.textContent = String(items.length);
  if (!items.length) { els.floatingNoticeList.innerHTML = '<div class="empty">No hay avisos activos.</div>'; return; }
  els.floatingNoticeList.innerHTML = items.map((msg) => `
    <div class="simple-item notice-row">
      <div>
        <strong>${msg.text}</strong>
        <div class="notice-meta">${msg.authorName || msg.authorUsername || "-"} · aviso activo</div>
      </div>
      ${isAdmin() ? `<button class="btn btn-danger delete-message-btn" data-id="${msg.id}" type="button">Eliminar</button>` : ""}
    </div>
  `).join("");
  document.querySelectorAll(".delete-message-btn").forEach((btn) => {
    btn.addEventListener("click", async () => {
      try { if (!confirm("¿Eliminar este aviso?")) return; await deleteDoc(doc(db, "messages", btn.dataset.id)); } catch (error) { alert(error.message || "No se pudo eliminar el aviso."); }
    });
  });
}

function renderBudgetPreview(budgetId = state.selectedBudgetId) {
  const budget = state.budgets.find((item) => item.id === budgetId);
  if (!budget) {
    els.budgetPreviewCard.innerHTML = '<div class="empty">Seleccioná un presupuesto para verlo y compartirlo.</div>';
    return;
  }
  state.selectedBudgetId = budget.id;
  const rows = (budget.items || []).map((item, index) => `
    <tr>
      <td>${index + 1}</td>
      <td>${escapeHtml(item.description || "-")}</td>
      <td>${item.quantity || 0}</td>
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
        </div>
      </div>

      <div class="budget-client-box">
        <strong>Cliente: ${escapeHtml(budget.clientName || "-")}</strong>
        <span>Celular: ${escapeHtml(budget.clientPhone || "-")}</span>
        <span>Email: ${escapeHtml(budget.clientEmail || "-")}</span>
        <span>Dirección: ${escapeHtml(budget.clientAddress || "-")}</span>
      </div>

      <table class="data-table budget-table">
        <thead>
          <tr><th>#</th><th>Detalle</th><th>Cant.</th><th>Unitario</th><th>Total</th></tr>
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

function renderTable(containerId, columns, rows, emptyText, deleteCollection = null) {
  const el = document.getElementById(containerId);
  if (!el) return;

  if (!rows.length) {
    el.innerHTML = `<div class="empty">${emptyText}</div>`;
    return;
  }

  el.innerHTML = `
    <table class="data-table">
      <thead>
        <tr>
          ${columns.map((col) => `<th>${col.label}</th>`).join("")}
          ${isAdmin() && deleteCollection ? "<th>Acción</th>" : ""}
        </tr>
      </thead>
      <tbody>
        ${rows.map((row) => `
          <tr>
            ${columns.map((col) => `<td>${row[col.key] ?? ""}</td>`).join("")}
            ${isAdmin() && deleteCollection ? `<td><button class="btn btn-secondary delete-btn" data-collection="${deleteCollection}" data-id="${row.id}" type="button">Eliminar</button></td>` : ""}
          </tr>
        `).join("")}
      </tbody>
    </table>
  `;

  el.querySelectorAll(".delete-btn").forEach((btn) => {
    btn.addEventListener("click", async () => {
      if (!confirm("¿Eliminar este registro?")) return;
      await deleteDoc(doc(db, btn.dataset.collection, btn.dataset.id));
    });
  });
}

function renderSimpleList(containerId, items, builder, emptyText) {
  const el = document.getElementById(containerId);
  if (!el) return;

  if (!items.length) {
    el.innerHTML = `<div class="empty">${emptyText}</div>`;
    return;
  }

  el.innerHTML = items.map(builder).join("");
}

function fillCategoriesSelect() {
  const select = els.productCategorySelect;
  if (!select) return;

  const categories = state.categories.length
    ? state.categories.sort((a, b) => (a.name || "").localeCompare(b.name || ""))
    : [{ name: "General" }];

  select.innerHTML = categories.map((cat) => `<option value="${cat.name}">${cat.name}</option>`).join("");
}

function applyRoleUI() {
  document.getElementById("userRoleText").textContent = `Rol: ${roleLabel(state.sessionUser.role)}`;
  document.getElementById("sessionUserText").textContent = state.sessionUser.name || state.sessionUser.username;

  document.querySelectorAll(".admin-only-nav").forEach((el) => {
    el.classList.toggle("hidden", !isAdmin());
  });
  document.querySelectorAll(".admin-only-block").forEach((el) => {
    el.classList.toggle("hidden", !isAdmin());
  });

  const hideByRole = {
    vendedor: ["inicio", "usuarios"]
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

function syncSaleFormVisibility() {
  const accountMode = els.saleOperationType.value === "cuenta_corriente";
  els.saleCashFields.classList.toggle("hidden", accountMode);
  els.saleAccountFields.classList.toggle("hidden", !accountMode);
}

function syncCheckFields() {
  const isCheck = els.paymentMethod.value === "cheque";
  els.checkFields.classList.toggle("hidden", !isCheck);
}

function syncExpenseVisibility() {
  els.freightLabel.classList.toggle("hidden", els.expenseCategory.value !== "Fletes");
}


function normalizeMedium(value) { const raw = String(value || "").toLowerCase().trim(); if (raw === "cheque" || raw === "check") return "cheque"; if (["efectivo", "cash"].includes(raw)) return "efectivo"; return "otro"; }
function startOfMonthISO(date = todayISO()) { return `${String(date).slice(0, 7)}-01`; }
function addToBreakdown(target, medium, amount) { const key = normalizeMedium(medium); target[key] = Number(target[key] || 0) + Number(amount || 0); }
function sumBreakdown(target) { return Number(target.efectivo || 0) + Number(target.cheque || 0) + Number(target.otro || 0); }
function formatBreakdownText(breakdown) { return `Efectivo ${currency(breakdown.efectivo || 0)} · Cheques ${currency(breakdown.cheque || 0)} · Otros ${currency(breakdown.otro || 0)}`; }
function currentCajaBreakdown() { const breakdown = { efectivo: 0, cheque: 0, otro: 0 }; state.cashMovements.forEach((item) => { if (item.kind === "apertura") { breakdown.efectivo += Number(item.cashAmount || 0); breakdown.cheque += Number(item.checkAmount || 0); breakdown.otro += Number(item.otherAmount || 0); } else if (item.kind === "ingreso_manual") { addToBreakdown(breakdown, item.medium, item.amount || 0); } }); state.sales.forEach((sale) => { if (sale.operationType === "contado") addToBreakdown(breakdown, sale.paymentMethod, sale.amount || 0); }); state.accountMovements.forEach((movement) => { if (movement.type === "cobro") addToBreakdown(breakdown, movement.paymentMethod, movement.amount || 0); }); state.expenses.forEach((expense) => { breakdown.efectivo -= Number(expense.amount || 0); }); return breakdown; }
function buildSalesBreakdown(items) { return items.reduce((acc, sale) => { addToBreakdown(acc, sale.paymentMethod, sale.amount || 0); return acc; }, { efectivo: 0, cheque: 0, otro: 0 }); }
function renderMiniStats(targetId, cards = []) { const node = document.getElementById(targetId); if (!node) return; if (!cards.length) { node.innerHTML = '<div class="empty">Todavía no hay datos suficientes.</div>'; return; } node.innerHTML = cards.map((card) => `<div class="mini-stat"><span>${card.label}</span><strong>${card.value}</strong></div>`).join(""); }
function renderBarChart(targetId, rows = [], monthMode = false) { const node = document.getElementById(targetId); if (!node) return; if (!rows.length) { node.innerHTML = '<div class="empty">Todavía no hay ventas para graficar.</div>'; return; } const max = Math.max(...rows.map((row) => Number(row.amount || 0)), 1); node.innerHTML = rows.map((row) => { const width = Math.max(6, (Number(row.amount || 0) / max) * 100); return `<div class="chart-row ${monthMode ? "month" : ""}"><div class="chart-label">${row.label}</div><div class="chart-track"><div class="chart-fill" style="width:${width}%"></div></div><div class="chart-value">${currency(row.amount || 0)}</div></div>`; }).join(""); }

function renderAccountDetail(customerId) {
  const card = document.getElementById("accountDetailCard");
  const customer = state.customers.find((item) => item.id === customerId);

  if (!customer) {
    card.innerHTML = `<div class="empty">Seleccioná un cliente para ver los movimientos.</div>`;
    els.paymentCustomerId.value = "";
    return;
  }

  const movements = accountMovementsForCustomer(customerId);
  const balance = accountBalance(customerId);
  els.paymentCustomerId.value = customerId;

  card.innerHTML = `
    <div class="account-header">
      <div>
        <strong>${getCustomerFullName(customer)}</strong>
        <div class="muted">Celular: ${customer.phone || "-"}</div>
      </div>
      <div class="account-balance">${currency(balance)}</div>
    </div>

    <div class="simple-list">
      ${movements.length ? movements.map((item) => `
        <div class="simple-item">
          <strong>${item.type === "cobro" ? "Cobro" : "Cargo"} · ${currency(item.amount)}</strong>
          <span>${item.date || "-"}</span>
          <div class="muted">${item.details || ""}</div>
        </div>
      `).join("") : `<div class="empty">No hay movimientos para este cliente.</div>`}
    </div>
  `;
}

function renderEverything() {
  fillCategoriesSelect();

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
  monthSalesItems.forEach((sale) => { const day = Number(String(sale.date || "").slice(8, 10) || 0); const weekNumber = Math.min(5, Math.max(1, Math.ceil(day / 7))); monthlyBuckets[weekNumber] = Number(monthlyBuckets[weekNumber] || 0) + Number(sale.amount || 0); });
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
  renderMiniStats("weekSummaryCards", [{ label: "Total semana", value: currency(weekTotal) }, { label: "Mejor día", value: `${bestWeekDay.label} · ${currency(bestWeekDay.amount)}` }, { label: "Días con ventas", value: String(weekDays.filter((row) => row.amount > 0).length) }]);
  renderMiniStats("monthSummaryCards", [{ label: "Total del mes", value: currency(allSalesTotal) }, { label: "Mejor semana", value: `${bestMonthWeek.label} · ${currency(bestMonthWeek.amount)}` }, { label: "Ticket promedio", value: currency(monthTicket) }]);
  renderBarChart("weekSalesChart", weekDays, false);
  renderBarChart("monthSalesChart", monthRows, true);
  renderMiniStats("cashStatusCards", [{ label: "Caja total", value: currency(cash) }, { label: "Efectivo", value: currency(cajaBreakdown.efectivo || 0) }, { label: "Cheques", value: currency(cajaBreakdown.cheque || 0) }]);

  renderSimpleList(
    "messagesList",
    state.messages.slice(0, 10),
    (msg) => `
      <div class="simple-item notice-row">
        <div>
          <strong>${msg.text}</strong>
          <div class="notice-meta">${msg.authorName || msg.authorUsername || "-"}</div>
        </div>
        ${isAdmin() ? `<button class="btn btn-danger delete-message-btn" data-id="${msg.id}" type="button">Eliminar</button>` : ""}
      </div>
    `,
    "No hay mensajes rápidos."
  );

  document.querySelectorAll(".delete-message-btn").forEach((btn) => {
    btn.addEventListener("click", async () => {
      try { if (!confirm("¿Eliminar este aviso?")) return; await deleteDoc(doc(db, "messages", btn.dataset.id)); } catch (error) { alert(error.message || "No se pudo eliminar el aviso."); }
    });
  });

  renderSimpleList(
    "overdueList",
    overdueCustomers.slice(0, 20),
    (customer) => `
      <div class="simple-item">
        <strong>${getCustomerFullName(customer)}</strong>
        <span>${currency(customer.balance)}</span>
        <div class="muted">${customer.phone || ""}</div>
      </div>
    `,
    "No hay clientes morosos."
  );

  renderTable(
    "salesTableWrap",
    [
      { key: "date", label: "Fecha" },
      { key: "documentType", label: "Comprobante" },
      { key: "documentNumber", label: "Número" },
      { key: "operationBadge", label: "Tipo" },
      { key: "displayAmount", label: "Monto" }
    ],
    state.sales.map((sale) => ({
      ...sale,
      displayAmount: currency(sale.amount),
      operationBadge: sale.operationType === "cuenta_corriente" ? `<span class="tag">Cuenta corriente</span>` : `<span class="tag">Contado</span>`
    })),
    "No hay ventas registradas.",
    "sales"
  );

  renderTable(
    "expensesTableWrap",
    [
      { key: "date", label: "Fecha" },
      { key: "category", label: "Categoría" },
      { key: "displayAmount", label: "Monto" },
      { key: "extraInfo", label: "Detalle" }
    ],
    state.expenses.map((exp) => ({
      ...exp,
      displayAmount: currency(exp.amount),
      extraInfo: exp.category === "Fletes" ? (exp.freightData || exp.details || "-") : (exp.details || "-")
    })),
    "No hay gastos registrados.",
    "expenses"
  );

  const lowStock = state.products
    .slice()
    .sort((a, b) => (Number(a.currentStock || 0) - Number(a.minStock || 0)) - (Number(b.currentStock || 0) - Number(b.minStock || 0)))
    .filter((item) => Number(item.currentStock || 0) <= Number(item.minStock || 0));

  renderSimpleList(
    "stockRankingList",
    lowStock,
    (item) => `
      <div class="simple-item">
        <strong>${item.name}</strong>
        <span>${item.category || "General"}</span>
        <div class="muted">Actual: ${item.currentStock} · Mínimo: ${item.minStock}</div>
      </div>
    `,
    "No hay productos con stock bajo."
  );

  const productFilter = (els.productSearchInput?.value || "").trim().toLowerCase();
  const filteredProducts = state.products.filter((item) => {
    const text = `${item.code || ""} ${item.name || ""} ${item.category || ""}`.toLowerCase();
    return !productFilter || text.includes(productFilter);
  });

  renderTable(
    "productsTableWrap",
    [
      { key: "code", label: "Código" },
      { key: "name", label: "Producto" },
      { key: "category", label: "Categoría" },
      { key: "currentStock", label: "Actual" },
      { key: "minStock", label: "Mínimo" },
      { key: "displayCost", label: "Costo" }
    ],
    filteredProducts.map((item) => ({
      ...item,
      displayCost: currency(item.cost)
    })),
    "No hay productos cargados.",
    "products"
  );

  const filter = (els.customerSearchInput.value || "").trim().toLowerCase();
  const filteredCustomers = state.customers.filter((customer) => {
    const text = `${getCustomerFullName(customer)} ${customer.phone || ""}`.toLowerCase();
    return !filter || text.includes(filter);
  });

  renderSimpleList(
    "customersList",
    filteredCustomers,
    (customer) => `
      <button class="simple-item customer-btn" data-id="${customer.id}" type="button">
        <strong>${getCustomerFullName(customer)}</strong>
        <span>${currency(accountBalance(customer.id))}</span>
        <div class="muted">${customer.phone || ""}</div>
      </button>
    `,
    "No hay clientes con cuenta corriente."
  );

  document.querySelectorAll(".customer-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      state.selectedCustomerId = btn.dataset.id;
      renderAccountDetail(btn.dataset.id);
    });
  });

  renderAccountDetail(state.selectedCustomerId);

  renderSimpleList(
    "cashMovementsList",
    state.cashMovements.slice(0, 30),
    (item) => `
      <div class="simple-item">
        <div class="cash-kind-badge">${item.kind === "apertura" ? "Apertura" : "Ingreso manual"}</div>
        <strong>${item.kind === "apertura" ? `${currency((item.cashAmount || 0) + (item.checkAmount || 0) + (item.otherAmount || 0))}` : currency(item.amount || 0)}</strong>
        <span>${item.date || "-"}</span>
        <div class="muted">${item.kind === "apertura" ? `Efectivo ${currency(item.cashAmount || 0)} · Cheques ${currency(item.checkAmount || 0)} · Otros ${currency(item.otherAmount || 0)}` : `${String(item.medium || "otro")} · ${item.details || ""}`}</div>
      </div>
    `,
    "Todavía no registraste apertura o ingresos manuales."
  );

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

  renderSimpleList(
    "budgetsList",
    filteredBudgets,
    (budget) => `
      <div class="simple-item budget-row ${state.selectedBudgetId === budget.id ? "active" : ""}">
        <button class="budget-btn-main" data-id="${budget.id}" type="button">
          <strong>${escapeHtml(budget.number || budget.id)} · ${escapeHtml(budget.clientName || "Cliente")}</strong>
          <span>${currency(budget.total)}</span>
          <div class="muted">${escapeHtml(budgetPaymentLabel(budget))}${budget.convertedToSale ? " · Convertido en venta" : ""}</div>
          <div class="muted">Fecha: ${escapeHtml(budget.date || "-")}</div>
        </button>
        <div class="budget-row-actions">
          <button class="btn btn-danger delete-budget-btn" data-id="${budget.id}" type="button">Eliminar</button>
        </div>
      </div>
    `,
    "No hay presupuestos guardados."
  );

  document.querySelectorAll(".budget-btn-main").forEach((btn) => {
    btn.addEventListener("click", () => renderBudgetPreview(btn.dataset.id));
  });

  document.querySelectorAll(".delete-budget-btn").forEach((btn) => {
    btn.addEventListener("click", async () => {
      try {
        if (!confirm("¿Eliminar este presupuesto?")) return;
        await deleteDoc(doc(db, "budgets", btn.dataset.id));
        if (state.selectedBudgetId === btn.dataset.id) {
          state.selectedBudgetId = "";
          renderBudgetPreview("");
        }
      } catch (error) {
        alert(error.message || "No se pudo eliminar el presupuesto.");
      }
    });
  });

  renderBudgetPreview(state.selectedBudgetId);
  renderFloatingNotices();

  renderTable(
    "usersTableWrap",
    [
      { key: "name", label: "Nombre" },
      { key: "username", label: "Usuario" },
      { key: "roleLabel", label: "Rol" }
    ],
    state.users.map((user) => ({
      ...user,
      roleLabel: roleLabel(user.role)
    })),
    "No hay usuarios cargados.",
    "users"
  );
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
  const snap = await getDocs(
    query(
      collection(db, "users"),
      where("username", "==", username.trim().toLowerCase()),
      where("passwordHash", "==", passwordHash),
      where("role", "==", role)
    )
  );
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
  if (!cleanUsername || !password) {
    throw new Error("Completá usuario y contraseña.");
  }

  if (state.loginMode === "administrador") {
    const adminCount = await countAdminUsers();
    if (adminCount === 0) {
      return await createFirstAdmin(cleanUsername, password);
    }
    const user = await findUserByCredentials(cleanUsername, password, "administrador");
    if (!user) throw new Error("Usuario o contraseña de administración incorrectos.");
    return user;
  }

  const vendor = await findUserByCredentials(cleanUsername, password, "vendedor");
  if (!vendor) throw new Error("Usuario o contraseña de vendedor incorrectos.");
  return vendor;
}

async function saveCustomerForAccount(data) {
  const key = sanitizeId(`${data.customerFirstName}_${data.customerLastName}_${data.customerPhone}`);
  const payload = {
    firstName: data.customerFirstName || "",
    lastName: data.customerLastName || "",
    phone: data.customerPhone || "",
    updatedAt: serverTimestamp()
  };
  await setDoc(doc(db, "customers", key), payload, { merge: true });
  return key;
}

function bindForm(id, handler, msgId) {
  const form = document.getElementById(id);
  if (!form) return;

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const msg = document.getElementById(msgId);
    if (msg) msg.textContent = "Guardando...";

    const formData = new FormData(form);
    const data = Object.fromEntries(formData.entries());

    try {
      await handler(data, formData);
      form.reset();
      if (form.date) form.date.value = todayISO();
      syncSaleFormVisibility();
      syncCheckFields();
      syncExpenseVisibility();
      enhanceMoneyInputs(form);
      if (msg) msg.textContent = "Guardado correctamente.";
    } catch (error) {
      console.error(error);
      if (msg) msg.textContent = error.message || "No se pudo guardar.";
    }
  });
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
    onSnapshot(query(collection(db, "messages"), orderBy("createdAt", "desc")), (snap) => {
      state.messages = snap.docs.map((item) => ({ id: item.id, ...item.data() }));
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
        ventas: ["Ventas", "Carga rápida de comprobantes"],
        gastos: ["Gastos", "Registro de egresos del negocio"],
        caja: ["Caja", "Apertura, ingresos manuales y control actual"],
        stock: ["Stock", "Productos, categorías y alertas"],
        cuentas: ["Cuentas corrientes", "Clientes, cobros y saldos"],
        presupuestos: ["Presupuestos", "Presupuestos express y conversión en venta"],
        usuarios: ["Usuarios", "Acceso de administración y vendedores"]
      };

      els.viewTitle.textContent = titles[view]?.[0] || "Panel";
      els.viewSubtitle.textContent = titles[view]?.[1] || "";
    });
  });
}


function setupInstallPrompt() {
  const isStandalone = window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone;
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

function setupUiEvents() {
  els.tabAdmin.addEventListener("click", () => setMode("administrador"));
  els.tabVendor.addEventListener("click", () => setMode("vendedor"));

  els.saleOperationType.addEventListener("change", syncSaleFormVisibility);
  els.paymentMethod.addEventListener("change", syncCheckFields);
  els.expenseCategory.addEventListener("change", syncExpenseVisibility);
  els.customerSearchInput.addEventListener("input", renderEverything);
  els.productSearchInput?.addEventListener("input", renderEverything);
  els.budgetSearchInput?.addEventListener("input", renderEverything);
  els.budgetSearchFrom?.addEventListener("change", renderEverything);
  els.budgetSearchTo?.addEventListener("change", renderEverything);
  els.goCreateBudgetBtn?.addEventListener("click", () => {
    document.getElementById("budgetForm")?.scrollIntoView({ behavior: "smooth", block: "start" });
  });
  els.goCreateProductBtn?.addEventListener("click", () => {
    document.getElementById("productForm")?.scrollIntoView({ behavior: "smooth", block: "start" });
    document.querySelector('#productForm [name="code"]')?.focus();
  });
  els.budgetPaymentTerms?.addEventListener("change", () => {
    els.budgetCustomTermsWrap.classList.toggle("hidden", els.budgetPaymentTerms.value !== "Personalizado");
  });

  els.addBudgetStockItemBtn?.addEventListener("click", () => createBudgetItemRow({ source: "stock", quantity: 1, unitPrice: 0 }));
  els.addBudgetManualItemBtn?.addEventListener("click", () => createBudgetItemRow({ source: "manual", quantity: 1, unitPrice: 0 }));

  els.budgetDownloadPdfBtn?.addEventListener("click", async () => {
    try { await downloadBudgetPdf(); } catch (error) { alert(error.message || "No se pudo generar el PDF."); }
  });

  els.budgetDownloadPngBtn?.addEventListener("click", async () => {
    try { await downloadBudgetPng(); } catch (error) { alert(error.message || "No se pudo generar la imagen."); }
  });

  els.budgetShareBtn?.addEventListener("click", async () => {
    try { await shareBudget(); } catch (error) { alert(error.message || "No se pudo compartir."); }
  });

  els.budgetConvertBtn?.addEventListener("click", async () => {
    try {
      await convertBudgetToSale();
      alert("Presupuesto convertido en venta correctamente.");
    } catch (error) {
      alert(error.message || "No se pudo convertir el presupuesto.");
    }
  });

  els.floatingNoticeBtn?.addEventListener("click", () => {
    els.floatingNoticePanel.classList.toggle("hidden");
  });
  els.closeFloatingNoticeBtn?.addEventListener("click", () => {
    els.floatingNoticePanel.classList.add("hidden");
  });

  els.captureAccountBtn.addEventListener("click", async () => {
    const card = document.getElementById("accountDetailCard");
    if (!card || card.querySelector(".empty")) {
      alert("Seleccioná una cuenta primero.");
      return;
    }

    const canvas = await window.html2canvas(card, {
      backgroundColor: "#ffffff",
      scale: 2
    });

    const link = document.createElement("a");
    link.download = "cuenta-corriente.png";
    link.href = canvas.toDataURL("image/png");
    link.click();
  });

  els.deleteAccountBtn?.addEventListener("click", async () => {
    try {
      if (!confirm("¿Eliminar esta cuenta corriente y todos sus movimientos?")) return;
      await deleteSelectedAccount();
    } catch (error) {
      alert(error.message || "No se pudo eliminar la cuenta.");
    }
  });

  els.logoutBtn.addEventListener("click", async () => {
    state.sessionUser = null;
    state.selectedCustomerId = "";
    state.selectedBudgetId = "";
    clearRealtime();
    await signOut(auth);
  });

  syncSaleFormVisibility();
  syncCheckFields();
  syncExpenseVisibility();
  enhanceMoneyInputs(document);
}

function setupForms() {
  bindForm("quickMessageForm", async (data) => {
    if (!isAdmin()) throw new Error("Solo administración puede publicar mensajes.");
    await addDoc(collection(db, "messages"), {
      text: data.text,
      authorName: state.sessionUser.name,
      authorUsername: state.sessionUser.username,
      createdAt: serverTimestamp()
    });
  }, null);

  bindForm("cashOpenForm", async (data) => {
    if (!isAdmin()) throw new Error("Solo administración puede abrir caja.");
    const cashAmount = parseMoneyValue(data.cashAmount || 0);
    const checkAmount = parseMoneyValue(data.checkAmount || 0);
    const otherAmount = parseMoneyValue(data.otherAmount || 0);
    if ((cashAmount + checkAmount + otherAmount) <= 0) throw new Error("Cargá algún importe para la apertura.");
    await addDoc(collection(db, "cash_movements"), { kind: "apertura", date: data.date, cashAmount, checkAmount, otherAmount, details: data.details || "", authorName: state.sessionUser.name, authorUsername: state.sessionUser.username, createdAt: serverTimestamp() });
  }, "cashMsg");

  bindForm("cashEntryForm", async (data) => {
    if (!isAdmin()) throw new Error("Solo administración puede agregar ingresos de caja.");
    const amount = parseMoneyValue(data.amount || 0);
    if (amount <= 0) throw new Error("El monto debe ser mayor a cero.");
    await addDoc(collection(db, "cash_movements"), { kind: "ingreso_manual", date: data.date, amount, medium: data.medium || "efectivo", details: data.details || "", authorName: state.sessionUser.name, authorUsername: state.sessionUser.username, createdAt: serverTimestamp() });
  }, "cashMsg");

  bindForm("saleForm", async (data, formData) => {
    const amount = parseMoneyValue(data.amount || 0);
    if (amount <= 0) throw new Error("El monto debe ser mayor a cero.");

    const payload = {
      date: data.date,
      amount,
      documentType: data.documentType,
      documentNumber: data.documentNumber,
      operationType: data.operationType,
      createdByName: state.sessionUser.name,
      createdByUsername: state.sessionUser.username,
      createdAt: serverTimestamp()
    };

    if (data.operationType === "contado") {
      payload.paymentMethod = data.paymentMethod || "efectivo";
      payload.details = data.details || "";
      if (data.paymentMethod === "cheque") {
        payload.checkBank = data.checkBank || "";
        payload.checkNumber = data.checkNumber || "";
        payload.checkHolder = data.checkHolder || "";
        payload.checkDueDate = data.checkDueDate || "";
        payload.checkFrontName = formData.get("checkFront")?.name || "";
        payload.checkBackName = formData.get("checkBack")?.name || "";
      }
    } else {
      payload.customerFirstName = data.customerFirstName || "";
      payload.customerLastName = data.customerLastName || "";
      payload.customerPhone = data.customerPhone || "";

      if (!payload.customerFirstName || !payload.customerLastName) {
        throw new Error("En cuenta corriente completá nombre y apellido.");
      }

      const customerId = await saveCustomerForAccount(data);
      payload.customerId = customerId;
      await addDoc(collection(db, "account_movements"), {
        customerId,
        type: "cargo",
        amount,
        date: data.date,
        details: `${data.documentType} ${data.documentNumber}`,
        createdAt: serverTimestamp()
      });
    }

    await addDoc(collection(db, "sales"), payload);
  }, "saleMsg");

  bindForm("expenseForm", async (data) => {
    const amount = parseMoneyValue(data.amount || 0);
    if (amount <= 0) throw new Error("El monto debe ser mayor a cero.");

    await addDoc(collection(db, "expenses"), {
      date: data.date,
      amount,
      category: data.category,
      details: data.details || "",
      freightData: data.category === "Fletes" ? (data.freightData || "") : "",
      createdByName: state.sessionUser.name,
      createdByUsername: state.sessionUser.username,
      createdAt: serverTimestamp()
    });
  }, "expenseMsg");

  bindForm("productForm", async (data) => {
    const id = sanitizeId(data.code);
    await setDoc(doc(db, "products", id), {
      code: data.code,
      name: data.name,
      category: data.category || "General",
      currentStock: Number(data.currentStock || 0),
      minStock: Number(data.minStock || 0),
      cost: parseMoneyValue(data.cost || 0),
      updatedAt: serverTimestamp()
    }, { merge: true });
  }, "productMsg");

  bindForm("categoryForm", async (data) => {
    if (!isAdmin()) throw new Error("Solo administración puede agregar categorías.");
    const id = sanitizeId(data.name);
    await setDoc(doc(db, "categories", id), {
      name: data.name,
      updatedAt: serverTimestamp()
    }, { merge: true });
  }, "categoryMsg");

  bindForm("budgetForm", async (data) => {
    const items = budgetItemsDraftFromDom().map((item) => ({
      ...item,
      quantity: Number(item.quantity || 0),
      unitPrice: parseMoneyValue(item.unitPrice || 0),
      total: Number(item.total || 0)
    })).filter((item) => item.description && item.quantity > 0);

    if (!items.length) throw new Error("Agregá al menos un ítem al presupuesto.");

    const total = items.reduce((sum, item) => sum + item.total, 0);
    const number = `P-${new Date().getFullYear()}-${String(Date.now()).slice(-6)}`;

    await addDoc(collection(db, "budgets"), {
      number,
      date: data.date,
      validUntil: data.validUntil || "",
      clientName: data.clientName,
      clientPhone: data.clientPhone || "",
      clientEmail: data.clientEmail || "",
      clientAddress: data.clientAddress || "",
      paymentTerms: data.paymentTerms,
      paymentTermsCustom: data.paymentTermsCustom || "",
      notes: data.notes || "",
      items,
      total,
      createdByName: state.sessionUser.name,
      createdByUsername: state.sessionUser.username,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
      convertedToSale: false
    });

    resetBudgetBuilder();
    updateBudgetTotals();
  }, "budgetMsg");

  bindForm("paymentForm", async (data) => {
    const amount = parseMoneyValue(data.amount || 0);
    if (!data.customerId) throw new Error("Seleccioná un cliente.");
    if (amount <= 0) throw new Error("El monto debe ser mayor a cero.");

    const balance = accountBalance(data.customerId);
    const finalAmount = data.paymentKind === "total" ? balance : amount;

    if (finalAmount <= 0) throw new Error("No hay saldo pendiente.");
    if (finalAmount > balance) throw new Error("El cobro supera el saldo actual.");

    await addDoc(collection(db, "account_movements"), {
      customerId: data.customerId,
      type: "cobro",
      amount: finalAmount,
      date: data.date,
      details: data.details || "Cobro de cuenta corriente",
      createdAt: serverTimestamp()
    });
  }, "paymentMsg");

  bindForm("userForm", async (data) => {
    if (!isAdmin()) throw new Error("Solo administración puede cargar usuarios.");

    const username = data.username.trim().toLowerCase();
    if (!username) throw new Error("Completá el usuario.");

    const userId = sanitizeId(username);
    const passwordHash = await sha256(data.password);

    await setDoc(doc(db, "users", userId), {
      name: data.name,
      username,
      passwordHash,
      role: data.role,
      updatedAt: serverTimestamp(),
      createdAt: serverTimestamp()
    }, { merge: true });
  }, "userMsg");
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
    if (!user) {
      showLogin();
    }
  });
}

setMode("administrador");
setDefaultDates();
setupNavigation();
setupUiEvents();
setupForms();
resetBudgetBuilder();
setupInstallPrompt();
initLoginFlow();
