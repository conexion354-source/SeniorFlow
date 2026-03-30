import { auth, db } from './firebase-config.js';
import { signInAnonymously, onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/12.11.0/firebase-auth.js';
import {
  addDoc, collection, deleteDoc, doc, onSnapshot, orderBy, query, serverTimestamp, updateDoc
} from 'https://www.gstatic.com/firebasejs/12.11.0/firebase-firestore.js';

const state = {
  sales: [],
  expenses: [],
  cashSessions: [],
  currentSession: null,
};

const els = {
  todayText: document.getElementById('todayText'),
  cajaBanner: document.getElementById('cajaBanner'),
  cajaWarning: document.getElementById('cajaWarning'),
  installBtn: document.getElementById('installBtn'),
  weekChart: document.getElementById('weekChart'),
  statSalesDay: document.getElementById('statSalesDay'),
  statSalesDayWords: document.getElementById('statSalesDayWords'),
  statCash: document.getElementById('statCash'),
  statCashBreakdown: document.getElementById('statCashBreakdown'),
  statSalesWeek: document.getElementById('statSalesWeek'),
  statSalesMonth: document.getElementById('statSalesMonth'),
  statCashEfectivo: document.getElementById('statCashEfectivo'),
  statCashCheque: document.getElementById('statCashCheque'),
  statCashTransfer: document.getElementById('statCashTransfer'),
  statExpensesDay: document.getElementById('statExpensesDay'),
  openCajaForm: document.getElementById('openCajaForm'),
  closeCajaForm: document.getElementById('closeCajaForm'),
  closeCajaTotal: document.getElementById('closeCajaTotal'),
  openCajaMsg: document.getElementById('openCajaMsg'),
  closeCajaMsg: document.getElementById('closeCajaMsg'),
  cashSessionsList: document.getElementById('cashSessionsList'),
  saleForm: document.getElementById('saleForm'),
  saleMsg: document.getElementById('saleMsg'),
  salePaymentMethod: document.getElementById('salePaymentMethod'),
  saleCustomerWrap: document.getElementById('saleCustomerWrap'),
  saleBankWrap: document.getElementById('saleBankWrap'),
  cancelSaleEdit: document.getElementById('cancelSaleEdit'),
  salesList: document.getElementById('salesList'),
  expenseForm: document.getElementById('expenseForm'),
  expenseMsg: document.getElementById('expenseMsg'),
  cancelExpenseEdit: document.getElementById('cancelExpenseEdit'),
  expensesList: document.getElementById('expensesList'),
  navBtns: [...document.querySelectorAll('.nav-btn')],
  views: {
    inicio: document.getElementById('inicioView'),
    caja: document.getElementById('cajaView'),
    ventas: document.getElementById('ventasView'),
    gastos: document.getElementById('gastosView'),
  }
};

let deferredPrompt = null;

const currency = (value) => new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 2 }).format(Number(value || 0));
const todayISO = () => new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 10);
const dateLabel = (date) => new Date(`${date}T00:00:00`).toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' });

function escapeHtml(value) {
  return String(value ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#039;');
}

function normalizeText(value) {
  return String(value || '').trim().toLowerCase();
}

function parseMoneyValue(input) {
  let raw = String(input ?? '').trim().toLowerCase();
  if (!raw) return 0;
  raw = raw.replace(/\s+/g, ' ');
  const hasMilWord = /\bmil\b/.test(raw);
  raw = raw.replace(/\$|ars|pesos?/g, '').trim();

  if (raw.includes('.') && raw.includes(',')) {
    if (raw.lastIndexOf(',') > raw.lastIndexOf('.')) {
      raw = raw.replace(/\./g, '').replace(',', '.');
    } else {
      raw = raw.replace(/,/g, '');
    }
  } else if (raw.includes(',')) {
    const parts = raw.split(',');
    if (parts.length === 2 && parts[1].length <= 2) raw = parts[0].replace(/\./g, '') + '.' + parts[1];
    else raw = raw.replace(/,/g, '');
  } else if (raw.includes('.')) {
    const parts = raw.split('.');
    if (!(parts.length === 2 && parts[1].length <= 2)) raw = raw.replace(/\./g, '');
  }

  raw = raw.replace(/mil/g, '').replace(/[^0-9.-]/g, '');
  let value = Number(raw || 0);
  if (!Number.isFinite(value)) value = 0;
  if (hasMilWord) value *= 1000;
  return value;
}

function formatMoneyInputValue(value) {
  return new Intl.NumberFormat('es-AR', { maximumFractionDigits: 2 }).format(Number(value || 0));
}

function numberToWordsUnder100(num) {
  const u = ['cero', 'uno', 'dos', 'tres', 'cuatro', 'cinco', 'seis', 'siete', 'ocho', 'nueve'];
  const teens = { 10: 'diez', 11: 'once', 12: 'doce', 13: 'trece', 14: 'catorce', 15: 'quince', 16: 'dieciséis', 17: 'diecisiete', 18: 'dieciocho', 19: 'diecinueve' };
  const tens = { 20: 'veinte', 30: 'treinta', 40: 'cuarenta', 50: 'cincuenta', 60: 'sesenta', 70: 'setenta', 80: 'ochenta', 90: 'noventa' };
  if (num < 10) return u[num];
  if (teens[num]) return teens[num];
  if (num < 30) return num === 20 ? 'veinte' : `veinti${u[num - 20]}`;
  const ten = Math.floor(num / 10) * 10;
  const unit = num % 10;
  return unit ? `${tens[ten]} y ${u[unit]}` : tens[ten];
}
function numberToWordsUnder1000(num) {
  const hundreds = { 100: 'cien', 200: 'doscientos', 300: 'trescientos', 400: 'cuatrocientos', 500: 'quinientos', 600: 'seiscientos', 700: 'setecientos', 800: 'ochocientos', 900: 'novecientos' };
  if (num < 100) return numberToWordsUnder100(num);
  if (hundreds[num]) return hundreds[num];
  const hundred = Math.floor(num / 100) * 100;
  const rest = num % 100;
  const prefix = num < 200 ? 'ciento' : hundreds[hundred];
  return `${prefix} ${numberToWordsUnder100(rest)}`;
}
function numberToWordsEs(num) {
  num = Math.floor(Number(num || 0));
  if (num === 0) return 'cero';
  if (num < 1000) return numberToWordsUnder1000(num);
  if (num < 1000000) {
    const thousands = Math.floor(num / 1000);
    const rest = num % 1000;
    const thousandText = thousands === 1 ? 'mil' : `${numberToWordsUnder1000(thousands)} mil`;
    return `${thousandText}${rest ? ` ${numberToWordsUnder1000(rest)}` : ''}`;
  }
  const millions = Math.floor(num / 1000000);
  const rest = num % 1000000;
  const millionText = millions === 1 ? 'un millón' : `${numberToWordsEs(millions)} millones`;
  return `${millionText}${rest ? ` ${numberToWordsEs(rest)}` : ''}`;
}
function moneyToWords(value) {
  const amount = Number(value || 0);
  const abs = Math.abs(amount);
  const integer = Math.floor(abs);
  const cents = Math.round((abs - integer) * 100);
  const sign = amount < 0 ? 'menos ' : '';
  const base = `${sign}${numberToWordsEs(integer)} peso${integer === 1 ? '' : 's'}`;
  if (!cents) return base.charAt(0).toUpperCase() + base.slice(1);
  const centsText = `${numberToWordsEs(cents)} centavo${cents === 1 ? '' : 's'}`;
  const full = `${base} con ${centsText}`;
  return full.charAt(0).toUpperCase() + full.slice(1);
}

function updateMoneyText(input) {
  const root = input.closest('label') || document;
  const target = root.querySelector(`[data-money-text-for="${input.name}"]`) || document.querySelector(`[data-money-text-for="${input.name}"]`);
  if (target) target.textContent = moneyToWords(parseMoneyValue(input.value));
}

function enhanceMoneyInputs(root = document) {
  root.querySelectorAll('[data-money="true"]').forEach((input) => {
    if (input.dataset.bound === '1') return;
    input.dataset.bound = '1';
    input.addEventListener('input', () => updateMoneyText(input));
    input.addEventListener('blur', () => {
      const value = parseMoneyValue(input.value);
      if (input.value.trim() !== '') input.value = formatMoneyInputValue(value);
      updateMoneyText(input);
    });
    updateMoneyText(input);
  });
}

function setView(view) {
  els.navBtns.forEach((btn) => btn.classList.toggle('active', btn.dataset.view === view));
  Object.entries(els.views).forEach(([name, node]) => node.classList.toggle('active', name === view));
}

function showMsg(node, text = '', type = '') {
  node.textContent = text;
  node.className = `msg ${type}`.trim();
}

function isCajaOpen() {
  return !!state.currentSession && !state.currentSession.closedAt;
}

function requireOpenCaja() {
  if (isCajaOpen()) return true;
  showMsg(els.saleMsg, 'Primero tenés que abrir caja.', 'error');
  showMsg(els.expenseMsg, 'Primero tenés que abrir caja.', 'error');
  setView('caja');
  return false;
}

function currentCajaBreakdown() {
  const breakdown = {
    efectivo: Number(state.currentSession?.openingCash || 0),
    cheque: Number(state.currentSession?.openingChecks || 0),
    transferencia: Number(state.currentSession?.openingTransfers || 0),
  };

  state.sales.forEach((sale) => {
    if (sale.paymentMethod === 'efectivo') breakdown.efectivo += Number(sale.amount || 0);
    if (sale.paymentMethod === 'cheque') breakdown.cheque += Number(sale.amount || 0);
    if (sale.paymentMethod === 'transferencia') breakdown.transferencia += Number(sale.amount || 0);
  });

  state.expenses.forEach((expense) => {
    breakdown.efectivo -= Number(expense.amount || 0);
  });

  return breakdown;
}

function renderDashboard() {
  const today = todayISO();
  const now = new Date(`${today}T12:00:00`);
  els.todayText.textContent = now.toLocaleDateString('es-AR', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' });

  const salesDay = state.sales.filter((item) => item.date === today).reduce((sum, item) => sum + Number(item.amount || 0), 0);
  const expensesDay = state.expenses.filter((item) => item.date === today).reduce((sum, item) => sum + Number(item.amount || 0), 0);
  const startOfMonth = `${today.slice(0, 7)}-01`;
  const salesMonth = state.sales.filter((item) => item.date >= startOfMonth && item.date <= today).reduce((sum, item) => sum + Number(item.amount || 0), 0);

  const last7 = [];
  for (let i = 6; i >= 0; i -= 1) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const iso = new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
    const amount = state.sales.filter((item) => item.date === iso).reduce((sum, item) => sum + Number(item.amount || 0), 0);
    last7.push({
      iso,
      label: d.toLocaleDateString('es-AR', { weekday: 'short' }).replace('.', ''),
      amount,
    });
  }
  const salesWeek = last7.reduce((sum, item) => sum + item.amount, 0);
  const box = currentCajaBreakdown();
  const boxTotal = box.efectivo + box.cheque + box.transferencia;

  els.statSalesDay.textContent = currency(salesDay);
  els.statSalesDayWords.textContent = moneyToWords(salesDay);
  els.statExpensesDay.textContent = currency(expensesDay);
  els.statSalesWeek.textContent = currency(salesWeek);
  els.statSalesMonth.textContent = currency(salesMonth);
  els.statCash.textContent = currency(boxTotal);
  els.statCashBreakdown.textContent = `Efectivo ${currency(box.efectivo)} · Cheques ${currency(box.cheque)} · Transferencias ${currency(box.transferencia)}`;
  els.statCashEfectivo.textContent = currency(box.efectivo);
  els.statCashCheque.textContent = currency(box.cheque);
  els.statCashTransfer.textContent = currency(box.transferencia);
  els.closeCajaTotal.value = currency(boxTotal);

  if (isCajaOpen()) {
    els.cajaBanner.textContent = `Caja abierta el ${dateLabel(state.currentSession.date)}.`;
    els.cajaBanner.className = 'status-banner open';
    els.cajaWarning.classList.add('hidden');
  } else {
    els.cajaBanner.textContent = 'Caja cerrada. Abrí caja para empezar a operar.';
    els.cajaBanner.className = 'status-banner closed';
    els.cajaWarning.classList.remove('hidden');
  }

  const max = Math.max(...last7.map((item) => item.amount), 1);
  els.weekChart.innerHTML = last7.map((item) => `
    <div class="bar-row">
      <div>${escapeHtml(item.label)}</div>
      <div class="bar-track"><div class="bar-fill" style="width:${Math.max(6, (item.amount / max) * 100)}%"></div></div>
      <div>${currency(item.amount)}</div>
    </div>
  `).join('');
}

function renderCashSessions() {
  if (!state.cashSessions.length) {
    els.cashSessionsList.innerHTML = '<div class="empty">Todavía no hay aperturas o cierres de caja.</div>';
    return;
  }
  els.cashSessionsList.innerHTML = state.cashSessions.map((item) => {
    const isOpen = !item.closedAt;
    const finalTotal = Number(item.closingTotal || 0);
    const openTotal = Number(item.openingCash || 0) + Number(item.openingChecks || 0) + Number(item.openingTransfers || 0);
    return `
      <article class="record-item">
        <div class="record-head">
          <div>
            <strong>Caja ${escapeHtml(dateLabel(item.date || todayISO()))}</strong>
            <div class="record-meta">
              <span class="pill ${isOpen ? 'success' : 'warning'}">${isOpen ? 'Abierta' : 'Cerrada'}</span>
              <span>Apertura ${currency(openTotal)}</span>
              ${isOpen ? '' : `<span>Cierre ${currency(finalTotal)}</span>`}
            </div>
          </div>
        </div>
        <div class="record-meta">
          <span>Efectivo ${currency(item.openingCash || 0)}</span>
          <span>Cheques ${currency(item.openingChecks || 0)}</span>
          <span>Transferencias ${currency(item.openingTransfers || 0)}</span>
          ${item.note ? `<span>Nota: ${escapeHtml(item.note)}</span>` : ''}
          ${item.closeNote ? `<span>Cierre: ${escapeHtml(item.closeNote)}</span>` : ''}
        </div>
      </article>
    `;
  }).join('');
}

function renderSales() {
  const rows = [...state.sales].sort((a, b) => (b.date || '').localeCompare(a.date || '') || (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));
  if (!rows.length) {
    els.salesList.innerHTML = '<div class="empty">No hay ventas cargadas.</div>';
    return;
  }
  els.salesList.innerHTML = rows.map((sale) => `
    <article class="record-item">
      <div class="record-head">
        <div>
          <strong>${currency(sale.amount)}</strong>
          <div class="record-meta">
            <span>${escapeHtml(dateLabel(sale.date))}</span>
            <span>${escapeHtml(sale.documentType || '-')}</span>
            <span>${escapeHtml(sale.paymentMethodLabel || sale.paymentMethod || '-')}</span>
            ${sale.paymentMethod === 'cuenta_corriente' ? `<span>${escapeHtml([sale.customerFirstName, sale.customerLastName].filter(Boolean).join(' ') || 'Cliente sin nombre')}</span>` : ''}
          </div>
        </div>
        <span class="pill ${sale.paymentMethod === 'cuenta_corriente' ? 'warning' : 'success'}">${escapeHtml(sale.documentNumber || 'Sin número')}</span>
      </div>
      <div class="record-meta">
        ${sale.bankInfo ? `<span>Referencia: ${escapeHtml(sale.bankInfo)}</span>` : ''}
        ${sale.details ? `<span>${escapeHtml(sale.details)}</span>` : ''}
      </div>
      <div class="record-actions">
        <button class="btn btn-secondary sale-edit" data-id="${sale.id}">Editar</button>
        <button class="btn btn-danger sale-delete" data-id="${sale.id}">Eliminar</button>
      </div>
    </article>
  `).join('');

  els.salesList.querySelectorAll('.sale-edit').forEach((btn) => btn.addEventListener('click', () => loadSaleIntoForm(btn.dataset.id)));
  els.salesList.querySelectorAll('.sale-delete').forEach((btn) => btn.addEventListener('click', async () => {
    if (!confirm('¿Eliminar esta venta?')) return;
    await deleteDoc(doc(db, 'sales', btn.dataset.id));
  }));
}

function renderExpenses() {
  const rows = [...state.expenses].sort((a, b) => (b.date || '').localeCompare(a.date || '') || (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));
  if (!rows.length) {
    els.expensesList.innerHTML = '<div class="empty">No hay gastos cargados.</div>';
    return;
  }
  els.expensesList.innerHTML = rows.map((expense) => `
    <article class="record-item">
      <div class="record-head">
        <div>
          <strong>${currency(expense.amount)}</strong>
          <div class="record-meta">
            <span>${escapeHtml(dateLabel(expense.date))}</span>
            <span>${escapeHtml(expense.category || '-')}</span>
          </div>
        </div>
        <span class="pill danger">Gasto</span>
      </div>
      <div class="record-meta">${expense.details ? `<span>${escapeHtml(expense.details)}</span>` : '<span>Sin detalle</span>'}</div>
      <div class="record-actions">
        <button class="btn btn-secondary expense-edit" data-id="${expense.id}">Editar</button>
        <button class="btn btn-danger expense-delete" data-id="${expense.id}">Eliminar</button>
      </div>
    </article>
  `).join('');

  els.expensesList.querySelectorAll('.expense-edit').forEach((btn) => btn.addEventListener('click', () => loadExpenseIntoForm(btn.dataset.id)));
  els.expensesList.querySelectorAll('.expense-delete').forEach((btn) => btn.addEventListener('click', async () => {
    if (!confirm('¿Eliminar este gasto?')) return;
    await deleteDoc(doc(db, 'expenses', btn.dataset.id));
  }));
}

function refreshAll() {
  renderDashboard();
  renderCashSessions();
  renderSales();
  renderExpenses();
}

function updateSaleConditionalFields() {
  const method = els.salePaymentMethod.value;
  els.saleCustomerWrap.classList.toggle('hidden', method !== 'cuenta_corriente');
  els.saleBankWrap.classList.toggle('hidden', !['cheque', 'transferencia'].includes(method));
  const form = els.saleForm;
  form.customerFirstName.required = method === 'cuenta_corriente';
  form.customerLastName.required = method === 'cuenta_corriente';
}

function resetSaleForm() {
  els.saleForm.reset();
  els.saleForm.date.value = todayISO();
  els.saleForm.paymentMethod.value = 'efectivo';
  updateSaleConditionalFields();
  els.cancelSaleEdit.classList.add('hidden');
  showMsg(els.saleMsg, '');
  enhanceMoneyInputs(els.saleForm);
}

function resetExpenseForm() {
  els.expenseForm.reset();
  els.expenseForm.date.value = todayISO();
  els.cancelExpenseEdit.classList.add('hidden');
  showMsg(els.expenseMsg, '');
  enhanceMoneyInputs(els.expenseForm);
}

function loadSaleIntoForm(id) {
  const sale = state.sales.find((item) => item.id === id);
  if (!sale) return;
  const form = els.saleForm;
  form.id.value = sale.id;
  form.date.value = sale.date || todayISO();
  form.amount.value = formatMoneyInputValue(sale.amount || 0);
  form.documentType.value = sale.documentType || 'Remito X';
  form.documentNumber.value = sale.documentNumber || '';
  form.paymentMethod.value = sale.paymentMethod || 'efectivo';
  form.bankInfo.value = sale.bankInfo || '';
  form.customerFirstName.value = sale.customerFirstName || '';
  form.customerLastName.value = sale.customerLastName || '';
  form.details.value = sale.details || '';
  updateSaleConditionalFields();
  enhanceMoneyInputs(form);
  els.cancelSaleEdit.classList.remove('hidden');
  setView('ventas');
}

function loadExpenseIntoForm(id) {
  const expense = state.expenses.find((item) => item.id === id);
  if (!expense) return;
  const form = els.expenseForm;
  form.id.value = expense.id;
  form.date.value = expense.date || todayISO();
  form.amount.value = formatMoneyInputValue(expense.amount || 0);
  form.category.value = expense.category || 'Alquiler';
  form.details.value = expense.details || '';
  enhanceMoneyInputs(form);
  els.cancelExpenseEdit.classList.remove('hidden');
  setView('gastos');
}

function attachRealtime() {
  onSnapshot(query(collection(db, 'sales'), orderBy('createdAt', 'desc')), (snap) => {
    state.sales = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    refreshAll();
  });
  onSnapshot(query(collection(db, 'expenses'), orderBy('createdAt', 'desc')), (snap) => {
    state.expenses = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    refreshAll();
  });
  onSnapshot(query(collection(db, 'cashSessions'), orderBy('createdAt', 'desc')), (snap) => {
    state.cashSessions = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    state.currentSession = state.cashSessions.find((item) => !item.closedAt) || null;
    refreshAll();
  });
}

async function initAuth() {
  onAuthStateChanged(auth, async (user) => {
    if (!user) {
      try { await signInAnonymously(auth); } catch (error) { console.error(error); }
      return;
    }
    attachRealtime();
  });
}

els.navBtns.forEach((btn) => btn.addEventListener('click', () => setView(btn.dataset.view)));
els.salePaymentMethod.addEventListener('change', updateSaleConditionalFields);
els.cancelSaleEdit.addEventListener('click', resetSaleForm);
els.cancelExpenseEdit.addEventListener('click', resetExpenseForm);

els.openCajaForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  showMsg(els.openCajaMsg, '');
  if (isCajaOpen()) {
    showMsg(els.openCajaMsg, 'Ya hay una caja abierta.', 'error');
    return;
  }
  const form = e.currentTarget;
  const payload = {
    date: form.date.value || todayISO(),
    openingCash: parseMoneyValue(form.cash.value),
    openingChecks: parseMoneyValue(form.checks.value),
    openingTransfers: parseMoneyValue(form.transfers.value),
    note: form.note.value.trim(),
    createdAt: serverTimestamp(),
  };
  await addDoc(collection(db, 'cashSessions'), payload);
  form.reset();
  form.date.value = todayISO();
  form.cash.value = '';
  form.checks.value = '0';
  form.transfers.value = '0';
  enhanceMoneyInputs(form);
  showMsg(els.openCajaMsg, 'Caja abierta correctamente.', 'success');
});

els.closeCajaForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  showMsg(els.closeCajaMsg, '');
  if (!isCajaOpen()) {
    showMsg(els.closeCajaMsg, 'No hay una caja abierta para cerrar.', 'error');
    return;
  }
  const box = currentCajaBreakdown();
  const total = box.efectivo + box.cheque + box.transferencia;
  await updateDoc(doc(db, 'cashSessions', state.currentSession.id), {
    closingCash: box.efectivo,
    closingChecks: box.cheque,
    closingTransfers: box.transferencia,
    closingTotal: total,
    closeNote: e.currentTarget.note.value.trim(),
    closedAt: serverTimestamp(),
  });
  e.currentTarget.reset();
  e.currentTarget.date.value = todayISO();
  showMsg(els.closeCajaMsg, 'Caja cerrada correctamente.', 'success');
});

els.saleForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  showMsg(els.saleMsg, '');
  if (!requireOpenCaja()) return;
  const form = e.currentTarget;
  const method = form.paymentMethod.value;
  const payload = {
    date: form.date.value || todayISO(),
    amount: parseMoneyValue(form.amount.value),
    documentType: form.documentType.value,
    documentNumber: form.documentNumber.value.trim(),
    paymentMethod: method,
    paymentMethodLabel: ({ efectivo: 'Efectivo', cheque: 'Cheque', transferencia: 'Transferencia', cuenta_corriente: 'Cuenta corriente' })[method] || method,
    bankInfo: form.bankInfo.value.trim(),
    customerFirstName: form.customerFirstName.value.trim(),
    customerLastName: form.customerLastName.value.trim(),
    details: form.details.value.trim(),
    cashSessionId: state.currentSession.id,
  };
  if (method === 'cuenta_corriente' && (!payload.customerFirstName || !payload.customerLastName)) {
    showMsg(els.saleMsg, 'Completá nombre y apellido del cliente.', 'error');
    return;
  }
  if (form.id.value) {
    await updateDoc(doc(db, 'sales', form.id.value), payload);
    showMsg(els.saleMsg, 'Venta editada correctamente.', 'success');
  } else {
    await addDoc(collection(db, 'sales'), { ...payload, createdAt: serverTimestamp() });
    showMsg(els.saleMsg, 'Venta guardada correctamente.', 'success');
  }
  resetSaleForm();
});

els.expenseForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  showMsg(els.expenseMsg, '');
  if (!requireOpenCaja()) return;
  const form = e.currentTarget;
  const payload = {
    date: form.date.value || todayISO(),
    amount: parseMoneyValue(form.amount.value),
    category: form.category.value,
    details: form.details.value.trim(),
    cashSessionId: state.currentSession.id,
  };
  if (form.id.value) {
    await updateDoc(doc(db, 'expenses', form.id.value), payload);
    showMsg(els.expenseMsg, 'Gasto editado correctamente.', 'success');
  } else {
    await addDoc(collection(db, 'expenses'), { ...payload, createdAt: serverTimestamp() });
    showMsg(els.expenseMsg, 'Gasto guardado correctamente.', 'success');
  }
  resetExpenseForm();
});

window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  deferredPrompt = e;
  els.installBtn.classList.remove('hidden');
});

els.installBtn.addEventListener('click', async () => {
  if (!deferredPrompt) return;
  deferredPrompt.prompt();
  await deferredPrompt.userChoice;
  deferredPrompt = null;
  els.installBtn.classList.add('hidden');
});

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => navigator.serviceWorker.register('./sw.js').catch(console.error));
}

function init() {
  els.openCajaForm.date.value = todayISO();
  els.closeCajaForm.date.value = todayISO();
  resetSaleForm();
  resetExpenseForm();
  enhanceMoneyInputs(document);
  initAuth();
}

init();
