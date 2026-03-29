import { auth, db } from "./firebase-config.js";
import { signInAnonymously } from "https://www.gstatic.com/firebasejs/12.11.0/firebase-auth.js";
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
} from "https://www.gstatic.com/firebasejs/12.11.0/firebase-firestore.js";

const state = {
  sales: [],
  expenses: [],
  cashSessions: [],
  editingSaleId: "",
  editingExpenseId: "",
};

const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => [...document.querySelectorAll(selector)];

const elements = {
  syncStatus: $("#syncStatus"),
  todayLabel: $("#todayLabel"),
  salesForm: $("#salesForm"),
  expensesForm: $("#expensesForm"),
  cashOpenForm: $("#cashOpenForm"),
  salesMsg: $("#salesMsg"),
  expensesMsg: $("#expensesMsg"),
  cashMsg: $("#cashMsg"),
  salesFormTitle: $("#salesFormTitle"),
  expensesFormTitle: $("#expensesFormTitle"),
  salesSubmitBtn: $("#salesSubmitBtn"),
  expensesSubmitBtn: $("#expensesSubmitBtn"),
  cancelSalesEditBtn: $("#cancelSalesEditBtn"),
  cancelExpensesEditBtn: $("#cancelExpensesEditBtn"),
  salesList: $("#salesList"),
  expensesList: $("#expensesList"),
  recentSales: $("#recentSales"),
  recentExpenses: $("#recentExpenses"),
  salesCountNote: $("#salesCountNote"),
  expensesCountNote: $("#expensesCountNote"),
  statCajaTotal: $("#statCajaTotal"),
  statCajaDetalle: $("#statCajaDetalle"),
  statVentasDia: $("#statVentasDia"),
  statVentasDiaDetalle: $("#statVentasDiaDetalle"),
  statVentasSemana: $("#statVentasSemana"),
  statVentasSemanaDetalle: $("#statVentasSemanaDetalle"),
  statVentasMes: $("#statVentasMes"),
  statVentasMesDetalle: $("#statVentasMesDetalle"),
  cajaEfectivo: $("#cajaEfectivo"),
  cajaCheques: $("#cajaCheques"),
  cajaTransferencias: $("#cajaTransferencias"),
  activeCajaCard: $("#activeCajaCard"),
  cajaHistoryList: $("#cajaHistoryList"),
  closeCajaBtn: $("#closeCajaBtn"),
  closeCajaNote: $("#closeCajaNote"),
};

const currency = (value) => new Intl.NumberFormat("es-AR", {
  style: "currency",
  currency: "ARS",
  minimumFractionDigits: Number(value || 0) % 1 ? 2 : 0,
  maximumFractionDigits: 2,
}).format(Number(value || 0));

const nowISO = () => {
  const now = new Date();
  const tzOffset = now.getTimezoneOffset() * 60000;
  return new Date(now - tzOffset).toISOString().slice(0, 10);
};

const todayDate = () => new Date(`${nowISO()}T00:00:00`);
const startOfWeek = () => {
  const date = todayDate();
  const day = date.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  date.setDate(date.getDate() + diff);
  return date;
};
const startOfMonth = () => new Date(todayDate().getFullYear(), todayDate().getMonth(), 1);
const toDate = (value) => new Date(`${value}T00:00:00`);

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function normalizeMoneyInput(raw) {
  const value = String(raw || "").trim();
  if (!value) return 0;
  let normalized = value.replace(/\s+/g, "");
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
  const number = Number(normalized);
  return Number.isFinite(number) ? number : 0;
}

function formatMoneyInput(value) {
  return new Intl.NumberFormat("es-AR", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(Number(value || 0));
}

function wordsUnder100(n) {
  const units = ["cero", "uno", "dos", "tres", "cuatro", "cinco", "seis", "siete", "ocho", "nueve"];
  const teens = { 10: "diez", 11: "once", 12: "doce", 13: "trece", 14: "catorce", 15: "quince", 16: "dieciséis", 17: "diecisiete", 18: "dieciocho", 19: "diecinueve" };
  const tens = { 20: "veinte", 30: "treinta", 40: "cuarenta", 50: "cincuenta", 60: "sesenta", 70: "setenta", 80: "ochenta", 90: "noventa" };
  if (n < 10) return units[n];
  if (teens[n]) return teens[n];
  if (n < 30) return n === 20 ? "veinte" : `veinti${units[n - 20]}`;
  const ten = Math.floor(n / 10) * 10;
  const unit = n % 10;
  return unit ? `${tens[ten]} y ${units[unit]}` : tens[ten];
}

function wordsUnder1000(n) {
  const hundreds = { 100: "cien", 200: "doscientos", 300: "trescientos", 400: "cuatrocientos", 500: "quinientos", 600: "seiscientos", 700: "setecientos", 800: "ochocientos", 900: "novecientos" };
  if (n < 100) return wordsUnder100(n);
  if (hundreds[n]) return hundreds[n];
  const hundred = Math.floor(n / 100) * 100;
  const rest = n % 100;
  const prefix = n < 200 ? "ciento" : hundreds[hundred];
  return `${prefix} ${wordsUnder100(rest)}`;
}

function numberToWords(n) {
  const num = Math.floor(Number(n || 0));
  if (num === 0) return "cero";
  if (num < 1000) return wordsUnder1000(num);
  if (num < 1000000) {
    const thousands = Math.floor(num / 1000);
    const rest = num % 1000;
    const thousandText = thousands === 1 ? "mil" : `${wordsUnder1000(thousands)} mil`;
    return `${thousandText}${rest ? ` ${wordsUnder1000(rest)}` : ""}`;
  }
  if (num < 1000000000) {
    const millions = Math.floor(num / 1000000);
    const rest = num % 1000000;
    const millionText = millions === 1 ? "un millón" : `${numberToWords(millions)} millones`;
    return `${millionText}${rest ? ` ${numberToWords(rest)}` : ""}`;
  }
  return String(num);
}

function moneyToWords(value) {
  const amount = Number(value || 0);
  const integer = Math.floor(Math.abs(amount));
  const cents = Math.round((Math.abs(amount) - integer) * 100);
  const sign = amount < 0 ? "menos " : "";
  let result = `${sign}${numberToWords(integer)} peso${integer === 1 ? "" : "s"}`;
  if (cents) result += ` con ${numberToWords(cents)} centavo${cents === 1 ? "" : "s"}`;
  return result.charAt(0).toUpperCase() + result.slice(1);
}

function setMessage(node, text = "", type = "") {
  if (!node) return;
  node.textContent = text;
  node.className = `msg ${type}`.trim();
}

function updateMoneyWords(form) {
  if (!form) return;
  form.querySelectorAll("[data-money-input='true']").forEach((input) => {
    const wordsNode = form.querySelector(`[data-money-words='${input.name}']`);
    if (!wordsNode) return;
    const value = normalizeMoneyInput(input.value);
    wordsNode.textContent = input.value ? moneyToWords(value) : "";
  });
}

function addMoneyInputBehavior(form) {
  if (!form) return;
  form.querySelectorAll("[data-money-input='true']").forEach((input) => {
    input.addEventListener("input", () => updateMoneyWords(form));
    input.addEventListener("blur", () => {
      if (!input.value.trim()) return updateMoneyWords(form);
      input.value = formatMoneyInput(normalizeMoneyInput(input.value));
      updateMoneyWords(form);
    });
  });
}

function getActiveCashSession() {
  return state.cashSessions.find((session) => session.status === "open") || null;
}

function getTransactionsForSession(sessionId, type) {
  const source = type === "sale" ? state.sales : state.expenses;
  return source.filter((item) => item.cashSessionId === sessionId);
}

function calculateCashForSession(session) {
  if (!session) return { efectivo: 0, cheque: 0, transferencia: 0, total: 0, sales: 0, expenses: 0 };
  const totals = {
    efectivo: Number(session.openingEfectivo || 0),
    cheque: Number(session.openingCheque || 0),
    transferencia: Number(session.openingTransferencia || 0),
  };
  let sales = 0;
  let expenses = 0;
  getTransactionsForSession(session.id, "sale").forEach((sale) => {
    const method = sale.paymentMethod || "efectivo";
    totals[method] = Number(totals[method] || 0) + Number(sale.amount || 0);
    sales += Number(sale.amount || 0);
  });
  getTransactionsForSession(session.id, "expense").forEach((expense) => {
    const method = expense.paymentMethod || "efectivo";
    totals[method] = Number(totals[method] || 0) - Number(expense.amount || 0);
    expenses += Number(expense.amount || 0);
  });
  return {
    ...totals,
    total: Number(totals.efectivo || 0) + Number(totals.cheque || 0) + Number(totals.transferencia || 0),
    sales,
    expenses,
  };
}

function buildGlobalBreakdown() {
  const totals = { efectivo: 0, cheque: 0, transferencia: 0 };
  state.sales.forEach((sale) => {
    const method = sale.paymentMethod || "efectivo";
    totals[method] = Number(totals[method] || 0) + Number(sale.amount || 0);
  });
  state.expenses.forEach((expense) => {
    const method = expense.paymentMethod || "efectivo";
    totals[method] = Number(totals[method] || 0) - Number(expense.amount || 0);
  });
  return totals;
}

function renderDashboard() {
  const today = nowISO();
  const weekStart = startOfWeek();
  const monthStart = startOfMonth();

  const salesToday = state.sales.filter((item) => item.date === today);
  const salesWeek = state.sales.filter((item) => toDate(item.date) >= weekStart);
  const salesMonth = state.sales.filter((item) => toDate(item.date) >= monthStart);
  const expensesToday = state.expenses.filter((item) => item.date === today);

  const totalDay = salesToday.reduce((sum, item) => sum + Number(item.amount || 0), 0);
  const totalWeek = salesWeek.reduce((sum, item) => sum + Number(item.amount || 0), 0);
  const totalMonth = salesMonth.reduce((sum, item) => sum + Number(item.amount || 0), 0);
  const totalExpensesToday = expensesToday.reduce((sum, item) => sum + Number(item.amount || 0), 0);

  const breakdownDay = { efectivo: 0, cheque: 0, transferencia: 0 };
  salesToday.forEach((sale) => {
    breakdownDay[sale.paymentMethod || "efectivo"] += Number(sale.amount || 0);
  });

  const activeSession = getActiveCashSession();
  const caja = activeSession ? calculateCashForSession(activeSession) : (() => {
    const global = buildGlobalBreakdown();
    return {
      ...global,
      total: global.efectivo + global.cheque + global.transferencia,
    };
  })();

  elements.statCajaTotal.textContent = currency(caja.total);
  elements.statCajaDetalle.textContent = activeSession
    ? `Caja abierta · Efectivo ${currency(caja.efectivo)} · Cheques ${currency(caja.cheque)} · Transferencias ${currency(caja.transferencia)}`
    : `Sin caja abierta · Balance global · Efectivo ${currency(caja.efectivo)} · Cheques ${currency(caja.cheque)} · Transferencias ${currency(caja.transferencia)}`;
  elements.statVentasDia.textContent = currency(totalDay);
  elements.statVentasDiaDetalle.textContent = `Efectivo ${currency(breakdownDay.efectivo)} · Cheques ${currency(breakdownDay.cheque)} · Transferencias ${currency(breakdownDay.transferencia)} · Gastos de hoy ${currency(totalExpensesToday)}`;
  elements.statVentasSemana.textContent = currency(totalWeek);
  elements.statVentasSemanaDetalle.textContent = `${salesWeek.length} venta${salesWeek.length === 1 ? "" : "s"} desde el lunes`;
  elements.statVentasMes.textContent = currency(totalMonth);
  elements.statVentasMesDetalle.textContent = `${salesMonth.length} venta${salesMonth.length === 1 ? "" : "s"} acumuladas este mes`;
  elements.cajaEfectivo.textContent = currency(caja.efectivo);
  elements.cajaCheques.textContent = currency(caja.cheque);
  elements.cajaTransferencias.textContent = currency(caja.transferencia);

  renderRecentList(elements.recentSales, state.sales, "sale", 5);
  renderRecentList(elements.recentExpenses, state.expenses, "expense", 5);
}

function renderRecentList(node, items, type, max = 5) {
  const list = items.slice(0, max);
  if (!list.length) {
    node.innerHTML = `<div class="empty">Todavía no hay ${type === "sale" ? "ventas" : "gastos"} cargados.</div>`;
    return;
  }

  node.innerHTML = list.map((item) => `
    <article class="record-card">
      <div class="record-main">
        <div class="record-top">
          <div>
            <div class="record-title">${escapeHtml(type === "sale" ? (item.document || "Venta") : (item.category || "Gasto"))}</div>
            <div class="record-meta">
              <span class="pill ${type === "sale" ? "income" : "expense"}">${type === "sale" ? "Venta" : "Gasto"}</span>
              <span class="pill">${escapeHtml(item.paymentMethod || "efectivo")}</span>
              <span class="pill">${escapeHtml(item.date || "")}</span>
            </div>
          </div>
          <div class="record-amount">${currency(item.amount)}</div>
        </div>
        ${item.details ? `<div class="inline-note" style="margin-top:8px">${escapeHtml(item.details)}</div>` : ""}
      </div>
    </article>`).join("");
}

function renderSales() {
  elements.salesCountNote.textContent = `${state.sales.length} venta${state.sales.length === 1 ? "" : "s"} registradas.`;
  if (!state.sales.length) {
    elements.salesList.innerHTML = '<div class="empty">No hay ventas cargadas todavía.</div>';
    return;
  }
  elements.salesList.innerHTML = state.sales.map((item) => `
    <article class="record-card">
      <div class="record-main">
        <div class="record-top">
          <div>
            <div class="record-title">${escapeHtml(item.document || "Venta sin comprobante")}</div>
            <div class="record-meta">
              <span class="pill income">Venta</span>
              <span class="pill">${escapeHtml(item.paymentMethod || "efectivo")}</span>
              <span class="pill">${escapeHtml(item.date || "")}</span>
              ${item.cashSessionId ? '<span class="pill">Caja asignada</span>' : '<span class="pill">Sin caja</span>'}
            </div>
          </div>
          <div class="record-amount">${currency(item.amount)}</div>
        </div>
        ${item.details ? `<div class="inline-note" style="margin-top:8px">${escapeHtml(item.details)}</div>` : ""}
      </div>
      <div class="record-actions">
        <button class="btn btn-secondary" type="button" data-edit-sale="${item.id}">Editar</button>
        <button class="btn btn-danger" type="button" data-delete-sale="${item.id}">Eliminar</button>
      </div>
    </article>`).join("");

  $$('[data-edit-sale]').forEach((button) => button.addEventListener('click', () => loadSaleForEdit(button.dataset.editSale)));
  $$('[data-delete-sale]').forEach((button) => button.addEventListener('click', async () => {
    if (!confirm('¿Eliminar esta venta?')) return;
    await deleteDoc(doc(db, 'kflow_sales', button.dataset.deleteSale));
  }));
}

function renderExpenses() {
  elements.expensesCountNote.textContent = `${state.expenses.length} gasto${state.expenses.length === 1 ? "" : "s"} registrados.`;
  if (!state.expenses.length) {
    elements.expensesList.innerHTML = '<div class="empty">No hay gastos cargados todavía.</div>';
    return;
  }
  elements.expensesList.innerHTML = state.expenses.map((item) => `
    <article class="record-card">
      <div class="record-main">
        <div class="record-top">
          <div>
            <div class="record-title">${escapeHtml(item.category || "Gasto")}</div>
            <div class="record-meta">
              <span class="pill expense">Gasto</span>
              <span class="pill">${escapeHtml(item.paymentMethod || "efectivo")}</span>
              <span class="pill">${escapeHtml(item.date || "")}</span>
              ${item.cashSessionId ? '<span class="pill">Caja asignada</span>' : '<span class="pill">Sin caja</span>'}
            </div>
          </div>
          <div class="record-amount">${currency(item.amount)}</div>
        </div>
        ${item.details ? `<div class="inline-note" style="margin-top:8px">${escapeHtml(item.details)}</div>` : ""}
      </div>
      <div class="record-actions">
        <button class="btn btn-secondary" type="button" data-edit-expense="${item.id}">Editar</button>
        <button class="btn btn-danger" type="button" data-delete-expense="${item.id}">Eliminar</button>
      </div>
    </article>`).join("");

  $$('[data-edit-expense]').forEach((button) => button.addEventListener('click', () => loadExpenseForEdit(button.dataset.editExpense)));
  $$('[data-delete-expense]').forEach((button) => button.addEventListener('click', async () => {
    if (!confirm('¿Eliminar este gasto?')) return;
    await deleteDoc(doc(db, 'kflow_expenses', button.dataset.deleteExpense));
  }));
}

function renderCash() {
  const activeSession = getActiveCashSession();
  if (!activeSession) {
    elements.activeCajaCard.innerHTML = `
      <div class="empty">
        No hay una caja abierta en este momento. Abrí una caja para empezar a controlar efectivo, cheques y transferencias del turno.
      </div>`;
    elements.closeCajaBtn.disabled = true;
  } else {
    const summary = calculateCashForSession(activeSession);
    elements.activeCajaCard.innerHTML = `
      <div class="kpi-row">
        <div class="kpi-mini"><span>Fecha de apertura</span><strong>${escapeHtml(activeSession.date || nowISO())}</strong></div>
        <div class="kpi-mini"><span>Ventas en caja</span><strong>${currency(summary.sales)}</strong></div>
        <div class="kpi-mini"><span>Gastos en caja</span><strong>${currency(summary.expenses)}</strong></div>
      </div>
      <div class="kpi-row" style="margin-top:12px">
        <div class="kpi-mini"><span>Efectivo actual</span><strong>${currency(summary.efectivo)}</strong></div>
        <div class="kpi-mini"><span>Cheques actuales</span><strong>${currency(summary.cheque)}</strong></div>
        <div class="kpi-mini"><span>Transferencias actuales</span><strong>${currency(summary.transferencia)}</strong></div>
      </div>
      <div class="inline-note" style="margin-top:12px">Apertura: Efectivo ${currency(activeSession.openingEfectivo || 0)} · Cheques ${currency(activeSession.openingCheque || 0)} · Transferencias ${currency(activeSession.openingTransferencia || 0)} · Total actual ${currency(summary.total)}</div>
    `;
    elements.closeCajaBtn.disabled = false;
  }

  if (!state.cashSessions.length) {
    elements.cajaHistoryList.innerHTML = '<div class="empty">Todavía no hay aperturas o cierres de caja.</div>';
    return;
  }

  elements.cajaHistoryList.innerHTML = state.cashSessions.map((session) => {
    const closed = session.status === 'closed';
    const finalTotal = closed
      ? Number(session.closingEfectivo || 0) + Number(session.closingCheque || 0) + Number(session.closingTransferencia || 0)
      : calculateCashForSession(session).total;
    return `
      <article class="record-card">
        <div class="record-main">
          <div class="record-top">
            <div>
              <div class="record-title">Caja ${closed ? 'cerrada' : 'abierta'} · ${escapeHtml(session.date || '')}</div>
              <div class="record-meta">
                <span class="pill">${closed ? 'Cerrada' : 'Abierta'}</span>
                <span class="pill">Total ${currency(finalTotal)}</span>
              </div>
            </div>
          </div>
          <div class="inline-note">Apertura: Efectivo ${currency(session.openingEfectivo || 0)} · Cheques ${currency(session.openingCheque || 0)} · Transferencias ${currency(session.openingTransferencia || 0)}</div>
          ${closed ? `<div class="inline-note" style="margin-top:8px">Cierre: Efectivo ${currency(session.closingEfectivo || 0)} · Cheques ${currency(session.closingCheque || 0)} · Transferencias ${currency(session.closingTransferencia || 0)}${session.closingNote ? ` · Nota: ${escapeHtml(session.closingNote)}` : ''}</div>` : ''}
        </div>
      </article>`;
  }).join('');
}

function resetSalesForm() {
  state.editingSaleId = "";
  elements.salesForm.reset();
  elements.salesForm.date.value = nowISO();
  updateMoneyWords(elements.salesForm);
  elements.salesFormTitle.textContent = 'Nueva venta';
  elements.salesSubmitBtn.textContent = 'Guardar venta';
  elements.cancelSalesEditBtn.classList.add('hidden');
  setMessage(elements.salesMsg, '');
}

function resetExpensesForm() {
  state.editingExpenseId = "";
  elements.expensesForm.reset();
  elements.expensesForm.date.value = nowISO();
  updateMoneyWords(elements.expensesForm);
  elements.expensesFormTitle.textContent = 'Nuevo gasto';
  elements.expensesSubmitBtn.textContent = 'Guardar gasto';
  elements.cancelExpensesEditBtn.classList.add('hidden');
  setMessage(elements.expensesMsg, '');
}

function resetCashOpenForm() {
  elements.cashOpenForm.reset();
  elements.cashOpenForm.date.value = nowISO();
  updateMoneyWords(elements.cashOpenForm);
  setMessage(elements.cashMsg, '');
}

function loadSaleForEdit(id) {
  const item = state.sales.find((sale) => sale.id === id);
  if (!item) return;
  state.editingSaleId = id;
  elements.salesForm.date.value = item.date || nowISO();
  elements.salesForm.amount.value = formatMoneyInput(item.amount || 0);
  elements.salesForm.paymentMethod.value = item.paymentMethod || 'efectivo';
  elements.salesForm.document.value = item.document || '';
  elements.salesForm.details.value = item.details || '';
  updateMoneyWords(elements.salesForm);
  elements.salesFormTitle.textContent = 'Editar venta';
  elements.salesSubmitBtn.textContent = 'Guardar cambios';
  elements.cancelSalesEditBtn.classList.remove('hidden');
  setMessage(elements.salesMsg, 'Editando venta seleccionada.', 'success');
  switchView('ventas');
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function loadExpenseForEdit(id) {
  const item = state.expenses.find((expense) => expense.id === id);
  if (!item) return;
  state.editingExpenseId = id;
  elements.expensesForm.date.value = item.date || nowISO();
  elements.expensesForm.amount.value = formatMoneyInput(item.amount || 0);
  elements.expensesForm.paymentMethod.value = item.paymentMethod || 'efectivo';
  elements.expensesForm.category.value = item.category || '';
  elements.expensesForm.details.value = item.details || '';
  updateMoneyWords(elements.expensesForm);
  elements.expensesFormTitle.textContent = 'Editar gasto';
  elements.expensesSubmitBtn.textContent = 'Guardar cambios';
  elements.cancelExpensesEditBtn.classList.remove('hidden');
  setMessage(elements.expensesMsg, 'Editando gasto seleccionado.', 'success');
  switchView('gastos');
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

async function saveSale(event) {
  event.preventDefault();
  try {
    const activeSession = getActiveCashSession();
    const currentRecord = state.sales.find((sale) => sale.id === state.editingSaleId) || null;
    const payload = {
      date: elements.salesForm.date.value || nowISO(),
      amount: normalizeMoneyInput(elements.salesForm.amount.value),
      paymentMethod: elements.salesForm.paymentMethod.value,
      document: elements.salesForm.document.value.trim(),
      details: elements.salesForm.details.value.trim(),
      cashSessionId: currentRecord?.cashSessionId || activeSession?.id || '',
      updatedAt: serverTimestamp(),
    };
    if (!payload.amount) throw new Error('Ingresá un monto válido para la venta.');
    if (state.editingSaleId) {
      await updateDoc(doc(db, 'kflow_sales', state.editingSaleId), payload);
      setMessage(elements.salesMsg, 'Venta actualizada correctamente.', 'success');
    } else {
      await addDoc(collection(db, 'kflow_sales'), { ...payload, createdAt: serverTimestamp() });
      setMessage(elements.salesMsg, activeSession ? 'Venta guardada y asignada a la caja abierta.' : 'Venta guardada correctamente.');
    }
    resetSalesForm();
  } catch (error) {
    setMessage(elements.salesMsg, error.message || 'No se pudo guardar la venta.', 'error');
  }
}

async function saveExpense(event) {
  event.preventDefault();
  try {
    const activeSession = getActiveCashSession();
    const currentRecord = state.expenses.find((expense) => expense.id === state.editingExpenseId) || null;
    const payload = {
      date: elements.expensesForm.date.value || nowISO(),
      amount: normalizeMoneyInput(elements.expensesForm.amount.value),
      paymentMethod: elements.expensesForm.paymentMethod.value,
      category: elements.expensesForm.category.value.trim(),
      details: elements.expensesForm.details.value.trim(),
      cashSessionId: currentRecord?.cashSessionId || activeSession?.id || '',
      updatedAt: serverTimestamp(),
    };
    if (!payload.amount) throw new Error('Ingresá un monto válido para el gasto.');
    if (!payload.category) throw new Error('Ingresá una categoría para el gasto.');
    if (state.editingExpenseId) {
      await updateDoc(doc(db, 'kflow_expenses', state.editingExpenseId), payload);
      setMessage(elements.expensesMsg, 'Gasto actualizado correctamente.', 'success');
    } else {
      await addDoc(collection(db, 'kflow_expenses'), { ...payload, createdAt: serverTimestamp() });
      setMessage(elements.expensesMsg, activeSession ? 'Gasto guardado y descontado de la caja abierta.' : 'Gasto guardado correctamente.');
    }
    resetExpensesForm();
  } catch (error) {
    setMessage(elements.expensesMsg, error.message || 'No se pudo guardar el gasto.', 'error');
  }
}

async function openCash(event) {
  event.preventDefault();
  try {
    const activeSession = getActiveCashSession();
    if (activeSession) throw new Error('Ya hay una caja abierta. Cerrala antes de abrir otra.');

    const payload = {
      date: elements.cashOpenForm.date.value || nowISO(),
      openingEfectivo: normalizeMoneyInput(elements.cashOpenForm.openingEfectivo.value),
      openingCheque: normalizeMoneyInput(elements.cashOpenForm.openingCheque.value),
      openingTransferencia: normalizeMoneyInput(elements.cashOpenForm.openingTransferencia.value),
      openingNote: elements.cashOpenForm.openingNote.value.trim(),
      status: 'open',
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    };

    await addDoc(collection(db, 'kflow_cash_sessions'), payload);
    resetCashOpenForm();
    setMessage(elements.cashMsg, 'Caja abierta correctamente.', 'success');
  } catch (error) {
    setMessage(elements.cashMsg, error.message || 'No se pudo abrir la caja.', 'error');
  }
}

async function closeCash() {
  try {
    const activeSession = getActiveCashSession();
    if (!activeSession) throw new Error('No hay una caja abierta para cerrar.');
    const summary = calculateCashForSession(activeSession);
    await updateDoc(doc(db, 'kflow_cash_sessions', activeSession.id), {
      status: 'closed',
      closedAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
      closingEfectivo: summary.efectivo,
      closingCheque: summary.cheque,
      closingTransferencia: summary.transferencia,
      closingTotal: summary.total,
      closingSales: summary.sales,
      closingExpenses: summary.expenses,
      closingNote: elements.closeCajaNote.value.trim(),
    });
    elements.closeCajaNote.value = '';
    setMessage(elements.cashMsg, 'Caja cerrada correctamente.', 'success');
  } catch (error) {
    setMessage(elements.cashMsg, error.message || 'No se pudo cerrar la caja.', 'error');
  }
}

function switchView(view) {
  $$('.view-section').forEach((section) => section.classList.add('hidden'));
  $(`#${view}View`).classList.remove('hidden');
  $$('[data-view]').forEach((button) => button.classList.toggle('active', button.dataset.view === view));
}

async function connectRealtime() {
  try {
    await signInAnonymously(auth);
    elements.syncStatus.textContent = 'Sincronizado en tiempo real';
  } catch (error) {
    elements.syncStatus.textContent = 'Error de conexión';
    console.error(error);
  }

  onSnapshot(query(collection(db, 'kflow_sales'), orderBy('date', 'desc')), (snapshot) => {
    state.sales = snapshot.docs.map((docItem) => ({ id: docItem.id, ...docItem.data() }));
    renderDashboard();
    renderSales();
    renderCash();
  }, (error) => {
    console.error(error);
    elements.syncStatus.textContent = 'Error leyendo ventas';
  });

  onSnapshot(query(collection(db, 'kflow_expenses'), orderBy('date', 'desc')), (snapshot) => {
    state.expenses = snapshot.docs.map((docItem) => ({ id: docItem.id, ...docItem.data() }));
    renderDashboard();
    renderExpenses();
    renderCash();
  }, (error) => {
    console.error(error);
    elements.syncStatus.textContent = 'Error leyendo gastos';
  });

  onSnapshot(query(collection(db, 'kflow_cash_sessions'), orderBy('date', 'desc')), (snapshot) => {
    state.cashSessions = snapshot.docs.map((docItem) => ({ id: docItem.id, ...docItem.data() }));
    renderDashboard();
    renderCash();
  }, (error) => {
    console.error(error);
    elements.syncStatus.textContent = 'Error leyendo caja';
  });
}

function init() {
  elements.todayLabel.textContent = new Date().toLocaleDateString('es-AR', {
    weekday: 'long', day: '2-digit', month: 'long', year: 'numeric'
  });

  addMoneyInputBehavior(elements.salesForm);
  addMoneyInputBehavior(elements.expensesForm);
  addMoneyInputBehavior(elements.cashOpenForm);
  resetSalesForm();
  resetExpensesForm();
  resetCashOpenForm();

  elements.salesForm.addEventListener('submit', saveSale);
  elements.expensesForm.addEventListener('submit', saveExpense);
  elements.cashOpenForm.addEventListener('submit', openCash);
  elements.closeCajaBtn.addEventListener('click', closeCash);
  elements.cancelSalesEditBtn.addEventListener('click', resetSalesForm);
  elements.cancelExpensesEditBtn.addEventListener('click', resetExpensesForm);
  $$('[data-view]').forEach((button) => button.addEventListener('click', () => switchView(button.dataset.view)));

  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => navigator.serviceWorker.register('./sw.js').catch(console.error));
  }

  connectRealtime();
}

init();
